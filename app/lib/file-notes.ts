import { useMemo, useSyncExternalStore } from 'react';

/** A browser-side action is deliberately separate from the server's durable queue status. */
export type StatutNoteFile = 'pending' | 'sending' | 'queued' | 'confirmed' | 'rejected';

export type FileNoteItem = {
  id: string;
  accountId: string;
  passageId: string;
  note: number;
  /** Monotonic per passage in this local outbox: UI must prefer the greatest value. */
  sequence: number;
  /** Set before the first RPC. Its id and payload must never be repurposed after this point. */
  attempted: boolean;
  statut: StatutNoteFile;
  createdAt: number;
  updatedAt: number;
  /** Number of transient failures. It is only used to space attempts, never to discard a vote. */
  essais: number;
  prochaineTentativeAt: number;
  motif?: string;
  /** Optimistic-concurrency version in the local store. */
  revision: number;
};

export type FileNotesSnapshot = {
  items: readonly FileNoteItem[];
  loading: boolean;
  storageError: string | null;
  isOnline: boolean;
};

export type ReponseSoumission =
  | { type: 'queued'; pollAfterMs?: number }
  | { type: 'confirmed' }
  | { type: 'rejected'; motif: string }
  | { type: 'retry'; motif?: string; retryAfterMs?: number };

export type ReponseSuivi = Record<string, Exclude<ReponseSoumission, { type: 'retry' }>>;

/**
 * The transport owns authentication. It must obtain the current Supabase session for every call;
 * it must not retain an access token in this outbox.
 */
export interface FileNotesTransport {
  submit(item: FileNoteItem, signal: AbortSignal): Promise<ReponseSoumission>;
  poll(ids: readonly string[], accountId: string, signal: AbortSignal): Promise<ReponseSuivi>;
}

/** Injectable persistence makes the queue testable without a DOM or fake IndexedDB. */
export interface FileNotesStore {
  list(accountId: string): Promise<FileNoteItem[]>;
  /** Reads the current passage head and consolidates or creates it in one storage transaction. */
  createOrConsolidate?(item: FileNoteItem): Promise<FileNoteItem | null>;
  /** Atomically assigns the next passage sequence and persists a brand-new action. */
  create?(item: FileNoteItem): Promise<FileNoteItem | null>;
  /** expectedRevision null creates an action; a number prevents a stale tab from overwriting it. */
  write(item: FileNoteItem, expectedRevision: number | null): Promise<FileNoteItem | null>;
  remove(ids: readonly string[]): Promise<void>;
  acquireLease?(accountId: string, owner: string, now: number, durationMs: number): Promise<boolean>;
  releaseLease?(accountId: string, owner: string): Promise<void>;
  subscribe?(listener: () => void): () => void;
}

export type FileNotesEnvironment = {
  now(): number;
  random(): number;
  isOnline(): boolean;
  setTimer(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimer(handle: ReturnType<typeof setTimeout>): void;
  newId(): string;
  onOnline?(listener: () => void): () => void;
};

export type FileNotesOutboxOptions = {
  accountId: string;
  store: FileNotesStore;
  transport: FileNotesTransport;
  environment?: Partial<FileNotesEnvironment>;
};

const MAX_ACTIONS = 200;
const RETENTION_CONFIRMED_MS = 7 * 24 * 60 * 60 * 1000;
const RETENTION_REJECTED_MS = 30 * 24 * 60 * 60 * 1000;
const LEASE_MS = 20_000;
const TIMEOUT_MS = 10_000;
const IDLE_POLL_MS = 15_000;
const POLL_MIN_MS = 10_000;
const POLL_SPREAD_MS = 5_000;
// setTimeout uses a signed 32-bit delay in browsers. A server Retry-After remains a lower bound
// until this platform limit, instead of being silently shortened to our normal five-minute backoff.
const MAX_TIMER_MS = 2_147_000_000;

function browserEnvironment(): FileNotesEnvironment {
  return {
    now: () => Date.now(),
    random: () => Math.random(),
    isOnline: () => typeof navigator === 'undefined' || navigator.onLine,
    setTimer: (callback, delay) => setTimeout(callback, delay),
    clearTimer: (handle) => clearTimeout(handle),
    newId: creerId,
    onOnline:
      typeof window === 'undefined'
        ? undefined
        : (listener) => {
            window.addEventListener('online', listener);
            return () => window.removeEventListener('online', listener);
          },
  };
}

function creerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback for older webviews. The server still verifies idempotency against the complete payload.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (letter) => {
    const n = Math.floor(Math.random() * 16);
    return (letter === 'x' ? n : (n & 0x3) | 0x8).toString(16);
  });
}

