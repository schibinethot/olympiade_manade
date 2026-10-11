export type MesureMinute = {
  minute: string;
  requests: number;
  errors5xx: number;
  responseBytes: number;
  cpuMs: number;
  rssBytes: number;
  eventLoopLagMs: number;
  inflightMax: number;
  httpConnectionsMax: number;
  instances: number;
  p95Ms: number | null;
  authenticatedActiveUsers?: number | null;
};

export type Supervision = {
  generatedAt: string;
  windowHours: number;
  sources: { serverPersistence: 'available' | 'unconfigured' | 'error'; databaseStatus: 'available' | 'error'; supabaseBandwidth: 'unknown' };
  activeUsers: { authenticatedLast2m: number | null; profilesTotal: number | null; lastHeartbeatAt: string | null };
  votes: { public: Notes; jury: Notes };
  database: { sizeBytes: number | null; connections: { current: number | null; max: number | null } };
  server: {
    current: { inflight: number; httpConnections: number; rssBytes: number; eventLoopLagMs: number };
    totals: { requests: number; errors5xx: number; responseBytes: number; cpuMs: number };
    latencyMs: { p95: number | null };
    history: MesureMinute[];
  };
};
type Notes = { total: number | null; modifiedLast5m: number | null; modifiedLastHour: number | null };

/** Le p95 est une borne d'histogramme ; 3001 désigne le compartiment ouvert au-delà de 3 s. */
export const latence = (ms: number | null) => ms == null ? 'Indisponible' : ms > 3000 ? '> 3 000 ms' : `≤ ${nombre(ms, 1)} ms`;

export const nombre = (valeur: number | null | undefined, decimales = 0) =>
  valeur == null || !Number.isFinite(valeur) ? 'Indisponible'
    : valeur.toLocaleString('fr-FR', { maximumFractionDigits: decimales });

export function octets(valeur: number | null | undefined): string {
  if (valeur == null || !Number.isFinite(valeur)) return 'Indisponible';
  const unites = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const index = valeur > 0 ? Math.min(4, Math.floor(Math.log(valeur) / Math.log(1000))) : 0;
  return `${nombre(valeur / 1000 ** index, 1)} ${unites[Math.max(0, index)]}`;
}

export function exporterMesures(mesures: MesureMinute[]): string {
  // Champs numériques et horodatages seulement : ni identité ni valeur fournie par un visiteur.
  const lignes = mesures.map((m) => [new Date(m.minute).toISOString(), m.requests, m.errors5xx,
    m.responseBytes, m.p95Ms ?? '', m.cpuMs, m.rssBytes, m.eventLoopLagMs,
    m.inflightMax, m.httpConnectionsMax, m.instances, m.authenticatedActiveUsers ?? ''].join(';'));
  return '\uFEFF' + ['minute_utc;requetes;erreurs_5xx;octets_reponse;p95_ms;cpu_ms;memoire_octets;retard_ms;requetes_simultanees_max;connexions_http_max;instances;comptes_actifs', ...lignes].join('\r\n');
}
