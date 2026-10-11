import type { FileNoteItem, FileNotesStore, FileNotesTransport, ReponseSoumission, ReponseSuivi } from './file-notes';
import { configurerFileNotes } from './file-notes';
import { supabase } from './supabase';

const DB_NAME = 'olympiade-file-notes-v1';
const ITEMS = 'items';
const LEASES = 'leases';
const SEQUENCES = 'sequences';

function derniereAction(items: readonly FileNoteItem[], passageId: string): FileNoteItem | undefined {
  return items
    .filter((item) => item.passageId === passageId)
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    .at(-1);
}

/** IndexedDB implementation. All writes are transactions and are broadcast to other tabs. */
export class IndexedDbFileNotesStore implements FileNotesStore {
  private database: Promise<IDBDatabase> | null = null;
  private channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('olympiade-file-notes-v1');

  async list(accountId: string): Promise<FileNoteItem[]> {
    const db = await this.open();
    return this.request<FileNoteItem[]>(db.transaction(ITEMS).objectStore(ITEMS).index('accountId').getAll(IDBKeyRange.only(accountId)));
  }
  async write(item: FileNoteItem, expectedRevision: number | null): Promise<FileNoteItem | null> {
    const db = await this.open();
    const tx = db.transaction(ITEMS, 'readwrite'); const store = tx.objectStore(ITEMS);
    const previous = await this.request<FileNoteItem | undefined>(store.get(item.id));
    if ((expectedRevision === null && previous) || (expectedRevision !== null && previous?.revision !== expectedRevision)) { tx.abort(); return null; }
    if (expectedRevision === null && await this.request<number>(store.index('accountId').count(IDBKeyRange.only(item.accountId))) >= 200) {
      tx.abort();
      throw new Error('Trop de notes sont en attente sur cet appareil. Attendez leur synchronisation avant de continuer.');
    }
    const saved = { ...item, revision: (previous?.revision ?? 0) + 1 };
    store.put(saved); await this.done(tx); this.channel?.postMessage('change'); return saved;
  }
  async create(item: FileNoteItem): Promise<FileNoteItem | null> {
    const db = await this.open(); const key = `${item.accountId}:${item.passageId}`;
    const tx = db.transaction([ITEMS, SEQUENCES], 'readwrite'); const items = tx.objectStore(ITEMS); const sequences = tx.objectStore(SEQUENCES);
    if (await this.request<FileNoteItem | undefined>(items.get(item.id))) { tx.abort(); return null; }
    const accountItems = await this.request<FileNoteItem[]>(items.index('accountId').getAll(IDBKeyRange.only(item.accountId)));
    if (accountItems.length >= 200) {
      tx.abort(); throw new Error('Trop de notes sont en attente sur cet appareil. Attendez leur synchronisation avant de continuer.');
    }
    const previous = await this.request<{ key: string; value: number } | undefined>(sequences.get(key));
    const maximumExistant = Math.max(0, ...accountItems.filter((candidate) => candidate.passageId === item.passageId).map((candidate) => candidate.sequence || 0));
    const sequence = Math.max(previous?.value ?? 0, maximumExistant) + 1;
    sequences.put({ key, value: sequence });
    const saved = { ...item, sequence, revision: 1 };
    items.put(saved); await this.done(tx); this.channel?.postMessage('change'); return saved;
  }
  async createOrConsolidate(item: FileNoteItem): Promise<FileNoteItem | null> {
    const db = await this.open(); const key = `${item.accountId}:${item.passageId}`;
    // ITEMS is in the read/write scope so IndexedDB serializes this decision with every state
    // transition from another tab. Reading through accountId also enforces the device cap here.
    const tx = db.transaction([ITEMS, SEQUENCES], 'readwrite'); const items = tx.objectStore(ITEMS); const sequences = tx.objectStore(SEQUENCES);
    if (await this.request<FileNoteItem | undefined>(items.get(item.id))) { tx.abort(); return null; }
    const accountItems = await this.request<FileNoteItem[]>(items.index('accountId').getAll(IDBKeyRange.only(item.accountId)));
    const latest = derniereAction(accountItems, item.passageId);
    if (latest?.statut === 'pending' && !latest.attempted) {
      const saved = {
        ...latest, note: item.note, updatedAt: item.updatedAt,
        prochaineTentativeAt: item.prochaineTentativeAt, motif: undefined,
        revision: (latest.revision || 0) + 1,
      };
      items.put(saved); await this.done(tx); this.channel?.postMessage('change'); return saved;
    }
    if (accountItems.length >= 200) {
      tx.abort(); throw new Error('Trop de notes sont en attente sur cet appareil. Attendez leur synchronisation avant de continuer.');
    }
    const previous = await this.request<{ key: string; value: number } | undefined>(sequences.get(key));
    const maximumExistant = Math.max(0, ...accountItems.filter((candidate) => candidate.passageId === item.passageId).map((candidate) => candidate.sequence || 0));
    const sequence = Math.max(previous?.value ?? 0, maximumExistant) + 1;
    sequences.put({ key, value: sequence });
    const saved = { ...item, sequence, revision: 1 };
    items.put(saved); await this.done(tx); this.channel?.postMessage('change'); return saved;
  }
  async remove(ids: readonly string[]): Promise<void> {
    const db = await this.open(); const tx = db.transaction(ITEMS, 'readwrite'); const store = tx.objectStore(ITEMS);
    ids.forEach((id) => store.delete(id)); await this.done(tx); this.channel?.postMessage('change');
  }
  async acquireLease(accountId: string, owner: string, now: number, durationMs: number): Promise<boolean> {
    const db = await this.open(); const tx = db.transaction(LEASES, 'readwrite'); const store = tx.objectStore(LEASES);
    const previous = await this.request<{ accountId: string; owner: string; until: number } | undefined>(store.get(accountId));
    if (previous && previous.owner !== owner && previous.until > now) { tx.abort(); return false; }
    store.put({ accountId, owner, until: now + durationMs }); await this.done(tx); return true;
  }
  async releaseLease(accountId: string, owner: string): Promise<void> {
    const db = await this.open(); const tx = db.transaction(LEASES, 'readwrite'); const store = tx.objectStore(LEASES);
    const previous = await this.request<{ owner: string } | undefined>(store.get(accountId)); if (previous?.owner === owner) store.delete(accountId); await this.done(tx);
  }
  subscribe(listener: () => void): () => void { if (!this.channel) return () => {}; const callback = () => listener(); this.channel.addEventListener('message', callback); return () => this.channel?.removeEventListener('message', callback); }
  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Le stockage durable IndexedDB est indisponible sur cet appareil.'));
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(ITEMS)) { const items = db.createObjectStore(ITEMS, { keyPath: 'id' }); items.createIndex('accountId', 'accountId'); }
        if (!db.objectStoreNames.contains(LEASES)) db.createObjectStore(LEASES, { keyPath: 'accountId' });
        if (!db.objectStoreNames.contains(SEQUENCES)) db.createObjectStore(SEQUENCES, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error('IndexedDB indisponible'));
    });
    this.database.catch(() => { this.database = null; });
    return this.database;
  }
  private request<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  private done(transaction: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error ?? new Error('Écriture IndexedDB annulée')); transaction.onerror = () => reject(transaction.error ?? new Error('Écriture IndexedDB impossible')); }); }
}

