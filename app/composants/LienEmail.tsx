import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { formaterDateLongue } from '../lib/dates';
import {
  appelerLien,
  decrireLien,
  ErreurLien,
  MESSAGES_LIEN,
  type ActionLien,
  type EtatLien,
  type TypeLien,
} from '../lib/lienEmail';
import { Icone } from './Icone';
import { TitrePage } from './TitrePage';

const BOUTON =
  'inline-flex min-h-12 w-full items-center justify-center rounded-[13px] px-5 text-[15px] font-semibold transition-[filter] disabled:cursor-wait disabled:opacity-60 tablette:w-auto';
const BOUTON_PRINCIPAL = `${BOUTON} bg-encre text-creme hover:brightness-125`;
const BOUTON_SECONDAIRE = `${BOUTON} border border-encre bg-transparent text-encre hover:bg-lin`;

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
    titre: 'Vous venez\u00a0?',
    intro: 'Un clic suffit pour nous le dire.',
  },
};

type Chargement =
  | { phase: 'chargement' }
  | { phase: 'erreur'; message: string }
  | { phase: 'pret'; etat: EtatLien };

/**
 * Page d'un lien signé d'email. Elle lit l'état du lien à l'ouverture (aucune écriture) puis envoie
 * l'action choisie au clic. Un lien d'un autre type que la page est traité comme invalide.
 */
export function LienEmail({ type }: { type: TypeLien }) {
  const [params] = useSearchParams();
  const jeton = params.get('j')?.trim() ?? '';
  const [chargement, setChargement] = useState<Chargement>({ phase: 'chargement' });
  const [envoi, setEnvoi] = useState<ActionLien | null>(null);
  const [echec, setEchec] = useState('');
  const [succes, setSucces] = useState<string | null>(null);
  const entete = ENTETES[type];

  useEffect(() => {
    if (!jeton) {
      setChargement({ phase: 'erreur', message: MESSAGES_LIEN.invalide });
      return;
    }
    const controle = new AbortController();
    setChargement({ phase: 'chargement' });
    decrireLien(jeton, controle.signal).then(
      (etat) =>
        setChargement(
          etat.type === type ? { phase: 'pret', etat } : { phase: 'erreur', message: MESSAGES_LIEN.invalide },
        ),
      (erreur: unknown) => {
        if (controle.signal.aborted) return;
        setChargement({ phase: 'erreur', message: erreur instanceof ErreurLien ? erreur.message : MESSAGES_LIEN.indisponible });
      },
    );
    return () => controle.abort();
  }, [jeton, type]);

  async function agir(action: ActionLien, etat: EtatLien) {
    if (envoi) return;
    setEnvoi(action);
    setEchec('');
    try {
      const { etat: reponse } = await appelerLien(jeton, action);
      setSucces(messageSucces(action, etat, reponse === 'deja_fait'));
    } catch (erreur) {
      const echecLien = erreur instanceof ErreurLien ? erreur : new ErreurLien('indisponible');
      if (echecLien.definitif) setChargement({ phase: 'erreur', message: echecLien.message });
      else setEchec(echecLien.message);
    } finally {
      setEnvoi(null);
    }
  }

  function corps(): ReactNode {
    if (chargement.phase === 'chargement') {
      return <p role="status" className="text-[15px] text-encre-2">Vérification du lien…</p>;
    }
    if (chargement.phase === 'erreur') {
      return <Message role="alert" icone="alerte" message={chargement.message} />;
    }
    const { etat } = chargement;
    if (succes) return <Message role="status" icone="valide" message={succes} reussi />;
    if (type === 'desinscription' && !etat.abonne) {
      return <Message role="status" icone="valide" message="Vous ne recevez déjà plus d’emails de l’Olympiade des Manades." reussi />;
    }
    return (
      <>
        <div className="flex flex-col gap-3 tablette:flex-row tablette:flex-wrap">{boutons(etat)}</div>
        <div role="alert">{echec ? <Message icone="alerte" message={echec} /> : null}</div>
      </>
    );
  }

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
        <p>{entete.intro}</p>
      </TitrePage>
      <div className="px-4 pt-6 pb-10 tablette:px-7 paysage:px-10 bureau:px-14">
        <div
          className="grid max-w-[560px] gap-4 rounded-[22px] border border-trait bg-creme p-5 tablette:p-7"
          aria-busy={chargement.phase === 'chargement' || envoi !== null}
        >
          {corps()}
        </div>
      </div>
    </>
  );
}

function messageSucces(action: ActionLien, etat: EtatLien, dejaFait: boolean): string {
  switch (action) {
    case 'confirmer':
      return dejaFait ? 'Votre adresse est déjà confirmée.' : 'Merci, votre adresse est confirmée.';
    case 'arreter_annonces':
      return 'C’est fait\u00a0: vous ne recevrez plus les annonces des prochaines dates. Les rappels de votre date continuent.';
    case 'desinscrire':
      return 'C’est fait\u00a0: vous ne recevrez plus aucun email de l’Olympiade des Manades.';
    case 'je_viens':
      return etat.date
        ? `Merci, c’est noté\u00a0: à bientôt le ${formaterDateLongue(etat.date.date)} à ${etat.date.ville}.`
        : 'Merci, c’est noté\u00a0: à bientôt\u00a0!';
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
    <button type="button" onClick={onClick} disabled={courante !== null} className={principal ? BOUTON_PRINCIPAL : BOUTON_SECONDAIRE}>
      {courante === action ? 'Envoi…' : children}
    </button>
  );
}

function Message({ role, icone, message, reussi }: { role?: 'alert' | 'status'; icone: 'alerte' | 'valide'; message: string; reussi?: boolean }) {
  return (
    <p role={role} className={`flex items-start gap-3 text-[15px] leading-relaxed font-semibold ${reussi ? 'text-encre' : 'text-rouge-alerte'}`}>
      <Icone nom={icone} className={`mt-0.5 size-5 shrink-0 ${reussi ? 'text-ok' : ''}`} />
      {message}
    </p>
  );
}
