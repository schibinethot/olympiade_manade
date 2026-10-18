/**
 * Éditeur d'un modèle d'e-mail : objet, texte d'aperçu, corps (et encart de bienvenue) avec la barre
 * d'insertion, réglage « Quand », aperçu en direct, barre d'actions collante tant que le texte est
 * modifié (Enregistrer, M'envoyer un test), retour au texte d'origine après confirmation.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BOUTON, BOUTON_PLEIN, CARTE, CHAMP } from '../CadreAdmin';
import { appelerApiAdmin, enregistrerModele, type DateCalendrier, type ModeEnvoi, type ModeleEmailLigne } from './donnees';
import { AlerteVariables, BarreInsertion, useInsertion } from './Insertion';
import { dateParDefaut, POUR_QUI } from './outils';
import { PanneauApercu } from './PanneauApercu';
import { ReglageQuand } from './ReglageQuand';
import { ALERTE } from './styles';
import { useBrouillonModele, type Brouillon, type ChampBrouillon } from './useBrouillonModele';

const NB = ' ';

type NomChamp = 'sujet' | 'preheader' | 'corps' | 'encart';
type Retour = { etat: 'repos' } | { etat: 'encours' } | { etat: 'ok' | 'erreur'; message: string };
const REPOS: Retour = { etat: 'repos' };

const LIBELLES: Record<NomChamp, string> = {
  sujet: 'Objet', preheader: 'Texte d’aperçu', corps: 'Corps du message', encart: `Encart «${NB}date proche${NB}»`,
};

const MESSAGES_TEST: Record<ModeEnvoi, (email: string) => string> = {
  smtp: (email) => `Test envoyé à ${email} (mode smtp). Il arrive dans votre boîte d’ici une minute.`,
  log: () => `Test simulé (mode log)${NB}: il est écrit dans le journal du serveur, aucun email n’est parti.`,
  off: () => `Envoi coupé (mode off)${NB}: aucun test n’est parti.`,
};

/** Un champ de texte du modèle, avec son aide, son erreur et, au besoin, la barre d'insertion. */
function ChampTexte({ id, libelle, aide, erreur, avant, multiligne, rows, ...champ }: {
  id: string; libelle: string; aide: string; erreur: string | null; avant?: ReactNode; multiligne: boolean;
  value: string; maxLength: number; rows?: number; onChange: (evenement: { target: { value: string } }) => void;
  ref: (element: HTMLInputElement | HTMLTextAreaElement | null) => void; onFocus: () => void;
}) {
  const proprietes = { ...champ, id, 'aria-describedby': `${id}-aide${erreur ? ` ${id}-erreur` : ''}`, 'aria-invalid': erreur ? true : undefined };
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{libelle}</label>
      {avant}
      {multiligne
        ? <textarea {...proprietes} rows={rows} className={`${CHAMP} py-2 font-mono text-sm leading-relaxed`} />
        : <input {...proprietes} className={CHAMP} />}
      <p id={`${id}-aide`} className="text-xs text-encre-2">{aide}{multiligne ? ` ${champ.value.length}${NB}/${NB}${champ.maxLength}` : ''}</p>
      {erreur ? <p id={`${id}-erreur`} className="text-sm text-rouge-alerte">{erreur}</p> : null}
    </div>
  );
}

