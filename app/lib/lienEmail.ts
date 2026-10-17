// Liens signés des emails (confirmation, désinscription, « je viens »).
//
// Une page ne fait qu'une lecture à l'ouverture (`decrire`) : les antivirus et messageries ouvrent
// les liens, aucune écriture ne doit partir sans un clic. L'action (`confirmer`, `desinscrire`,
// `arreter_annonces`, `je_viens`) n'est envoyée qu'au clic.

export type TypeLien = 'confirmation' | 'desinscription' | 'je_viens';
export type ActionLien = 'decrire' | 'confirmer' | 'desinscrire' | 'arreter_annonces' | 'je_viens';

export type EtatLien = {
  type: TypeLien;
  date?: { nom: string; ville: string; date: string };
  abonne: boolean;
  annonces: boolean;
};

export const MESSAGES_LIEN = {
  invalide: 'Ce lien n’est pas valide.',
  expire: 'Ce lien a expiré.',
  indisponible: 'Service momentanément indisponible, réessayez plus tard.',
} as const;

export type NatureEchec = keyof typeof MESSAGES_LIEN;

/** Échec d'un appel : `definitif` quand le lien lui-même est refusé (invalide, expiré). */
export class ErreurLien extends Error {
  readonly nature: NatureEchec;
  constructor(nature: NatureEchec) {
    super(MESSAGES_LIEN[nature]);
    this.name = 'ErreurLien';
    this.nature = nature;
  }
  get definitif(): boolean {
    return this.nature !== 'indisponible';
  }
}

function natureDuStatut(statut: number): NatureEchec {
  if (statut === 400) return 'invalide';
  if (statut === 410) return 'expire';
  return 'indisponible';
}

/** Réponse du serveur à une action : `etat` vaut `'deja_fait'` quand l'adresse était déjà confirmée. */
export type ReponseLien = { ok: true; etat: unknown };

export async function appelerLien(jeton: string, action: ActionLien, signal?: AbortSignal): Promise<ReponseLien> {
  let reponse: Response;
  try {
    reponse = await fetch('/api/emails/lien', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jeton, action }),
      signal: signal ?? AbortSignal.timeout(15_000),
    });
  } catch (erreur) {
    if (signal?.aborted) throw erreur;
    throw new ErreurLien('indisponible');
  }
  if (!reponse.ok) throw new ErreurLien(natureDuStatut(reponse.status));
  const corps: unknown = await reponse.json().catch(() => null);
  if (typeof corps !== 'object' || corps === null || (corps as { ok?: unknown }).ok !== true) {
    throw new ErreurLien('indisponible');
  }
  return corps as ReponseLien;
}

const TYPES: readonly string[] = ['confirmation', 'desinscription', 'je_viens'];

/** Lit l'état d'un lien ; null si la forme ne convient pas. */
export function etatValide(valeur: unknown): EtatLien | null {
  if (typeof valeur !== 'object' || valeur === null) return null;
  const { type, date, abonne, annonces } = valeur as Record<string, unknown>;
  if (typeof type !== 'string' || !TYPES.includes(type)) return null;
  let precision: EtatLien['date'];
  if (date !== undefined && date !== null) {
    if (typeof date !== 'object') return null;
    const { nom, ville, date: jour } = date as Record<string, unknown>;
    if (typeof nom !== 'string' || typeof ville !== 'string' || typeof jour !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(jour)) return null;
    precision = { nom, ville, date: jour };
  }
  return { type: type as TypeLien, date: precision, abonne: abonne !== false, annonces: annonces === true };
}

export async function decrireLien(jeton: string, signal: AbortSignal): Promise<EtatLien> {
  const { etat } = await appelerLien(jeton, 'decrire', signal);
  const decrit = etatValide(etat);
  if (!decrit) throw new ErreurLien('indisponible');
  return decrit;
}
