import { describe, expect, it, vi } from 'vitest';
import { creerWorkerFileNotes, fileNotesDepuisEnvironnement } from '../../serveur/file-notes.mjs';

function json(corps: unknown, statut = 200, entetes?: Record<string, string>) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json', ...entetes },
  });
}

describe('worker de la file des notes', () => {
  it('est inactif par défaut et ne fait aucun appel réseau', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const worker = creerWorkerFileNotes({ fetchFn });
    expect(worker.enabled).toBe(false);
    expect(worker.batchSize).toBe(100);
    expect(worker.demarrer()).toBe(false);
    await expect(worker.traiterUneFois()).resolves.toEqual({ active: false, prises: 0, confirmees: 0 });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(fileNotesDepuisEnvironnement({ FILE_NOTES_ACTIVE: 'false' })).toBeNull();
  });

  it('ne s’active depuis l’environnement que sur la valeur exacte true', () => {
    expect(fileNotesDepuisEnvironnement({ FILE_NOTES_ACTIVE: 'TRUE' })).toBeNull();
    expect(() => fileNotesDepuisEnvironnement({ FILE_NOTES_ACTIVE: 'true' })).toThrow(/activé sans URL Supabase/);
    const worker = fileNotesDepuisEnvironnement({
      FILE_NOTES_ACTIVE: 'true',
      VITE_SUPABASE_URL: 'https://projet.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'secret-test',
      FILE_NOTES_BATCH_SIZE: '12',
      FILE_NOTES_INTERVAL_MS: '500',
    });
    expect(worker).toMatchObject({ enabled: true, batchSize: 12 });
    worker?.arreter();
  });

  it('appelle le RPC avec la clé serveur, un lot borné et un identifiant opaque', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json({ prises: 2, confirmees: 2 }));
    const worker = creerWorkerFileNotes({
      enabled: true,
      supabaseUrl: 'https://projet.supabase.co/chemin-ignore',
      serviceRoleKey: 'secret-test',
      instanceId: 'file-1234567890abcdef12345678',
      batchSize: 2,
      fetchFn,
    });
    await expect(worker.traiterUneFois()).resolves.toEqual({ active: true, prises: 2, confirmees: 2 });
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe('https://projet.supabase.co/rest/v1/rpc/traiter_file_notes');
    expect(init?.headers).toMatchObject({ apikey: 'secret-test', Authorization: 'Bearer secret-test' });
    expect(JSON.parse(String(init?.body))).toEqual({
      p_limite: 2,
      p_instance_id: 'file-1234567890abcdef12345678',
    });
  });

  it('partage l’appel en cours entre deux déclenchements concurrents', async () => {
    let terminer!: (reponse: Response) => void;
    const fetchFn = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => { terminer = resolve; }));
    const worker = creerWorkerFileNotes({
      enabled: true,
      supabaseUrl: 'https://projet.supabase.co',
      serviceRoleKey: 'secret-test',
      fetchFn,
    });
    const premier = worker.traiterUneFois();
    const second = worker.traiterUneFois();
    expect(second).toBe(premier);
    expect(fetchFn).toHaveBeenCalledOnce();
    terminer(json({ prises: 1, confirmees: 1 }));
    await expect(premier).resolves.toMatchObject({ prises: 1, confirmees: 1 });
  });

  it('respecte l’intervalle même sur lot plein et ne raccourcit pas Retry-After', async () => {
    vi.useFakeTimers();
    try {
      const fetchPlein = vi.fn<typeof fetch>(async () => json({ prises: 100, confirmees: 100 }));
      const plein = creerWorkerFileNotes({
        enabled: true,
        supabaseUrl: 'https://projet.supabase.co',
        serviceRoleKey: 'secret-test',
        intervalMs: 250,
        fetchFn: fetchPlein,
      });
      plein.demarrer();
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchPlein).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(249);
      expect(fetchPlein).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchPlein).toHaveBeenCalledTimes(2);
      plein.arreter();

      const fetchLimite = vi.fn<typeof fetch>(async () => json({}, 429, { 'Retry-After': '2' }));
      const limite = creerWorkerFileNotes({
        enabled: true,
        supabaseUrl: 'https://projet.supabase.co',
        serviceRoleKey: 'secret-test',
        fetchFn: fetchLimite,
        randomFn: () => 0,
      });
      limite.demarrer();
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchLimite).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1999);
      expect(fetchLimite).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchLimite).toHaveBeenCalledTimes(2);
      limite.arreter();
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuse une activation incomplète et ne recopie pas le corps SQL des erreurs', async () => {
    expect(() => creerWorkerFileNotes({ enabled: true })).toThrow(/activé sans URL Supabase/);
    const fetchFn = vi.fn<typeof fetch>(async () => json({ message: 'détail SQL privé' }, 503, { 'Retry-After': '2' }));
    const worker = creerWorkerFileNotes({
      enabled: true,
      supabaseUrl: 'http://localhost:54321',
      serviceRoleKey: 'secret-test',
      fetchFn,
    });
    await expect(worker.traiterUneFois()).rejects.toThrow('HTTP 503');
    await worker.traiterUneFois().catch((erreur) => {
      expect(String(erreur)).not.toContain('détail SQL privé');
      expect(erreur.retryAfterMs).toBe(2000);
    });
  });
});
