/**
 * Éditeur d'un modèle d'e-mail : textes, barre de variables et de mise en forme, moment d'envoi,
 * aperçu en direct, enregistrement, test à l'adresse de l'admin et retour au texte d'origine.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MODELES_DEFAUT, VARIABLES, variablesInconnues, type VariableEmail } from '../../../../serveur/gabarits-emails.mjs';
import { BOUTON, BOUTON_PLEIN, CARTE, CHAMP } from '../CadreAdmin';
import { ApercuEmail, type LargeurApercu } from './ApercuEmail';
import { appelerApiAdmin, enregistrerModele, type DateCalendrier, type MajModele, type ModeEnvoi, type ModeleEmailLigne } from './donnees';
import {
  aUneEcheance,
  heureSaisie,
  heureValide,
  HEURE_MAX,
  HEURE_MIN,
  insererBouton,
  insererGras,
  insererLien,
  insererListe,
  insererVariable,
  instantEnClair,
  jourParisDe,
  joursValides,
  JOURS_MAX,
  JOURS_MIN,
  libelleChoixJours,
  libelleOptionDate,
  POUR_QUI,
  preparerApercu,
  quandEnClair,
  type Insertion,
} from './outils';

const NB = '\u00a0';

// ---------------------------------------------------------------------------
// Insertion au curseur, partagée avec le message aux inscrits
// ---------------------------------------------------------------------------

type Champ = HTMLInputElement | HTMLTextAreaElement;
type Transformation = (valeur: string, debut: number, fin: number) => Insertion;

/** Le dernier champ touché reçoit les insertions, à l'endroit du curseur (gardé après la perte du focus). */
export function useInsertion<K extends string>(valeurs: Record<K, string>, changer: (cle: K, valeur: string) => void, initiale: K) {
  const refs = useRef<Partial<Record<K, Champ | null>>>({});
  const [cible, setCible] = useState<K>(initiale);

  function brancher(cle: K) {
    return {
      ref: (element: Champ | null) => { refs.current[cle] = element; },
      onFocus: () => setCible(cle),
    };
  }

  function appliquer(transformer: Transformation) {
    const champ = refs.current[cible];
    const valeur = valeurs[cible];
    const debut = champ?.selectionStart ?? valeur.length;
    const fin = champ?.selectionEnd ?? debut;
    const resultat = transformer(valeur, debut, fin);
    changer(cible, resultat.valeur);
    requestAnimationFrame(() => {
      const element = refs.current[cible];
      if (!element) return;
      element.focus();
      element.setSelectionRange(resultat.debut, resultat.fin);
    });
  }

  return { cible, brancher, appliquer };
}

const GROUPES: ReadonlyArray<VariableEmail['groupe']> = ['Personne', 'Date', 'Lieu', 'Infos', 'Liens'];
const OUTILS: ReadonlyArray<{ libelle: string; aide: string; transformer: Transformation }> = [
  { libelle: 'Gras', aide: `Met la sélection en gras${NB}: **texte**`, transformer: insererGras },
  { libelle: 'Lien', aide: `Fait un lien de la sélection${NB}: [texte](https://…)`, transformer: insererLien },
  { libelle: 'Liste', aide: `Met la ligne en liste à puces${NB}: - élément`, transformer: insererListe },
  { libelle: 'Bouton', aide: `Ajoute un bouton seul sur sa ligne${NB}: [[Texte|https://…]]`, transformer: insererBouton },
];

/** Un clic n'enlève pas le focus du champ : la sélection reste celle de l'admin. */
const garderLeFocus = (evenement: { preventDefault: () => void }) => evenement.preventDefault();

