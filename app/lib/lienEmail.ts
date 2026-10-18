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
  /** Abonnement aux actualités seulement : ne dit pas si la personne reçoit encore des emails. */
  abonne: boolean;
  annonces: boolean;
  /** La personne a déjà tout arrêté (liste d'opposition). */
  desinscrit: boolean;
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

const DELAI_MS = 15_000;

/** Signal qui s'arrête au délai ou à l'abandon de l'appelant ; repli sans AbortSignal.any (navigateurs anciens). */
export function signalAvecDelai(signal?: AbortSignal, delaiMs = DELAI_MS): AbortSignal {
  const delai = AbortSignal.timeout(delaiMs);
  if (!signal) return delai;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, delai]);
  const controle = new AbortController();
  const arreter = () => controle.abort();
  if (signal.aborted || delai.aborted) controle.abort();
  signal.addEventListener('abort', arreter, { once: true });
  delai.addEventListener('abort', arreter, { once: true });
  return controle.signal;
}

export async function appelerLien(jeton: string, action: ActionLien, signal?: AbortSignal): Promise<ReponseLien> {
  let reponse: Response;
  try {
    reponse = await fetch('/api/emails/lien', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jeton, action }),
      signal: signalAvecDelai(signal),
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
  const { type, date, abonne, annonces, desinscrit } = valeur as Record<string, unknown>;
  if (typeof type !== 'string' || !TYPES.includes(type)) return null;
  let precision: EtatLien['date'];
  if (date !== undefined && date !== null) {
    if (typeof date !== 'object') return null;
    const { nom, ville, date: jour } = date as Record<string, unknown>;
    if (typeof nom !== 'string' || typeof ville !== 'string' || typeof jour !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(jour)) return null;
    precision = { nom, ville, date: jour };
  }
  return { type: type as TypeLien, date: precision, abonne: abonne !== false, annonces: annonces === true, desinscrit: desinscrit === true };
}

export async function decrireLien(jeton: string, signal: AbortSignal): Promise<EtatLien> {
  const { etat } = await appelerLien(jeton, 'decrire', signal);
  const decrit = etatValide(etat);
  if (!decrit) throw new ErreurLien('indisponible');
  return decrit;
}

// Le jeton est lu une fois dans l'adresse puis gardé dans l'onglet et retiré de l'adresse : l'outil
// de mesure ne le voit pas, et un rechargement de la page continue de fonctionner.
//
// Les liens des emails portent le jeton dans le fragment (#j=…) : le navigateur ne l'envoie ni au
// serveur (journaux) ni dans le Referer. L'ancienne forme (?j=…) reste lue en repli. Le retrait de
// l'adresse passe par le routeur (navigate, voir LienEmail) : useLocation ne garde pas le jeton.
const CLE_JETON = 'olympiade-lien-email';

function stockageOnglet(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Jeton d'une adresse : le fragment `#j=` d'abord, puis `?j=` ; `present` si l'adresse en porte un, même vide. */
export function jetonDeLAdresse(adresse: string): { jeton: string; present: boolean } {
  const url = new URL(adresse);
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const present = fragment.has('j') || url.searchParams.has('j');
  const jeton = fragment.get('j')?.trim() || url.searchParams.get('j')?.trim() || '';
  return { jeton, present };
}

/** Garde le jeton de la page `chemin` dans l'onglet (un rechargement le retrouve). */
export function garderJeton(chemin: string, jeton: string): void {
  try {
    stockageOnglet()?.setItem(CLE_JETON, JSON.stringify({ chemin, jeton }));
  } catch {
    // Stockage refusé : le jeton reste dans l'état de la page, seul un rechargement le perdrait.
  }
}

/**
 * Retire le jeton de l'onglet. Appelé quand la page de lien est quittée dans l'onglet (démontage) : une
 * autre page du site, où la mesure d'audience peut être chargée, ne le trouve plus. Un rechargement ne
 * démonte rien : le jeton reste disponible pour lui.
 */
export function oublierJeton(): void {
  try {
    stockageOnglet()?.removeItem(CLE_JETON);
  } catch {
    // Stockage illisible : rien n'y a été gardé.
  }
}

/**
 * Jeton de la page `chemin` : celui de l'adresse `adresse`, sinon celui gardé dans l'onglet.
 * `retirer` dit si l'adresse porte un jeton à effacer (l'appelant remplace l'entrée d'historique).
 */
export function recupererJeton(chemin: string, adresse: string): { jeton: string; retirer: boolean } {
  const stockage = stockageOnglet();
  const { jeton: dansAdresse, present } = jetonDeLAdresse(adresse);
  if (dansAdresse) {
    garderJeton(chemin, dansAdresse);
    return { jeton: dansAdresse, retirer: true };
  }
  try {
    const garde: unknown = JSON.parse(stockage?.getItem(CLE_JETON) ?? 'null');
    if (typeof garde === 'object' && garde !== null) {
      const { chemin: cheminGarde, jeton } = garde as Record<string, unknown>;
      if (cheminGarde === chemin && typeof jeton === 'string') return { jeton, retirer: present };
    }
  } catch {
    // Valeur abîmée : comme un lien sans jeton.
  }
  return { jeton: '', retirer: present };
}
