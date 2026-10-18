import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { useNavigate } from 'react-router';
import { formaterDateLongue } from '../lib/dates';
import {
  appelerLien,
  decrireLien,
  ErreurLien,
  garderJeton,
  MESSAGES_LIEN,
  oublierJeton,
  recupererJeton,
  type ActionLien,
  type EtatLien,
  type NatureEchec,
  type TypeLien,
} from '../lib/lienEmail';
import { Icone } from './Icone';
import { TitrePage } from './TitrePage';

const BOUTON =
  'inline-flex min-h-12 w-full items-center justify-center rounded-[13px] px-5 py-3 text-[15px] leading-snug font-semibold text-balance transition-[filter] aria-busy:cursor-wait aria-busy:opacity-60 disabled:cursor-wait disabled:opacity-60 tablette:w-auto';
const BOUTON_PRINCIPAL = `${BOUTON} bg-encre text-creme hover:brightness-125`;
const BOUTON_SECONDAIRE = `${BOUTON} border border-encre bg-transparent text-encre hover:bg-lin`;
const LIEN = 'font-semibold text-rouge underline underline-offset-2 hover:text-encre';

const ENTETES: Record<TypeLien, { surtitre: string; titre: string; intro: string }> = {
  confirmation: {
    surtitre: 'Votre inscription',
    titre: 'Confirmez votre adresse',
    intro: 'Un dernier geste pour recevoir les emails de l’Olympiade des Manades.',
  },
  desinscription: {
    surtitre: 'Vos emails',
    titre: 'Se désinscrire',
    intro: 'Choisissez ce que vous souhaitez continuer à recevoir.',
  },
  je_viens: {
    surtitre: 'Votre venue',
    titre: 'Vous venez ?',
    intro: 'Un clic suffit pour nous le dire.',
  },
};

/**
 * Désinscription sans annonces : un seul bouton. Intro de même longueur que celle à deux choix,
 * affichée pendant le chargement : la page ne saute pas quand l'état du lien arrive.
 */
const INTRO_UN_CHOIX = 'Un seul bouton arrête tous les emails de l’Olympiade des Manades.';

const DEJA_DESINSCRIT = 'Vous ne recevez déjà plus d’emails de l’Olympiade des Manades.';

type Chargement =
  | { phase: 'jeton' }
  | { phase: 'chargement' }
  | { phase: 'erreur'; nature: NatureEchec }
  | { phase: 'pret'; etat: EtatLien };

/**
 * Page d'un lien signé d'email. Elle lit l'état du lien à l'ouverture (aucune écriture) puis envoie
 * l'action choisie au clic. Un lien d'un autre type que la page est traité comme invalide.
 * Le résultat (succès ou erreur définitive) est annoncé et reçoit le focus.
 */