function retryDelay(essais: number, random: number, retryAfterMs?: number): number {
  // Retry-After is a lower bound. Add only positive jitter so simultaneous clients do not burst again.
  if (typeof retryAfterMs === 'number' && retryAfterMs >= 0) return Math.min(MAX_TIMER_MS, retryAfterMs + Math.round(random * Math.min(5_000, retryAfterMs * 0.2)));
  const base = Math.min(5 * 60_000, 1_000 * 2 ** Math.min(essais, 8));
  return Math.round(base * (0.8 + random * 0.4));
}

function pollDelay(essais: number, random: number, requested?: number): number {
  if (typeof requested === 'number' && requested >= 0) {
    const lowerBound = Math.max(POLL_MIN_MS, requested);
    return Math.min(MAX_TIMER_MS, lowerBound + Math.round(random * Math.min(POLL_SPREAD_MS, lowerBound * 0.2)));
  }
  const ranges = essais === 0 ? [500, 1_000] : essais === 1 ? [2_000, 3_000] : essais === 2 ? [4_000, 6_000] : essais === 3 ? [8_000, 12_000] : [POLL_MIN_MS, POLL_MIN_MS + POLL_SPREAD_MS];
  return ranges[0] + Math.round(random * (ranges[1] - ranges[0]));
}

function messageErreur(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Connexion impossible. Nouvelle tentative prévue.';
}

function estTerminal(item: FileNoteItem): boolean {
  return item.statut === 'confirmed' || item.statut === 'rejected';
}

/** Oldest first for transmission. Sequence wins within a passage, then stable timestamps/ids break cross-tab ties. */
function comparerChronologique(a: FileNoteItem, b: FileNoteItem): number {
  if (a.passageId === b.passageId && a.sequence !== b.sequence) return a.sequence - b.sequence;
  return a.createdAt - b.createdAt || a.sequence - b.sequence || a.id.localeCompare(b.id);
}

/** Durable, sequential outbox. A single instance is scoped to exactly one authenticated account. */
export class FileNotesOutbox {
  private readonly accountId: string;
  private readonly store: FileNotesStore;
  private readonly transport: FileNotesTransport;
  private readonly env: FileNotesEnvironment;
  private readonly owner: string;
  private items: FileNoteItem[] = [];
  private snapshot: FileNotesSnapshot;
  private listeners = new Set<() => void>();
  private started = false;
  private processing = false;
  private processingPromise: Promise<void> | null = null;
  private nextLeaseAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private abort: AbortController | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private unsubscribeOnline: (() => void) | null = null;

  constructor(options: FileNotesOutboxOptions) {
    this.accountId = options.accountId;
    this.store = options.store;
    this.transport = options.transport;
    this.env = { ...browserEnvironment(), ...options.environment };
    this.owner = this.env.newId();
    this.snapshot = { items: [], loading: true, storageError: null, isOnline: this.env.isOnline() };
  }

