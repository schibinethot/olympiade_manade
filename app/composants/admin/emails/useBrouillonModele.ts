/**
 * Brouillon d'un modèle d'e-mail : valeurs saisies, écart avec la ligne enregistrée, erreurs de
 * saisie, retour au texte d'origine et champs à enregistrer (les seules colonnes éditables).
 */

import { useCallback, useMemo, useState } from 'react';
import { MODELES_DEFAUT, type ModeleEmail } from '../../../../serveur/gabarits-emails.mjs';
import type { MajModele, ModeleEmailLigne } from './donnees';
import { aUneEcheance, heureSaisie, heureValide, joursValides } from './outils';

const NB = ' ';

export type Brouillon = { sujet: string; preheader: string; corps: string; encart: string; jours: number | null; heure: string };
export type ChampBrouillon = keyof Brouillon;

const brouillonDe = (modele: ModeleEmailLigne): Brouillon => ({
  sujet: modele.sujet, preheader: modele.preheader, corps: modele.corps, encart: modele.encart ?? '',
  jours: modele.jours_decalage, heure: heureSaisie(modele.heure_envoi),
});

export function useBrouillonModele(modele: ModeleEmailLigne) {
  const { cle } = modele;
  const datee = aUneEcheance(cle);
  const bienvenue = cle === 'bienvenue';
  const [brouillon, setBrouillon] = useState<Brouillon>(() => brouillonDe(modele));

  const modifier = useCallback(<K extends ChampBrouillon>(champ: K, valeur: Brouillon[K]) => {
    setBrouillon((avant) => ({ ...avant, [champ]: valeur }));
  }, []);

  const enregistre = brouillonDe(modele);
  const modifie = (Object.keys(enregistre) as ChampBrouillon[]).some((champ) => enregistre[champ] !== brouillon[champ]);

  const erreurs = {
    sujet: brouillon.sujet.trim() ? null : 'L’objet est obligatoire.',
    corps: brouillon.corps.trim() ? null : 'Le corps du message est obligatoire.',
    jours: !datee || (brouillon.jours !== null && joursValides(brouillon.jours)) ? null : 'Choisissez le jour d’envoi.',
    heure: !datee || heureValide(brouillon.heure) ? null : `L’heure d’envoi doit être comprise entre 7${NB}h et 21${NB}h.`,
  };
  const valide = Object.values(erreurs).every((erreur) => erreur === null);

  /** Textes du modèle tels qu'affichés : aperçu et test. */
  const textes: ModeleEmail = useMemo(() => ({
    sujet: brouillon.sujet, preheader: brouillon.preheader, corps: brouillon.corps, encart: bienvenue ? brouillon.encart : null,
  }), [brouillon.sujet, brouillon.preheader, brouillon.corps, brouillon.encart, bienvenue]);

  /** Textes de départ (MODELES_DEFAUT) ; le moment d'envoi ne change pas. */
  const revenirOrigine = useCallback(() => {
    const origine = MODELES_DEFAUT[cle];
    setBrouillon((avant) => ({
      ...avant, sujet: origine.sujet, preheader: origine.preheader, corps: origine.corps, encart: origine.encart ?? '',
    }));
  }, [cle]);

  /** Les colonnes que l'admin peut écrire : encart nul hors bienvenue, jour et heure pour les étapes datées. */
  const champs = (): MajModele => ({
    sujet: brouillon.sujet, preheader: brouillon.preheader, corps: brouillon.corps,
    encart: bienvenue ? brouillon.encart : null,
    ...(datee ? { jours_decalage: brouillon.jours, heure_envoi: brouillon.heure } : {}),
  });

  return { brouillon, modifier, modifie, erreurs, valide, textes, revenirOrigine, champs, datee, bienvenue };
}
