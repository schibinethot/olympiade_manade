import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAccesAdmin } from '../lib/useAccesAdmin';
import { exporterMesures, latence, nombre, octets, type MesureMinute, type Supervision } from '../lib/supervision';
import type { Route } from './+types/admin-statistiques';

export const meta: Route.MetaFunction = () => [
  { title: 'Statistiques et charge · Administration' },
  { name: 'robots', content: 'noindex' },
];

const CARTE = 'rounded-[22px] border border-trait bg-creme p-5 tablette:p-6';
const BOUTON = 'inline-flex min-h-12 items-center justify-center rounded-xl border border-trait px-4 text-sm font-semibold disabled:opacity-50';
const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export default function Statistiques() {
  const { acces, session } = useAccesAdmin();
  const jeton = session?.access_token;
  const [heures, setHeures] = useState(1);
  const [courbe, setCourbe] = useState<'requests' | 'authenticatedActiveUsers'>('requests');
  const [essai, setEssai] = useState(0);
  const [etat, setEtat] = useState<{ jeton?: string; heures: number; donnees: Supervision | null; erreur: string | null; enCours: boolean }>({ heures: 1, donnees: null, erreur: null, enCours: false });

  useEffect(() => {
    if (acces !== 'autorise' || !jeton) return;
    let arrete = false;
    let enCours = false;
    let refuse = false;
    let timer: ReturnType<typeof setTimeout>;
    const controle = new AbortController();
    async function lire() {
      if (arrete || enCours || refuse) return;
      if (document.visibilityState !== 'visible') {
        timer = setTimeout(() => void lire(), 30_000);
        return;
      }
      enCours = true;
      setEtat((avant) => ({ jeton, heures, donnees: avant.jeton === jeton && avant.heures === heures ? avant.donnees : null, erreur: null, enCours: true }));
      try {
        const reponse = await fetch(`/api/admin/supervision?heures=${heures}`, {
          headers: { Authorization: `Bearer ${jeton}` }, cache: 'no-store',
          signal: AbortSignal.any([controle.signal, AbortSignal.timeout(10_000)]),
        });
        if (!reponse.ok) {
          refuse = reponse.status === 401 || reponse.status === 403;
          throw new Error(refuse ? 'L’accès a expiré ou ce compte n’est plus administrateur. Reconnectez-vous.'
            : reponse.status === 429 ? 'Actualisations trop rapprochées. Nouvelle tentative dans 30 secondes.'
              : 'La supervision est indisponible. Vérifiez la configuration du service et réessayez.');
        }
        const donnees = await reponse.json() as Supervision;
        if (!donnees.server || !donnees.database || !donnees.activeUsers || !Array.isArray(donnees.server.history)) throw new Error('Réponse de supervision incomplète.');
        if (!arrete) setEtat({ jeton, heures, donnees, erreur: null, enCours: false });
      } catch (echec) {
        if (!arrete) setEtat((avant) => ({ jeton, heures, donnees: refuse ? null : avant.donnees, erreur: echec instanceof Error && echec.name === 'Error' ? echec.message : 'Mesures non actualisées. Vérifiez la connexion.', enCours: false }));
      } finally {
        enCours = false;
        if (!arrete && !refuse) timer = setTimeout(() => void lire(), 30_000);
      }
    }
    function reprendre() {
      if (document.visibilityState !== 'visible' || enCours) return;
      clearTimeout(timer);
      void lire();
    }
    void lire();
    document.addEventListener('visibilitychange', reprendre);
    return () => { arrete = true; controle.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', reprendre); };
  }, [acces, jeton, heures, essai]);

  const data = acces === 'autorise' && etat.jeton === jeton && etat.heures === heures ? etat.donnees : null;
  function exporter() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([exporterMesures(data.server.history)], { type: 'text/csv;charset=utf-8' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `supervision-${new Date(data.generatedAt).toISOString().slice(0, 10)}-${heures}h.csv`;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="mx-auto max-w-[1600px] px-4 pt-8 tablette:px-7 paysage:px-10 bureau:px-14">
    <Link to="/admin" className="inline-flex min-h-12 items-center text-sm font-medium text-encre-2 underline underline-offset-4">← Administration</Link>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
      <div><p className="text-xs font-bold tracking-[.18em] text-or-ink uppercase">Supervision du service</p>
        <h1 className="mt-2 font-display text-4xl tablette:text-5xl">Statistiques et charge</h1>
        <p className="mt-3 max-w-2xl text-encre-2">Connexions, notes et ressources : l’activité réelle de votre application.</p>
      </div>
      {acces === 'autorise' ? <button type="button" onClick={() => setEssai((n) => n + 1)} disabled={etat.enCours} className={`${BOUTON} bg-encre text-sable`}>{etat.enCours ? 'Actualisation…' : 'Actualiser'}</button> : null}
    </div>

    {acces === 'chargement' ? <p role="status" className="mt-8">Vérification de l’accès…</p> : acces !== 'autorise' ?
      <div className={`${CARTE} mt-8`}>
        <p role={acces === 'anonyme' ? 'status' : 'alert'}>{acces === 'anonyme' ? 'Connectez-vous pour consulter les statistiques.' : acces === 'refuse' ? 'Ces statistiques sont réservées aux administrateurs.' : 'Impossible de vérifier vos droits. Réessayez depuis l’administration.'}</p>
        <Link to="/admin" className={`${BOUTON} mt-4`}>Accéder à l’administration</Link>
      </div> : <>
      <section aria-label="Objectif de capacité" className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-encre p-6 text-sable">
        <div><p className="text-xs font-bold tracking-[.16em] text-or-clair uppercase">Objectif de la soirée</p>
          <p className="mt-2 font-display text-3xl"><span className="tabular-nums">5 000</span> personnes en simultané</p></div>
        <div className="max-w-sm"><p className="font-semibold text-or-clair">Capacité à valider par un test de charge</p>
          <p className="mt-1 text-sm text-nuit-mute">Les mesures ci-dessous décrivent l’activité observée. Elles ne garantissent pas la capacité maximale.</p></div>
      </section>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Période des mesures serveur" className="inline-flex gap-1 rounded-2xl bg-lin p-1">
          {[1, 24].map((n) => <button key={n} type="button" aria-pressed={heures === n} onClick={() => setHeures(n)} className={`min-h-12 rounded-xl px-4 text-sm font-semibold ${heures === n ? 'bg-creme text-encre shadow-sm' : 'text-encre-2'}`}>{n === 1 ? 'Dernière heure' : '24 heures'}</button>)}
        </div>
        <button type="button" onClick={exporter} disabled={!data?.server.history.length} className={BOUTON}>Exporter les mesures</button>
      </div>
      {etat.erreur ? <p role="alert" className="mb-5 rounded-xl border border-rouge/30 bg-creme p-4 text-rouge-alerte">{etat.erreur}{data ? ' Les dernières mesures connues restent affichées.' : ''}</p> : null}
      {!data ? <p role="status" className="py-8 text-encre-2">{etat.enCours ? 'Lecture des mesures…' : 'Aucune mesure disponible pour le moment.'}</p> : <>
        <p className="mb-5 text-sm text-encre-2">Mesuré le {new Date(data.generatedAt).toLocaleString('fr-FR')} · Actualisation toutes les 30 secondes, lorsque cet écran est visible.</p>
        {data.sources.serverPersistence !== 'available' ? <p className="mb-5 rounded-xl border border-trait bg-lin p-4 text-sm">{data.sources.serverPersistence === 'unconfigured' ? 'Historique permanent non configuré. Les mesures serveur sont conservées en mémoire depuis le dernier démarrage.' : 'L’enregistrement de l’historique est momentanément indisponible. Les mesures locales restent visibles.'}</p> : null}
        {data.sources.databaseStatus === 'error' ? <p role="status" className="mb-5 rounded-xl border border-trait bg-lin p-4 text-sm">Les mesures de la base sont indisponibles. Vérifiez que la migration de supervision est appliquée et que Supabase est accessible.</p> : null}
        <div className="grid gap-4 tablette:grid-cols-2 paysage:grid-cols-4">
          <Indicateur titre="Comptes actifs" valeur={nombre(data.activeUsers.authenticatedLast2m)} detail="Signal reçu depuis moins de 2 minutes. Visiteurs non connectés exclus." />
          <Indicateur titre="Notes du public" valeur={nombre(data.votes.public.total)} detail={data.votes.public.modifiedLast5m == null ? 'Activité récente indisponible.' : `${nombre(data.votes.public.modifiedLast5m)} notes créées ou modifiées depuis 5 minutes.`} />
          <Indicateur titre="Requêtes serveur" valeur={nombre(data.server.totals.requests)} detail={`Sur la période mesurée (${heures} h maximum). Appels directs à Supabase exclus.`} />
          <Indicateur titre="Erreurs serveur" valeur={nombre(data.server.totals.errors5xx)} detail={data.server.totals.requests ? `${nombre(100 * data.server.totals.errors5xx / data.server.totals.requests, 2)} % des réponses sont des erreurs 5xx.` : 'Aucune requête observée sur la période.'} alerte={data.server.totals.errors5xx > 0} />
        </div>
        <div className="mt-5 grid gap-5 paysage:grid-cols-[1.6fr_1fr]">
          <section className={CARTE} aria-labelledby="titre-trafic"><h2 id="titre-trafic" className="font-display text-2xl">Évolution de l’activité</h2><p className="mt-1 text-sm text-encre-2">Une mesure par minute · intervalles enregistrés uniquement</p>
            <div role="group" aria-label="Mesure du graphique" className="mt-3 flex flex-wrap gap-2">{(['requests', 'authenticatedActiveUsers'] as const).map((cle) => <button key={cle} type="button" aria-pressed={courbe === cle} onClick={() => setCourbe(cle)} className={`${BOUTON} ${courbe === cle ? 'bg-lin' : ''}`}>{cle === 'requests' ? 'Requêtes' : 'Comptes actifs'}</button>)}</div>
            <Courbe mesures={data.server.history} indicateur={courbe} />
          </section>
          <section className={CARTE} aria-labelledby="titre-donnees"><h2 id="titre-donnees" className="font-display text-2xl">Données et enregistrements</h2>
            <dl className="mt-4 divide-y divide-trait">
              <Ligne terme="Comptes inscrits" valeur={nombre(data.activeUsers.profilesTotal)} />
              <Ligne terme="Notes du jury" valeur={nombre(data.votes.jury.total)} />
              <Ligne terme="Notes touchées depuis 1 h" valeur={nombre(data.votes.public.modifiedLastHour == null || data.votes.jury.modifiedLastHour == null ? null : data.votes.public.modifiedLastHour + data.votes.jury.modifiedLastHour)} />
              <Ligne terme="Volume de la base" valeur={octets(data.database.sizeBytes)} />
              <Ligne terme="Données servies par Railway" valeur={octets(data.server.totals.responseBytes)} />
              <Ligne terme="Transferts Supabase" valeur="Non mesurés ici" />
            </dl>
            <p className="mt-3 text-xs text-encre-2">Une note corrigée conserve une seule ligne. Ces compteurs ne représentent pas le nombre total de tentatives d’enregistrement.</p>
          </section>
        </div>
        <section className="mt-6" aria-labelledby="titre-ressources"><h2 id="titre-ressources" className="mb-4 font-display text-2xl">Ressources et temps de réponse</h2>
          <div className="grid gap-4 tablette:grid-cols-2 paysage:grid-cols-4">
            <Indicateur titre="Mémoire du processus" valeur={octets(data.server.current.rssBytes)} detail="Mesure actuelle sur l’instance qui répond." />
            <Indicateur titre="Temps de réponse p95" valeur={latence(data.server.latencyMs.p95)} detail="Borne estimée côté serveur. N’inclut ni le réseau mobile, ni l’écriture du vote dans Supabase." />
            <Indicateur titre="Connexions à la base" valeur={`${nombre(data.database.connections.current)} / ${nombre(data.database.connections.max)}`} detail="Connexions PostgreSQL, distinctes des personnes connectées." />
            <Indicateur titre="Retard du serveur" valeur={`${nombre(data.server.current.eventLoopLagMs, 1)} ms`} detail="Retard de la boucle Node : une hausse persistante peut signaler une saturation." />
          </div>
          <p className="mt-4 text-sm text-encre-2">Actuellement : {nombre(data.server.current.inflight)} requêtes en cours et {nombre(data.server.current.httpConnections)} connexions HTTP sur cette instance. Temps CPU cumulé sur la période : {nombre(data.server.totals.cpuMs / 1000, 1)} s.</p>
        </section>
        <details className={`${CARTE} mt-6`}><summary className="min-h-12 cursor-pointer font-semibold">Journal des mesures par minute</summary>
          <p className="my-3 text-sm text-encre-2">Les 30 dernières minutes enregistrées. L’export contient toute la période disponible.</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm tabular-nums"><caption className="sr-only">Mesures serveur enregistrées</caption>
            <thead><tr>{['Heure', 'Requêtes', 'Erreurs 5xx', 'Données', 'p95', 'Mémoire', 'Comptes actifs', 'Instances'].map((t) => <th key={t} scope="col" className="border-b border-trait px-3 py-3 font-semibold">{t}</th>)}</tr></thead>
            <tbody>{data.server.history.slice(-30).reverse().map((m) => <tr key={m.minute} className="border-b border-trait last:border-0"><td className="px-3 py-3"><time dateTime={m.minute}>{heure(m.minute)}</time></td><td className="px-3 py-3">{nombre(m.requests)}</td><td className="px-3 py-3">{nombre(m.errors5xx)}</td><td className="px-3 py-3">{octets(m.responseBytes)}</td><td className="px-3 py-3">{m.p95Ms == null ? '—' : `${nombre(m.p95Ms)} ms`}</td><td className="px-3 py-3">{octets(m.rssBytes)}</td><td className="px-3 py-3">{nombre(m.authenticatedActiveUsers)}</td><td className="px-3 py-3">{nombre(m.instances)}</td></tr>)}</tbody>
          </table></div>
        </details>
        <p className="mt-5 text-sm text-encre-2">Mesures techniques agrégées, sans email, adresse IP ni contenu des notes dans ce journal. L’historique permanent conserve 30 jours de mesures.</p>
      </>}
    </>}
  </div>;
}

function Indicateur({ titre, valeur, detail, alerte = false }: { titre: string; valeur: string; detail: string; alerte?: boolean }) {
  return <section className={CARTE}><h3 className="text-xs font-bold tracking-[.1em] text-encre-2 uppercase">{titre}</h3><p className={`mt-3 break-words text-3xl font-semibold tabular-nums ${alerte ? 'text-rouge-alerte' : 'text-encre'}`}>{valeur}</p><p className="mt-2 text-xs leading-relaxed text-encre-2">{detail}</p></section>;
}
function Ligne({ terme, valeur }: { terme: string; valeur: ReactNode }) {
  return <div className="flex items-baseline justify-between gap-4 py-3 text-sm"><dt className="text-encre-2">{terme}</dt><dd className="text-right font-semibold tabular-nums">{valeur}</dd></div>;
}
function Courbe({ mesures: toutes, indicateur }: { mesures: MesureMinute[]; indicateur: 'requests' | 'authenticatedActiveUsers' }) {
  const mesures = toutes.filter((m) => m[indicateur] != null);
  if (!mesures.length) return <p className="grid min-h-48 place-content-center text-sm text-encre-2">{indicateur === 'requests' ? 'Le graphique apparaîtra après la première minute enregistrée.' : 'Aucune mesure historique des comptes actifs. L’enregistrement permanent doit être actif.'}</p>;
  const valeur = (m: MesureMinute) => m[indicateur] ?? 0;
  const unite = indicateur === 'requests' ? 'requêtes / min' : 'comptes actifs';
  const max = Math.max(1, ...mesures.map(valeur));
  const debut = Date.parse(mesures[0].minute);
  const fin = Date.parse(mesures[mesures.length - 1].minute);
  const x = (m: MesureMinute) => mesures.length === 1 ? 320 : 24 + (Date.parse(m.minute) - debut) / Math.max(60_000, fin - debut) * 592;
  const y = (m: MesureMinute) => 172 - (valeur(m) / max) * 136;
  // Une interruption de collecte reste un trou visible ; ne pas inventer une activité entre deux points.
  return <figure className="mt-4"><svg viewBox="0 0 640 210" role="img" aria-label={`${unite} : ${mesures.length} minutes observées, maximum ${nombre(Math.max(...mesures.map(valeur)))}.`} className="w-full text-or-ink">
    {[36, 104, 172].map((v) => <line key={v} x1="24" x2="616" y1={v} y2={v} stroke="currentColor" opacity=".18" />)}
    <text x="24" y="20" fontSize="12" fill="currentColor">{nombre(max)} {unite}</text>
    {mesures.map((m, i) => <g key={m.minute}>{i > 0 && Date.parse(m.minute) - Date.parse(mesures[i - 1].minute) <= 90_000 ? <line x1={x(mesures[i - 1])} y1={y(mesures[i - 1])} x2={x(m)} y2={y(m)} stroke="currentColor" strokeWidth="2" /> : null}<circle cx={x(m)} cy={y(m)} r={mesures.length > 120 ? 1 : 3} fill="currentColor"><title>{heure(m.minute)} : {nombre(valeur(m))} {unite}</title></circle></g>)}
    <text x="24" y="201" fontSize="12" fill="currentColor">{heure(mesures[0].minute)}</text><text x="616" y="201" textAnchor="end" fontSize="12" fill="currentColor">{heure(mesures[mesures.length - 1].minute)}</text>
  </svg><figcaption className="text-xs text-encre-2">{indicateur === 'requests' ? 'Le trafic du site inclut les fichiers et les pages. Les votes sont envoyés directement à la base.' : 'Comptes connectés ayant signalé leur présence depuis moins de 2 minutes, tous appareils confondus.'}</figcaption></figure>;
}