export function Editeur({ modele, dates, client, jeton, emailAdmin, focaliser, onEnregistre, onModifie, onFermer }: {
  modele: ModeleEmailLigne;
  dates: readonly DateCalendrier[];
  client: SupabaseClient;
  jeton: string | null;
  emailAdmin: string | null;
  /** Ouvert depuis la frise : le bouton cliqué a disparu, le focus passe au titre de l'éditeur. */
  focaliser: boolean;
  onEnregistre: (ligne: ModeleEmailLigne) => void;
  /** Signale à la page un brouillon à protéger (onglets, liens, retour, rechargement). */
  onModifie: (modifie: boolean) => void;
  onFermer: () => void;
}) {
  const { cle } = modele;
  const b = useBrouillonModele(modele);
  const [dateId, setDateId] = useState(() => dateParDefaut(dates, new Date()));
  const [enregistrement, setEnregistrement] = useState<Retour>(REPOS);
  const [test, setTest] = useState<Retour>(REPOS);
  const [confirmerOrigine, setConfirmerOrigine] = useState(false);
  const titre = useRef<HTMLHeadingElement>(null);
  const question = useRef<HTMLParagraphElement>(null);
  const boutonOrigine = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (focaliser) titre.current?.focus(); }, [focaliser]);
  useEffect(() => { onModifie(b.modifie); }, [b.modifie, onModifie]);
  useEffect(() => () => onModifie(false), [onModifie]);
  useEffect(() => { if (confirmerOrigine) question.current?.focus(); }, [confirmerOrigine]);

  const modifier = <K extends ChampBrouillon>(champ: K, valeur: Brouillon[K]) => {
    b.modifier(champ, valeur);
    setEnregistrement(REPOS);
  };
  const insertion = useInsertion<NomChamp>(b.brouillon, (champ, valeur) => modifier(champ, valeur), 'corps');
  const reglage = useMemo(() => ({ jours_decalage: b.brouillon.jours, heure_envoi: b.brouillon.heure || null }), [b.brouillon.jours, b.brouillon.heure]);

  function fermerConfirmation(revenir: boolean) {
    if (revenir) b.revenirOrigine();
    setConfirmerOrigine(false);
    requestAnimationFrame(() => boutonOrigine.current?.focus());
  }

  async function enregistrer() {
    if (enregistrement.etat === 'encours') return;
    if (!b.valide) return setEnregistrement({ etat: 'erreur', message: 'Corrigez les champs signalés avant d’enregistrer.' });
    setEnregistrement({ etat: 'encours' });
    const resultat = await enregistrerModele(client, cle, b.champs());
    if (!resultat.ok) return setEnregistrement({ etat: 'erreur', message: resultat.message });
    onEnregistre(resultat.valeur);
    setEnregistrement({ etat: 'ok', message: 'Modèle enregistré. Les prochains envois utilisent ce texte.' });
  }

  async function envoyerTest() {
    if (!jeton || test.etat === 'encours') return;
    setTest({ etat: 'encours' });
    const reponse = await appelerApiAdmin<{ ok: boolean; mode: ModeEnvoi }>('/api/admin/emails/test', jeton, {
      cle, brouillon: { ...b.textes, preheader: b.textes.preheader ?? '', encart: b.textes.encart ?? null }, calendrierId: dateId || null,
    });
    if (!reponse.ok) setTest({ etat: 'erreur', message: reponse.message });
    else setTest({ etat: 'ok', message: (MESSAGES_TEST[reponse.donnees.mode] ?? MESSAGES_TEST.log)(emailAdmin ?? 'votre adresse') });
  }

  const champ = (nom: NomChamp, maxLength: number, aide: string, avant?: ReactNode) => (
    <ChampTexte id={`modele-${nom}`} libelle={LIBELLES[nom]} aide={aide} avant={avant} multiligne={nom === 'corps' || nom === 'encart'}
      rows={nom === 'corps' ? 14 : 9} value={b.brouillon[nom]} maxLength={maxLength}
      erreur={nom === 'sujet' || nom === 'corps' ? b.erreurs[nom] : null}
      onChange={(evenement) => modifier(nom, evenement.target.value)} {...insertion.brancher(nom)} />
  );
  const statut = enregistrement.etat === 'ok' ? enregistrement.message : test.etat === 'ok' ? test.message : '';

  return (
    <div className="grid min-w-0 gap-5">
      <button type="button" onClick={onFermer} className="inline-flex min-h-11 items-center justify-self-start text-sm font-medium text-encre-2 underline underline-offset-4">
        ← Toute la séquence
      </button>

      <header className={CARTE}>
        <p className="text-xs font-bold tracking-[.18em] text-or-ink uppercase">Modèle d’email</p>
        <h2 ref={titre} tabIndex={-1} className="mt-1 font-display text-3xl">{modele.nom}</h2>
        <p className="mt-2 text-sm text-encre-2">{POUR_QUI[cle]}.</p>
        {!modele.actif ? <p className={`${ALERTE} mt-3 text-sm`}>Cet email est désactivé{NB}: il ne part pas. Réactivez-le depuis la séquence.</p> : null}
      </header>

      <div className="grid gap-5 paysage:grid-cols-[minmax(0,1fr)_402px]">
        <div className="grid min-w-0 content-start gap-5">
          <section className={`${CARTE} grid gap-4`} aria-labelledby="titre-textes-modele">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="titre-textes-modele" className="font-display text-xl">Textes</h3>
              <button ref={boutonOrigine} type="button" className={BOUTON} onClick={() => setConfirmerOrigine(true)}>Revenir au texte d’origine</button>
            </div>
            {confirmerOrigine ? (
              <div role="group" aria-labelledby="question-origine" className={`${ALERTE} grid gap-2`}>
                <p id="question-origine" ref={question} tabIndex={-1} className="text-sm">
                  Remplacer l’objet, le texte d’aperçu, le corps{b.bienvenue ? ' et l’encart' : ''} par le texte d’origine{NB}? Vos changements de texte seront perdus. Le moment d’envoi ne change pas, et rien n’est enregistré avant «{NB}Enregistrer{NB}».
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={BOUTON_PLEIN} onClick={() => fermerConfirmation(true)}>Remplacer par le texte d’origine</button>
                  <button type="button" className={`${BOUTON} bg-creme`} onClick={() => fermerConfirmation(false)}>Annuler</button>
                </div>
              </div>
            ) : null}
            {champ('sujet', 200, 'Les infos (variables) marchent aussi dans l’objet.')}
            {champ('preheader', 200, 'Quelques mots affichés après l’objet dans la boîte de réception.')}
            {champ('corps', 8000, 'Une ligne vide sépare deux paragraphes. Une ligne dont l’info n’est pas encore connue (heure, billetterie…) n’apparaît pas.',
              <BarreInsertion cle={cle} libelleCible={LIBELLES[insertion.cible]} riche={insertion.cible === 'corps' || insertion.cible === 'encart'} appliquer={insertion.appliquer} />)}
            {b.bienvenue ? champ('encart', 4000, 'Ajouté à la bienvenue quand la date tombe dans les 7 jours qui suivent l’inscription.') : null}
            <AlerteVariables cle={cle} textes={[b.brouillon.sujet, b.brouillon.preheader, b.brouillon.corps, b.bienvenue ? b.brouillon.encart : '']} />
          </section>
          <ReglageQuand cle={cle} datee={b.datee} jours={b.brouillon.jours} heure={b.brouillon.heure} erreurJours={b.erreurs.jours}
            erreurHeure={b.erreurs.heure} onJours={(jours) => modifier('jours', jours)} onHeure={(heure) => modifier('heure', heure)} />
        </div>
        {/* Sous l'en-tête collant du site (environ 67 px), au-dessus de la barre d'actions collante (environ 90 px) :
            l'aperçu reste visible pendant la saisie. */}
        <div className={`${CARTE} min-w-0 p-3 tablette:p-3 paysage:sticky paysage:top-[5.5rem] paysage:max-h-[calc(100dvh-12rem)] paysage:self-start paysage:overflow-y-auto`}>
          <PanneauApercu id="apercu-modele" cle={cle} modele={b.textes} reglage={reglage} dates={dates} dateId={dateId} onDateId={setDateId} niveauTitre={3} />
        </div>
      </div>

      {/* Collante tant que le texte est modifié : « Enregistrer » reste à portée pendant la saisie. */}
      <section aria-label="Actions sur le modèle"
        className={`${CARTE} grid gap-2 py-3 tablette:py-4 ${b.modifie ? 'sticky bottom-0 z-10 shadow-[0_-10px_28px_rgba(28,25,18,0.14)]' : ''}`}>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BOUTON_PLEIN} disabled={enregistrement.etat === 'encours'} onClick={() => void enregistrer()}>
            {enregistrement.etat === 'encours' ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className={BOUTON} disabled={!jeton || test.etat === 'encours'} onClick={() => void envoyerTest()}>
            {test.etat === 'encours' ? 'Envoi du test…' : 'M’envoyer un test'}
          </button>
          {b.modifie ? <span className="text-sm font-semibold text-or-ink">Modifications non enregistrées</span> : null}
        </div>
        {/* Région permanente : le résultat (enregistré, test parti) est annoncé sans déplacer le focus. */}
        <p role="status" className="text-sm text-ok">{statut}</p>
        {enregistrement.etat === 'erreur' ? <p role="alert" className="text-sm text-rouge-alerte">{enregistrement.message}</p> : null}
        {test.etat === 'erreur' ? <p role="alert" className="text-sm text-rouge-alerte">{test.message}</p> : null}
      </section>
      <p className="text-xs text-encre-2">
        Le test part tout de suite à {emailAdmin ?? 'votre adresse'}, avec le texte affiché (même non enregistré) et la date d’exemple. Il porte
        l’heure réelle{NB}: le compte à rebours peut différer de l’aperçu. 10 tests par heure au plus.
      </p>
    </div>
  );
}
