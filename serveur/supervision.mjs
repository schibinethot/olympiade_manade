// @ts-check
// Mesures agrégées du serveur et endpoint d'administration. Ce module ne conserve aucune
// identité, adresse IP, URL complète ni valeur de jeton.

import { createHash, randomUUID } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';

const BORNES_LATENCE = [10, 25, 50, 100, 250, 500, 1000, 3000];
const MINUTE_MS = 60_000;
const RETENTION_LOCALE_MINUTES = 1440;

/** @param {unknown} valeur @param {number} repli @param {number} min @param {number} max */
function entierBorne(valeur, repli, min, max) {
  const n = Number(valeur);
  return Number.isInteger(n) && n >= min && n <= max ? n : repli;
}

/** @param {string | undefined} valeur */
function urlSupabase(valeur) {
  if (!valeur) return null;
  try {
    const url = new URL(valeur);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/** Un identifiant opaque et borné : les noms Railway bruts ne sont ni persistés ni exposés.
 * @param {string | undefined} valeur
 */
function idInstance(valeur) {
  if (!valeur) return `local-${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  return `srv-${createHash('sha256').update(valeur).digest('hex').slice(0, 24)}`;
}

/** @param {number} millisecondes */
export function indexLatence(millisecondes) {
  const n = Number.isFinite(millisecondes) && millisecondes >= 0 ? millisecondes : 0;
  const i = BORNES_LATENCE.findIndex((borne) => n <= borne);
  return i === -1 ? BORNES_LATENCE.length : i;
}

/** @param {number[]} histogramme */
export function percentile95(histogramme) {
  const total = histogramme.reduce((somme, n) => somme + n, 0);
  if (total === 0) return null;
  const cible = Math.ceil(total * 0.95);
  let cumul = 0;
  for (let i = 0; i < histogramme.length; i++) {
    cumul += histogramme[i] ?? 0;
    // 3001 est une sentinelle (« strictement supérieur à 3 s »), affichée comme telle par le front.
    if (cumul >= cible) return BORNES_LATENCE[i] ?? 3001;
  }
  return 3001;
}

/** @param {number} timestamp */
function debutMinute(timestamp) {
  return Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;
}

/** @param {number} minute */
function creerEchantillon(minute) {
  return {
    minute,
    requests: 0,
    errors5xx: 0,
    responseBytes: 0,
    cpuMs: 0,
    rssBytes: process.memoryUsage().rss,
    eventLoopLagMs: 0,
    inflightMax: 0,
    httpConnectionsMax: 0,
    authenticatedActiveUsers: null,
    instances: 1,
    histogram: Array(9).fill(0),
  };
}

/** @param {import('node:http').ServerResponse} res */
function longueurReponse(res) {
  const valeur = res.getHeader('content-length');
  const n = typeof valeur === 'string' || typeof valeur === 'number' ? Number(valeur) : 0;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

/** @param {import('node:http').IncomingMessage} req */
function bearer(req) {
  const valeur = req.headers.authorization;
  if (typeof valeur !== 'string') return null;
  const correspondance = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(valeur);
  return correspondance?.[1] ?? null;
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {number} statut
 * @param {unknown} corps
 * @param {Record<string, string>} [supplement]
 */
function repondreJson(req, res, statut, corps, supplement = {}) {
  const texte = JSON.stringify(corps);
  res.writeHead(statut, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(texte)),
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    ...(req.headers['x-forwarded-proto'] === 'https' ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
    ...supplement,
  });
  res.end(req.method === 'HEAD' ? undefined : texte);
}

/** @param {Response} reponse */
async function jsonReponse(reponse) {
  try {
    return await reponse.json();
  } catch {
    return null;
  }
}

/**
 * @typedef {{
 *   supabaseUrl: string | null,
 *   publishableKey: string | null,
 *   serviceRoleKey: string | null,
 *   instanceId: string,
 *   timeoutMs: number,
 *   maxConcurrent: number,
 *   ratePerMinute: number,
 *   fetchFn?: typeof fetch,
 *   now?: () => number,
 *   timers?: boolean,
 * }} OptionsSupervision
 */

/** @param {Partial<OptionsSupervision>} options */
export function creerSupervision(options = {}) {
  const supabaseUrl = options.supabaseUrl ?? null;
  const publishableKey = options.publishableKey ?? null;
  const serviceRoleKey = options.serviceRoleKey ?? null;
  const instanceId = options.instanceId ?? idInstance(undefined);
  const timeoutMs = options.timeoutMs ?? 5_000;
  const maxConcurrent = options.maxConcurrent ?? 4;
  const ratePerMinute = options.ratePerMinute ?? 60;
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;

  let echantillon = creerEchantillon(debutMinute(now()));
  /** @type {ReturnType<typeof creerEchantillon>[]} */
  const historique = [];
  let inflight = 0;
  let connexions = 0;
  let appelsAdmin = 0;
  let minuteLimite = debutMinute(now());
  let adminsSimultanes = 0;
  /** @type {string | null} */
  let derniereErreurPersistance = null;
  let filePersistance = Promise.resolve();
  let cpuPrecedent = process.cpuUsage();
  // Le premier échantillon nettoie aussi les déploiements qui redémarrent avant une heure ;
  // les suivants espacent strictement le nettoyage d'au moins 60 minutes.
  let prochainNettoyage = now();
  const retard = monitorEventLoopDelay({ resolution: 20 });
  retard.enable();

  function instantane() {
    return {
      inflight,
      httpConnections: connexions,
      rssBytes: process.memoryUsage().rss,
      eventLoopLagMs: Number.isFinite(retard.max) ? Math.round((retard.max / 1e6) * 1000) / 1000 : 0,
    };
  }

  /** @param {ReturnType<typeof creerEchantillon>} ligne */
  async function persister(ligne) {
    if (!supabaseUrl || !serviceRoleKey) return;
    const controleur = new AbortController();
    const minute = new Date(ligne.minute).toISOString();
    const delai = setTimeout(() => controleur.abort(), timeoutMs);
    delai.unref?.();
    try {
      const reponse = await fetchFn(`${supabaseUrl}/rest/v1/rpc/enregistrer_metrique_serveur`, {
        method: 'POST',
        signal: controleur.signal,
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_minute: minute,
          p_instance_id: instanceId,
          p_requetes: ligne.requests,
          p_erreurs_5xx: ligne.errors5xx,
          p_octets_reponse: ligne.responseBytes,
          p_cpu_ms: ligne.cpuMs,
          p_rss_octets: ligne.rssBytes,
          p_retard_boucle_ms: ligne.eventLoopLagMs,
          p_requetes_simultanees_max: ligne.inflightMax,
          p_connexions_http_max: ligne.httpConnectionsMax,
          p_latences: ligne.histogram,
        }),
      });
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      derniereErreurPersistance = null;

      if (now() >= prochainNettoyage) {
        const nettoyage = await fetchFn(`${supabaseUrl}/rest/v1/rpc/nettoyer_metriques_serveur`, {
          method: 'POST',
          signal: controleur.signal,
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        });
        if (!nettoyage.ok) throw new Error(`nettoyage HTTP ${nettoyage.status}`);
        prochainNettoyage = now() + 60 * MINUTE_MS;
      }
    } catch (erreur) {
      derniereErreurPersistance = erreur instanceof Error ? erreur.message : String(erreur);
    } finally {
      clearTimeout(delai);
    }
  }

  function avancer() {
    const minute = debutMinute(now());
    if (minute === echantillon.minute) {
      echantillon.rssBytes = Math.max(echantillon.rssBytes, process.memoryUsage().rss);
      echantillon.inflightMax = Math.max(echantillon.inflightMax, inflight);
      echantillon.httpConnectionsMax = Math.max(echantillon.httpConnectionsMax, connexions);
      return;
    }

    const cpu = process.cpuUsage(cpuPrecedent);
    cpuPrecedent = process.cpuUsage();
    echantillon.cpuMs = Math.max(0, Math.round((cpu.user + cpu.system) / 1000));
    echantillon.rssBytes = Math.max(echantillon.rssBytes, process.memoryUsage().rss);
    echantillon.eventLoopLagMs = Number.isFinite(retard.max) ? Math.round((retard.max / 1e6) * 1000) / 1000 : 0;
    retard.reset();
    historique.push(echantillon);
    if (historique.length > RETENTION_LOCALE_MINUTES) historique.shift();
    const aPersister = echantillon;
    filePersistance = filePersistance.then(() => persister(aPersister));
    echantillon = creerEchantillon(minute);
    echantillon.inflightMax = inflight;
    echantillon.httpConnectionsMax = connexions;
  }

  const minuteur = options.timers === false ? null : setInterval(avancer, MINUTE_MS);
  minuteur?.unref();

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  function observerRequete(req, res) {
    avancer();
    const debut = performance.now();
    inflight += 1;
    echantillon.inflightMax = Math.max(echantillon.inflightMax, inflight);
    let terminee = false;
    const terminer = () => {
      if (terminee) return;
      terminee = true;
      inflight = Math.max(0, inflight - 1);
      avancer();
      echantillon.requests += 1;
      if (res.statusCode >= 500) echantillon.errors5xx += 1;
      if (req.method !== 'HEAD') echantillon.responseBytes += longueurReponse(res);
      echantillon.histogram[indexLatence(performance.now() - debut)] += 1;
    };
    res.once('finish', terminer);
    res.once('close', terminer);
  }

  /** @param {import('node:http').Server} serveur */
  function attacherServeur(serveur) {
    serveur.on('connection', (socket) => {
      connexions += 1;
      avancer();
      socket.once('close', () => {
        connexions = Math.max(0, connexions - 1);
      });
    });
    serveur.once('close', fermer);
  }

  function fermer() {
    if (minuteur) clearInterval(minuteur);
    retard.disable();
  }

  /** @type {number[]} */
  let histogrammeLocalCache = Array(9).fill(0);

  /** @param {number} heures */
  function historiqueLocal(heures) {
    avancer();
    const depuis = now() - heures * 60 * MINUTE_MS;
    const selection = [...historique, echantillon].filter((ligne) => ligne.minute >= depuis);
    histogrammeLocalCache = Array(9).fill(0);
    for (const ligne of selection) {
      ligne.histogram.forEach((n, i) => (histogrammeLocalCache[i] += n));
    }
    return selection
      .map((ligne) => ({
        minute: new Date(ligne.minute).toISOString(),
        requests: ligne.requests,
        errors5xx: ligne.errors5xx,
        responseBytes: ligne.responseBytes,
        cpuMs: ligne.cpuMs,
        rssBytes: ligne.rssBytes,
        eventLoopLagMs: ligne.eventLoopLagMs,
        inflightMax: ligne.inflightMax,
        httpConnectionsMax: ligne.httpConnectionsMax,
        authenticatedActiveUsers: ligne.authenticatedActiveUsers,
        instances: 1,
        p95Ms: percentile95(ligne.histogram),
      }));
  }

  /** @param {ReturnType<typeof historiqueLocal>} lignes */
  function totaux(lignes) {
    // L'historique SQL ne renvoie volontairement pas les cases de l'histogramme. Son p95 global
    // reste donc indisponible ; le p95 de chaque minute, lui, est exact à la borne près.
    const local = lignes === historiqueLocalCache;
    return {
      requests: lignes.reduce((s, l) => s + Number(l.requests ?? 0), 0),
      errors5xx: lignes.reduce((s, l) => s + Number(l.errors5xx ?? 0), 0),
      responseBytes: lignes.reduce((s, l) => s + Number(l.responseBytes ?? 0), 0),
      cpuMs: lignes.reduce((s, l) => s + Number(l.cpuMs ?? 0), 0),
      p95: local ? percentile95(histogrammeLocalCache) : null,
    };
  }

  /** @type {ReturnType<typeof historiqueLocal>} */
  let historiqueLocalCache = [];

  /** @param {string} path @param {RequestInit} init */
  async function appeler(path, init) {
    if (!supabaseUrl || !publishableKey) throw new Error('Supabase serveur non configuré');
    // Le signal reste actif après la réception des en-têtes et borne donc aussi la lecture du JSON.
    return fetchFn(`${supabaseUrl}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  async function repondre(req, res) {
    if (req.method !== 'GET') {
      return repondreJson(req, res, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
    }
    if (adminsSimultanes >= maxConcurrent) return repondreJson(req, res, 429, { error: 'too_many_requests' });
    const minute = debutMinute(now());
    if (minute !== minuteLimite) {
      minuteLimite = minute;
      appelsAdmin = 0;
    }
    if (appelsAdmin >= ratePerMinute) return repondreJson(req, res, 429, { error: 'too_many_requests' });
    appelsAdmin += 1;
    adminsSimultanes += 1;

    try {
      const token = bearer(req);
      if (!token) return repondreJson(req, res, 401, { error: 'authentication_required' });
      if (!supabaseUrl || !publishableKey) return repondreJson(req, res, 503, { error: 'service_unavailable' });

      let utilisateur;
      try {
        const auth = await appeler('/auth/v1/user', {
          headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
        });
        if (auth.status === 401 || auth.status === 403) return repondreJson(req, res, 401, { error: 'invalid_token' });
        if (!auth.ok) return repondreJson(req, res, 503, { error: 'service_unavailable' });
        utilisateur = await jsonReponse(auth);
      } catch {
        return repondreJson(req, res, 503, { error: 'service_unavailable' });
      }
      if (!utilisateur || typeof utilisateur.id !== 'string') {
        return repondreJson(req, res, 401, { error: 'invalid_token' });
      }

      let admin = false;
      try {
        const filtre = encodeURIComponent(`eq.${utilisateur.id}`);
        const profil = await appeler(`/rest/v1/profils?select=id,role&id=${filtre}&limit=1`, {
          headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
        });
        if (!profil.ok) return repondreJson(req, res, 503, { error: 'service_unavailable' });
        const lignes = await jsonReponse(profil);
        admin = Array.isArray(lignes) && lignes.length === 1 && lignes[0]?.id === utilisateur.id && lignes[0]?.role === 'admin';
      } catch {
        return repondreJson(req, res, 503, { error: 'service_unavailable' });
      }
      if (!admin) return repondreJson(req, res, 403, { error: 'forbidden' });

      const adresse = new URL(req.url ?? '/', 'http://serveur');
      const heures = adresse.searchParams.get('heures') === '24' ? 24 : 1;
      let snapshot = null;
      let databaseStatus = 'available';
      try {
        const rpc = await appeler('/rest/v1/rpc/lire_supervision', {
          method: 'POST',
          headers: {
            apikey: publishableKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_heures: heures }),
        });
        if (rpc.status === 401 || rpc.status === 403) return repondreJson(req, res, 403, { error: 'forbidden' });
        if (!rpc.ok) throw new Error(`RPC HTTP ${rpc.status}`);
        snapshot = await jsonReponse(rpc);
        if (!snapshot || typeof snapshot !== 'object') throw new Error('Réponse RPC invalide');
      } catch {
        databaseStatus = 'error';
      }

      historiqueLocalCache = historiqueLocal(heures);
      const etatPersistance = !serviceRoleKey ? 'unconfigured' : derniereErreurPersistance ? 'error' : 'available';
      const lignes =
        etatPersistance === 'available' && Array.isArray(snapshot?.serverHistory)
          ? snapshot.serverHistory
          : historiqueLocalCache;
      const valeurs = snapshot ?? {
        activeUsers: { authenticatedLast2m: null, profilesTotal: null, lastHeartbeatAt: null },
        votes: {
          public: { total: null, modifiedLast5m: null, modifiedLastHour: null },
          jury: { total: null, modifiedLast5m: null, modifiedLastHour: null },
        },
        database: { sizeBytes: null, connections: { current: null, max: null } },
      };

      const resume = lignes === historiqueLocalCache ? totaux(lignes) : snapshot?.serverTotals ?? totaux(lignes);
      return repondreJson(req, res, 200, {
        generatedAt: new Date(now()).toISOString(),
        windowHours: heures,
        sources: {
          databaseStatus,
          serverPersistence: etatPersistance,
          supabaseBandwidth: 'unknown',
        },
        activeUsers: valeurs.activeUsers,
        votes: valeurs.votes,
        database: valeurs.database,
        server: {
          current: instantane(),
          totals: {
            requests: resume.requests,
            errors5xx: resume.errors5xx,
            responseBytes: resume.responseBytes,
            cpuMs: resume.cpuMs,
          },
          latencyMs: { p95: resume.p95 },
          history: lignes,
        },
      });
    } finally {
      adminsSimultanes = Math.max(0, adminsSimultanes - 1);
    }
  }

  return {
    /** @param {string | undefined} url */
    estRoute: (url) => {
      try {
        return new URL(url ?? '/', 'http://serveur').pathname === '/api/admin/supervision';
      } catch {
        return false;
      }
    },
    repondre,
    observerRequete,
    attacherServeur,
    fermer,
    avancer,
  };
}

/** @param {NodeJS.ProcessEnv} environnement */
export function supervisionDepuisEnvironnement(environnement) {
  return creerSupervision({
    supabaseUrl: urlSupabase(environnement.VITE_SUPABASE_URL),
    publishableKey: environnement.VITE_SUPABASE_PUBLISHABLE_KEY || null,
    serviceRoleKey: environnement.SUPABASE_SERVICE_ROLE_KEY || null,
    // Un deployment Railway peut avoir plusieurs replicas : seul l'identifiant de replica est
    // assez précis. Sans lui, un identifiant aléatoire évite que deux processus s'écrasent.
    instanceId: idInstance(environnement.SUPERVISION_INSTANCE_ID || environnement.RAILWAY_REPLICA_ID),
    timeoutMs: entierBorne(environnement.SUPERVISION_FETCH_TIMEOUT_MS, 5_000, 500, 15_000),
    maxConcurrent: entierBorne(environnement.SUPERVISION_MAX_CONCURRENT, 4, 1, 20),
    ratePerMinute: entierBorne(environnement.SUPERVISION_RATE_LIMIT_PER_MINUTE, 60, 1, 600),
  });
}