  getSnapshot = (): FileNotesSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    void this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.unsubscribeStore = this.store.subscribe?.(() => void this.reload()) ?? null;
    this.unsubscribeOnline = this.env.onOnline?.(() => void this.flush()) ?? null;
    await this.reload();
    if (!this.snapshot.storageError) {
      try { await this.cleanup(); } catch { /* L'erreur de stockage est déjà publiée. */ }
    }
    this.plan();
  }

  stop(): void {
    this.started = false;
    this.abort?.abort();
    this.abort = null;
    if (this.timer !== null) this.env.clearTimer(this.timer);
    this.timer = null;
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.unsubscribeOnline?.();
    this.unsubscribeOnline = null;
  }

  /**
   * Persists before changing the optimistic view. A quota/private-mode failure rejects this call so
   * a caller never claims a vote was saved when it was only in memory.
   */
  async enqueue(passageId: string, note: number): Promise<FileNoteItem> {
    if (!passageId) throw new TypeError('Le passage est requis.');
    if (!Number.isInteger(note) || note < 1 || note > 10) throw new TypeError('La note doit être un entier de 1 à 10.');
    await this.start();
    const now = this.env.now();
    await this.cleanup();
    const item: FileNoteItem = {
      id: this.env.newId(), accountId: this.accountId, passageId, note,
      sequence: 0,
      statut: 'pending', attempted: false,
      createdAt: now, updatedAt: now, essais: 0, prochaineTentativeAt: now, revision: 0,
    };
    const saved = await this.createOrConsolidate(item);
    if (!saved) throw new Error('Impossible d’enregistrer cette note sur cet appareil.');
    void this.flush();
    return saved;
  }

  async retryRejected(id: string): Promise<void> {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item || item.statut !== 'rejected') return;
    const now = this.env.now();
    const replacement: FileNoteItem = {
      ...item, id: this.env.newId(), sequence: 0,
      statut: 'pending', attempted: false, essais: 0, motif: undefined, createdAt: now, updatedAt: now, prochaineTentativeAt: now, revision: 0,
    };
    const saved = await this.create(replacement);
    if (!saved) throw new Error('La note a été modifiée dans un autre onglet. Réessayez.');
    void this.flush();
  }

  /** Useful after a focus/network event and for deterministic tests. Never runs two network calls at once. */
  flush(): Promise<void> {
    if (!this.started || this.processing || !this.env.isOnline()) {
      this.publish({ isOnline: this.env.isOnline() });
      if (this.started && !this.processing) this.plan();
      // A correction can arrive while another tab's version is being read.  Waiting and doing one
      // more pass makes an explicit caller observe the current action, instead of a stale no-op.
      return this.processingPromise ? this.processingPromise.then(() => this.flush()) : Promise.resolve();
    }
    this.processing = true;
    const run = (async () => {
      try {
        const leased = await this.store.acquireLease?.(this.accountId, this.owner, this.env.now(), LEASE_MS);
        if (leased === false) { this.nextLeaseAt = this.env.now() + 500; return; }
        this.nextLeaseAt = 0;
        await this.reload(false);
        // A session/account change can unmount and stop this outbox while IndexedDB is being read.
        if (!this.started) return;
        await this.processOne();
      } catch (error) {
        this.setStorageError(messageErreur(error));
      } finally {
        try { await this.store.releaseLease?.(this.accountId, this.owner); } catch { /* a later lease expiry is safe */ }
        this.processing = false;
        this.processingPromise = null;
        this.plan();
      }
    })();
    this.processingPromise = run;
    return run;
  }

  private async processOne(): Promise<void> {
    const now = this.env.now();
    const queued = this.items.filter((item) => item.statut === 'queued' && item.prochaineTentativeAt <= now).slice(0, 100);
    if (queued.length > 0) {
      await this.poll(queued);
      return;
    }
    const expiredSending = this.items.find((item) => item.statut === 'sending' && item.updatedAt + LEASE_MS <= now);
    if (expiredSending) {
      await this.persist({ ...expiredSending, statut: 'pending', updatedAt: now, prochaineTentativeAt: now });
      return;
    }
    const candidate = this.items
      .filter((item) => item.statut === 'pending' && item.prochaineTentativeAt <= now)
      .sort(comparerChronologique)
      .find((item) => !this.items.some((older) => older.passageId === item.passageId && comparerChronologique(older, item) < 0 && !estTerminal(older)));
    if (!candidate) return;
    // This write is the commit point for idempotency: a timeout can only retry this exact id+payload.
    const sending = await this.persist({ ...candidate, statut: 'sending', attempted: true, updatedAt: now });
    if (!sending) return;
    try {
      const result = await this.withTimeout((signal) => this.transport.submit(sending, signal));
      await this.applySubmission(sending, result);
    } catch (error) {
      // The server may have accepted the request just before the timeout; retrying its immutable id
      // is safe and lets the idempotent RPC return the original durable state.
      await this.retry(sending, messageErreur(error));
    }
  }

  private async poll(items: readonly FileNoteItem[]): Promise<void> {
    let states: ReponseSuivi;
    try {
      states = await this.withTimeout((signal) => this.transport.poll(items.map((item) => item.id), this.accountId, signal));
    } catch (error) {
      const retryAfterMs = error && typeof error === 'object' && 'retryAfterMs' in error && typeof error.retryAfterMs === 'number' ? error.retryAfterMs : undefined;
      await Promise.all(items.map((item) => this.retry(item, messageErreur(error), retryAfterMs)));
      return;
    }
    await Promise.all(items.map(async (item) => {
      const state = states[item.id];
      if (!state) return this.retry(item, 'Suivi indisponible. Nouvelle vérification prévue.');
      if (state.type === 'confirmed') return this.persist({ ...item, statut: 'confirmed', motif: undefined, updatedAt: this.env.now() });
      if (state.type === 'rejected') return this.persist({ ...item, statut: 'rejected', motif: state.motif, updatedAt: this.env.now() });
      if (state.type === 'queued') {
        const essais = item.essais + 1;
        return this.persist({ ...item, statut: 'queued', essais, motif: undefined, updatedAt: this.env.now(), prochaineTentativeAt: this.env.now() + pollDelay(essais, this.env.random(), state.pollAfterMs) });
      }
    }));
  }

  private async applySubmission(item: FileNoteItem, result: ReponseSoumission): Promise<void> {
    const now = this.env.now();
    if (result.type === 'confirmed') {
      await this.persist({ ...item, statut: 'confirmed', motif: undefined, updatedAt: now });
    } else if (result.type === 'queued') {
      await this.persist({ ...item, statut: 'queued', essais: 0, motif: undefined, updatedAt: now, prochaineTentativeAt: now + pollDelay(0, this.env.random(), result.pollAfterMs) });
    } else if (result.type === 'rejected') {
      await this.persist({ ...item, statut: 'rejected', motif: result.motif, updatedAt: now });
    } else {
      await this.retry(item, result.motif, result.retryAfterMs);
    }
  }

  private async retry(item: FileNoteItem, motif?: string, retryAfterMs?: number): Promise<void> {
    const essais = item.essais + 1;
    const now = this.env.now();
    await this.persist({
      ...item, statut: item.statut === 'queued' ? 'queued' : 'pending', essais, motif,
      updatedAt: now,
      prochaineTentativeAt: now + (item.statut === 'queued'
        ? pollDelay(essais, this.env.random(), retryAfterMs)
        : retryDelay(essais, this.env.random(), retryAfterMs)),
    });
  }

  private async withTimeout<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.abort = controller;
    const timeout = this.env.setTimer(() => controller.abort(new DOMException('Délai dépassé', 'TimeoutError')), TIMEOUT_MS);
    try {
      const aborted = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason ?? new DOMException('Annulé', 'AbortError')), { once: true });
      });
      return await Promise.race([work(controller.signal), aborted]);
    } finally {
      this.env.clearTimer(timeout);
      if (this.abort === controller) this.abort = null;
    }
  }

  private async reload(plan = true): Promise<void> {
    if (!this.started) return;
    try {
      this.items = (await this.store.list(this.accountId)).sort((a, b) => b.updatedAt - a.updatedAt);
      this.publish({ loading: false, storageError: null });
      if (plan) this.plan();
    } catch (error) {
      this.publish({ loading: false, storageError: messageErreur(error) });
    }
  }

  private async persist(item: FileNoteItem, expectedRevision: number | null = item.revision): Promise<FileNoteItem | null> {
    try {
      const saved = await this.store.write(item, expectedRevision);
      if (!saved) {
        await this.reload(false);
        return null;
      }
      this.items = [saved, ...this.items.filter((candidate) => candidate.id !== saved.id)].sort((a, b) => b.updatedAt - a.updatedAt);
      this.publish({ storageError: null });
      return saved;
    } catch (error) {
      this.setStorageError(messageErreur(error));
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    const now = this.env.now();
    const obsolete = this.items.filter((item) =>
      (item.statut === 'confirmed' && item.updatedAt < now - RETENTION_CONFIRMED_MS) ||
      (item.statut === 'rejected' && item.updatedAt < now - RETENTION_REJECTED_MS),
    );
    const terminals = this.items.filter(estTerminal).sort((a, b) => a.updatedAt - b.updatedAt);
    const excess = Math.max(0, this.items.length - MAX_ACTIONS + 1);
    const ids = new Set([...obsolete, ...terminals.slice(0, excess)].map((item) => item.id));
    if (ids.size === 0) return;
    try {
      await this.store.remove([...ids]);
      this.items = this.items.filter((item) => !ids.has(item.id));
      this.publish({ storageError: null });
    } catch (error) {
      this.setStorageError(messageErreur(error));
      throw error;
    }
  }

  private async create(item: FileNoteItem): Promise<FileNoteItem | null> {
    try {
      if (this.store.create) {
        const saved = await this.store.create(item);
        if (!saved) { await this.reload(false); return null; }
        this.items = [saved, ...this.items.filter((candidate) => candidate.id !== saved.id)].sort((a, b) => b.updatedAt - a.updatedAt);
        this.publish({ storageError: null });
        return saved;
      }
      const sequence = Math.max(0, ...this.items.filter((candidate) => candidate.passageId === item.passageId).map((candidate) => candidate.sequence || 0)) + 1;
      return this.persist({ ...item, sequence }, null);
    } catch (error) {
      this.setStorageError(messageErreur(error));
      throw error;
    }
  }

  private async createOrConsolidate(item: FileNoteItem): Promise<FileNoteItem | null> {
    try {
      if (this.store.createOrConsolidate) {
        const saved = await this.store.createOrConsolidate(item);
        if (!saved) { await this.reload(false); return null; }
        this.items = [saved, ...this.items.filter((candidate) => candidate.id !== saved.id)].sort((a, b) => b.updatedAt - a.updatedAt);
        this.publish({ storageError: null });
        return saved;
      }
      // Compatibility for injected stores: the optimistic revision still prevents overwriting the
      // same row, while browser persistence supplies the cross-tab atomic primitive above.
      const previous = this.items.find((candidate) => candidate.passageId === item.passageId && candidate.statut === 'pending' && !candidate.attempted);
      if (previous) return this.persist({ ...previous, note: item.note, updatedAt: item.updatedAt, prochaineTentativeAt: item.prochaineTentativeAt, motif: undefined });
      return this.create(item);
    } catch (error) {
      this.setStorageError(messageErreur(error));
      throw error;
    }
  }

  private plan(): void {
    if (!this.started || this.processing) return;
    if (this.timer !== null) this.env.clearTimer(this.timer);
    const now = this.env.now();
    if (this.snapshot.storageError) {
      this.timer = this.env.setTimer(() => { this.timer = null; void this.flush(); }, IDLE_POLL_MS);
      return;
    }
    if (!this.env.isOnline()) {
      this.timer = this.env.setTimer(() => { this.timer = null; void this.flush(); }, IDLE_POLL_MS);
      return;
    }
    if (this.nextLeaseAt > now) {
      this.timer = this.env.setTimer(() => { this.timer = null; void this.flush(); }, this.nextLeaseAt - now);
      return;
    }
    const due = this.items.filter((item) =>
      item.statut === 'queued' ||
      (item.statut === 'pending' && !this.items.some((older) => older.passageId === item.passageId && comparerChronologique(older, item) < 0 && !estTerminal(older))),
    )
      .reduce((earliest, item) => Math.min(earliest, item.prochaineTentativeAt), Number.POSITIVE_INFINITY);
    const sendingLease = this.items.filter((item) => item.statut === 'sending').reduce((earliest, item) => Math.min(earliest, item.updatedAt + LEASE_MS), Number.POSITIVE_INFINITY);
    const earliest = Math.min(due, sendingLease);
    const delay = Number.isFinite(earliest) ? Math.max(0, earliest - now) : IDLE_POLL_MS;
    this.timer = this.env.setTimer(() => { this.timer = null; void this.flush(); }, delay);
  }

  private publish(change: Partial<FileNotesSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...change, items: [...this.items], isOnline: this.env.isOnline() };
    for (const listener of this.listeners) listener();
  }

  private setStorageError(storageError: string): void {
    this.publish({ loading: false, storageError });
  }
}

