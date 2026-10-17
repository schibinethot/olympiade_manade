/**
 * Administration du module de consentement cookies.
 *
 * Onglets :
 * - Réglages : textes et catégories de la bannière (lecture/écriture via Supabase sous RLS)
 * - Statistiques : taux mesure/publicité sur 7/30/90/365 jours
 * - Journal : 50 entrées par page, plus récent d'abord, purge > 365 jours
 *
 * @see plan-consentement-cookies.md section « Admin »
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { BOUTON, BOUTON_PLEIN, CadreAdmin, CARTE, CHAMP, useClientAdmin } from '../composants/admin/CadreAdmin';
import { AideCookies } from '../composants/admin/AideCookies';

// ---------------------------------------------------------------------------
// Types alignés sur les colonnes de parametres_cookies
// ---------------------------------------------------------------------------

type ParamètresCookies = {
  titre: string;
  description: string;
  texte_tout_accepter: string;
  texte_refuser: string;
  texte_personnaliser: string;
  texte_enregistrer: string;
  url_confidentialite: string;
  mesure_active: boolean;
  mesure_titre: string;
  mesure_description: string;
  publicite_active: boolean;
  publicite_titre: string;
  publicite_description: string;
  duree_consentement_jours: number;
};

type LigneJournal = {
  id: string;
  visiteur_id: string;
  ip_hachee: string | null;
  agent_utilisateur: string | null;
  consentement_donne: boolean;
  mesure_acceptee: boolean;
  publicite_acceptee: boolean;
  action: 'accept_all' | 'reject_all' | 'custom';
  url_page: string | null;
  provenance: string | null;
  cree_le: string;
};

type Periode = '7' | '30' | '90' | '365';

const LIBELLE_ACTION: Record<LigneJournal['action'], string> = {
  accept_all: 'Tout accepté',
  reject_all: 'Tout refusé',
  custom: 'Personnalisé',
};

const TAILLE_PAGE_JOURNAL = 50;

// ---------------------------------------------------------------------------
// Page racine
// ---------------------------------------------------------------------------

export function meta() {
  return [{ title: 'Cookies · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function AdminCookies() {
  return (
    <CadreAdmin surtitre="Configuration" titre="Consentement cookies">
      <Contenu />
    </CadreAdmin>
  );
}

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------

type Onglet = 'aide' | 'reglages' | 'statistiques' | 'journal';

const ONGLETS: ReadonlyArray<{ cle: Onglet; libelle: string }> = [
  { cle: 'aide', libelle: 'Comment ça marche' },
  { cle: 'reglages', libelle: 'Réglages' },
  { cle: 'statistiques', libelle: 'Statistiques' },
  { cle: 'journal', libelle: 'Journal' },
];

function estOnglet(valeur: string | null): valeur is Onglet {
  return valeur === 'aide' || valeur === 'reglages' || valeur === 'statistiques' || valeur === 'journal';
}

function Contenu() {
  const [params, setParams] = useSearchParams();
  const demande = params.get('onglet');
  const onglet: Onglet = estOnglet(demande) ? demande : 'aide';
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function activer(cle: Onglet, focalise = false) {
    setParams(
      (prec) => {
        const copie = new URLSearchParams(prec);
        if (cle === 'aide') copie.delete('onglet');
        else copie.set('onglet', cle);
        return copie;
      },
      { replace: true },
    );
    if (focalise) {
      const index = ONGLETS.findIndex((o) => o.cle === cle);
      // Laisser le temps à React de peindre le nouvel aria-selected
      setTimeout(() => refs.current[index]?.focus(), 0);
    }
  }

  function onTouche(evt: KeyboardEvent<HTMLButtonElement>, index: number) {
    const dernier = ONGLETS.length - 1;
    let suivant: number | null = null;
    if (evt.key === 'ArrowRight') suivant = index === dernier ? 0 : index + 1;
    else if (evt.key === 'ArrowLeft') suivant = index === 0 ? dernier : index - 1;
    else if (evt.key === 'Home') suivant = 0;
    else if (evt.key === 'End') suivant = dernier;
    if (suivant === null) return;
    evt.preventDefault();
    activer(ONGLETS[suivant].cle, true);
  }

  return (
    <div className="grid gap-5">
      <div
        role="tablist"
        aria-label="Onglets cookies"
        className="flex flex-wrap gap-2"
      >
        {ONGLETS.map((o, i) => {
          const actif = o.cle === onglet;
          return (
            <button
              key={o.cle}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`onglet-cookies-${o.cle}`}
              aria-selected={actif}
              // Seul le panneau actif est rendu : l'onglet inactif ne pointe vers aucun élément absent.
              aria-controls={actif ? `panneau-cookies-${o.cle}` : undefined}
              tabIndex={actif ? 0 : -1}
              onClick={() => activer(o.cle)}
              onKeyDown={(e) => onTouche(e, i)}
              className={`${BOUTON} ${actif ? 'bg-encre text-sable' : ''}`}
            >
              {o.libelle}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panneau-cookies-${onglet}`}
        aria-labelledby={`onglet-cookies-${onglet}`}
      >
        {onglet === 'aide' && <AideCookies onAllerVers={(cible) => activer(cible, false)} />}
        {onglet === 'reglages' && <OngletReglages />}
        {onglet === 'statistiques' && <OngletStatistiques />}
        {onglet === 'journal' && <OngletJournal />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet Réglages
// ---------------------------------------------------------------------------

function OngletReglages() {
  const { client, erreurClient } = useClientAdmin();
  const [params, setParams] = useState<ParamètresCookies | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let actif = true;
    void (async () => {
      const { data, error } = await client.from('parametres_cookies').select('*').eq('id', 1).single();
      if (!actif) return;
      if (error) setErreur('Les réglages sont indisponibles.');
      else setParams(data as ParamètresCookies);
    })();
    return () => { actif = false; };
  }, [client]);

  async function enregistrer() {
    if (!client || !params || enCours) return;
    setEnCours(true);
    setErreur(null);
    const { error } = await client
      .from('parametres_cookies')
      .update({
        titre: params.titre,
        description: params.description,
        texte_tout_accepter: params.texte_tout_accepter,
        texte_refuser: params.texte_refuser,
        texte_personnaliser: params.texte_personnaliser,
        texte_enregistrer: params.texte_enregistrer,
        url_confidentialite: params.url_confidentialite,
        mesure_active: params.mesure_active,
        mesure_titre: params.mesure_titre,
        mesure_description: params.mesure_description,
        publicite_active: params.publicite_active,
        publicite_titre: params.publicite_titre,
        publicite_description: params.publicite_description,
        duree_consentement_jours: params.duree_consentement_jours,
      })
      .eq('id', 1);
    setEnCours(false);
    if (error) setErreur("L’enregistrement a échoué. Réessayez.");
    else setConfirmation('Paramètres enregistrés.');
  }

  function modif<K extends keyof ParamètresCookies>(cle: K, valeur: ParamètresCookies[K]) {
    setParams((avant) => (avant ? { ...avant, [cle]: valeur } : avant));
    setConfirmation(null);
  }

  if (erreurClient) return <p role="alert" className="text-rouge-alerte">{erreurClient}</p>;
  if (!params && !erreur) return <p role="status">Lecture des réglages…</p>;
  if (erreur && !params) return <p role="alert" className="text-rouge-alerte">{erreur}</p>;
  if (!params) return null;

  return (
    <div className="grid gap-5">
      {/* Textes du bandeau */}
      <section className={CARTE} aria-labelledby="titre-textes">
        <h2 id="titre-textes" className="font-display text-2xl">Textes du bandeau</h2>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="titre" className="text-sm font-semibold">Titre</label>
            <input id="titre" className={CHAMP} value={params.titre} maxLength={80}
              onChange={(e) => modif('titre', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="description" className="text-sm font-semibold">Description</label>
            <textarea id="description" className={`${CHAMP} min-h-[5rem] py-2`} value={params.description} maxLength={600}
              onChange={(e) => modif('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4 tablette:grid-cols-4">
            {(
              [
                ['texte_tout_accepter', 'Tout accepter'],
                ['texte_refuser', 'Tout refuser'],
                ['texte_personnaliser', 'Personnaliser'],
                ['texte_enregistrer', 'Enregistrer'],
              ] as const
            ).map(([cle, libelle]) => (
              <div key={cle} className="grid gap-1.5">
                <label htmlFor={cle} className="text-sm font-semibold">{libelle}</label>
                <input id={cle} className={CHAMP} value={params[cle]} maxLength={80}
                  onChange={(e) => modif(cle, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="url_confidentialite" className="text-sm font-semibold">URL Confidentialité</label>
            <input id="url_confidentialite" className={CHAMP} value={params.url_confidentialite} maxLength={200}
              onChange={(e) => modif('url_confidentialite', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Catégories */}
      <section className={CARTE} aria-labelledby="titre-categories">
        <h2 id="titre-categories" className="font-display text-2xl">Catégories</h2>
        <div className="mt-4 grid gap-6">
          {/* Mesure */}
          <div className="grid gap-3">
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4" checked={params.mesure_active}
                onChange={(e) => modif('mesure_active', e.target.checked)} />
              Mesure d'audience active
            </label>
            {params.mesure_active && (
              <div className="grid gap-3 pl-4 border-l-2 border-trait">
                <div className="grid gap-1.5">
                  <label htmlFor="mesure_titre" className="text-sm font-semibold">Titre</label>
                  <input id="mesure_titre" className={CHAMP} value={params.mesure_titre} maxLength={80}
                    onChange={(e) => modif('mesure_titre', e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="mesure_description" className="text-sm font-semibold">Description</label>
                  <textarea id="mesure_description" className={`${CHAMP} min-h-[4rem] py-2`} value={params.mesure_description} maxLength={600}
                    onChange={(e) => modif('mesure_description', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Publicité */}
          <div className="grid gap-3">
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4" checked={params.publicite_active}
                onChange={(e) => modif('publicite_active', e.target.checked)} />
              Publicité active
            </label>
            {params.publicite_active && (
              <div className="grid gap-3 pl-4 border-l-2 border-trait">
                <div className="grid gap-1.5">
                  <label htmlFor="publicite_titre" className="text-sm font-semibold">Titre</label>
                  <input id="publicite_titre" className={CHAMP} value={params.publicite_titre} maxLength={80}
                    onChange={(e) => modif('publicite_titre', e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="publicite_description" className="text-sm font-semibold">Description</label>
                  <textarea id="publicite_description" className={`${CHAMP} min-h-[4rem] py-2`} value={params.publicite_description} maxLength={600}
                    onChange={(e) => modif('publicite_description', e.target.value)} />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Durée */}
      <section className={CARTE} aria-labelledby="titre-duree">
        <h2 id="titre-duree" className="font-display text-2xl">Durée de validité</h2>
        <div className="mt-4 grid gap-1.5">
          <label htmlFor="duree" className="text-sm font-semibold">Durée (jours, 1 à 395)</label>
          <input id="duree" type="number" min={1} max={395} className={`${CHAMP} w-32`}
            value={params.duree_consentement_jours}
            onChange={(e) => modif('duree_consentement_jours', Math.min(395, Math.max(1, parseInt(e.target.value) || 1)))} />
          <p className="text-sm text-encre-2">Recommandé&nbsp;: 365 jours (13&nbsp;mois CNIL).</p>
        </div>
      </section>

      {/* Bouton enregistrer */}
      <div className="flex flex-wrap items-center gap-3">
        {erreur ? <p role="alert" className="text-rouge-alerte">{erreur}</p> : null}
        {confirmation ? <p role="status" className="text-ok">{confirmation}</p> : null}
        <button type="button" className={BOUTON_PLEIN} disabled={enCours} onClick={() => void enregistrer()}>
          {enCours ? 'Enregistrement…' : 'Enregistrer les réglages'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet Statistiques
// ---------------------------------------------------------------------------

function OngletStatistiques() {
  const { client, erreurClient } = useClientAdmin();
  const [periode, setPeriode] = useState<Periode>('30');
  const [stats, setStats] = useState<{
    total: number;
    accept_all: number;
    reject_all: number;
    custom: number;
    tauxMesure: number;
    tauxPublicite: number;
  } | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let actif = true;
    setChargement(true);
    setErreur(null);
    setStats(null);

    void (async () => {
      try {
        const depuis = new Date(Date.now() - parseInt(periode) * 24 * 60 * 60 * 1000).toISOString();

        const [{ count: total }, { count: accept_all }, { count: reject_all }, { count: custom }, { count: tauxMesure }, { count: tauxPublicite }] = await Promise.all([
          client.from('consentements_cookies').select('id', { count: 'exact', head: true }).gte('cree_le', depuis),
          client.from('consentements_cookies').select('id', { count: 'exact', head: true }).gte('cree_le', depuis).eq('action', 'accept_all'),
          client.from('consentements_cookies').select('id', { count: 'exact', head: true }).gte('cree_le', depuis).eq('action', 'reject_all'),
          client.from('consentements_cookies').select('id', { count: 'exact', head: true }).gte('cree_le', depuis).eq('action', 'custom'),
          client.from('consentements_cookies').select('id', { count: 'exact', head: true }).gte('cree_le', depuis).eq('mesure_acceptee', true),
          client.from('consentements_cookies').select('id', { count: 'exact', head: true }).gte('cree_le', depuis).eq('publicite_acceptee', true),
        ]);

        if (!actif) return;

        const t = total ?? 0;
        setStats({
          total: t,
          accept_all: accept_all ?? 0,
          reject_all: reject_all ?? 0,
          custom: custom ?? 0,
          tauxMesure: t > 0 ? Math.round(((tauxMesure ?? 0) / t) * 100) : 0,
          tauxPublicite: t > 0 ? Math.round(((tauxPublicite ?? 0) / t) * 100) : 0,
        });
      } catch {
        if (actif) setErreur('Les statistiques sont indisponibles.');
      } finally {
        if (actif) setChargement(false);
      }
    })();

    return () => { actif = false; };
  }, [client, periode]);

  if (erreurClient) return <p role="alert" className="text-rouge-alerte">{erreurClient}</p>;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">Période&nbsp;:</span>
        {(['7', '30', '90', '365'] as Periode[]).map((p) => (
          <button key={p} type="button"
            className={`${BOUTON} ${periode === p ? 'bg-encre text-sable' : ''}`}
            onClick={() => setPeriode(p)}>
            {p}&nbsp;j
          </button>
        ))}
      </div>

      {chargement ? <p role="status">Calcul des statistiques…</p> : null}
      {erreur ? <p role="alert" className="text-rouge-alerte">{erreur}</p> : null}

      {stats ? (
        <div className="grid gap-4 tablette:grid-cols-2 paysage:grid-cols-3">
          {[
            { libelle: 'Total', valeur: stats.total },
            { libelle: 'Tout accepté', valeur: stats.accept_all },
            { libelle: 'Tout refusé', valeur: stats.reject_all },
            { libelle: 'Personnalisé', valeur: stats.custom },
            { libelle: 'Taux mesure', valeur: `${stats.tauxMesure} %` },
            { libelle: 'Taux publicité', valeur: `${stats.tauxPublicite} %` },
          ].map(({ libelle, valeur }) => (
            <div key={libelle} className={CARTE}>
              <p className="text-xs font-bold tracking-[.18em] text-or-ink uppercase">{libelle}</p>
              <p className="mt-2 font-display text-4xl">{valeur}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet Journal
// ---------------------------------------------------------------------------

function OngletJournal() {
  const { client, erreurClient } = useClientAdmin();
  const [lignes, setLignes] = useState<LigneJournal[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [enPurge, setEnPurge] = useState(false);
  const [confirmationPurge, setConfirmationPurge] = useState(false);

  useEffect(() => {
    if (!client) return;
    let actif = true;
    setLignes(null);
    setErreur(null);

    void (async () => {
      try {
        const { data, error, count } = await client
          .from('consentements_cookies')
          .select('id,visiteur_id,ip_hachee,agent_utilisateur,consentement_donne,mesure_acceptee,publicite_acceptee,action,url_page,provenance,cree_le', { count: 'exact' })
          .order('cree_le', { ascending: false })
          .range(page * TAILLE_PAGE_JOURNAL, (page + 1) * TAILLE_PAGE_JOURNAL - 1);
        if (!actif) return;
        if (error) throw error;
        setLignes((data ?? []) as LigneJournal[]);
        setTotal(count ?? 0);
      } catch {
        if (actif) setErreur('Le journal est indisponible.');
      }
    })();

    return () => { actif = false; };
  }, [client, page, revision]);

  async function purger() {
    if (!client || enPurge) return;
    setEnPurge(true);
    setErreur(null);
    const limite = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const { error } = await client.from('consentements_cookies').delete().lt('cree_le', limite);
      if (error) throw error;
      setConfirmationPurge(false);
      setPage(0);
      setRevision((v) => v + 1);
    } catch {
      setErreur('La purge a échoué. Réessayez.');
    } finally {
      setEnPurge(false);
    }
  }

  if (erreurClient) return <p role="alert" className="text-rouge-alerte">{erreurClient}</p>;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-encre-2">Consentements enregistrés pour audit RGPD.</p>

        {confirmationPurge ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Supprimer toutes les entrées de plus d'un an&nbsp;?</span>
            <button type="button" className={`${BOUTON} text-rouge-alerte`} disabled={enPurge}
              onClick={() => void purger()}>
              {enPurge ? 'Purge…' : 'Confirmer la purge'}
            </button>
            <button type="button" className={BOUTON} disabled={enPurge} onClick={() => setConfirmationPurge(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <button type="button" className={`${BOUTON} text-rouge-alerte`}
            onClick={() => setConfirmationPurge(true)}>
            Purger (&gt; 365 jours)
          </button>
        )}
      </div>

      {erreur ? (
        <p role="alert" className="text-rouge-alerte">{erreur}</p>
      ) : null}

      {!lignes && !erreur ? <p role="status">Lecture du journal…</p> : null}

      {lignes?.length === 0 ? (
        <p className={CARTE}>Aucune entrée dans le journal.</p>
      ) : null}

      {lignes?.length ? (
        <div className={`${CARTE} overflow-x-auto`}>
          <table className="w-full text-sm" aria-label="Journal des consentements">
            <thead>
              <tr className="border-b border-trait text-left text-xs font-bold tracking-[.14em] text-encre-2 uppercase">
                <th className="pb-2 pr-4 whitespace-nowrap">Date</th>
                <th className="pb-2 pr-4 whitespace-nowrap">Action</th>
                <th className="pb-2 pr-4 whitespace-nowrap">Mesure</th>
                <th className="pb-2 pr-4 whitespace-nowrap">Publicité</th>
                <th className="pb-2 pr-4">Page</th>
                <th className="pb-2 pr-4">Provenance</th>
                <th className="pb-2">Visiteur</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr key={ligne.id} className="border-b border-trait last:border-0">
                  <td className="py-3 pr-4 whitespace-nowrap text-encre-2">
                    {new Date(ligne.cree_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      ligne.action === 'accept_all' ? 'bg-ok/10 text-ok' :
                      ligne.action === 'reject_all' ? 'bg-rouge/10 text-rouge-alerte' :
                      'bg-ambre/15 text-or-ink'
                    }`}>
                      {LIBELLE_ACTION[ligne.action]}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{ligne.mesure_acceptee ? '✓' : '–'}</td>
                  <td className="py-3 pr-4">{ligne.publicite_acceptee ? '✓' : '–'}</td>
                  <td className="py-3 pr-4 max-w-[200px] truncate text-encre-2">
                    {ligne.url_page ?? '–'}
                  </td>
                  <td className="py-3 pr-4 text-encre-2">
                    {ligne.provenance ?? '–'}
                  </td>
                  <td className="py-3 font-mono text-xs text-encre-2">
                    {ligne.visiteur_id.substring(0, 8)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {total > TAILLE_PAGE_JOURNAL ? (
        <nav aria-label="Pages du journal" className="flex items-center justify-between gap-3">
          <button type="button" className={BOUTON} disabled={page === 0} onClick={() => setPage((v) => v - 1)}>
            ← Précédente
          </button>
          <span className="text-sm">
            Page {page + 1} sur {Math.ceil(total / TAILLE_PAGE_JOURNAL)}
          </span>
          <button type="button" className={BOUTON}
            disabled={(page + 1) * TAILLE_PAGE_JOURNAL >= total}
            onClick={() => setPage((v) => v + 1)}>
            Suivante →
          </button>
        </nav>
      ) : null}
    </div>
  );
}