export function LienEmail({ type }: { type: TypeLien }) {
  const [jeton, setJeton] = useState<string | null>(null);
  const [chargement, setChargement] = useState<Chargement>({ phase: 'jeton' });
  const [envoi, setEnvoi] = useState<ActionLien | null>(null);
  const [echec, setEchec] = useState('');
  const [succes, setSucces] = useState<ReactNode>(null);
  const [aAgi, setAAgi] = useState(false);
  const resultat = useRef<HTMLParagraphElement>(null);
  const messageEchec = useRef<HTMLParagraphElement>(null);
  const navigate = useNavigate();
  const entete = ENTETES[type];

  // Jeton lu une fois : un nouveau montage (mode strict de React) le remet dans l'onglet au lieu de relire
  // une adresse déjà nettoyée.
  const jetonLu = useRef<string | null>(null);

  // Le jeton est lu dans l'adresse (#j=, sinon ?j=) puis retiré de l'adresse par le routeur, pour que
  // useLocation ne le garde pas (voir recupererJeton). Il est gardé dans l'onglet pour un rechargement,
  // et retiré de l'onglet quand on quitte la page (revue de code, mineur n° 8).
  useEffect(() => {
    const { pathname, href } = window.location;
    if (jetonLu.current === null) {
      const lu = recupererJeton(pathname, href);
      if (lu.retirer) navigate(pathname, { replace: true });
      jetonLu.current = lu.jeton;
      setJeton(lu.jeton);
    } else if (jetonLu.current) {
      garderJeton(pathname, jetonLu.current);
    }
    return () => oublierJeton();
  }, [navigate]);

  useEffect(() => {
    if (jeton === null) return;
    if (!jeton) {
      setChargement({ phase: 'erreur', nature: 'invalide' });
      return;
    }
    const controle = new AbortController();
    setChargement({ phase: 'chargement' });
    decrireLien(jeton, controle.signal).then(
      (etat) => setChargement(etat.type === type ? { phase: 'pret', etat } : { phase: 'erreur', nature: 'invalide' }),
      (erreur: unknown) => {
        if (controle.signal.aborted) return;
        setChargement({ phase: 'erreur', nature: erreur instanceof ErreurLien ? erreur.nature : 'indisponible' });
      },
    );
    return () => controle.abort();
  }, [jeton, type]);

  const erreurDefinitive = chargement.phase === 'erreur';
  useEffect(() => {
    if (aAgi && (succes || erreurDefinitive)) resultat.current?.focus();
  }, [aAgi, succes, erreurDefinitive]);
  // Échec réessayable : le bouton, désactivé pendant l'appel, a perdu le focus ; il passe au message.
  useEffect(() => {
    if (echec) messageEchec.current?.focus();
  }, [echec]);

  async function agir(action: ActionLien, etat: EtatLien) {
    if (envoi || !jeton) return;
    setEnvoi(action);
    setEchec('');
    try {
      const { etat: reponse } = await appelerLien(jeton, action);
      setSucces(messageSucces(action, etat, reponse === 'deja_fait'));
    } catch (erreur) {
      const echecLien = erreur instanceof ErreurLien ? erreur : new ErreurLien('indisponible');
      if (echecLien.definitif) setChargement({ phase: 'erreur', nature: echecLien.nature });
      else setEchec(echecLien.message);
    } finally {
      setAAgi(true);
      setEnvoi(null);
    }
  }

  const pret = chargement.phase === 'pret' ? chargement.etat : null;
  const dejaDesinscrit = pret !== null && type === 'desinscription' && pret.desinscrit;
  const montreBoutons = pret !== null && !succes && !dejaDesinscrit;
  const enChargement = chargement.phase === 'jeton' || chargement.phase === 'chargement';

  /**
   * Intro de la page. Désinscription : celle à deux choix pendant le chargement, puis selon les
   * annonces ; elle reste après l'action (pas de saut), et disparaît pour un lien refusé ou une
   * adresse déjà désinscrite.
   */
  function intro(): string | null {
    if (type !== 'desinscription') return entete.intro;
    if (enChargement) return entete.intro;
    if (!pret || pret.desinscrit) return null;
    return pret.annonces ? entete.intro : INTRO_UN_CHOIX;
  }
  const texteIntro = intro();

  function boutons(etat: EtatLien): ReactNode {
    if (type === 'confirmation') {
      return (
        <Bouton action="confirmer" courante={envoi} onClick={() => agir('confirmer', etat)} principal>
          Confirmer mon adresse
        </Bouton>
      );
    }
    if (type === 'je_viens') {
      const date = etat.date;
      return (
        <Bouton action="je_viens" courante={envoi} onClick={() => agir('je_viens', etat)} principal>
          {date ? `Je viens le ${formaterDateLongue(date.date)} à ${date.ville}` : 'Je viens'}
        </Bouton>
      );
    }
    return (
      <>
        {etat.annonces ? (
          <Bouton action="arreter_annonces" courante={envoi} onClick={() => agir('arreter_annonces', etat)}>
            Arrêter seulement les annonces
          </Bouton>
        ) : null}
        <Bouton action="desinscrire" courante={envoi} onClick={() => agir('desinscrire', etat)} principal>
          Ne plus rien recevoir
        </Bouton>
      </>
    );
  }

  return (
    <>
      <TitrePage surtitre={entete.surtitre} titre={entete.titre}>
        {texteIntro ? <p>{texteIntro}</p> : null}
      </TitrePage>
      <div className="px-4 pt-6 pb-10 tablette:px-7 paysage:px-10 bureau:px-14">
        <div
          className="max-w-[560px] rounded-[22px] border border-trait bg-creme p-5 tablette:p-7"
          aria-busy={chargement.phase === 'chargement' || envoi !== null}
        >
          <div role="status">
            {enChargement ? (
              <p className="text-[15px] text-encre-2">Vérification du lien…</p>
            ) : null}
            {succes ? <Message icone="valide" reussi refMessage={resultat}>{succes}</Message> : null}
            {dejaDesinscrit && !succes ? <Message icone="valide" reussi>{DEJA_DESINSCRIT}</Message> : null}
          </div>
          {montreBoutons ? (
            <div className="flex flex-col gap-3 tablette:flex-row tablette:flex-wrap">{boutons(pret)}</div>
          ) : null}
          <div role="alert">
            {chargement.phase === 'erreur' ? (
              <Message icone="alerte" refMessage={resultat}>
                {messageErreur(chargement.nature, type)}
              </Message>
            ) : null}
            {echec ? <Message icone="alerte" marge refMessage={messageEchec}>{echec}</Message> : null}
          </div>
        </div>
      </div>
    </>
  );
}