/** A small store useful for unit tests and for integrations that provide their own persistence. */
export class MemoryFileNotesStore implements FileNotesStore {
  private records = new Map<string, FileNoteItem>();
  private leases = new Map<string, { owner: string; until: number }>();
  private listeners = new Set<() => void>();
  async list(accountId: string): Promise<FileNoteItem[]> { return [...this.records.values()].filter((item) => item.accountId === accountId); }
  async write(item: FileNoteItem, expectedRevision: number | null): Promise<FileNoteItem | null> {
    const existing = this.records.get(item.id);
    if ((expectedRevision === null && existing) || (expectedRevision !== null && existing?.revision !== expectedRevision)) return null;
    if (expectedRevision === null && [...this.records.values()].filter((candidate) => candidate.accountId === item.accountId).length >= MAX_ACTIONS) {
      throw new Error('Trop de notes sont en attente sur cet appareil. Attendez leur synchronisation avant de continuer.');
    }
    const saved = { ...item, revision: (existing?.revision ?? 0) + 1 };
    this.records.set(saved.id, saved); this.emit(); return saved;
  }
  async remove(ids: readonly string[]): Promise<void> { ids.forEach((id) => this.records.delete(id)); this.emit(); }
  async create(item: FileNoteItem): Promise<FileNoteItem | null> {
    if (this.records.has(item.id)) return null;
    if ([...this.records.values()].filter((candidate) => candidate.accountId === item.accountId).length >= MAX_ACTIONS) {
      throw new Error('Trop de notes sont en attente sur cet appareil. Attendez leur synchronisation avant de continuer.');
    }
    const sequence = Math.max(0, ...[...this.records.values()].filter((candidate) => candidate.accountId === item.accountId && candidate.passageId === item.passageId).map((candidate) => candidate.sequence || 0)) + 1;
    const saved = { ...item, sequence, revision: 1 };
    this.records.set(saved.id, saved); this.emit(); return saved;
  }
  async createOrConsolidate(item: FileNoteItem): Promise<FileNoteItem | null> {
    if (this.records.has(item.id)) return null;
    const accountItems = [...this.records.values()].filter((candidate) => candidate.accountId === item.accountId);
    const passageItems = accountItems.filter((candidate) => candidate.passageId === item.passageId);
    const latest = passageItems.sort(comparerChronologique).at(-1);
    if (latest?.statut === 'pending' && !latest.attempted) {
      const saved = {
        ...latest, note: item.note, updatedAt: item.updatedAt,
        prochaineTentativeAt: item.prochaineTentativeAt, motif: undefined,
        revision: latest.revision + 1,
      };
      this.records.set(saved.id, saved); this.emit(); return saved;
    }
    if (accountItems.length >= MAX_ACTIONS) {
      throw new Error('Trop de notes sont en attente sur cet appareil. Attendez leur synchronisation avant de continuer.');
    }
    const sequence = Math.max(0, ...passageItems.map((candidate) => candidate.sequence || 0)) + 1;
    const saved = { ...item, sequence, revision: 1 };
    this.records.set(saved.id, saved); this.emit(); return saved;
  }
  async acquireLease(accountId: string, owner: string, now: number, durationMs: number): Promise<boolean> {
    const lease = this.leases.get(accountId);
    if (lease && lease.owner !== owner && lease.until > now) return false;
    this.leases.set(accountId, { owner, until: now + durationMs }); return true;
  }
  async releaseLease(accountId: string, owner: string): Promise<void> { if (this.leases.get(accountId)?.owner === owner) this.leases.delete(accountId); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(): void { for (const listener of this.listeners) listener(); }
}

type Config = { store: FileNotesStore; transport: FileNotesTransport };
let config: Config | null = null;
const outboxes = new Map<string, FileNotesOutbox>();

/** Set once by the browser bootstrap. Tests may set an in-memory store and scripted transport. */
export function configurerFileNotes(next: Config): void {
  for (const outbox of outboxes.values()) outbox.stop();
  config = next;
  outboxes.clear();
}

export function obtenirFileNotes(accountId: string): FileNotesOutbox {
  if (!config) throw new Error('La synchronisation des notes n’est pas configurée.');
  let outbox = outboxes.get(accountId);
  if (!outbox) { outbox = new FileNotesOutbox({ accountId, ...config }); outboxes.set(accountId, outbox); }
  return outbox;
}

const VIDE: FileNotesSnapshot = { items: [], loading: false, storageError: null, isOnline: true };

export type UseFileNotes = FileNotesSnapshot & {
  enqueue(passageId: string, note: number): Promise<FileNoteItem>;
  retryRejected(id: string): Promise<void>;
};

/** React facade used by the root synchronizer and the notation route; both share one account outbox. */
export function useFileNotes(accountId: string | null): UseFileNotes {
  const outbox = useMemo(() => accountId && config ? obtenirFileNotes(accountId) : null, [accountId]);
  const snapshot = useSyncExternalStore(outbox ? outbox.subscribe : () => () => {}, outbox ? outbox.getSnapshot : () => VIDE, () => VIDE);
  return {
    ...snapshot,
    enqueue: async (passageId, note) => {
      if (!outbox) throw new Error('Connectez-vous pour enregistrer une note.');
      return outbox.enqueue(passageId, note);
    },
    retryRejected: async (id) => { await outbox?.retryRejected(id); },
  };
}

/** Mount this once in the application root so queued notes resume after navigation. */
export function SynchronisationNotes({ accountId }: { accountId: string | null }) {
  useFileNotes(accountId);
  return null;
}
