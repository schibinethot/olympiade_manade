import { describe, expect, it } from 'vitest';
import {
  FileNotesOutbox,
  MemoryFileNotesStore,
  type FileNotesEnvironment,
  type FileNotesStore,
  type FileNotesTransport,
} from '../../app/lib/file-notes';

function environnement(now = 1_000): FileNotesEnvironment & { advance(ms: number): void } {
  let clock = now;
  let serial = 0;
  return {
    now: () => clock,
    random: () => 0.5,
    isOnline: () => true,
    setTimer: () => 0 as unknown as ReturnType<typeof setTimeout>,
    clearTimer: () => undefined,
    newId: () => `00000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`,
    advance: (ms) => { clock += ms; },
  };
}

function transport(script: Partial<FileNotesTransport> = {}): FileNotesTransport {
  return {
    submit: async () => ({ type: 'confirmed' }),
    poll: async () => ({}),
    ...script,
  };
}

function outbox(store: FileNotesStore = new MemoryFileNotesStore(), overrides: Partial<FileNotesTransport> = {}) {
  const env = environnement();
  const queue = new FileNotesOutbox({ accountId: 'user-a', store, transport: transport(overrides), environment: env });
  return { queue, env, store };
}

describe('file durable des notes publiques', () => {
  it('consolide une correction encore non envoyée, puis envoie uniquement la dernière valeur', async () => {
    const sent: { id: string; note: number }[] = [];
    const store = new MemoryFileNotesStore();
    const baseEnv = environnement();
    let online = false;
    const queue = new FileNotesOutbox({
      accountId: 'user-a', store, environment: { ...baseEnv, isOnline: () => online },
      transport: transport({ submit: async (item) => { sent.push({ id: item.id, note: item.note }); return { type: 'confirmed' }; } }),
    });
    await queue.start();
    const first = await queue.enqueue('passage-a', 4);
    const correction = await queue.enqueue('passage-a', 9);
    expect(correction.id).toBe(first.id);
    expect(queue.getSnapshot().items).toHaveLength(1);
    online = true;
    await queue.flush();
    expect(sent).toEqual([{ id: first.id, note: 9 }]);
    expect(queue.getSnapshot().items[0]).toMatchObject({ note: 9, statut: 'confirmed' });
  });

  it('ne dit pas une action enregistrée avant la confirmation durable du serveur', async () => {
    let poll = 0;
    const { queue, env } = outbox(undefined, {
      submit: async () => ({ type: 'queued' }),
      poll: async (ids) => {
        poll++;
        return { [ids[0]]: { type: 'confirmed' } };
      },
    });
    await queue.start();
    await queue.enqueue('passage-a', 7);
    await queue.flush();
    expect(queue.getSnapshot().items[0].statut).toBe('queued');
    expect(poll).toBe(0);
    await queue.flush();
    expect(poll).toBe(0);
    env.advance(1_000);
    await queue.flush();
    expect(poll).toBe(1);
    expect(queue.getSnapshot().items[0].statut).toBe('confirmed');
  });

  it('ne laisse pas une ancienne correction en attente écraser une nouvelle', async () => {
    const events: string[] = [];
    let polls = 0;
    const { queue, env } = outbox(undefined, {
      submit: async (item) => { events.push(`submit:${item.note}`); return { type: 'queued' }; },
      poll: async (ids) => {
        events.push('poll');
        polls++;
        return { [ids[0]]: { type: 'confirmed' } };
      },
    });
    await queue.start();
    await queue.enqueue('passage-a', 3);
    await queue.flush();
    await queue.enqueue('passage-a', 8);
    env.advance(1_000);
    await queue.flush();
    expect(polls).toBe(1);
    expect(events).toEqual(['submit:3', 'poll', 'submit:8']);
  });

  it('réessaie une panne avec le même identifiant et un délai exponentiel, sans bloquer les autres notes', async () => {
    const ids: string[] = [];
    let attempts = 0;
    const { queue, env } = outbox(undefined, {
      submit: async (item) => {
        ids.push(item.id); attempts++;
        if (item.passageId === 'passage-a' && attempts === 1) return { type: 'retry', motif: '429', retryAfterMs: 2_000 };
        return { type: 'confirmed' };
      },
    });
    await queue.start();
    const first = await queue.enqueue('passage-a', 6);
    await queue.enqueue('passage-b', 5);
    await queue.flush();
    expect(queue.getSnapshot().items.find((item) => item.id === first.id)).toMatchObject({ statut: 'pending', essais: 1, prochaineTentativeAt: 3_200 });
    await queue.flush();
    expect(queue.getSnapshot().items.find((item) => item.passageId === 'passage-b')?.statut).toBe('confirmed');
    env.advance(2_200);
    await queue.flush();
    expect(ids.filter((id) => id === first.id)).toHaveLength(2);
    expect(queue.getSnapshot().items.find((item) => item.id === first.id)?.statut).toBe('confirmed');
  });

  it('ne réutilise jamais un UUID dont la réponse a pu être perdue pour une correction ultérieure', async () => {
    const sent: { id: string; note: number }[] = [];
    const { queue, env } = outbox(undefined, {
      submit: async (item) => { sent.push({ id: item.id, note: item.note }); return { type: 'retry', motif: 'réponse perdue', retryAfterMs: 1_000 }; },
    });
    await queue.start();
    const first = await queue.enqueue('passage-a', 2);
    await queue.flush();
    const correction = await queue.enqueue('passage-a', 9);
    expect(correction.id).not.toBe(first.id);
    expect(correction.sequence).toBeGreaterThan(first.sequence);
    env.advance(1_100);
    await queue.flush();
    expect(sent.filter((item) => item.id === first.id).map((item) => item.note)).toEqual([2, 2]);
  });

  it('garde une correction récente derrière une ancienne action en backoff, jamais admise', async () => {
    const sent: number[] = [];
    let firstAttempt = true;
    const { queue, env } = outbox(undefined, {
      submit: async (item) => {
        sent.push(item.note);
        if (item.note === 8 && firstAttempt) { firstAttempt = false; return { type: 'retry', retryAfterMs: 1_000 }; }
        return { type: 'confirmed' };
      },
    });
    await queue.start();
    await queue.enqueue('passage-a', 8);
    await queue.flush();
    await queue.enqueue('passage-a', 9);
    await queue.flush();
    expect(sent).toEqual([8]);
    env.advance(1_100);
    await queue.flush();
    await queue.flush();
    expect(sent).toEqual([8, 8, 9]);
  });

  it('reprend après expiration du bail une action restée « envoi en cours » après un rechargement', async () => {
    const store = new MemoryFileNotesStore();
    await store.write({
      id: '00000000-0000-4000-8000-000000000123', accountId: 'user-a', passageId: 'passage-a', note: 6,
      sequence: 1, attempted: true, statut: 'sending', createdAt: 1, updatedAt: 1, essais: 0, prochaineTentativeAt: 1, revision: 0,
    }, null);
    const env = environnement(25_000);
    let calls = 0;
    const queue = new FileNotesOutbox({ accountId: 'user-a', store, environment: env, transport: transport({ submit: async () => { calls++; return { type: 'confirmed' }; } }) });
    await queue.start();
    await queue.flush();
    expect(queue.getSnapshot().items[0].statut).toBe('pending');
    await queue.flush();
    expect(calls).toBe(1);
    expect(queue.getSnapshot().items[0].statut).toBe('confirmed');
  });

  it('laisse le transport intact quand un autre onglet tient le bail, puis réessaie sans boucle chaude', async () => {
    let delay = -1;
    const env = { ...environnement(), setTimer: (_callback: () => void, ms: number) => { delay = ms; return 0 as unknown as ReturnType<typeof setTimeout>; } };
    const store: FileNotesStore = {
      list: async () => [{ id: 'one', accountId: 'user-a', passageId: 'passage-a', note: 1, sequence: 1, attempted: false, statut: 'pending' as const, createdAt: 1, updatedAt: 1, essais: 0, prochaineTentativeAt: 1, revision: 1 }],
      write: async () => null, remove: async () => undefined, acquireLease: async () => false,
    };
    const queue = new FileNotesOutbox({ accountId: 'user-a', store, environment: env, transport: transport({ submit: async () => { throw new Error('ne doit pas être appelée'); } }) });
    await queue.start(); await queue.flush();
    expect(delay).toBe(500);
  });

  it('montre un rejet métier définitif sans empêcher les actions suivantes', async () => {
    const { queue } = outbox(undefined, {
      submit: async (item) => item.passageId === 'ferme'
        ? { type: 'rejected', motif: 'vote_ferme' }
        : { type: 'confirmed' },
    });
    await queue.start();
    await queue.enqueue('ferme', 5);
    await queue.enqueue('ouvert', 8);
    await queue.flush();
    await queue.flush();
    expect(queue.getSnapshot().items.find((item) => item.passageId === 'ferme')).toMatchObject({ statut: 'rejected', motif: 'vote_ferme' });
    expect(queue.getSnapshot().items.find((item) => item.passageId === 'ouvert')?.statut).toBe('confirmed');
  });

  it('crée un nouvel identifiant idempotent quand une action rejetée est relancée', async () => {
    const { queue } = outbox(undefined, { submit: async () => ({ type: 'rejected', motif: 'vote_ferme' }) });
    await queue.start();
    const rejected = await queue.enqueue('passage-a', 5);
    await queue.flush();
    await queue.retryRejected(rejected.id);
    const replacement = queue.getSnapshot().items.find((item) => item.statut === 'pending');
    expect(replacement).toMatchObject({ passageId: 'passage-a', note: 5, attempted: false });
    expect(replacement?.id).not.toBe(rejected.id);
  });

  it('isole strictement les files de deux comptes qui partagent le même stockage', async () => {
    const store = new MemoryFileNotesStore();
    const env = environnement();
    const make = (accountId: string) => new FileNotesOutbox({ accountId, store, transport: transport(), environment: env });
    const alice = make('alice'); const bob = make('bob');
    await alice.start(); await bob.start();
    await alice.enqueue('passage-a', 2); await bob.enqueue('passage-a', 10);
    expect(alice.getSnapshot().items).toHaveLength(1);
    expect(alice.getSnapshot().items[0].accountId).toBe('alice');
    expect(bob.getSnapshot().items).toHaveLength(1);
    expect(bob.getSnapshot().items[0].accountId).toBe('bob');
  });

  it('consolide atomiquement la dernière correction malgré deux vues obsolètes sans BroadcastChannel', async () => {
    const durable = new MemoryFileNotesStore();
    const store: FileNotesStore = {
      list: durable.list.bind(durable),
      write: durable.write.bind(durable),
      remove: durable.remove.bind(durable),
      create: durable.create.bind(durable),
      createOrConsolidate: durable.createOrConsolidate.bind(durable),
      acquireLease: durable.acquireLease.bind(durable),
      releaseLease: durable.releaseLease.bind(durable),
      // Pas de subscribe : chaque outbox conserve volontairement une vue locale obsolète.
    };
    const env = { ...environnement(), isOnline: () => false };
    const first = new FileNotesOutbox({ accountId: 'same-user', store, environment: env, transport: transport() });
    const second = new FileNotesOutbox({ accountId: 'same-user', store, environment: env, transport: transport() });
    await first.start(); await second.start();
    const a = await first.enqueue('passage-a', 3);
    const b = await second.enqueue('passage-a', 8);
    expect(b.id).toBe(a.id);
    expect(first.getSnapshot().items[0].note).toBe(3);

    const lastClick = await first.enqueue('passage-a', 9);
    expect(lastClick.id).toBe(a.id);
    await expect(durable.list('same-user')).resolves.toMatchObject([{ id: a.id, note: 9, sequence: 1, attempted: false }]);
  });

  it('respecte un Retry-After supérieur à cinq minutes pour une soumission et un suivi', async () => {
    const { queue } = outbox(undefined, {
      submit: async () => ({ type: 'retry', retryAfterMs: 600_000 }),
    });
    await queue.start();
    const item = await queue.enqueue('passage-a', 6);
    await queue.flush();
    expect(queue.getSnapshot().items.find((candidate) => candidate.id === item.id)?.prochaineTentativeAt).toBe(603_500);

    const queuedStore = new MemoryFileNotesStore();
    await queuedStore.write({
      ...item, id: '00000000-0000-4000-8000-000000000999', statut: 'queued', attempted: true,
      updatedAt: 1_000, prochaineTentativeAt: 1_000, revision: 0,
    }, null);
    const suiviEnv = environnement();
    const suivi = new FileNotesOutbox({
      accountId: 'user-a', store: queuedStore, environment: suiviEnv,
      transport: transport({ poll: async () => { throw Object.assign(new Error('429'), { retryAfterMs: 600_000 }); } }),
    });
    await suivi.start(); await suivi.flush();
    expect(suivi.getSnapshot().items[0].prochaineTentativeAt).toBe(603_500);
  });

  it('refuse l’optimisme si IndexedDB/quota ne confirme pas la persistance', async () => {
    const unavailable: FileNotesStore = {
      list: async () => [],
      write: async () => { throw new Error('Quota dépassé'); },
      remove: async () => undefined,
    };
    const { queue } = outbox(unavailable);
    await queue.start();
    await expect(queue.enqueue('passage-a', 4)).rejects.toThrow('Quota dépassé');
    expect(queue.getSnapshot().items).toHaveLength(0);
    expect(queue.getSnapshot().storageError).toContain('Quota dépassé');
  });
});