export function BarreInsertion({ libelleCible, riche, appliquer }: {
  libelleCible: string;
  riche: boolean;
  appliquer: (transformer: Transformation) => void;
}) {
  return (
    // Conteneur de requête : le code {{…}} des variables ne s'affiche que si la barre a la place.
    <div className="@container grid gap-3 rounded-2xl border border-trait bg-sable p-3">
      <p className="text-xs text-encre-2">
        Les boutons insèrent dans «{NB}<span className="font-semibold text-encre">{libelleCible}</span>{NB}», à l’endroit du curseur.
      </p>
      <div role="group" aria-label="Mise en forme" className="flex flex-wrap gap-2">
        {OUTILS.map((outil) => (
          <button
            key={outil.libelle}
            type="button"
            title={riche ? outil.aide : 'Mise en forme réservée au corps du message'}
            disabled={!riche}
            onMouseDown={garderLeFocus}
            onClick={() => appliquer(outil.transformer)}
            className={`${BOUTON} min-h-10 bg-creme`}
          >
            {outil.libelle}
          </button>
        ))}
      </div>
      <div className="grid gap-2.5">
        {GROUPES.map((groupe) => (
          <div key={groupe} role="group" aria-label={`Variables${NB}: ${groupe}`} className="flex flex-wrap items-center gap-1.5">
            <span aria-hidden="true" className="mr-1 text-xs font-bold tracking-[.14em] text-or-ink uppercase">{groupe}</span>
            {VARIABLES.filter((variable) => variable.groupe === groupe).map((variable) => (
              <button
                key={variable.cle}
                type="button"
                title={`{{${variable.cle}}} · exemple${NB}: ${variable.exemple}`}
                onMouseDown={garderLeFocus}
                onClick={() => appliquer((valeur, debut, fin) => insererVariable(valeur, debut, fin, variable.cle))}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-trait bg-creme px-2.5 text-left text-[13px] hover:border-or"
              >
                <span>{variable.libelle}</span>{' '}
                <code className="sr-only font-mono text-xs text-encre-2 @lg:not-sr-only">{`{{${variable.cle}}}`}</code>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Alerte des variables absentes de VARIABLES : rendues vides dans l'email. */
export function AlerteVariables({ textes }: { textes: readonly string[] }) {
  const inconnues = variablesInconnues(textes.join('\n'));
  if (!inconnues.length) return null;
  return (
    <p role="alert" className="rounded-xl border border-alerte bg-ambre/15 px-3 py-2 text-sm">
      <span className="font-semibold">Variable inconnue{NB}:</span> {inconnues.map((nom) => `{{${nom}}}`).join(', ')}.
      {' '}Elle serait remplacée par un vide dans l’email. Choisissez une variable dans la liste.
    </p>
  );
}

// ---------------------------------------------------------------------------
// Éditeur
// ---------------------------------------------------------------------------

type Brouillon = { sujet: string; preheader: string; corps: string; encart: string; jours: number | null; heure: string };
type ChampTexte = 'sujet' | 'preheader' | 'corps' | 'encart';
type Retour = { etat: 'repos' } | { etat: 'encours' } | { etat: 'ok' | 'erreur'; message: string };

const LIBELLES_CHAMPS: Record<ChampTexte, string> = {
  sujet: 'Objet', preheader: 'Texte d’aperçu', corps: 'Corps du message', encart: `Encart «${NB}date proche${NB}»`,
};
const CHOIX_JOURS = Array.from({ length: JOURS_MAX - JOURS_MIN + 1 }, (_, index) => JOURS_MIN + index);

const brouillonDe = (modele: ModeleEmailLigne): Brouillon => ({
  sujet: modele.sujet, preheader: modele.preheader, corps: modele.corps, encart: modele.encart ?? '',
  jours: modele.jours_decalage, heure: heureSaisie(modele.heure_envoi),
});

const MESSAGES_TEST: Record<ModeEnvoi, (email: string) => string> = {
  smtp: (email) => `Test envoyé à ${email} (mode smtp). Il arrive dans votre boîte d’ici une minute.`,
  log: () => `Test simulé (mode log)${NB}: il est écrit dans le journal du serveur, aucun email n’est parti.`,
  off: () => `Envoi coupé (mode off)${NB}: aucun test n’est parti.`,
};

/** Date proposée par défaut : la prochaine date confirmée, sinon la prochaine, sinon la dernière connue. */
function dateParDefaut(dates: readonly DateCalendrier[]): string {
  const aujourdhui = jourParisDe(new Date());
  const avenir = dates.filter((date) => date.date_soiree >= aujourdhui);
  return (avenir.find((date) => date.statut === 'confirmee') ?? avenir[0] ?? dates[dates.length - 1])?.id ?? '';
}

export function Editeur({ modele, dates, client, jeton, emailAdmin, focaliser, onEnregistre, onFermer }: {
  modele: ModeleEmailLigne;
  dates: readonly DateCalendrier[];
  client: SupabaseClient;
  jeton: string | null;
  emailAdmin: string | null;
  /** Ouvert depuis la frise : le bouton cliqué a disparu, le focus passe au titre de l'éditeur. */
  focaliser: boolean;
  onEnregistre: (ligne: ModeleEmailLigne) => void;
  onFermer: () => void;
}) {
  const { cle } = modele;
  const datee = aUneEcheance(cle);
  const bienvenue = cle === 'bienvenue';
  const [brouillon, setBrouillon] = useState<Brouillon>(() => brouillonDe(modele));
  const [dateId, setDateId] = useState(() => dateParDefaut(dates));
  const [prenom, setPrenom] = useState('Camille');
  const [exemples, setExemples] = useState(false);
  const [encartVisible, setEncartVisible] = useState(true);
  const [largeur, setLargeur] = useState<LargeurApercu>('mobile');
  const [enregistrement, setEnregistrement] = useState<Retour>({ etat: 'repos' });
  const [test, setTest] = useState<Retour>({ etat: 'repos' });
  const [confirmerOrigine, setConfirmerOrigine] = useState(false);
  const [confirmerQuitter, setConfirmerQuitter] = useState(false);
  const [maintenant] = useState(() => new Date());
  const [origine] = useState(() => (typeof window === 'undefined' ? 'https://olympiadedesmanades.fr' : window.location.origin));
  const titre = useRef<HTMLHeadingElement>(null);

  // Changement de vue depuis la frise : le titre de l'éditeur reçoit le focus (et vient à l'écran).
  useEffect(() => { if (focaliser) titre.current?.focus(); }, []);

  const modifier = (champ: keyof Brouillon, valeur: Brouillon[keyof Brouillon]) => {
    setBrouillon((avant) => ({ ...avant, [champ]: valeur }));
    setEnregistrement({ etat: 'repos' });
  };
  const insertion = useInsertion<ChampTexte>(brouillon, (champ, valeur) => modifier(champ, valeur), 'corps');

  const saisi = brouillonDe(modele);
  const modifie = (Object.keys(saisi) as (keyof Brouillon)[]).some((champ) => saisi[champ] !== brouillon[champ]);
  const erreurs = {
    sujet: brouillon.sujet.trim() ? null : 'L’objet est obligatoire.',
    corps: brouillon.corps.trim() ? null : 'Le corps du message est obligatoire.',
    heure: !datee || heureValide(brouillon.heure) ? null : `L’heure d’envoi doit être comprise entre 7${NB}h et 21${NB}h.`,
    jours: !datee || (brouillon.jours !== null && joursValides(brouillon.jours)) ? null : 'Choisissez le jour d’envoi.',
  };
  const valide = Object.values(erreurs).every((erreur) => erreur === null);

  const date = dates.find((ligne) => ligne.id === dateId) ?? null;
  const modeleApercu = useMemo(() => ({
    sujet: brouillon.sujet, preheader: brouillon.preheader, corps: brouillon.corps, encart: bienvenue ? brouillon.encart : null,
  }), [brouillon.sujet, brouillon.preheader, brouillon.corps, brouillon.encart, bienvenue]);
  const { contexte, instant } = useMemo(() => preparerApercu({
    cle, reglage: { jours_decalage: brouillon.jours, heure_envoi: brouillon.heure || null }, date, dates,
    prenom, origine, maintenant, exemples, encart: encartVisible,
  }), [cle, brouillon.jours, brouillon.heure, date, dates, prenom, origine, maintenant, exemples, encartVisible]);
  const pour = prenom.trim() ? `pour ${prenom.trim()}` : 'sans prénom';
  const legende = datee && instant !== maintenant ? `Tel qu’il partira le ${instantEnClair(instant)}, ${pour}.`
    : bienvenue && contexte.encartDateProche ? `Tel que reçu 3 jours avant la date, ${pour}.`
      : `Tel qu’il partirait maintenant, ${pour}.`;

  async function enregistrer() {
    if (enregistrement.etat === 'encours') return;
    if (!valide) {
      setEnregistrement({ etat: 'erreur', message: 'Corrigez les champs signalés avant d’enregistrer.' });
      return;
    }
    const champs: MajModele = {
      sujet: brouillon.sujet, preheader: brouillon.preheader, corps: brouillon.corps,
      encart: bienvenue ? brouillon.encart : null,
      ...(datee ? { jours_decalage: brouillon.jours, heure_envoi: brouillon.heure } : {}),
    };
    setEnregistrement({ etat: 'encours' });
    const resultat = await enregistrerModele(client, cle, champs);
    if (!resultat.ok) {
      setEnregistrement({ etat: 'erreur', message: resultat.message });
      return;
    }
    onEnregistre(resultat.valeur);
    setEnregistrement({ etat: 'ok', message: 'Modèle enregistré. Les prochains envois utilisent ce texte.' });
  }

  async function envoyerTest() {
    if (!jeton || test.etat === 'encours') return;
    setTest({ etat: 'encours' });
    const reponse = await appelerApiAdmin<{ ok: boolean; mode: ModeEnvoi }>('/api/admin/emails/test', jeton, {
      cle,
      brouillon: { sujet: brouillon.sujet, preheader: brouillon.preheader, corps: brouillon.corps, encart: bienvenue ? brouillon.encart : null },
      calendrierId: date?.id ?? null,
    });
    if (!reponse.ok) setTest({ etat: 'erreur', message: reponse.message });
    else setTest({ etat: 'ok', message: (MESSAGES_TEST[reponse.donnees.mode] ?? MESSAGES_TEST.log)(emailAdmin ?? 'votre adresse') });
  }

  function revenirOrigine() {
    const origineTexte = MODELES_DEFAUT[cle];
    setBrouillon((avant) => ({
      ...avant, sujet: origineTexte.sujet, preheader: origineTexte.preheader, corps: origineTexte.corps, encart: origineTexte.encart ?? '',
    }));
    setConfirmerOrigine(false);
    setEnregistrement({ etat: 'repos' });
  }

  const champTexte = (champ: ChampTexte, multiligne: boolean, maxLength: number, aide: string) => {
    const id = `modele-${champ}`;
    const erreur = champ === 'sujet' || champ === 'corps' ? erreurs[champ] : null;
    const props = {
      id, value: brouillon[champ], maxLength, ...insertion.brancher(champ),
      'aria-describedby': `${id}-aide${erreur ? ` ${id}-erreur` : ''}`,
      'aria-invalid': erreur ? true : undefined,
      onChange: (evenement: { target: { value: string } }) => modifier(champ, evenement.target.value),
    };
    return (
      <div className="grid gap-1.5">
        <label htmlFor={id} className="text-sm font-semibold">{LIBELLES_CHAMPS[champ]}</label>
        {multiligne
          ? <textarea {...props} rows={champ === 'corps' ? 14 : 9} className={`${CHAMP} py-2 font-mono text-sm leading-relaxed`} />
          : <input {...props} className={CHAMP} />}
        <p id={`${id}-aide`} className="text-xs text-encre-2">
          {aide} {multiligne ? `${brouillon[champ].length}${NB}/${NB}${maxLength}` : null}
        </p>
        {erreur ? <p id={`${id}-erreur`} className="text-sm text-rouge-alerte">{erreur}</p> : null}
      </div>
    );
  };

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {confirmerQuitter ? (
          <div role="group" aria-label="Quitter l’éditeur" className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Vos modifications ne sont pas enregistrées. Quitter quand même{NB}?</span>
            <button type="button" className={BOUTON} onClick={onFermer}>Quitter sans enregistrer</button>
            <button type="button" className={BOUTON} onClick={() => setConfirmerQuitter(false)}>Rester</button>
          </div>
        ) : (
          <button type="button" className="inline-flex min-h-12 items-center text-sm font-medium text-encre-2 underline underline-offset-4"
            onClick={() => (modifie ? setConfirmerQuitter(true) : onFermer())}>
            ← Toute la séquence
          </button>
        )}
      </div>

      <header className={CARTE}>
        <p className="text-xs font-bold tracking-[.18em] text-or-ink uppercase">Modèle d’email</p>
        <h2 ref={titre} tabIndex={-1} className="mt-1 font-display text-3xl outline-none">{modele.nom}</h2>
        <p className="mt-2 text-sm text-encre-2">{POUR_QUI[cle]}.</p>
        {!modele.actif ? (
          <p className="mt-3 rounded-xl border border-alerte bg-ambre/15 px-3 py-2 text-sm">
            Cet email est désactivé{NB}: il ne part pas. Réactivez-le depuis la séquence.
          </p>
        ) : null}
        {modifie ? <p className="mt-3 text-sm font-semibold text-or-ink">Modifications non enregistrées</p> : null}
      </header>

      <div className={`grid gap-5 ${largeur === 'mobile' ? 'paysage:grid-cols-[minmax(0,1fr)_402px]' : 'paysage:grid-cols-[minmax(0,1fr)_650px]'}`}>
        <div className="grid min-w-0 content-start gap-5">
          <section className={`${CARTE} grid gap-4`} aria-labelledby="titre-textes-modele">
            <h3 id="titre-textes-modele" className="font-display text-xl">Textes</h3>
            {champTexte('sujet', false, 200, 'Les variables marchent aussi dans l’objet.')}
            {champTexte('preheader', false, 200, 'Quelques mots affichés après l’objet dans la boîte de réception.')}
            <BarreInsertion
              libelleCible={LIBELLES_CHAMPS[insertion.cible]}
              riche={insertion.cible === 'corps' || insertion.cible === 'encart'}
              appliquer={insertion.appliquer}
            />
            {champTexte('corps', true, 8000, 'Une ligne vide sépare deux paragraphes. Une ligne dont l’info n’est pas encore connue (heure, billetterie, vainqueur…) n’apparaît pas.')}
            {bienvenue ? champTexte('encart', true, 4000, 'Ajouté à la bienvenue quand la date tombe dans les 7 jours qui suivent l’inscription.') : null}
            <AlerteVariables textes={[brouillon.sujet, brouillon.preheader, brouillon.corps, bienvenue ? brouillon.encart : '']} />
          </section>

          <section className={`${CARTE} grid gap-4`} aria-labelledby="titre-quand-modele">
            <h3 id="titre-quand-modele" className="font-display text-xl">Quand</h3>
            {datee ? (
              <>
                <div className="grid gap-4 tablette:grid-cols-2">
                  <div className="grid gap-1.5">
                    <label htmlFor="modele-jours" className="text-sm font-semibold">Jour d’envoi</label>
                    <select id="modele-jours" className={CHAMP} value={brouillon.jours ?? ''}
                      onChange={(evenement) => modifier('jours', evenement.target.value === '' ? null : Number(evenement.target.value))}>
                      {brouillon.jours === null ? <option value="">Choisir</option> : null}
                      {CHOIX_JOURS.map((jours) => (
                        <option key={jours} value={jours}>{libelleChoixJours(jours, cle === 'annonce')}</option>
                      ))}
                    </select>
                    {erreurs.jours ? <p className="text-sm text-rouge-alerte">{erreurs.jours}</p> : null}
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="modele-heure" className="text-sm font-semibold">Heure d’envoi</label>
                    <input id="modele-heure" type="time" min={HEURE_MIN} max={HEURE_MAX} step={300} className={CHAMP}
                      value={brouillon.heure} aria-invalid={erreurs.heure ? true : undefined}
                      aria-describedby={erreurs.heure ? 'modele-heure-erreur' : undefined}
                      onChange={(evenement) => modifier('heure', evenement.target.value)} />
                    {erreurs.heure ? <p id="modele-heure-erreur" className="text-sm text-rouge-alerte">{erreurs.heure}</p> : null}
                  </div>
                </div>
                <p className="text-sm text-encre-2">
                  {quandEnClair(cle, brouillon.jours, brouillon.heure || null)}, heure de Paris. Réglable de 14 jours avant à 7 jours après la date, entre 7{NB}h et 21{NB}h.
                </p>
              </>
            ) : (
              <p className="text-sm">{quandEnClair(cle, null, null)}. Cet email ne se règle pas sur une date.</p>
            )}
          </section>
        </div>

        {/* Sous l'en-tête collant du site (environ 67 px) : l'aperçu reste visible pendant la saisie. */}
        <div className={`${CARTE} grid min-w-0 content-start gap-4 p-3 tablette:p-3 paysage:sticky paysage:top-[5.5rem] paysage:max-h-[calc(100dvh-6.5rem)] paysage:self-start paysage:overflow-y-auto`}>
          <div className="grid gap-2 px-1 pt-1">
            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-end gap-2">
              <div className="grid min-w-0 gap-1">
                <label htmlFor="apercu-date" className="text-sm font-semibold">Date d’exemple</label>
                <select id="apercu-date" className={`${CHAMP} min-h-10`} value={dateId} onChange={(evenement) => setDateId(evenement.target.value)}>
                  {dates.length ? null : <option value="">Aucune date au calendrier</option>}
                  {dates.map((ligne) => <option key={ligne.id} value={ligne.id}>{libelleOptionDate(ligne)}</option>)}
                </select>
              </div>
              <div className="grid min-w-0 gap-1">
                <label htmlFor="apercu-prenom" className="text-sm font-semibold">Prénom d’exemple</label>
                <input id="apercu-prenom" className={`${CHAMP} min-h-10`} value={prenom} maxLength={60} onChange={(evenement) => setPrenom(evenement.target.value)} />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm" title="Heure, arènes, billetterie, infos pratiques, manades, vainqueur">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-encre" checked={exemples} onChange={(evenement) => setExemples(evenement.target.checked)} />
              Remplir les infos pas encore connues par des exemples
            </label>
            {bienvenue ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-encre" checked={encartVisible} onChange={(evenement) => setEncartVisible(evenement.target.checked)} />
                Montrer l’encart «{NB}date proche{NB}»
              </label>
            ) : null}
          </div>
          <ApercuEmail id="apercu-modele" modele={modeleApercu} contexte={contexte} largeur={largeur} onLargeur={setLargeur} legende={legende} />
        </div>
      </div>

      <section className={`${CARTE} grid gap-3`} aria-label="Actions sur le modèle">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BOUTON_PLEIN} disabled={enregistrement.etat === 'encours'} onClick={() => void enregistrer()}>
            {enregistrement.etat === 'encours' ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className={BOUTON} disabled={!jeton || test.etat === 'encours'} onClick={() => void envoyerTest()}>
            {test.etat === 'encours' ? 'Envoi du test…' : 'M’envoyer un test'}
          </button>
          {confirmerOrigine ? null : (
            <button type="button" className={BOUTON} onClick={() => setConfirmerOrigine(true)}>Revenir au texte d’origine</button>
          )}
        </div>
        {confirmerOrigine ? (
          <div role="group" aria-label="Revenir au texte d’origine" className="grid gap-2 rounded-xl border border-alerte bg-ambre/15 p-3">
            <p className="text-sm">
              Remplacer l’objet, le texte d’aperçu, le corps{bienvenue ? ' et l’encart' : ''} par le texte d’origine{NB}? Vos changements de texte seront perdus. Le moment d’envoi ne change pas, et rien n’est enregistré avant «{NB}Enregistrer{NB}».
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BOUTON_PLEIN} onClick={revenirOrigine}>Remplacer par le texte d’origine</button>
              <button type="button" className={BOUTON} onClick={() => setConfirmerOrigine(false)}>Annuler</button>
            </div>
          </div>
        ) : null}
        <p className="text-xs text-encre-2">Le test part à {emailAdmin ?? 'votre adresse'}, avec le texte affiché (même non enregistré) et la date d’exemple. 10 tests par heure au plus.</p>
        {enregistrement.etat === 'ok' ? <p role="status" className="text-ok">{enregistrement.message}</p> : null}
        {enregistrement.etat === 'erreur' ? <p role="alert" className="text-rouge-alerte">{enregistrement.message}</p> : null}
        {test.etat === 'ok' ? <p role="status">{test.message}</p> : null}
        {test.etat === 'erreur' ? <p role="alert" className="text-rouge-alerte">{test.message}</p> : null}
      </section>
    </div>
  );
}