function messageErreur(nature: NatureEchec, type: TypeLien): ReactNode {
  if (nature === 'indisponible') return MESSAGES_LIEN.indisponible;
  if (nature === 'expire' && type === 'confirmation') {
    return (
      <span>
        Ce lien a expiré. Inscrivez-vous à nouveau depuis l’accueil : un nouveau lien vous sera envoyé.{' '}
        <a href="/#actualites" className={LIEN}>Retour au formulaire d’inscription</a>
      </span>
    );
  }
  return (
    <span>
      {MESSAGES_LIEN[nature]}{' '}
      <a href="/contact" className={LIEN}>Nous contacter</a>
    </span>
  );
}

function messageSucces(action: ActionLien, etat: EtatLien, dejaFait: boolean): ReactNode {
  switch (action) {
    case 'confirmer':
      return dejaFait ? 'Votre adresse est déjà confirmée.' : 'Merci, votre adresse est confirmée.';
    case 'arreter_annonces':
      return 'C’est fait : vous ne recevrez plus les annonces des prochaines dates. Les rappels de votre date continuent.';
    case 'desinscrire':
      return 'C’est fait : vous ne recevrez plus aucun email de l’Olympiade des Manades.';
    case 'je_viens':
      return etat.date ? (
        <>
          Merci, c’est noté : à bientôt le {formaterDateLongue(etat.date.date)} à{' '}
          <span className="whitespace-nowrap">{etat.date.ville}</span>.
        </>
      ) : (
        'Merci, c’est noté : à bientôt !'
      );
    default:
      return 'C’est fait.';
  }
}

function Bouton({ action, courante, onClick, principal, children }: {
  action: ActionLien;
  courante: ActionLien | null;
  onClick: () => void;
  principal?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={courante !== null}
      aria-busy={courante === action || undefined}
      className={principal ? BOUTON_PRINCIPAL : BOUTON_SECONDAIRE}
    >
      {children}
    </button>
  );
}

function Message({ icone, reussi, marge, refMessage, children }: {
  icone: 'alerte' | 'valide';
  reussi?: boolean;
  /** Message sous les boutons : la marge est portée par le message, pas par la région vide. */
  marge?: boolean;
  refMessage?: Ref<HTMLParagraphElement>;
  children: ReactNode;
}) {
  return (
    <p
      ref={refMessage}
      tabIndex={refMessage ? -1 : undefined}
      className={`flex items-start gap-3 text-[15px] leading-relaxed font-semibold ${marge ? 'mt-4' : ''} ${reussi ? 'text-encre' : 'text-rouge-alerte'}`}
    >
      <Icone nom={icone} className={`mt-0.5 size-5 shrink-0 ${reussi ? 'text-ok' : ''}`} />
      <span>{children}</span>
    </p>
  );
}