async function sessionPour(accountId: string) {
  const client = await supabase(); const { data, error } = await client.auth.getSession();
  if (error || !data.session || data.session.user.id !== accountId) throw new Error('Session absente ou changée.');
  return data.session;
}

/** Le SDK PostgREST ne retourne pas Retry-After : ce transport conserve les en-têtes HTTP. */
async function rpc(nom: string, corps: Record<string, unknown>, accountId: string, signal: AbortSignal) {
  const session = await sessionPour(accountId);
  signal.throwIfAborted();
  const url = import.meta.env.VITE_SUPABASE_URL;
  const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !cle) throw new Error('Configuration Supabase absente.');
  const reponse = await fetch(new URL(`/rest/v1/rpc/${nom}`, url), {
    method: 'POST', headers: { apikey: cle,
      Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps), signal,
  });
  const entete = reponse.headers.get('retry-after');
  const secondes = entete === null ? NaN : Number(entete);
  const retryAfterMs = entete === null ? undefined : Number.isFinite(secondes)
    ? Math.max(0, secondes * 1000) : Math.max(0, Date.parse(entete) - Date.now());
  const data = await reponse.json().catch(() => null);
  return { reponse, data, retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined };
}

function temporaire(status: number, code?: string) {
  return status === 401 || status === 408 || status === 429 || status >= 500 ||
    ['40001', '40P01', '55P03', '57014'].includes(code ?? '');
}

/** Exact adapter for the durable SQL queue. It persists no JWT and validates the user before each RPC. */
export const transportSupabaseFileNotes: FileNotesTransport = {
  async submit(item, signal) {
    try {
      const { reponse, data, retryAfterMs } = await rpc('mettre_note_en_file', { p_request_id: item.id, p_passage_id: item.passageId, p_note: item.note }, item.accountId, signal);
      if (!reponse.ok) return temporaire(reponse.status, data?.code)
        ? { type: 'retry', retryAfterMs, motif: reponse.status === 401 ? 'Reconnectez-vous pour reprendre cet envoi.' : 'Service momentanément indisponible.' }
        : { type: 'rejected', motif: 'La note a été refusée par le serveur.' };
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) return { type: 'retry', motif: 'Réponse serveur incomplète.' };
      if (row.statut === 'confirmee') return { type: 'confirmed' };
      if (row.statut === 'rejetee') return { type: 'rejected', motif: row.motif || 'La note a été refusée.' };
      return row.statut === 'en_attente' ? { type: 'queued' } : { type: 'retry', motif: 'Réponse serveur incomplète.' };
    } catch (error) { return { type: 'retry', motif: error instanceof Error ? error.message : undefined }; }
  },
  async poll(ids, accountId, signal) {
    const { reponse, data, retryAfterMs } = await rpc('lire_statuts_file_notes', { p_request_ids: [...ids] }, accountId, signal);
    if (!reponse.ok) throw Object.assign(new Error('Suivi momentanément indisponible.'), { retryAfterMs });
    const result: ReponseSuivi = {};
    for (const row of Array.isArray(data) ? data : []) {
      if (row.statut === 'confirmee') result[row.request_id] = { type: 'confirmed' };
      if (row.statut === 'rejetee') result[row.request_id] = { type: 'rejected', motif: row.motif || 'La note a été refusée.' };
      if (row.statut === 'en_attente') result[row.request_id] = { type: 'queued' };
    }
    return result;
  },
};

/** Call once from the browser root before useFileNotes. */
export function configurerFileNotesNavigateur(): void {
  configurerFileNotes({ store: new IndexedDbFileNotesStore(), transport: transportSupabaseFileNotes });
}
