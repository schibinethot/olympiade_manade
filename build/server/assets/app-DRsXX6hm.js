import { Link, useLocation, useMatches, useRevalidator } from "react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Fragment as Fragment$1, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
//#region app/donnees/affiche.ts
var VILLE_AFFICHE = "Nîmes";
/**
* Manades de la dernière édition connue à Nîmes, faute de programme pour l'édition à venir.
* Libellées comme telles sur la page (« Les manades de l'édition 2026 »).
*/
var EDITION_MANADES = {
	annee: 2026,
	manades: [
		"Vinuesa",
		"Gillet",
		"Robert Michel",
		"Lafon",
		"Arlatenco"
	]
};
//#endregion
//#region app/lib/dates.ts
var FUSEAU$1 = "Europe/Paris";
function jourParis(date) {
	return new Intl.DateTimeFormat("fr-CA", {
		timeZone: FUSEAU$1,
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(date);
}
function prochaineSoiree(dates, maintenant) {
	const aujourdhui = jourParis(maintenant);
	return dates.filter((x) => x.statut !== "annulee" && x.date_soiree >= aujourdhui).sort((a, b) => a.date_soiree.localeCompare(b.date_soiree))[0] ?? null;
}
function compteARebours(cible, maintenant) {
	const ms = cible.getTime() - maintenant.getTime();
	if (ms <= 0) return null;
	const minutesTotales = Math.floor(ms / 6e4);
	return {
		jours: Math.floor(minutesTotales / 1440),
		heures: Math.floor(minutesTotales % 1440 / 60),
		minutes: minutesTotales % 60
	};
}
/** Le premier jour du mois s'écrit « 1er » en français ; Intl ne donne que « 1 ». */
function premierDuMois(texte) {
	return texte.replace(/(^|\s)1(?=\s)/, "$11er");
}
function formaterDateLongue(dateIso) {
	const [a, m, j] = dateIso.split("-").map(Number);
	return premierDuMois(new Intl.DateTimeFormat("fr-FR", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC"
	}).format(new Date(Date.UTC(a, m - 1, j))));
}
function formaterHeure(heure) {
	if (!heure) return null;
	const [h, min] = heure.split(":");
	return min === "00" ? `${Number(h)}h` : `${Number(h)}h${min}`;
}
//#endregion
//#region app/lib/accueil.ts
var FUSEAU = "Europe/Paris";
/** Heure murale de Paris pour un instant donné, lue comme si c'était de l'UTC. */
function murParis(instant) {
	const parties = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
		timeZone: FUSEAU,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	}).formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
	return Date.UTC(+parties.year, +parties.month - 1, +parties.day, +parties.hour, +parties.minute, +parties.second);
}
/**
* Début d'une soirée : sa date et son heure, lues à Paris (heure d'été comme d'hiver).
* Sans heure connue, le début de la journée.
*/
function instantSoiree(dateIso, heure) {
	const [a, m, j] = dateIso.split("-").map(Number);
	const [h, min] = (heure ?? "00:00").split(":").map(Number);
	const voulu = Date.UTC(a, m - 1, j, h, min);
	let instant = voulu - (murParis(voulu) - voulu);
	instant += voulu - murParis(instant);
	return new Date(instant);
}
/** Texte du compte à rebours : en jours, puis en heures et minutes le dernier jour. */
function texteCompteARebours(reste) {
	if (!reste) return null;
	if (reste.jours >= 1) return `${reste.jours} jour${reste.jours > 1 ? "s" : ""}`;
	if (reste.heures >= 1) return reste.minutes ? `${reste.heures} h ${reste.minutes} min` : `${reste.heures} h`;
	return `${Math.max(1, reste.minutes)} min`;
}
/** « aux arènes de Nîmes », « aux arènes André Blanc, à Mouriès », « à Beaucaire ». */
function lieuSoiree({ arenes, ville }) {
	if (!arenes) return `à ${ville}`;
	if (!/^ar[eè]nes\b/i.test(arenes)) return `à ${ville} (${arenes})`;
	const nom = `aux a${arenes.slice(1)}`;
	return arenes.includes(ville) ? nom : `${nom}, à ${ville}`;
}
/**
* « le vendredi 20 août 2027 à 21h, aux arènes de Nîmes (date prévisionnelle) » : quand et où
* ouvriront les votes, pour la carte « Notez les Olympiades » et la page /noter.
*/
function momentSoiree(soiree) {
	const heure = formaterHeure(soiree.heure);
	const mention = soiree.statut === "previsionnelle" ? " (date prévisionnelle)" : "";
	return `le ${formaterDateLongue(soiree.date_soiree)}${heure ? ` à ${heure}` : ""}, ${lieuSoiree(soiree)}${mention}`;
}
/** « 20 août », « 1er mai » */
function formaterJourMois(dateIso) {
	const [a, m, j] = dateIso.split("-").map(Number);
	return premierDuMois(new Intl.DateTimeFormat("fr-FR", {
		day: "numeric",
		month: "long",
		timeZone: "UTC"
	}).format(new Date(Date.UTC(a, m - 1, j))));
}
/** Prochaine soirée d'une ville (l'affiche d'accueil est celle de Nîmes). */
function prochaineSoireeA(calendrier, ville, maintenant) {
	return prochaineSoiree(calendrier.filter((s) => s.ville === ville), maintenant);
}
/**
* Soirée de référence du vote, pour la carte « Notez les Olympiades » et la pastille de l'en-tête :
* la prochaine soirée de Nîmes, celle de l'affiche et du vote. Si Nîmes n'a plus de date à venir,
* la prochaine soirée du calendrier, tous événements confondus.
*/
function soireeDeReference(calendrier, maintenant) {
	return prochaineSoireeA(calendrier, "Nîmes", maintenant) ?? prochaineSoiree(calendrier, maintenant);
}
var ordreResultat$1 = (p) => p.date_soiree ?? `${p.annee}-12-31`;
/** Domaine d'une source, sans « www. » : « midilibre.fr ». */
function domaine(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
}
/**
* Dernier vainqueur connu : la ligne confirmée la plus récente du palmarès. Une ligne plus récente
* encore « à confirmer » est ignorée. Le nom vient des données : rien n'est codé en dur.
*/
function dernierVainqueur(palmares) {
	const confirmes = palmares.filter((p) => p.statut === "confirme").sort((a, b) => ordreResultat$1(a).localeCompare(ordreResultat$1(b)));
	const resultat = confirmes.at(-1);
	if (!resultat) return null;
	const victoires = confirmes.filter((p) => p.vainqueur.trim() === resultat.vainqueur.trim());
	const sources = [];
	for (const v of victoires) {
		const nom = v.source_url ? domaine(v.source_url) : null;
		if (nom && v.source_url && !sources.some((s) => s.domaine === nom)) sources.push({
			domaine: nom,
			url: v.source_url
		});
	}
	return {
		vainqueur: resultat.vainqueur.trim(),
		resultat,
		victoires: victoires.map((v) => ({
			annee: v.annee,
			ville: v.ville
		})),
		sources
	};
}
/**
* Extrait de la saison pour l'accueil : quelques soirées à partir de la prochaine (les dernières
* de la saison quand elle touche à sa fin). Sans soirée à venir, la dernière saison connue.
*/
function saisonAccueil(calendrier, maintenant, taille = 4) {
	if (calendrier.length === 0) return null;
	const prochaine = prochaineSoiree(calendrier, maintenant);
	const annee = prochaine?.annee ?? Math.max(...calendrier.map((s) => s.annee));
	const saison = calendrier.filter((s) => s.annee === annee).sort((a, b) => a.date_soiree.localeCompare(b.date_soiree));
	const aujourdhui = jourParis(maintenant);
	const rang = prochaine ? saison.findIndex((s) => s.id === prochaine.id) : saison.length;
	const debut = Math.max(0, Math.min(rang, saison.length - taille));
	return {
		annee,
		total: saison.length,
		lignes: saison.slice(debut, debut + taille).map((soiree) => ({
			soiree,
			etat: soiree.statut === "annulee" ? "annulee" : soiree.id === prochaine?.id ? "prochaine" : soiree.date_soiree < aujourdhui ? "terminee" : "a-venir"
		}))
	};
}
function aCalendrier(donnees) {
	return typeof donnees === "object" && donnees !== null && "calendrier" in donnees && "lueLe" in donnees && typeof donnees.lueLe === "string";
}
//#endregion
//#region app/lib/contact.ts
var LIMITES_CONTACT = {
	prenom: 60,
	email: 254,
	messageMin: 10,
	messageMax: 2e3
};
var EMAIL$1 = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** btrim(texte, E' \t\r\n') */
function rogner(texte) {
	return texte.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
}
/** length() de Postgres : nombre de points de code. */
function longueur(texte) {
	return Array.from(texte).length;
}
/** Valeurs envoyées à la base : rognées des blancs que la base ignore de toute façon. */
function normaliserContact(champs) {
	return {
		prenom: rogner(champs.prenom),
		email: rogner(champs.email),
		message: rogner(champs.message)
	};
}
function validerContact(champs) {
	const { prenom, email, message } = normaliserContact(champs);
	const erreurs = {};
	if (longueur(prenom) === 0) erreurs.prenom = "Indiquez votre prénom.";
	else if (longueur(prenom) > LIMITES_CONTACT.prenom) erreurs.prenom = "Le prénom ne doit pas dépasser 60 caractères.";
	if (longueur(email) === 0) erreurs.email = "Indiquez votre adresse email.";
	else if (longueur(email) > LIMITES_CONTACT.email) erreurs.email = "L’adresse email ne doit pas dépasser 254 caractères.";
	else if (!EMAIL$1.test(email)) erreurs.email = "Cette adresse email n’est pas valide.";
	if (longueur(message) < LIMITES_CONTACT.messageMin) erreurs.message = "Le message doit contenir au moins 10 caractères.";
	else if (longueur(message) > LIMITES_CONTACT.messageMax) erreurs.message = "Le message ne doit pas dépasser 2\xA0000 caractères.";
	return erreurs;
}
//#endregion
//#region app/lib/supabase.ts
var url = "https://khwlwpzydlrfocfpvywv.supabase.co";
var cle = "sb_publishable_9EXUOvjsTgH6s-uVfedA0g_n9buhJFY";
/** Clé de la session dans localStorage (supabase-js y ajoute « -code-verifier » pendant une demande). */
var CLE_SESSION = "olympiade-auth";
var promesse = null;
var cree = null;
var rappels = /* @__PURE__ */ new Set();
/**
* Client Supabase (clé publishable), chargé et créé au premier appel. supabase-js (environ 55 Ko
* gzip) est un module à part, importé à la demande : les pages vitrine, dont les données sont dans
* le pré-rendu, s'affichent sans lui. Il arrive à la première lecture fraîche, au premier envoi
* d'un formulaire, ou dès l'ouverture si l'appareil a une session (useSession).
*
* Sans variables d'environnement, la promesse est rejetée au lieu de casser l'import du module :
* les lectures de données la transforment en ErreurDonnees, et le pré-rendu affiche alors le repli.
* Un échec du chargement (réseau) n'est pas retenu : l'appel suivant réessaie.
*/
function supabase() {
	if (!promesse) {
		promesse = creer();
		promesse.catch(() => {
			promesse = null;
		});
	}
	return promesse;
}
async function creer() {
	const { createClient } = await import("@supabase/supabase-js");
	cree = createClient(url, cle, { auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
		flowType: "pkce",
		storageKey: CLE_SESSION
	} });
	for (const rappel of rappels) rappel(cree);
	return cree;
}
/**
* Appelle `rappel` avec le client dès qu'il existe : tout de suite s'il est déjà créé, sinon à sa
* création, quel que soit l'appel qui le crée (lecture, inscription, session).
*/
function quandClientCree(rappel) {
	rappels.add(rappel);
	if (cree) rappel(cree);
}
/** Paramètres d'adresse posés par Supabase Auth au retour du lien de l'email (PKCE, erreur, jeton). */
var PARAMETRES_AUTH = /[?#&](code|error|error_code|error_description|access_token)=/;
/**
* Vrai si l'appareil a peut-être une session à relire : une clé du site dans le stockage local
* (session, ou demande PKCE en cours), ou le retour du lien de connexion dans l'adresse. Sinon,
* personne n'est connecté et supabase-js n'a pas à être chargé pour le savoir.
*/
function sessionPossible(stockage, adresse) {
	if (PARAMETRES_AUTH.test(adresse.search) || PARAMETRES_AUTH.test(adresse.hash)) return true;
	if (!stockage) return false;
	try {
		for (let i = 0; i < stockage.length; i++) if (stockage.key(i)?.startsWith("olympiade-auth")) return true;
	} catch {}
	return false;
}
//#endregion
//#region app/lib/auth.ts
var MESSAGES_AUTH = {
	codeRefuse: "Code incorrect ou expiré. Vérifiez vos emails ou demandez un nouveau code.",
	tropDeDemandes: "Trop de demandes de code. Réessayez dans quelques minutes.",
	reseau: "Connexion impossible. Vérifiez votre réseau et réessayez.",
	emailInvalide: "Cette adresse email n’est pas valide.",
	inscriptionsFermees: "Les inscriptions sont momentanément fermées. Réessayez plus tard.",
	envoiRefuse: "Le code n’a pas pu être envoyé à cette adresse. Réessayez plus tard.",
	inconnue: "Une erreur est survenue. Réessayez dans un instant."
};
/** Erreur d'inscription ou de connexion, au message français prêt à afficher. */
var ErreurAuth = class extends Error {
	code;
	constructor(message, code) {
		super(message);
		this.name = "ErreurAuth";
		this.code = code;
	}
};
/** Les 6 chiffres d'une saisie ou d'un collage (« 123 456 », « Votre code : 123456 »), sinon null. */
function normaliserCode(saisie) {
	const chiffres = saisie.replace(/[^0-9]/g, "");
	return chiffres.length === 6 ? chiffres : null;
}
/** Adresse sans espaces (une adresse n'en contient jamais), en minuscules. */
function normaliserEmail(saisie) {
	return saisie.replace(/\s+/g, "").toLowerCase();
}
var PRENOM_MAX = 60;
var EMAIL_MAX = 254;
var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function validerInscription({ prenom, email, consentement }) {
	const erreurs = {};
	const nom = prenom.trim();
	const adresse = normaliserEmail(email);
	if (longueur(nom) === 0) erreurs.prenom = "Indiquez votre prénom.";
	else if (longueur(nom) > PRENOM_MAX) erreurs.prenom = "Le prénom ne doit pas dépasser 60 caractères.";
	if (adresse.length === 0) erreurs.email = "Indiquez votre adresse email.";
	else if (longueur(adresse) > EMAIL_MAX) erreurs.email = "L’adresse email ne doit pas dépasser 254 caractères.";
	else if (!EMAIL.test(adresse)) erreurs.email = MESSAGES_AUTH.emailInvalide;
	if (!consentement) erreurs.consentement = "Vous devez accepter la politique de confidentialité pour recevoir un code.";
	return erreurs;
}
var CODES_TROP_DE_DEMANDES = /* @__PURE__ */ new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);
var CODES_FERMETURE = /* @__PURE__ */ new Set([
	"signup_disabled",
	"otp_disabled",
	"email_provider_disabled"
]);
/**
* Message français d'une erreur de supabase-js (AuthApiError, AuthRetryableFetchError) ou du
* navigateur. Le texte anglais de Supabase n'est jamais affiché.
*/
function traduireErreurAuth(erreur, etape) {
	if (erreur instanceof ErreurAuth) return erreur.message;
	if (erreur instanceof TypeError) return MESSAGES_AUTH.reseau;
	if (typeof erreur !== "object" || erreur === null) return MESSAGES_AUTH.inconnue;
	const { name, code, status } = erreur;
	const statut = typeof status === "number" ? status : void 0;
	const codeErreur = typeof code === "string" ? code : void 0;
	if (name === "AuthRetryableFetchError" && !statut) return MESSAGES_AUTH.reseau;
	if (codeErreur && CODES_TROP_DE_DEMANDES.has(codeErreur) || statut === 429) return MESSAGES_AUTH.tropDeDemandes;
	if (etape === "verification" && statut !== void 0 && statut >= 400 && statut < 500) return MESSAGES_AUTH.codeRefuse;
	if (codeErreur === "email_address_invalid" || codeErreur === "validation_failed") return MESSAGES_AUTH.emailInvalide;
	if (codeErreur && CODES_FERMETURE.has(codeErreur)) return MESSAGES_AUTH.inscriptionsFermees;
	if (codeErreur === "email_address_not_authorized") return MESSAGES_AUTH.envoiRefuse;
	return MESSAGES_AUTH.inconnue;
}
function enErreurAuth(erreur, etape) {
	const code = typeof erreur === "object" && erreur !== null && "code" in erreur ? erreur.code : void 0;
	return new ErreurAuth(traduireErreurAuth(erreur, etape), typeof code === "string" ? code : void 0);
}
/**
* Envoie un code à 6 chiffres. Même réponse que l'adresse soit nouvelle ou déjà inscrite : rien ne
* révèle qu'un compte existe. Pour un compte existant, Supabase ignore `data` (le prénom ne change pas).
* Le lien de secours de l'email ramène sur /inscription/code (adresse autorisée dans la
* configuration Auth, additional_redirect_urls).
*/
async function demanderCode(prenom, email) {
	try {
		const { error } = await (await supabase()).auth.signInWithOtp({
			email,
			options: {
				shouldCreateUser: true,
				data: {
					prenom,
					consentement: true
				},
				emailRedirectTo: typeof window === "undefined" ? void 0 : `${window.location.origin}/inscription/code`
			}
		});
		if (error) throw error;
	} catch (erreur) {
		throw enErreurAuth(erreur, "demande");
	}
}
/** Valide le code : la session est alors enregistrée dans le navigateur (clé « olympiade-auth »). */
async function verifierCode(email, code) {
	try {
		const { data, error } = await (await supabase()).auth.verifyOtp({
			email,
			token: code,
			type: "email"
		});
		if (error) throw error;
		if (!data.session) throw new ErreurAuth(MESSAGES_AUTH.codeRefuse);
	} catch (erreur) {
		throw enErreurAuth(erreur, "verification");
	}
}
/** Ferme la session de cet appareil seulement (les autres appareils du spectateur restent connectés). */
async function seDeconnecter() {
	try {
		const { error } = await (await supabase()).auth.signOut({ scope: "local" });
		if (error) throw error;
	} catch (erreur) {
		throw enErreurAuth(erreur, "demande");
	}
}
/** « 0:42 » : temps restant avant de pouvoir renvoyer le code. */
function formaterDecompte(secondes) {
	const reste = Math.max(0, Math.ceil(secondes));
	return `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}`;
}
var CLE_DEMANDE = "olympiade-inscription";
/** Demande lue dans le stockage ou dans l'état de navigation ; null si la forme ne convient pas. */
function demandeValide(valeur) {
	if (typeof valeur !== "object" || valeur === null) return null;
	const { prenom, email, envoyeeLe } = valeur;
	if (typeof prenom !== "string" || typeof email !== "string" || typeof envoyeeLe !== "number") return null;
	return {
		prenom,
		email,
		envoyeeLe
	};
}
/** Relit une demande enregistrée ; null si elle est absente ou abîmée. */
function lireDemande(texte) {
	if (!texte) return null;
	try {
		return demandeValide(JSON.parse(texte));
	} catch {
		return null;
	}
}
/** Stockage de l'onglet, ou null s'il est indisponible (navigation privée stricte, stockage bloqué). */
function stockageOnglet() {
	try {
		return typeof window === "undefined" ? null : window.sessionStorage;
	} catch {
		return null;
	}
}
function demandeEnCours() {
	try {
		return lireDemande(stockageOnglet()?.getItem(CLE_DEMANDE) ?? null);
	} catch {
		return null;
	}
}
function memoriserDemande(demande) {
	try {
		stockageOnglet()?.setItem(CLE_DEMANDE, JSON.stringify(demande));
	} catch {}
}
function oublierDemande() {
	try {
		stockageOnglet()?.removeItem(CLE_DEMANDE);
	} catch {}
}
//#endregion
//#region app/lib/etat-soiree.ts
/** Lot vitrine : les votes ne sont jamais ouverts. Le lot 2 branchera l'état réel de la soirée. */
var ETAT_SOIREE = "hors-soiree";
//#endregion
//#region app/lib/temps.ts
function useMaintenant(reference) {
	const [maintenant, setMaintenant] = useState(() => reference ? new Date(reference) : null);
	useEffect(() => {
		setMaintenant(/* @__PURE__ */ new Date());
		const minuteur = setInterval(() => setMaintenant(/* @__PURE__ */ new Date()), 6e4);
		return () => clearInterval(minuteur);
	}, []);
	return maintenant;
}
//#endregion
//#region app/lib/useSession.ts
var AU_DEPART = {
	session: null,
	prenom: null,
	chargement: true
};
/**
* Attente maximale de la session (chargement de supabase-js) puis de la lecture du prénom, comme pour
* les autres lectures du navigateur.
*/
var DELAI_PROFIL_MS = 3e3;
var etat = AU_DEPART;
var abonnes = /* @__PURE__ */ new Set();
var demarre = false;
var tour = 0;
function publier(suivant) {
	etat = suivant;
	for (const rappel of abonnes) rappel();
}
async function lirePrenom(client, session) {
	const { data, error } = await client.from("profils").select("prenom").eq("id", session.user.id).abortSignal(AbortSignal.timeout(DELAI_PROFIL_MS)).maybeSingle();
	if (!error && typeof data?.prenom === "string") return data.prenom;
	const prenom = session.user.user_metadata?.prenom;
	return typeof prenom === "string" ? prenom : null;
}
async function appliquer(client, session) {
	const numero = ++tour;
	if (!session) {
		publier({
			session: null,
			prenom: null,
			chargement: false
		});
		return;
	}
	if (etat.session?.user.id === session.user.id && etat.prenom) {
		publier({
			...etat,
			session,
			chargement: false
		});
		return;
	}
	publier({
		session,
		prenom: null,
		chargement: true
	});
	const prenom = await lirePrenom(client, session).catch(() => null);
	if (numero === tour) publier({
		session,
		prenom,
		chargement: false
	});
}
/** Stockage local du navigateur, ou null s'il est indisponible. */
function stockageLocal() {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}
/**
* Charge le client ; sans lui (variables absentes, réseau), personne n'est connecté. Même borne que
* les lectures du navigateur : si la session n'est pas connue dans le délai (supabase-js lent ou
* bloqué), la page s'affiche en version non connectée, et la session s'applique si elle arrive ensuite.
*/
function charger() {
	const numero = tour;
	const borne = setTimeout(() => {
		if (tour === numero && etat.chargement) publier({
			session: null,
			prenom: null,
			chargement: false
		});
	}, DELAI_PROFIL_MS);
	supabase().catch(() => {
		clearTimeout(borne);
		publier({
			session: null,
			prenom: null,
			chargement: false
		});
	});
}
function demarrer() {
	if (demarre) return;
	demarre = true;
	quandClientCree((client) => {
		client.auth.onAuthStateChange((_evenement, session) => {
			setTimeout(() => void appliquer(client, session), 0);
		});
	});
	if (sessionPossible(stockageLocal(), window.location)) charger();
	else publier({
		session: null,
		prenom: null,
		chargement: false
	});
	window.addEventListener("storage", (evenement) => {
		if (evenement.key?.startsWith("olympiade-auth") && evenement.newValue) charger();
	});
}
function sAbonner$1(rappel) {
	abonnes.add(rappel);
	demarrer();
	return () => {
		abonnes.delete(rappel);
	};
}
/**
* Session du spectateur et prénom de son profil.
*
* Au pré-rendu et pendant l'hydratation : { session: null, chargement: true }, puis l'état réel du
* navigateur. Aucun écart d'hydratation.
*/
function useSession() {
	return useSyncExternalStore(sAbonner$1, () => etat, () => AU_DEPART);
}
//#endregion
//#region app/composants/Icone.tsx
var TRACES = {
	fleche: /* @__PURE__ */ jsx("path", { d: "M5 12h14M13 6l6 6-6 6" }),
	chevron: /* @__PURE__ */ jsx("path", { d: "M6 9l6 6 6-6" }),
	cadenas: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("rect", {
		x: "5",
		y: "11",
		width: "14",
		height: "9",
		rx: "2"
	}), /* @__PURE__ */ jsx("path", { d: "M8 11V8a4 4 0 0 1 8 0v3" })] }),
	horloge: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("circle", {
		cx: "12",
		cy: "12",
		r: "8.5"
	}), /* @__PURE__ */ jsx("path", { d: "M12 7.5V12l3 2" })] }),
	calendrier: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("rect", {
		x: "4",
		y: "5",
		width: "16",
		height: "15",
		rx: "2"
	}), /* @__PURE__ */ jsx("path", { d: "M4 10h16M9 3v4M15 3v4" })] }),
	valide: /* @__PURE__ */ jsx("path", { d: "M5 12.5l4.5 4.5L19 7.5" }),
	mail: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("rect", {
		x: "3.5",
		y: "5.5",
		width: "17",
		height: "13",
		rx: "2.5"
	}), /* @__PURE__ */ jsx("path", { d: "M4 7l8 6 8-6" })] }),
	trophee: /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx("path", { d: "M8 4h8v5a4 4 0 0 1-8 0z" }),
		/* @__PURE__ */ jsx("path", { d: "M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" }),
		/* @__PURE__ */ jsx("path", { d: "M12 13v4M8.5 20h7" })
	] }),
	alerte: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("path", { d: "M12 4l9 16H3z" }), /* @__PURE__ */ jsx("path", { d: "M12 10v4M12 17h.01" })] }),
	externe: /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx("path", { d: "M14 4h6v6" }),
		/* @__PURE__ */ jsx("path", { d: "M20 4l-9 9" }),
		/* @__PURE__ */ jsx("path", { d: "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" })
	] })
};
function Icone({ nom, className = "size-[18px]" }) {
	return /* @__PURE__ */ jsx("svg", {
		viewBox: "0 0 24 24",
		"aria-hidden": "true",
		focusable: "false",
		className: `flex-none fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round] ${className}`,
		children: TRACES[nom]
	});
}
//#endregion
//#region app/composants/Logo.tsx
/**
* Logo de la charte (section 5) : « Olympiade » au pinceau en dégradé couchant,
* puis « DES MANADES » en capitales Inter espacées, couleur or.
* Décoratif : le lien qui l'entoure porte le nom accessible.
*/
function Logo({ fond = "clair" }) {
	const sombre = fond === "sombre";
	return /* @__PURE__ */ jsxs("span", {
		"aria-hidden": "true",
		className: "inline-flex flex-col leading-none",
		children: [/* @__PURE__ */ jsx("span", {
			className: `bg-clip-text pr-[0.08em] font-brush text-[27px] leading-[1.05] text-transparent ${sombre ? "bg-[image:var(--couchant-nuit)]" : "bg-couchant-logo"}`,
			children: "Olympiade"
		}), /* @__PURE__ */ jsx("span", {
			className: `mt-px pl-0.5 text-[8.5px] font-bold uppercase tracking-[0.32em] ${sombre ? "text-or-clair" : "text-or-ink"}`,
			children: "des Manades"
		})]
	});
}
//#endregion
//#region app/composants/Entete.tsx
var LIENS$1 = [
	{
		vers: "/",
		libelle: "Accueil"
	},
	{
		vers: "/classements",
		libelle: "Classements"
	},
	{
		vers: "/dates",
		libelle: "Dates"
	},
	{
		vers: "/noter",
		libelle: "Noter en direct"
	}
];
var ID_MENU = "menu-principal";
var ID_RAISON_NOTER = "raison-noter-entete";
var CLASSE_PASTILLE_SOIREE = "hidden items-center gap-[7px] rounded-full py-1.5 pr-2.5 pl-[9px] text-[10.5px] leading-none font-bold tracking-[0.14em] whitespace-nowrap uppercase tablette:inline-flex";
var CLASSE_NOTER = "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-[14px] px-[18px] text-[14.5px] font-semibold whitespace-nowrap";
var CLASSE_LIEN = "group flex min-h-12 items-center rounded-full";
var CLASSE_PASTILLE = "flex-1 rounded-2xl px-4 py-3 text-base font-medium text-encre-2 transition-colors group-hover:bg-lin group-aria-[current=page]:bg-encre group-aria-[current=page]:text-sable paysage:flex-none paysage:rounded-full paysage:px-[15px] paysage:py-[9px] paysage:text-[14.5px] paysage:leading-[1.3]";
/**
* En-tête du site public (maquette : écran public, bloc .ph).
* Sous 1000 px de large, la navigation est un popover natif ouvert par le bouton « Menu » :
* il fonctionne sans JavaScript (pages pré-rendues), se ferme avec Échap ou un clic à côté.
* À partir de 1000 px, la même navigation s'affiche en ligne.
*
* Spectateur connecté : son prénom et « Se déconnecter », dans le menu sous 1000 px, à droite de
* l'en-tête au-delà. Le bouton « Noter » reste grisé tant que les votes sont fermés.
*/
function Entete({ generique = false, etat = ETAT_SOIREE }) {
	const menu = useRef(null);
	const { pathname } = useLocation();
	const chemin = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
	const { session, prenom } = useSession();
	const connecte = session !== null && !generique;
	const pastilleConnecte = connecte ? "paysage:hidden bureau:inline-flex" : "";
	const donnees = useMatches().map((m) => m.loaderData).find(aCalendrier);
	const maintenant = useMaintenant(donnees?.lueLe ?? null);
	const soiree = donnees?.calendrier && maintenant ? soireeDeReference(donnees.calendrier, maintenant) : null;
	const ouvert = etat === "ouvert";
	useEffect(() => {
		const nav = menu.current;
		if (nav?.matches(":popover-open")) nav.hidePopover();
	}, [pathname]);
	return /* @__PURE__ */ jsxs("header", {
		className: "sticky top-0 z-20 flex items-center gap-4 border-b border-trait bg-sable/86 px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2.5 backdrop-blur-[14px] backdrop-saturate-[1.4] tablette:px-7 paysage:gap-[30px] paysage:px-10 bureau:px-14",
		children: [
			/* @__PURE__ */ jsx(Link, {
				to: "/",
				"aria-label": "Olympiade des Manades, accueil",
				className: "inline-flex min-h-12 items-center rounded-lg",
				children: /* @__PURE__ */ jsx(Logo, {})
			}),
			/* @__PURE__ */ jsxs("nav", {
				id: ID_MENU,
				ref: menu,
				popover: "auto",
				"aria-label": "Navigation principale",
				className: "fixed inset-x-4 top-[calc(env(safe-area-inset-top)+76px)] bottom-auto m-0 h-auto w-auto rounded-[22px] border border-trait bg-creme p-2 text-encre shadow-[0_24px_50px_-24px_rgba(28,25,18,0.45)] paysage:static paysage:flex paysage:overflow-visible paysage:border-0 paysage:bg-transparent paysage:p-0 paysage:shadow-none",
				children: [/* @__PURE__ */ jsx("ul", {
					className: "flex flex-col gap-1 paysage:flex-row paysage:gap-0.5",
					children: LIENS$1.map((lien) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Link, {
						to: lien.vers,
						"aria-current": !generique && chemin === lien.vers ? "page" : void 0,
						className: CLASSE_LIEN,
						children: /* @__PURE__ */ jsx("span", {
							className: CLASSE_PASTILLE,
							children: lien.libelle
						})
					}) }, lien.vers))
				}), connecte ? /* @__PURE__ */ jsx(CompteSpectateur, {
					prenom,
					variante: "menu"
				}) : null]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ml-auto flex items-center gap-2.5",
				children: [
					connecte ? /* @__PURE__ */ jsx(CompteSpectateur, {
						prenom,
						variante: "barre"
					}) : null,
					soiree && !generique ? ouvert ? /* @__PURE__ */ jsxs("span", {
						className: `${CLASSE_PASTILLE_SOIREE} ${pastilleConnecte} bg-[rgba(194,59,29,.1)] text-rouge-alerte`,
						children: [
							/* @__PURE__ */ jsx("span", {
								"aria-hidden": "true",
								className: "point-direct size-[7px] rounded-full bg-current"
							}),
							"Ce soir · ",
							soiree.ville
						]
					}) : /* @__PURE__ */ jsxs("span", {
						className: `${CLASSE_PASTILLE_SOIREE} ${pastilleConnecte} bg-lin text-encre-2`,
						children: [
							/* @__PURE__ */ jsx(Icone, {
								nom: "calendrier",
								className: "size-3"
							}),
							"Prochaine soirée · ",
							formaterJourMois(soiree.date_soiree)
						]
					}) : null,
					!generique && chemin === "/noter" ? null : ouvert ? /* @__PURE__ */ jsx(Link, {
						to: "/noter",
						className: `${CLASSE_NOTER} bg-couchant-bouton text-white shadow-[0_10px_24px_-10px_rgba(194,59,29,0.75),inset_0_1px_0_rgba(255,255,255,0.25)] transition-[filter,transform] hover:brightness-105 active:scale-[0.97]`,
						children: "Noter"
					}) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("button", {
						type: "button",
						"aria-disabled": "true",
						"aria-describedby": ID_RAISON_NOTER,
						className: `${CLASSE_NOTER} cursor-not-allowed bg-lin text-encre-2 shadow-[inset_0_0_0_1px_var(--color-trait)]`,
						children: [/* @__PURE__ */ jsx(Icone, {
							nom: "cadenas",
							className: "size-[15px]"
						}), "Noter"]
					}), /* @__PURE__ */ jsx("span", {
						id: ID_RAISON_NOTER,
						hidden: true,
						children: "Les votes ne sont pas encore ouverts\xA0: ils ouvriront le soir de l’Olympiade."
					})] }),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						popoverTarget: ID_MENU,
						"aria-controls": ID_MENU,
						"aria-label": "Menu",
						className: "grid size-12 cursor-pointer place-content-center gap-[5px] rounded-[13px] text-encre shadow-[inset_0_0_0_1px_var(--color-trait)] paysage:hidden",
						children: [
							/* @__PURE__ */ jsx("span", {
								"aria-hidden": "true",
								className: "block h-[1.6px] w-[17px] rounded-sm bg-current"
							}),
							/* @__PURE__ */ jsx("span", {
								"aria-hidden": "true",
								className: "block h-[1.6px] w-[17px] rounded-sm bg-current"
							}),
							/* @__PURE__ */ jsx("span", {
								"aria-hidden": "true",
								className: "block h-[1.6px] w-[17px] rounded-sm bg-current"
							})
						]
					})
				]
			})
		]
	});
}
/**
* Prénom du spectateur connecté et « Se déconnecter » (session de cet appareil seulement).
* Deux emplacements, un seul affiché à la fois : dans le menu sous 1000 px (« menu »), à droite de
* l'en-tête au-delà (« barre »).
*/
function CompteSpectateur({ prenom, variante }) {
	const [enCours, setEnCours] = useState(false);
	const [erreur, setErreur] = useState(null);
	const verrou = useRef(false);
	async function deconnecter() {
		if (verrou.current) return;
		verrou.current = true;
		setEnCours(true);
		setErreur(null);
		try {
			await seDeconnecter();
		} catch (echec) {
			setErreur(traduireErreurAuth(echec, "demande"));
		} finally {
			verrou.current = false;
			setEnCours(false);
		}
	}
	const menu = variante === "menu";
	return /* @__PURE__ */ jsxs("div", {
		className: menu ? "mt-1 grid gap-1 border-t border-trait px-4 pt-2 paysage:hidden" : "hidden max-w-[16rem] shrink-0 flex-col items-end paysage:flex",
		children: [/* @__PURE__ */ jsxs("div", {
			className: `flex items-center whitespace-nowrap ${menu ? "justify-between gap-3" : "gap-1"}`,
			children: [/* @__PURE__ */ jsxs("span", {
				className: `truncate font-semibold text-encre ${menu ? "text-base" : "max-w-[9rem] text-sm"}`,
				children: [/* @__PURE__ */ jsx("span", {
					className: "sr-only",
					children: "Connecté : "
				}), prenom]
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: deconnecter,
				disabled: enCours,
				className: `inline-flex min-h-12 items-center rounded-full font-medium text-encre-2 underline underline-offset-2 transition-colors hover:text-encre disabled:cursor-wait disabled:opacity-70 ${menu ? "px-2 text-base" : "px-2.5 text-[13.5px]"}`,
				children: "Se déconnecter"
			})]
		}), /* @__PURE__ */ jsx("div", {
			role: "alert",
			children: erreur ? /* @__PURE__ */ jsx("p", {
				className: "pb-1 text-[12.5px] leading-snug text-rouge",
				children: erreur
			}) : null
		})]
	});
}
//#endregion
//#region app/composants/SignatureTpmge.tsx
/**
* Signature « Signé TPMGE » (spec agence). Le style, adapté au fond nuit du
* pied de page, est dans app/app.css (section Signature).
*/
function SignatureTpmge() {
	return /* @__PURE__ */ jsxs("a", {
		className: "tpmge-badge",
		href: "https://tpmge.com/#olympiade-des-manades",
		target: "_blank",
		rel: "noopener noreferrer",
		"aria-label": "Site conçu et développé par TPMGE",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "tpmge-badge__shine",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ jsx("span", {
				className: "tpmge-badge__label",
				children: "Signé"
			}),
			/* @__PURE__ */ jsx("span", {
				className: "tpmge-mark",
				children: "TPMGE"
			})
		]
	});
}
//#endregion
//#region app/composants/PiedDePage.tsx
var LIENS = [
	{
		vers: "/mentions-legales",
		libelle: "Mentions légales"
	},
	{
		vers: "/confidentialite",
		libelle: "Confidentialité"
	},
	{
		vers: "/contact",
		libelle: "Contact"
	},
	{
		vers: "/admin",
		libelle: "Administration"
	}
];
var CARTE = "flex flex-col gap-2.5 rounded-[18px] bg-[rgba(255,240,220,0.05)] px-[18px] py-4 shadow-[inset_0_0_0_1px_var(--trait-nuit)]";
var SURTITRE$1 = "text-[9.5px] leading-none font-bold tracking-[0.2em] text-or-clair uppercase";
/**
* Pied de page du site (maquette : bloc .pf, fond nuit). Ordre imposé par la charte, section 8 :
* partenaire officiel Atch Élevage, mention de collaboration, liens, puis signature TPMGE.
*/
function PiedDePage() {
	return /* @__PURE__ */ jsxs("footer", {
		className: "mt-12 grid gap-6 bg-nuit px-4 pt-9 pb-[calc(28px+env(safe-area-inset-bottom))] text-nuit-txt tablette:grid-cols-[1.2fr_1fr] tablette:px-7 tablette:pt-11 paysage:grid-cols-[1.3fr_1fr_1fr] paysage:px-10 paysage:pt-14 paysage:pb-8 bureau:px-14",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "tablette:col-span-full paysage:col-span-1",
				children: [/* @__PURE__ */ jsx(Logo, { fond: "sombre" }), /* @__PURE__ */ jsx("p", {
					className: "mt-2.5 max-w-[34ch] text-[13.5px] text-nuit-mute",
					children: "Le public note les manades, en direct, aux côtés du jury. Saison 2027 des Olympiades camarguaises."
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: CARTE,
				children: [
					/* @__PURE__ */ jsx("p", {
						className: SURTITRE$1,
						children: "Partenaire officiel"
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "inline-flex items-center gap-1.5 text-[11px] leading-none font-bold tracking-[0.16em] uppercase",
						children: [/* @__PURE__ */ jsx("img", {
							src: "/marques/atch-ecru.svg",
							alt: "Atch",
							width: 50,
							height: 20,
							loading: "lazy",
							decoding: "async",
							className: "h-5 w-auto"
						}), "Élevage"]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-[12.5px] leading-[1.45] text-nuit-mute",
						children: "Atch Élevage, sponsor de l’Olympiade des Manades\xA0: cheptel, filiation et génétique des chevaux et des bovins."
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: CARTE,
				children: [/* @__PURE__ */ jsx("p", {
					className: SURTITRE$1,
					children: "Application"
				}), /* @__PURE__ */ jsx("p", {
					className: "text-[12.5px] leading-[1.45] text-nuit-mute",
					children: "Conçue en collaboration avec Atch Élevage et TPMGE."
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--trait-nuit)] pt-3 tablette:col-span-full",
				children: [/* @__PURE__ */ jsx("ul", {
					className: "flex flex-wrap gap-x-[18px] text-[13.5px] text-nuit-mute",
					children: LIENS.map((lien) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Link, {
						to: lien.vers,
						className: "inline-flex min-h-12 items-center underline-offset-4 transition-colors hover:text-nuit-txt hover:underline",
						children: lien.libelle
					}) }, lien.vers))
				}), /* @__PURE__ */ jsx(SignatureTpmge, {})]
			}),
			/* @__PURE__ */ jsxs("p", {
				className: "-mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11.5px] text-nuit-mute tablette:col-span-full",
				children: [/* @__PURE__ */ jsxs("span", { children: [
					"© ",
					2026,
					" Olympiade des Manades"
				] }), /* @__PURE__ */ jsx("span", { children: "Aucun traceur publicitaire" })]
			})
		]
	});
}
//#endregion
//#region app/composants/TitrePage.tsx
/** En-tête de page du site public (maquette : bloc .pg-h). */
function TitrePage({ surtitre, titre, children, bas }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "px-4 pt-6 pb-1 tablette:px-7 tablette:pt-9 tablette:pb-1.5 paysage:px-10 paysage:pt-[46px] bureau:px-14",
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "text-[10.5px] leading-tight font-bold tracking-[0.2em] text-or-ink uppercase",
				children: surtitre
			}),
			/* @__PURE__ */ jsx("h1", {
				className: "mt-2 font-display text-[36px] leading-[1.04] font-bold tracking-[-0.01em] tablette:text-[46px] paysage:text-[58px] [&_em]:text-rouge",
				children: titre
			}),
			children ? /* @__PURE__ */ jsx("div", {
				className: "mt-2 max-w-[58ch] text-encre-2",
				children
			}) : null,
			bas
		]
	});
}
//#endregion
//#region app/composants/SuiviPresence.tsx
/** Présence opérationnelle d'un compte, sans identifiant publicitaire ni historique de navigation. */
function SuiviPresence() {
	const { session } = useSession();
	const id = session?.user.id;
	useEffect(() => {
		if (!id) return;
		let arrete = false;
		let enCours = false;
		let dernierEssai = 0;
		let timer;
		const controle = new AbortController();
		async function envoyer() {
			if (arrete || enCours) return;
			if (document.visibilityState === "visible" && navigator.onLine && Date.now() - dernierEssai >= 6e4) {
				enCours = true;
				dernierEssai = Date.now();
				try {
					const client = await supabase();
					if (!arrete) await client.rpc("enregistrer_presence").abortSignal(AbortSignal.any([controle.signal, AbortSignal.timeout(5e3)]));
				} catch {} finally {
					enCours = false;
				}
			}
			if (!arrete) timer = setTimeout(() => void envoyer(), 6e4 + Math.random() * 15e3);
		}
		function auRetour() {
			if (document.visibilityState !== "visible" || arrete || enCours) return;
			clearTimeout(timer);
			timer = setTimeout(() => void envoyer(), Math.random() * 5e3);
		}
		timer = setTimeout(() => void envoyer(), Math.random() * 3e4);
		document.addEventListener("visibilitychange", auRetour);
		window.addEventListener("online", auRetour);
		return () => {
			arrete = true;
			controle.abort();
			clearTimeout(timer);
			document.removeEventListener("visibilitychange", auRetour);
			window.removeEventListener("online", auRetour);
		};
	}, [id]);
	return null;
}
//#endregion
//#region app/lib/file-notes.ts
var MAX_ACTIONS = 200;
var RETENTION_CONFIRMED_MS = 6048e5;
var RETENTION_REJECTED_MS = 2592e6;
var LEASE_MS = 2e4;
var TIMEOUT_MS = 1e4;
var IDLE_POLL_MS = 15e3;
var POLL_MIN_MS = 1e4;
var POLL_SPREAD_MS = 5e3;
var MAX_TIMER_MS = 2147e6;
function browserEnvironment() {
	return {
		now: () => Date.now(),
		random: () => Math.random(),
		isOnline: () => typeof navigator === "undefined" || navigator.onLine,
		setTimer: (callback, delay) => setTimeout(callback, delay),
		clearTimer: (handle) => clearTimeout(handle),
		newId: creerId,
		onOnline: typeof window === "undefined" ? void 0 : (listener) => {
			window.addEventListener("online", listener);
			return () => window.removeEventListener("online", listener);
		}
	};
}
function creerId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (letter) => {
		const n = Math.floor(Math.random() * 16);
		return (letter === "x" ? n : n & 3 | 8).toString(16);
	});
}
function retryDelay(essais, random, retryAfterMs) {
	if (typeof retryAfterMs === "number" && retryAfterMs >= 0) return Math.min(MAX_TIMER_MS, retryAfterMs + Math.round(random * Math.min(5e3, retryAfterMs * .2)));
	const base = Math.min(3e5, 1e3 * 2 ** Math.min(essais, 8));
	return Math.round(base * (.8 + random * .4));
}
function pollDelay(essais, random, requested) {
	if (typeof requested === "number" && requested >= 0) {
		const lowerBound = Math.max(POLL_MIN_MS, requested);
		return Math.min(MAX_TIMER_MS, lowerBound + Math.round(random * Math.min(POLL_SPREAD_MS, lowerBound * .2)));
	}
	const ranges = essais === 0 ? [500, 1e3] : essais === 1 ? [2e3, 3e3] : essais === 2 ? [4e3, 6e3] : essais === 3 ? [8e3, 12e3] : [POLL_MIN_MS, 15e3];
	return ranges[0] + Math.round(random * (ranges[1] - ranges[0]));
}
function messageErreur(error) {
	return error instanceof Error && error.message ? error.message : "Connexion impossible. Nouvelle tentative prévue.";
}
function estTerminal(item) {
	return item.statut === "confirmed" || item.statut === "rejected";
}
/** Oldest first for transmission. Sequence wins within a passage, then stable timestamps/ids break cross-tab ties. */
function comparerChronologique(a, b) {
	if (a.passageId === b.passageId && a.sequence !== b.sequence) return a.sequence - b.sequence;
	return a.createdAt - b.createdAt || a.sequence - b.sequence || a.id.localeCompare(b.id);
}
/** Durable, sequential outbox. A single instance is scoped to exactly one authenticated account. */
var FileNotesOutbox = class {
	accountId;
	store;
	transport;
	env;
	owner;
	items = [];
	snapshot;
	listeners = /* @__PURE__ */ new Set();
	started = false;
	processing = false;
	processingPromise = null;
	nextLeaseAt = 0;
	timer = null;
	abort = null;
	unsubscribeStore = null;
	unsubscribeOnline = null;
	constructor(options) {
		this.accountId = options.accountId;
		this.store = options.store;
		this.transport = options.transport;
		this.env = {
			...browserEnvironment(),
			...options.environment
		};
		this.owner = this.env.newId();
		this.snapshot = {
			items: [],
			loading: true,
			storageError: null,
			isOnline: this.env.isOnline()
		};
	}
	getSnapshot = () => this.snapshot;
	subscribe = (listener) => {
		this.listeners.add(listener);
		this.start();
		return () => {
			this.listeners.delete(listener);
			if (this.listeners.size === 0) this.stop();
		};
	};
	async start() {
		if (this.started) return;
		this.started = true;
		this.unsubscribeStore = this.store.subscribe?.(() => void this.reload()) ?? null;
		this.unsubscribeOnline = this.env.onOnline?.(() => void this.flush()) ?? null;
		await this.reload();
		if (!this.snapshot.storageError) try {
			await this.cleanup();
		} catch {}
		this.plan();
	}
	stop() {
		this.started = false;
		this.abort?.abort();
		this.abort = null;
		if (this.timer !== null) this.env.clearTimer(this.timer);
		this.timer = null;
		this.unsubscribeStore?.();
		this.unsubscribeStore = null;
		this.unsubscribeOnline?.();
		this.unsubscribeOnline = null;
	}
	/**
	* Persists before changing the optimistic view. A quota/private-mode failure rejects this call so
	* a caller never claims a vote was saved when it was only in memory.
	*/
	async enqueue(passageId, note) {
		if (!passageId) throw new TypeError("Le passage est requis.");
		if (!Number.isInteger(note) || note < 1 || note > 10) throw new TypeError("La note doit être un entier de 1 à 10.");
		await this.start();
		const now = this.env.now();
		await this.cleanup();
		const item = {
			id: this.env.newId(),
			accountId: this.accountId,
			passageId,
			note,
			sequence: 0,
			statut: "pending",
			attempted: false,
			createdAt: now,
			updatedAt: now,
			essais: 0,
			prochaineTentativeAt: now,
			revision: 0
		};
		const saved = await this.createOrConsolidate(item);
		if (!saved) throw new Error("Impossible d’enregistrer cette note sur cet appareil.");
		this.flush();
		return saved;
	}
	async retryRejected(id) {
		const item = this.items.find((candidate) => candidate.id === id);
		if (!item || item.statut !== "rejected") return;
		const now = this.env.now();
		const replacement = {
			...item,
			id: this.env.newId(),
			sequence: 0,
			statut: "pending",
			attempted: false,
			essais: 0,
			motif: void 0,
			createdAt: now,
			updatedAt: now,
			prochaineTentativeAt: now,
			revision: 0
		};
		if (!await this.create(replacement)) throw new Error("La note a été modifiée dans un autre onglet. Réessayez.");
		this.flush();
	}
	/** Useful after a focus/network event and for deterministic tests. Never runs two network calls at once. */
	flush() {
		if (!this.started || this.processing || !this.env.isOnline()) {
			this.publish({ isOnline: this.env.isOnline() });
			if (this.started && !this.processing) this.plan();
			return this.processingPromise ? this.processingPromise.then(() => this.flush()) : Promise.resolve();
		}
		this.processing = true;
		const run = (async () => {
			try {
				if (await this.store.acquireLease?.(this.accountId, this.owner, this.env.now(), LEASE_MS) === false) {
					this.nextLeaseAt = this.env.now() + 500;
					return;
				}
				this.nextLeaseAt = 0;
				await this.reload(false);
				if (!this.started) return;
				await this.processOne();
			} catch (error) {
				this.setStorageError(messageErreur(error));
			} finally {
				try {
					await this.store.releaseLease?.(this.accountId, this.owner);
				} catch {}
				this.processing = false;
				this.processingPromise = null;
				this.plan();
			}
		})();
		this.processingPromise = run;
		return run;
	}
	async processOne() {
		const now = this.env.now();
		const queued = this.items.filter((item) => item.statut === "queued" && item.prochaineTentativeAt <= now).slice(0, 100);
		if (queued.length > 0) {
			await this.poll(queued);
			return;
		}
		const expiredSending = this.items.find((item) => item.statut === "sending" && item.updatedAt + LEASE_MS <= now);
		if (expiredSending) {
			await this.persist({
				...expiredSending,
				statut: "pending",
				updatedAt: now,
				prochaineTentativeAt: now
			});
			return;
		}
		const candidate = this.items.filter((item) => item.statut === "pending" && item.prochaineTentativeAt <= now).sort(comparerChronologique).find((item) => !this.items.some((older) => older.passageId === item.passageId && comparerChronologique(older, item) < 0 && !estTerminal(older)));
		if (!candidate) return;
		const sending = await this.persist({
			...candidate,
			statut: "sending",
			attempted: true,
			updatedAt: now
		});
		if (!sending) return;
		try {
			const result = await this.withTimeout((signal) => this.transport.submit(sending, signal));
			await this.applySubmission(sending, result);
		} catch (error) {
			await this.retry(sending, messageErreur(error));
		}
	}
	async poll(items) {
		let states;
		try {
			states = await this.withTimeout((signal) => this.transport.poll(items.map((item) => item.id), this.accountId, signal));
		} catch (error) {
			const retryAfterMs = error && typeof error === "object" && "retryAfterMs" in error && typeof error.retryAfterMs === "number" ? error.retryAfterMs : void 0;
			await Promise.all(items.map((item) => this.retry(item, messageErreur(error), retryAfterMs)));
			return;
		}
		await Promise.all(items.map(async (item) => {
			const state = states[item.id];
			if (!state) return this.retry(item, "Suivi indisponible. Nouvelle vérification prévue.");
			if (state.type === "confirmed") return this.persist({
				...item,
				statut: "confirmed",
				motif: void 0,
				updatedAt: this.env.now()
			});
			if (state.type === "rejected") return this.persist({
				...item,
				statut: "rejected",
				motif: state.motif,
				updatedAt: this.env.now()
			});
			if (state.type === "queued") {
				const essais = item.essais + 1;
				return this.persist({
					...item,
					statut: "queued",
					essais,
					motif: void 0,
					updatedAt: this.env.now(),
					prochaineTentativeAt: this.env.now() + pollDelay(essais, this.env.random(), state.pollAfterMs)
				});
			}
		}));
	}
	async applySubmission(item, result) {
		const now = this.env.now();
		if (result.type === "confirmed") await this.persist({
			...item,
			statut: "confirmed",
			motif: void 0,
			updatedAt: now
		});
		else if (result.type === "queued") await this.persist({
			...item,
			statut: "queued",
			essais: 0,
			motif: void 0,
			updatedAt: now,
			prochaineTentativeAt: now + pollDelay(0, this.env.random(), result.pollAfterMs)
		});
		else if (result.type === "rejected") await this.persist({
			...item,
			statut: "rejected",
			motif: result.motif,
			updatedAt: now
		});
		else await this.retry(item, result.motif, result.retryAfterMs);
	}
	async retry(item, motif, retryAfterMs) {
		const essais = item.essais + 1;
		const now = this.env.now();
		await this.persist({
			...item,
			statut: item.statut === "queued" ? "queued" : "pending",
			essais,
			motif,
			updatedAt: now,
			prochaineTentativeAt: now + (item.statut === "queued" ? pollDelay(essais, this.env.random(), retryAfterMs) : retryDelay(essais, this.env.random(), retryAfterMs))
		});
	}
	async withTimeout(work) {
		const controller = new AbortController();
		this.abort = controller;
		const timeout = this.env.setTimer(() => controller.abort(new DOMException("Délai dépassé", "TimeoutError")), TIMEOUT_MS);
		try {
			const aborted = new Promise((_resolve, reject) => {
				controller.signal.addEventListener("abort", () => reject(controller.signal.reason ?? new DOMException("Annulé", "AbortError")), { once: true });
			});
			return await Promise.race([work(controller.signal), aborted]);
		} finally {
			this.env.clearTimer(timeout);
			if (this.abort === controller) this.abort = null;
		}
	}
	async reload(plan = true) {
		if (!this.started) return;
		try {
			this.items = (await this.store.list(this.accountId)).sort((a, b) => b.updatedAt - a.updatedAt);
			this.publish({
				loading: false,
				storageError: null
			});
			if (plan) this.plan();
		} catch (error) {
			this.publish({
				loading: false,
				storageError: messageErreur(error)
			});
		}
	}
	async persist(item, expectedRevision = item.revision) {
		try {
			const saved = await this.store.write(item, expectedRevision);
			if (!saved) {
				await this.reload(false);
				return null;
			}
			this.items = [saved, ...this.items.filter((candidate) => candidate.id !== saved.id)].sort((a, b) => b.updatedAt - a.updatedAt);
			this.publish({ storageError: null });
			return saved;
		} catch (error) {
			this.setStorageError(messageErreur(error));
			throw error;
		}
	}
	async cleanup() {
		const now = this.env.now();
		const obsolete = this.items.filter((item) => item.statut === "confirmed" && item.updatedAt < now - RETENTION_CONFIRMED_MS || item.statut === "rejected" && item.updatedAt < now - RETENTION_REJECTED_MS);
		const terminals = this.items.filter(estTerminal).sort((a, b) => a.updatedAt - b.updatedAt);
		const excess = Math.max(0, this.items.length - MAX_ACTIONS + 1);
		const ids = new Set([...obsolete, ...terminals.slice(0, excess)].map((item) => item.id));
		if (ids.size === 0) return;
		try {
			await this.store.remove([...ids]);
			this.items = this.items.filter((item) => !ids.has(item.id));
			this.publish({ storageError: null });
		} catch (error) {
			this.setStorageError(messageErreur(error));
			throw error;
		}
	}
	async create(item) {
		try {
			if (this.store.create) {
				const saved = await this.store.create(item);
				if (!saved) {
					await this.reload(false);
					return null;
				}
				this.items = [saved, ...this.items.filter((candidate) => candidate.id !== saved.id)].sort((a, b) => b.updatedAt - a.updatedAt);
				this.publish({ storageError: null });
				return saved;
			}
			const sequence = Math.max(0, ...this.items.filter((candidate) => candidate.passageId === item.passageId).map((candidate) => candidate.sequence || 0)) + 1;
			return this.persist({
				...item,
				sequence
			}, null);
		} catch (error) {
			this.setStorageError(messageErreur(error));
			throw error;
		}
	}
	async createOrConsolidate(item) {
		try {
			if (this.store.createOrConsolidate) {
				const saved = await this.store.createOrConsolidate(item);
				if (!saved) {
					await this.reload(false);
					return null;
				}
				this.items = [saved, ...this.items.filter((candidate) => candidate.id !== saved.id)].sort((a, b) => b.updatedAt - a.updatedAt);
				this.publish({ storageError: null });
				return saved;
			}
			const previous = this.items.find((candidate) => candidate.passageId === item.passageId && candidate.statut === "pending" && !candidate.attempted);
			if (previous) return this.persist({
				...previous,
				note: item.note,
				updatedAt: item.updatedAt,
				prochaineTentativeAt: item.prochaineTentativeAt,
				motif: void 0
			});
			return this.create(item);
		} catch (error) {
			this.setStorageError(messageErreur(error));
			throw error;
		}
	}
	plan() {
		if (!this.started || this.processing) return;
		if (this.timer !== null) this.env.clearTimer(this.timer);
		const now = this.env.now();
		if (this.snapshot.storageError) {
			this.timer = this.env.setTimer(() => {
				this.timer = null;
				this.flush();
			}, IDLE_POLL_MS);
			return;
		}
		if (!this.env.isOnline()) {
			this.timer = this.env.setTimer(() => {
				this.timer = null;
				this.flush();
			}, IDLE_POLL_MS);
			return;
		}
		if (this.nextLeaseAt > now) {
			this.timer = this.env.setTimer(() => {
				this.timer = null;
				this.flush();
			}, this.nextLeaseAt - now);
			return;
		}
		const due = this.items.filter((item) => item.statut === "queued" || item.statut === "pending" && !this.items.some((older) => older.passageId === item.passageId && comparerChronologique(older, item) < 0 && !estTerminal(older))).reduce((earliest, item) => Math.min(earliest, item.prochaineTentativeAt), Number.POSITIVE_INFINITY);
		const sendingLease = this.items.filter((item) => item.statut === "sending").reduce((earliest, item) => Math.min(earliest, item.updatedAt + LEASE_MS), Number.POSITIVE_INFINITY);
		const earliest = Math.min(due, sendingLease);
		const delay = Number.isFinite(earliest) ? Math.max(0, earliest - now) : IDLE_POLL_MS;
		this.timer = this.env.setTimer(() => {
			this.timer = null;
			this.flush();
		}, delay);
	}
	publish(change) {
		this.snapshot = {
			...this.snapshot,
			...change,
			items: [...this.items],
			isOnline: this.env.isOnline()
		};
		for (const listener of this.listeners) listener();
	}
	setStorageError(storageError) {
		this.publish({
			loading: false,
			storageError
		});
	}
};
var config = null;
var outboxes = /* @__PURE__ */ new Map();
/** Set once by the browser bootstrap. Tests may set an in-memory store and scripted transport. */
function configurerFileNotes(next) {
	for (const outbox of outboxes.values()) outbox.stop();
	config = next;
	outboxes.clear();
}
function obtenirFileNotes(accountId) {
	if (!config) throw new Error("La synchronisation des notes n’est pas configurée.");
	let outbox = outboxes.get(accountId);
	if (!outbox) {
		outbox = new FileNotesOutbox({
			accountId,
			...config
		});
		outboxes.set(accountId, outbox);
	}
	return outbox;
}
var VIDE$1 = {
	items: [],
	loading: false,
	storageError: null,
	isOnline: true
};
/** React facade used by the root synchronizer and the notation route; both share one account outbox. */
function useFileNotes(accountId) {
	const outbox = useMemo(() => accountId && config ? obtenirFileNotes(accountId) : null, [accountId]);
	return {
		...useSyncExternalStore(outbox ? outbox.subscribe : () => () => {}, outbox ? outbox.getSnapshot : () => VIDE$1, () => VIDE$1),
		enqueue: async (passageId, note) => {
			if (!outbox) throw new Error("Connectez-vous pour enregistrer une note.");
			return outbox.enqueue(passageId, note);
		},
		retryRejected: async (id) => {
			await outbox?.retryRejected(id);
		}
	};
}
//#endregion
//#region app/lib/file-notes-browser.ts
var DB_NAME = "olympiade-file-notes-v1";
var ITEMS = "items";
var LEASES = "leases";
var SEQUENCES = "sequences";
function derniereAction(items, passageId) {
	return items.filter((item) => item.passageId === passageId).sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || a.createdAt - b.createdAt || a.id.localeCompare(b.id)).at(-1);
}
/** IndexedDB implementation. All writes are transactions and are broadcast to other tabs. */
var IndexedDbFileNotesStore = class {
	database = null;
	channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("olympiade-file-notes-v1");
	async list(accountId) {
		const db = await this.open();
		return this.request(db.transaction(ITEMS).objectStore(ITEMS).index("accountId").getAll(IDBKeyRange.only(accountId)));
	}
	async write(item, expectedRevision) {
		const tx = (await this.open()).transaction(ITEMS, "readwrite");
		const store = tx.objectStore(ITEMS);
		const previous = await this.request(store.get(item.id));
		if (expectedRevision === null && previous || expectedRevision !== null && previous?.revision !== expectedRevision) {
			tx.abort();
			return null;
		}
		if (expectedRevision === null && await this.request(store.index("accountId").count(IDBKeyRange.only(item.accountId))) >= 200) {
			tx.abort();
			throw new Error("Trop de notes sont en attente sur cet appareil. Attendez leur synchronisation avant de continuer.");
		}
		const saved = {
			...item,
			revision: (previous?.revision ?? 0) + 1
		};
		store.put(saved);
		await this.done(tx);
		this.channel?.postMessage("change");
		return saved;
	}
	async create(item) {
		const db = await this.open();
		const key = `${item.accountId}:${item.passageId}`;
		const tx = db.transaction([ITEMS, SEQUENCES], "readwrite");
		const items = tx.objectStore(ITEMS);
		const sequences = tx.objectStore(SEQUENCES);
		if (await this.request(items.get(item.id))) {
			tx.abort();
			return null;
		}
		const accountItems = await this.request(items.index("accountId").getAll(IDBKeyRange.only(item.accountId)));
		if (accountItems.length >= 200) {
			tx.abort();
			throw new Error("Trop de notes sont en attente sur cet appareil. Attendez leur synchronisation avant de continuer.");
		}
		const previous = await this.request(sequences.get(key));
		const maximumExistant = Math.max(0, ...accountItems.filter((candidate) => candidate.passageId === item.passageId).map((candidate) => candidate.sequence || 0));
		const sequence = Math.max(previous?.value ?? 0, maximumExistant) + 1;
		sequences.put({
			key,
			value: sequence
		});
		const saved = {
			...item,
			sequence,
			revision: 1
		};
		items.put(saved);
		await this.done(tx);
		this.channel?.postMessage("change");
		return saved;
	}
	async createOrConsolidate(item) {
		const db = await this.open();
		const key = `${item.accountId}:${item.passageId}`;
		const tx = db.transaction([ITEMS, SEQUENCES], "readwrite");
		const items = tx.objectStore(ITEMS);
		const sequences = tx.objectStore(SEQUENCES);
		if (await this.request(items.get(item.id))) {
			tx.abort();
			return null;
		}
		const accountItems = await this.request(items.index("accountId").getAll(IDBKeyRange.only(item.accountId)));
		const latest = derniereAction(accountItems, item.passageId);
		if (latest?.statut === "pending" && !latest.attempted) {
			const saved = {
				...latest,
				note: item.note,
				updatedAt: item.updatedAt,
				prochaineTentativeAt: item.prochaineTentativeAt,
				motif: void 0,
				revision: (latest.revision || 0) + 1
			};
			items.put(saved);
			await this.done(tx);
			this.channel?.postMessage("change");
			return saved;
		}
		if (accountItems.length >= 200) {
			tx.abort();
			throw new Error("Trop de notes sont en attente sur cet appareil. Attendez leur synchronisation avant de continuer.");
		}
		const previous = await this.request(sequences.get(key));
		const maximumExistant = Math.max(0, ...accountItems.filter((candidate) => candidate.passageId === item.passageId).map((candidate) => candidate.sequence || 0));
		const sequence = Math.max(previous?.value ?? 0, maximumExistant) + 1;
		sequences.put({
			key,
			value: sequence
		});
		const saved = {
			...item,
			sequence,
			revision: 1
		};
		items.put(saved);
		await this.done(tx);
		this.channel?.postMessage("change");
		return saved;
	}
	async remove(ids) {
		const tx = (await this.open()).transaction(ITEMS, "readwrite");
		const store = tx.objectStore(ITEMS);
		ids.forEach((id) => store.delete(id));
		await this.done(tx);
		this.channel?.postMessage("change");
	}
	async acquireLease(accountId, owner, now, durationMs) {
		const tx = (await this.open()).transaction(LEASES, "readwrite");
		const store = tx.objectStore(LEASES);
		const previous = await this.request(store.get(accountId));
		if (previous && previous.owner !== owner && previous.until > now) {
			tx.abort();
			return false;
		}
		store.put({
			accountId,
			owner,
			until: now + durationMs
		});
		await this.done(tx);
		return true;
	}
	async releaseLease(accountId, owner) {
		const tx = (await this.open()).transaction(LEASES, "readwrite");
		const store = tx.objectStore(LEASES);
		if ((await this.request(store.get(accountId)))?.owner === owner) store.delete(accountId);
		await this.done(tx);
	}
	subscribe(listener) {
		if (!this.channel) return () => {};
		const callback = () => listener();
		this.channel.addEventListener("message", callback);
		return () => this.channel?.removeEventListener("message", callback);
	}
	open() {
		if (this.database) return this.database;
		if (typeof indexedDB === "undefined") return Promise.reject(/* @__PURE__ */ new Error("Le stockage durable IndexedDB est indisponible sur cet appareil."));
		this.database = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, 2);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(ITEMS)) db.createObjectStore(ITEMS, { keyPath: "id" }).createIndex("accountId", "accountId");
				if (!db.objectStoreNames.contains(LEASES)) db.createObjectStore(LEASES, { keyPath: "accountId" });
				if (!db.objectStoreNames.contains(SEQUENCES)) db.createObjectStore(SEQUENCES, { keyPath: "key" });
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error ?? /* @__PURE__ */ new Error("IndexedDB indisponible"));
		});
		this.database.catch(() => {
			this.database = null;
		});
		return this.database;
	}
	request(request) {
		return new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}
	done(transaction) {
		return new Promise((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onabort = () => reject(transaction.error ?? /* @__PURE__ */ new Error("Écriture IndexedDB annulée"));
			transaction.onerror = () => reject(transaction.error ?? /* @__PURE__ */ new Error("Écriture IndexedDB impossible"));
		});
	}
};
async function sessionPour(accountId) {
	const { data, error } = await (await supabase()).auth.getSession();
	if (error || !data.session || data.session.user.id !== accountId) throw new Error("Session absente ou changée.");
	return data.session;
}
/** Le SDK PostgREST ne retourne pas Retry-After : ce transport conserve les en-têtes HTTP. */
async function rpc(nom, corps, accountId, signal) {
	const session = await sessionPour(accountId);
	signal.throwIfAborted();
	const reponse = await fetch(new URL(`/rest/v1/rpc/${nom}`, "https://khwlwpzydlrfocfpvywv.supabase.co"), {
		method: "POST",
		headers: {
			apikey: "sb_publishable_9EXUOvjsTgH6s-uVfedA0g_n9buhJFY",
			Authorization: `Bearer ${session.access_token}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(corps),
		signal
	});
	const entete = reponse.headers.get("retry-after");
	const secondes = entete === null ? NaN : Number(entete);
	const retryAfterMs = entete === null ? void 0 : Number.isFinite(secondes) ? Math.max(0, secondes * 1e3) : Math.max(0, Date.parse(entete) - Date.now());
	return {
		reponse,
		data: await reponse.json().catch(() => null),
		retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : void 0
	};
}
function temporaire(status, code) {
	return status === 401 || status === 408 || status === 429 || status >= 500 || [
		"40001",
		"40P01",
		"55P03",
		"57014"
	].includes(code ?? "");
}
/** Exact adapter for the durable SQL queue. It persists no JWT and validates the user before each RPC. */
var transportSupabaseFileNotes = {
	async submit(item, signal) {
		try {
			const { reponse, data, retryAfterMs } = await rpc("mettre_note_en_file", {
				p_request_id: item.id,
				p_passage_id: item.passageId,
				p_note: item.note
			}, item.accountId, signal);
			if (!reponse.ok) return temporaire(reponse.status, data?.code) ? {
				type: "retry",
				retryAfterMs,
				motif: reponse.status === 401 ? "Reconnectez-vous pour reprendre cet envoi." : "Service momentanément indisponible."
			} : {
				type: "rejected",
				motif: "La note a été refusée par le serveur."
			};
			const row = Array.isArray(data) ? data[0] : null;
			if (!row) return {
				type: "retry",
				motif: "Réponse serveur incomplète."
			};
			if (row.statut === "confirmee") return { type: "confirmed" };
			if (row.statut === "rejetee") return {
				type: "rejected",
				motif: row.motif || "La note a été refusée."
			};
			return row.statut === "en_attente" ? { type: "queued" } : {
				type: "retry",
				motif: "Réponse serveur incomplète."
			};
		} catch (error) {
			return {
				type: "retry",
				motif: error instanceof Error ? error.message : void 0
			};
		}
	},
	async poll(ids, accountId, signal) {
		const { reponse, data, retryAfterMs } = await rpc("lire_statuts_file_notes", { p_request_ids: [...ids] }, accountId, signal);
		if (!reponse.ok) throw Object.assign(/* @__PURE__ */ new Error("Suivi momentanément indisponible."), { retryAfterMs });
		const result = {};
		for (const row of Array.isArray(data) ? data : []) {
			if (row.statut === "confirmee") result[row.request_id] = { type: "confirmed" };
			if (row.statut === "rejetee") result[row.request_id] = {
				type: "rejected",
				motif: row.motif || "La note a été refusée."
			};
			if (row.statut === "en_attente") result[row.request_id] = { type: "queued" };
		}
		return result;
	}
};
/** Call once from the browser root before useFileNotes. */
function configurerFileNotesNavigateur() {
	configurerFileNotes({
		store: new IndexedDbFileNotesStore(),
		transport: transportSupabaseFileNotes
	});
}
//#endregion
//#region app/composants/SuiviNotes.tsx
if (typeof window !== "undefined") configurerFileNotesNavigateur();
/** La reprise continue après une navigation dans le site, sans transmettre les notes d'un autre compte. */
function SuiviNotes() {
	const { session } = useSession();
	const file = useFileNotes(session?.user.id ?? null);
	const { pathname } = useLocation();
	const nombre = file.items.filter((i) => [
		"pending",
		"sending",
		"queued"
	].includes(i.statut)).length;
	if (!nombre || pathname === "/noter") return null;
	return /* @__PURE__ */ jsxs("p", {
		role: "status",
		className: "mx-auto my-4 max-w-5xl rounded-xl border border-trait bg-lin px-5 py-3 text-sm",
		children: [
			nombre,
			" ",
			nombre > 1 ? "notes en attente d’enregistrement" : "note en attente d’enregistrement",
			".",
			" ",
			/* @__PURE__ */ jsx(Link, {
				to: "/noter",
				className: "font-semibold text-rouge underline underline-offset-2",
				children: "Voir mes envois"
			})
		]
	});
}
//#endregion
//#region app/donnees/photos-accueil.ts
/** Modification des fichiers des épreuves : même cadre que l'original (rapports de taille vérifiés sur Commons). */
var RETOUCHE = "retouchée (niveaux de gris, duotone)";
var BY_SA_4 = {
	licence: "CC BY-SA 4.0",
	lienLicence: "https://creativecommons.org/licenses/by-sa/4.0/deed.fr"
};
var PHOTOS_ACCUEIL = {
	gardian: {
		id: "gardian",
		fichier: "/photos/hero-640.webp",
		avif: "/photos/hero-640.avif",
		largeur: 640,
		hauteur: 425,
		auteur: "afroboof",
		licence: "CC BY-SA 2.0",
		lienLicence: "https://creativecommons.org/licenses/by-sa/2.0/deed.fr",
		fiche: "https://commons.wikimedia.org/wiki/File:Gardian_galopant_vers_sa_manade.jpg",
		modification: "recadrée et retouchée (niveaux de gris, duotone)"
	},
	manade: {
		id: "manade",
		fichier: "/photos/manade-640.webp",
		avif: "/photos/manade-640.avif",
		largeur: 640,
		hauteur: 360,
		auteur: "Christian Ferrer",
		...BY_SA_4,
		fiche: "https://commons.wikimedia.org/wiki/File:Gardian_and_Camargue_cattle,_Saint-Gilles_11.jpg",
		modification: RETOUCHE
	},
	chevaux: {
		id: "chevaux",
		fichier: "/photos/chevaux-640.webp",
		avif: "/photos/chevaux-640.avif",
		largeur: 640,
		hauteur: 427,
		auteur: "Benjamin Smith / Wikimedia Commons",
		...BY_SA_4,
		fiche: "https://commons.wikimedia.org/wiki/File:Saint-Laurent-d%27Aigouze_-_Camargue_horses_-_01.jpg",
		modification: RETOUCHE
	},
	arenes: {
		id: "arenes",
		fichier: "/photos/arenes-640.webp",
		avif: "/photos/arenes-640.avif",
		largeur: 640,
		hauteur: 421,
		auteur: "Krzysztof Golik",
		...BY_SA_4,
		fiche: "https://commons.wikimedia.org/wiki/File:Arenes_de_Nimes_(1).jpg",
		modification: RETOUCHE
	}
};
/**
* Fichiers de l'affiche de l'accueil (photo « gardian »). Sur téléphone, l'affiche, plus haute que
* large, ne montre qu'une bande verticale de la photo : jusqu'à 480 px de large, un recadrage de
* 700 × 730 pris à 38 % (le même point que le cadrage CSS, donc exactement la même image) remplace la
* photo entière : 48 Ko en AVIF au lieu de 74 Ko, et de 110 Ko pour le WebP d'origine.
*/
var AFFICHE = {
	telephone: {
		media: "(max-width: 480px)",
		avif: "/photos/hero-telephone.avif",
		webp: "/photos/hero-telephone.webp",
		largeur: 700,
		hauteur: 730
	},
	entiere: {
		avif: "/photos/hero.avif",
		webp: "/photos/hero.webp",
		largeur: 1100,
		hauteur: 730
	}
};
//#endregion
//#region app/composants/Affiche.tsx
var ID_CREDIT = "credit-photo-affiche";
/**
* Affiche de l'accueil (maquette : .affiche, charte section 5) : grande photo en duotone,
* « ARÈNES DE NÎMES » en Playfair capitales, date en Playfair italique, titre au pinceau incliné
* de −5°, manades en capitales séparées par des filets. Le titre est le h1 de la page.
*
* La photo est une <img> du HTML pré-rendu (et non un fond CSS, découvert après la feuille de style) :
* c'est l'élément le plus grand du premier écran (LCP), chargé en priorité haute. Le duotone est
* celui de .duo-calques (app/app.css).
*/
function Affiche({ soiree }) {
	const heure = soiree ? formaterHeure(soiree.heure) : null;
	return /* @__PURE__ */ jsxs("div", {
		className: "relative isolate flex min-h-[470px] flex-col justify-between overflow-hidden rounded-[26px] px-5 pt-[22px] pb-[26px] text-white tablette:min-h-[560px] paysage:min-h-[600px] paysage:px-9 paysage:py-[34px] bureau:min-h-[640px]",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "absolute inset-0",
				children: /* @__PURE__ */ jsxs("picture", {
					className: "duo-calques block size-full",
					children: [
						/* @__PURE__ */ jsx("source", {
							type: "image/avif",
							media: AFFICHE.telephone.media,
							srcSet: AFFICHE.telephone.avif,
							width: AFFICHE.telephone.largeur,
							height: AFFICHE.telephone.hauteur
						}),
						/* @__PURE__ */ jsx("source", {
							type: "image/webp",
							media: AFFICHE.telephone.media,
							srcSet: AFFICHE.telephone.webp,
							width: AFFICHE.telephone.largeur,
							height: AFFICHE.telephone.hauteur
						}),
						/* @__PURE__ */ jsx("source", {
							type: "image/avif",
							srcSet: AFFICHE.entiere.avif
						}),
						/* @__PURE__ */ jsx("img", {
							src: AFFICHE.entiere.webp,
							width: AFFICHE.entiere.largeur,
							height: AFFICHE.entiere.hauteur,
							alt: "Un gardian à cheval traverse un pré clos de barbelés, photo en duotone orangé",
							"aria-describedby": ID_CREDIT,
							fetchPriority: "high",
							className: "object-[38%_42%]"
						})
					]
				})
			}),
			/* @__PURE__ */ jsx("div", {
				"aria-hidden": "true",
				className: "voile-affiche absolute inset-0"
			}),
			/* @__PURE__ */ jsx("div", {
				"aria-hidden": "true",
				className: "grain absolute inset-0 opacity-30"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "relative z-10 flex items-start justify-between gap-3 [text-shadow:0_0_2px_rgba(60,15,5,.7),0_1px_3px_rgba(60,15,5,.5),0_2px_16px_rgba(90,20,5,.55)]",
				children: [/* @__PURE__ */ jsxs("p", {
					className: "font-display uppercase",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "mb-2 block pl-[3px] text-[10.5px] leading-none font-semibold tracking-[0.32em] paysage:mb-3 paysage:text-[13px]",
							children: "Arènes de"
						}),
						" ",
						/* @__PURE__ */ jsx("span", {
							className: "block text-[46px] leading-[.92] font-extrabold tracking-[0.02em] [text-shadow:0_6px_26px_rgba(90,20,5,.35)] paysage:text-[74px]",
							children: VILLE_AFFICHE
						})
					]
				}), soiree ? /* @__PURE__ */ jsxs("p", {
					className: "border-l-[1.5px] border-white/70 pl-3 text-[14px] leading-[1.15] font-extrabold tracking-[0.04em] uppercase paysage:text-[20px]",
					children: [
						/* @__PURE__ */ jsxs("time", {
							dateTime: soiree.date_soiree,
							children: [formaterJourMois(soiree.date_soiree), heure ? ` ${heure}` : ""]
						}),
						" ",
						/* @__PURE__ */ jsx("span", {
							className: "mt-1 block font-display text-[30px] leading-none font-medium tracking-normal text-peche normal-case italic paysage:text-[44px]",
							children: soiree.annee
						})
					]
				}) : null]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "relative z-10",
				children: [/* @__PURE__ */ jsxs("h1", {
					className: "flex -rotate-5 flex-col items-center leading-[.9] font-normal [text-shadow:0_8px_30px_rgba(90,20,5,.45)]",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "ml-[12%] self-start font-brush text-[26px] paysage:text-[38px]",
							children: "Les grandes"
						}),
						" ",
						/* @__PURE__ */ jsx("span", {
							className: "font-brush text-[70px] tracking-[-0.01em] paysage:text-[132px]",
							children: "Olympiades"
						}),
						" ",
						/* @__PURE__ */ jsx("span", {
							className: "mr-[10%] self-end font-brush text-[30px] paysage:text-[48px]",
							children: "des Manades"
						})
					]
				}), /* @__PURE__ */ jsx("ul", {
					"aria-label": `Manades de l’édition ${EDITION_MANADES.annee}`,
					className: "mt-[18px] flex flex-wrap justify-center gap-y-1 text-[10.5px] leading-none font-extrabold tracking-[0.1em] text-[#ffe2c2] uppercase [text-shadow:0_1px_10px_rgba(70,15,0,.55)] paysage:gap-y-2 paysage:text-[13px]",
					children: EDITION_MANADES.manades.map((manade) => /* @__PURE__ */ jsx("li", {
						className: "border-l border-[rgba(255,226,194,.6)] px-2 first:border-l-0 paysage:px-3.5",
						children: manade
					}, manade))
				})]
			})
		]
	});
}
/** Crédit de la photo de l'affiche, juste dessous (licence CC BY-SA : auteur, licence, modifications). */
function CreditAffiche({ className = "" }) {
	const photo = PHOTOS_ACCUEIL.gardian;
	return /* @__PURE__ */ jsxs("p", {
		id: ID_CREDIT,
		className: `text-[11.5px] leading-snug text-encre-2 ${className}`,
		children: [
			"Photo de l’affiche\xA0:",
			" ",
			/* @__PURE__ */ jsx("a", {
				href: photo.fiche,
				className: "underline underline-offset-2 hover:text-encre",
				children: photo.auteur
			}),
			",",
			" ",
			/* @__PURE__ */ jsx("a", {
				href: photo.lienLicence,
				className: "underline underline-offset-2 hover:text-encre",
				rel: "license",
				children: photo.licence
			}),
			", via Wikimedia Commons, ",
			photo.modification,
			"."
		]
	});
}
//#endregion
//#region app/lib/inscription-ouverte.ts
/** Vrai seulement pour la chaîne exacte « true ». */
function inscriptionOuverte(env) {
	return env.VITE_INSCRIPTION_OUVERTE === "true";
}
var INSCRIPTION_OUVERTE = inscriptionOuverte({
	"BASE_URL": "/",
	"DEV": false,
	"MODE": "production",
	"PROD": true,
	"SSR": true,
	"VITE_INSCRIPTION_OUVERTE": "false",
	"VITE_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_9EXUOvjsTgH6s-uVfedA0g_n9buhJFY",
	"VITE_SUPABASE_URL": "https://khwlwpzydlrfocfpvywv.supabase.co"
});
/** Texte affiché à la place des liens d'inscription tant que le drapeau est faux. */
var TEXTE_INSCRIPTIONS_FERMEES = "Inscriptions bientôt ouvertes";
//#endregion
//#region app/composants/Fer.tsx
/**
* Fer de manade provisoire (charte, section 5) : cercle fin et initiale au pinceau. Les vrais fers
* ne s'affichent qu'avec l'accord de chaque manade. Décoratif : le nom est écrit à côté.
*/
function Fer({ manade, taille = "normal", clair = false, className = "" }) {
	const initiale = initialeManade(manade);
	return /* @__PURE__ */ jsx("span", {
		"aria-hidden": "true",
		className: `inline-grid flex-none place-items-center rounded-full pt-[3px] pr-0.5 font-brush leading-none shadow-[inset_0_0_0_1.5px_currentColor] ${taille === "petit" ? "size-8 text-[17px]" : "size-11 text-[24px]"} ${clair ? "text-white" : "text-or-ink"} ${className}`,
		children: initiale
	});
}
/** Initiale du fer : celle du dernier mot (« Robert Michel » → M, comme sur la maquette). */
function initialeManade(manade) {
	return (manade.trim().split(/\s+/).at(-1) ?? manade).charAt(0).toLocaleUpperCase("fr-FR");
}
//#endregion
//#region app/composants/ProchaineSoiree.tsx
var CERCLE = "inline-grid size-11 flex-none place-items-center rounded-full text-white shadow-[inset_0_0_0_1.5px_currentColor]";
/**
* Encart du compte à rebours, dans la carte « Notez les Olympiades » (à la place de l'encart
* « En piste » de la maquette, réservé à la soirée en cours) : « Dans 313 jours », puis le nom de
* la soirée, avec la billetterie quand elle existe.
*/
function ProchaineSoiree({ soiree, disponible, maintenant }) {
	if (!disponible) return /* @__PURE__ */ jsxs("div", {
		className: "relative z-10 flex items-center gap-3 rounded-[18px] bg-[rgba(50,10,0,.24)] p-3",
		children: [/* @__PURE__ */ jsx("span", {
			"aria-hidden": "true",
			className: CERCLE,
			children: /* @__PURE__ */ jsx(Icone, { nom: "calendrier" })
		}), /* @__PURE__ */ jsx("p", {
			className: "text-[14px] leading-snug font-semibold",
			children: "Informations momentanément indisponibles"
		})]
	});
	if (!soiree) return /* @__PURE__ */ jsxs("div", {
		className: "relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[18px] bg-[rgba(50,10,0,.24)] p-3",
		children: [
			/* @__PURE__ */ jsx("span", {
				"aria-hidden": "true",
				className: CERCLE,
				children: /* @__PURE__ */ jsx(Icone, { nom: "calendrier" })
			}),
			/* @__PURE__ */ jsx("p", {
				className: "min-w-0 flex-1 font-display text-[17px] leading-tight font-bold",
				children: "Prochaines dates bientôt annoncées"
			}),
			/* @__PURE__ */ jsx(Link, {
				to: "/dates",
				className: "ml-auto inline-flex min-h-12 items-center gap-1 text-[13px] font-semibold underline underline-offset-2",
				children: "Voir les dates"
			})
		]
	});
	const debut = instantSoiree(soiree.date_soiree, soiree.heure);
	const texte = texteCompteARebours(compteARebours(debut, maintenant));
	const nom = /* @__PURE__ */ jsx("span", {
		className: "block text-[12.5px] leading-[1.25] font-semibold text-balance",
		children: soiree.nom
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "relative z-10 flex items-center gap-3 rounded-[18px] bg-[rgba(50,10,0,.24)] p-3",
		children: [
			/* @__PURE__ */ jsx("span", {
				"aria-hidden": "true",
				className: CERCLE,
				children: /* @__PURE__ */ jsx(Icone, { nom: "horloge" })
			}),
			/* @__PURE__ */ jsxs("p", {
				className: "flex-none",
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "block text-[9.5px] leading-[1.2] font-bold tracking-[0.16em] uppercase",
						children: texte ? "Dans" : "C’est"
					}),
					" ",
					/* @__PURE__ */ jsx("time", {
						dateTime: debut.toISOString(),
						className: "block font-display text-[22px] leading-[1.05] font-bold whitespace-nowrap italic",
						children: texte ?? "ce soir"
					})
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "ml-auto min-w-0 max-w-[20ch] text-right",
				children: soiree.lien_billetterie ? /* @__PURE__ */ jsxs("a", {
					href: soiree.lien_billetterie,
					className: "group inline-flex min-h-12 flex-col items-end justify-center",
					children: [nom, /* @__PURE__ */ jsxs("span", {
						className: "inline-flex items-center gap-1 text-[12px] underline underline-offset-2 group-hover:no-underline",
						children: ["Billetterie", /* @__PURE__ */ jsx(Icone, {
							nom: "externe",
							className: "size-3"
						})]
					})]
				}) : nom
			})
		]
	});
}
//#endregion
//#region app/composants/BlocNoter.tsx
var PASTILLE = "inline-flex items-center gap-[7px] rounded-full bg-white/16 py-1.5 pr-2.5 pl-[9px] text-[10.5px] leading-none font-bold tracking-[0.14em] whitespace-nowrap uppercase";
var BOUTON = "relative z-10 inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#fffaf2] px-6 text-[16.5px] leading-none font-semibold whitespace-nowrap text-[#9a2c12] shadow-[0_14px_30px_-14px_rgba(60,10,0,.7)]";
/**
* Carte « Notez les Olympiades » (maquette : .notez), premier bloc de l'accueil sur téléphone.
*
* Hors soirée, le bouton reste à sa place mais grisé (aria-disabled, sans navigation) et l'info
* dessous dit pourquoi : date, heure et lieu de la prochaine soirée du calendrier.
* Soirée ouverte (lot 2) : le bouton mène au vote, avec la pastille « En direct ».
*
* Inscription (Task 6) : possible avant la soirée (CDC 4.4). Sous la raison du bouton grisé, un lien
* vers /inscription, ou, pour un spectateur déjà connecté, « Vous êtes inscrit… ». Le pré-rendu et
* l'hydratation affichent le lien : la session n'est connue qu'ensuite, dans le navigateur.
* Drapeau VITE_INSCRIPTION_OUVERTE à faux (par défaut) : « Inscriptions bientôt ouvertes », sans
* lien, à la place du lien d'inscription.
*/
function BlocNoter({ etat, soiree, calendrierDisponible, maintenant, direct }) {
	const idTitre = useId();
	const idRaison = useId();
	const ouvert = etat === "ouvert";
	const { session, prenom } = useSession();
	const inscrit = session !== null;
	return /* @__PURE__ */ jsxs("section", {
		"aria-labelledby": idTitre,
		className: "carte-notez relative isolate order-first flex flex-col gap-3 overflow-hidden rounded-[26px] px-5 pt-5 pb-[18px] text-white shadow-[0_24px_50px_-24px_rgba(170,46,23,.75)] tablette:order-none tablette:justify-between tablette:px-6 tablette:pt-[26px] tablette:pb-[22px] paysage:px-[30px] paysage:pt-8 paysage:pb-[26px]",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "relative z-10 flex flex-wrap items-center justify-between gap-2",
				children: [
					ouvert ? /* @__PURE__ */ jsxs("p", {
						className: PASTILLE,
						children: [/* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							className: "point-direct size-[7px] rounded-full bg-current"
						}), "En direct"]
					}) : /* @__PURE__ */ jsxs("p", {
						className: PASTILLE,
						children: [/* @__PURE__ */ jsx(Icone, {
							nom: "calendrier",
							className: "size-3"
						}), "Prochaine soirée"]
					}),
					ouvert && direct?.epreuve ? /* @__PURE__ */ jsx("p", {
						className: "text-[12px] leading-[1.3] font-semibold",
						children: direct.epreuve
					}) : null,
					!ouvert && soiree ? /* @__PURE__ */ jsxs("p", {
						className: "text-[12px] leading-[1.3] font-semibold",
						children: [soiree.ville, soiree.statut === "previsionnelle" ? " · date prévisionnelle" : ""]
					}) : null
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "relative z-10",
				children: [/* @__PURE__ */ jsx("h2", {
					id: idTitre,
					className: "mt-1 font-brush text-[46px] leading-[.95] font-normal paysage:text-[60px]",
					children: "Notez les Olympiades"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-2.5 max-w-[36ch] text-[15px] leading-[1.45]",
					children: ouvert ? "Ce soir, le public note aussi. Donnez une note de 1 à 10 à chaque manade, dès la fin de son passage." : "Le soir de l’Olympiade, le public note aussi, aux côtés du jury."
				})]
			}),
			ouvert ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs(Link, {
					to: inscrit || !INSCRIPTION_OUVERTE ? "/noter" : "/inscription",
					className: `${BOUTON} transition-[filter,transform] hover:brightness-105 active:scale-[0.97]`,
					children: ["Je note les manades", /* @__PURE__ */ jsx(Icone, { nom: "fleche" })]
				}),
				inscrit || !INSCRIPTION_OUVERTE ? null : /* @__PURE__ */ jsxs("p", {
					className: "relative z-10 text-[13px] leading-[1.4]",
					children: [
						"Inscription en 30 secondes\xA0: prénom, email, code reçu.",
						" ",
						/* @__PURE__ */ jsx(Link, {
							to: "/inscription",
							className: "font-semibold underline underline-offset-2",
							children: "Déjà inscrit\xA0?"
						})
					]
				}),
				direct?.manadeEnPiste ? /* @__PURE__ */ jsxs("div", {
					className: "relative z-10 flex items-center gap-3 rounded-[18px] bg-[rgba(50,10,0,.24)] p-3",
					children: [
						/* @__PURE__ */ jsx(Fer, {
							manade: direct.manadeEnPiste,
							clair: true
						}),
						/* @__PURE__ */ jsxs("p", { children: [
							/* @__PURE__ */ jsx("span", {
								className: "block text-[9.5px] leading-[1.2] font-bold tracking-[0.16em] uppercase",
								children: "En piste"
							}),
							" ",
							/* @__PURE__ */ jsxs("span", {
								className: "font-display text-[17px] leading-[1.2] font-bold",
								children: ["Manade ", direct.manadeEnPiste]
							})
						] }),
						direct.notes != null ? /* @__PURE__ */ jsxs("p", {
							className: "ml-auto text-right text-[11.5px] leading-[1.1]",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "block font-display text-[22px] leading-none font-bold italic tabular-nums",
									children: direct.notes.toLocaleString("fr-FR")
								}),
								" ",
								"notes"
							]
						}) : null
					]
				}) : null
			] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					"aria-disabled": "true",
					"aria-describedby": idRaison,
					className: `${BOUTON} cursor-not-allowed opacity-[.62] shadow-none`,
					children: ["Je note les manades", /* @__PURE__ */ jsx(Icone, {
						nom: "cadenas",
						className: "size-[17px]"
					})]
				}),
				/* @__PURE__ */ jsx("p", {
					id: idRaison,
					className: "relative z-10 text-[13.5px] leading-[1.45]",
					children: raisonVotesFermes(soiree)
				}),
				inscrit ? /* @__PURE__ */ jsxs("p", {
					className: "relative z-10 flex items-center gap-1.5 text-[13.5px] leading-[1.45] font-semibold",
					children: [
						/* @__PURE__ */ jsx(Icone, {
							nom: "valide",
							className: "size-4"
						}),
						"Vous êtes inscrit, à bientôt dans les arènes",
						prenom ? `, ${prenom}` : ""
					]
				}) : INSCRIPTION_OUVERTE ? /* @__PURE__ */ jsxs(Link, {
					to: "/inscription",
					className: "relative z-10 self-start py-2.5 text-[13.5px] leading-[1.45] font-semibold underline underline-offset-2",
					children: ["Inscrivez-vous dès maintenant, vous serez prêt le soir venu", /* @__PURE__ */ jsx(Icone, {
						nom: "fleche",
						className: "ml-1 inline size-4 align-[-3px]"
					})]
				}) : /* @__PURE__ */ jsx("p", {
					className: "relative z-10 text-[13.5px] leading-[1.45] font-semibold",
					children: TEXTE_INSCRIPTIONS_FERMEES
				}),
				/* @__PURE__ */ jsx(ProchaineSoiree, {
					soiree,
					disponible: calendrierDisponible,
					maintenant
				})
			] })
		]
	});
}
/** « Les votes ouvriront le soir de l’Olympiade, le vendredi 20 août 2027 à 21h, aux arènes de Nîmes. … » */
function raisonVotesFermes(soiree) {
	const suite = "Vous noterez chaque manade de 1 à 10, dès la fin de son passage.";
	if (!soiree) return `Les votes ouvriront le soir de l’Olympiade. ${suite}`;
	return `Les votes ouvriront le soir de l’Olympiade, ${momentSoiree(soiree)}. ${suite}`;
}
//#endregion
//#region app/composants/DernierVainqueur.tsx
var SURTITRE = "block font-sans text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] text-or-clair uppercase";
/**
* « Dernier vainqueur connu » (maquette : .champion). Tout vient du palmarès : la ligne confirmée
* la plus récente, la frise des victoires confirmées de la manade et leurs sources.
*/
function DernierVainqueur({ palmares }) {
	const v = palmares ? dernierVainqueur(palmares) : null;
	return /* @__PURE__ */ jsxs("section", {
		"aria-labelledby": "titre-vainqueur",
		className: "fond-champion relative isolate mx-4 mt-9 grid gap-[22px] overflow-hidden rounded-[26px] px-[22px] py-[26px] text-nuit-txt tablette:mx-7 tablette:mt-11 tablette:grid-cols-[1.4fr_1fr] tablette:items-end tablette:p-[34px] paysage:mx-10 paysage:mt-14 paysage:px-12 paysage:py-11 bureau:mx-14",
		children: [
			/* @__PURE__ */ jsx("div", {
				"aria-hidden": "true",
				className: "grain absolute inset-0"
			}),
			v ? /* @__PURE__ */ jsx("span", {
				"aria-hidden": "true",
				className: "pointer-events-none absolute -top-10 -right-2.5 font-brush text-[280px] leading-none text-[rgba(226,192,138,.07)]",
				children: initialeManade(v.vainqueur)
			}) : null,
			/* @__PURE__ */ jsxs("div", {
				className: "relative",
				children: [/* @__PURE__ */ jsxs("h2", {
					id: "titre-vainqueur",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: SURTITRE,
							children: "Dernier vainqueur connu"
						}),
						" ",
						v ? /* @__PURE__ */ jsxs("span", {
							className: "mt-2.5 mb-3 block font-display text-[42px] leading-[.98] font-bold paysage:text-[60px]",
							children: ["Manade ", /* @__PURE__ */ jsx("em", {
								className: "text-or-clair italic",
								children: v.vainqueur
							})]
						}) : null
					]
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-2 max-w-[44ch] text-nuit-mute",
					children: !palmares ? "Informations momentanément indisponibles" : !v ? "Aucun résultat confirmé pour l’instant." : `Vainqueur à ${v.resultat.ville} en ${v.resultat.annee}.${v.resultat.detail ? ` ${v.resultat.detail}` : ""}`
				})]
			}),
			v ? /* @__PURE__ */ jsxs("div", {
				className: "relative grid gap-3.5",
				children: [
					/* @__PURE__ */ jsx("ul", {
						"aria-label": `Victoires confirmées de la manade ${v.vainqueur}`,
						className: "flex flex-wrap gap-3",
						children: v.victoires.map((victoire) => /* @__PURE__ */ jsxs("li", {
							className: "max-w-[50%] min-w-[76px] flex-1 border-t border-[rgba(226,192,138,.35)] pt-2.5 text-[10px] leading-[1.3] font-bold tracking-[0.14em] text-nuit-mute uppercase",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "block font-display text-[28px] leading-[1.1] font-semibold tracking-normal text-or-clair normal-case italic",
									children: victoire.annee
								}),
								" ",
								victoire.ville
							]
						}, `${victoire.annee}-${victoire.ville}`))
					}),
					v.sources.length ? /* @__PURE__ */ jsxs("p", {
						className: "text-[11px] text-nuit-mute",
						children: [
							v.sources.length > 1 ? "Sources" : "Source",
							"\xA0:",
							" ",
							v.sources.map((source, i) => /* @__PURE__ */ jsxs(Fragment$1, { children: [i > 0 ? ", " : "", /* @__PURE__ */ jsx("a", {
								href: source.url,
								className: "underline underline-offset-2 hover:text-nuit-txt",
								children: source.domaine
							})] }, source.domaine))
						]
					}) : null,
					/* @__PURE__ */ jsxs(Link, {
						to: "/classements",
						className: "inline-flex min-h-12 items-center gap-1.5 justify-self-start text-[13.5px] font-semibold text-or-clair hover:underline",
						children: ["Tout le palmarès", /* @__PURE__ */ jsx(Icone, {
							nom: "fleche",
							className: "size-[15px]"
						})]
					})
				]
			}) : null
		]
	});
}
//#endregion
//#region app/donnees/epreuves.ts
var EPREUVES = [
	{
		numero: 1,
		nom: "Ferrade en piste",
		description: "Le cavalier renverse un anouble (taurillon d’environ un an) avec le fer depuis son cheval, met pied à terre, le maîtrise à mains nues et le couche pour simuler le marquage.",
		format: "Individuelle",
		photo: "manade",
		cadrage: "object-[55%_70%]"
	},
	{
		numero: 2,
		nom: "Saut de cheval à cheval",
		description: "Deux cavaliers encadrent un troisième cheval, non monté. L’un règle la vitesse et la direction, l’autre saute sur le cheval libre en plein galop.",
		format: "Deux cavaliers",
		photo: "chevaux",
		cadrage: "object-[50%_45%]"
	},
	{
		numero: 3,
		nom: "Saut de cheval à taureau",
		description: "Le cavalier saute de son cheval sur un taureau lancé et doit le tenir jusqu’à le mettre au sol. La durée de tenue compte.",
		format: "Individuelle",
		photo: "gardian",
		cadrage: "object-[42%_40%]"
	},
	{
		numero: 4,
		nom: "Attente au fer",
		description: "Les manadiers dirigent un taureau vers un angle de la piste pour qu’il charge de face deux gardians armés de tridents. Les deux doivent piquer en même temps, chacun d’un côté.",
		format: "Collective",
		photo: "arenes",
		cadrage: "object-[50%_55%]"
	}
];
//#endregion
//#region app/lib/useProche.ts
/**
* Vrai dès que l'élément arrive à `marge` du bord de l'écran, et le reste ensuite. Faux au
* pré-rendu et à l'hydratation.
*
* Pour différer vraiment des images : le chargement différé natif (loading="lazy") de Chrome
* commence à 1 250 px de l'écran, et chargeait donc les photos des épreuves dès l'ouverture de
* l'accueil sur téléphone.
*/
function useProche(marge = "400px") {
	const ref = useRef(null);
	const [proche, setProche] = useState(false);
	useEffect(() => {
		const element = ref.current;
		if (proche || !element) return;
		if (typeof IntersectionObserver === "undefined") {
			setProche(true);
			return;
		}
		const observateur = new IntersectionObserver((entrees) => {
			if (entrees.some((entree) => entree.isIntersecting)) {
				setProche(true);
				observateur.disconnect();
			}
		}, { rootMargin: marge });
		observateur.observe(element);
		return () => observateur.disconnect();
	}, [marge, proche]);
	return [ref, proche];
}
//#endregion
//#region app/composants/Epreuves.tsx
var LIEN = "underline underline-offset-2 hover:text-encre";
/** Photo d'une carte : AVIF si le navigateur le lit, sinon WebP. */
function PhotoCarte({ photo, cadrage }) {
	return /* @__PURE__ */ jsxs("picture", { children: [/* @__PURE__ */ jsx("source", {
		type: "image/avif",
		srcSet: photo.avif,
		width: photo.largeur,
		height: photo.hauteur
	}), /* @__PURE__ */ jsx("img", {
		src: photo.fichier,
		alt: "",
		width: photo.largeur,
		height: photo.hauteur,
		decoding: "async",
		className: cadrage
	})] });
}
/**
* « Le programme · Les quatre épreuves » (maquette : .sec + .ep-grid). Sur téléphone, les cartes
* défilent à l'horizontale ; à partir de l'iPad portrait, grille de 2 puis de 4 colonnes.
* Hors soirée, pas d'horaire ni d'état d'épreuve : le pied de carte donne le format.
*
* Photos chargées quand la liste arrive à 400 px de l'écran (useProche), toutes les quatre à la fois :
* sur téléphone, elles ne pèsent plus sur le premier affichage, et les cartes qu'on fait défiler à
* l'horizontale sont déjà prêtes. Sans JavaScript, le <noscript> les affiche directement.
*/
function Epreuves() {
	const photos = [...new Set(EPREUVES.map((e) => e.photo))].map((id) => PHOTOS_ACCUEIL[id]);
	const [liste, photosProches] = useProche();
	return /* @__PURE__ */ jsxs("section", {
		"aria-labelledby": "titre-epreuves",
		className: "px-4 pt-9 pb-1 tablette:px-7 tablette:pt-11 paysage:px-10 paysage:pt-14 bureau:px-14",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
					className: "text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] text-or-ink uppercase",
					children: "Le programme"
				}), /* @__PURE__ */ jsx("h2", {
					id: "titre-epreuves",
					className: "mt-1.5 font-display text-[28px] leading-[1.08] font-bold tracking-[-0.01em] tablette:text-[34px] paysage:text-[40px]",
					children: "Les quatre épreuves"
				})] }), /* @__PURE__ */ jsxs(Link, {
					to: "/classements",
					className: "inline-flex min-h-12 items-center gap-1.5 text-[13.5px] font-semibold text-rouge hover:underline",
					children: ["Voir le classement", /* @__PURE__ */ jsx(Icone, {
						nom: "fleche",
						className: "size-[15px]"
					})]
				})]
			}),
			/* @__PURE__ */ jsx("ul", {
				ref: liste,
				tabIndex: 0,
				"aria-label": "Les quatre épreuves",
				className: "relative -mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[80%] grid-flow-col gap-3 overflow-x-auto rounded-[22px] px-4 pb-1 [scrollbar-width:none] tablette:mx-0 tablette:grid-flow-row tablette:grid-cols-2 tablette:overflow-visible tablette:px-0 paysage:grid-cols-4 paysage:gap-4 [&::-webkit-scrollbar]:hidden",
				children: EPREUVES.map((epreuve) => {
					const photo = PHOTOS_ACCUEIL[epreuve.photo];
					return /* @__PURE__ */ jsxs("li", {
						className: "relative flex snap-start flex-col overflow-hidden rounded-[22px] border border-trait bg-creme",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "duo-calques aspect-[16/11] overflow-hidden text-white",
							children: [photosProches ? /* @__PURE__ */ jsx(PhotoCarte, {
								photo,
								cadrage: epreuve.cadrage
							}) : /* @__PURE__ */ jsx("noscript", { children: /* @__PURE__ */ jsx("img", {
								src: photo.fichier,
								alt: "",
								width: photo.largeur,
								height: photo.hauteur,
								className: epreuve.cadrage
							}) }), /* @__PURE__ */ jsx("span", {
								"aria-hidden": "true",
								className: "absolute -bottom-0.5 left-3.5 z-10 font-display text-[74px] leading-none font-bold italic [text-shadow:0_4px_22px_rgba(70,15,0,.4)]",
								children: epreuve.numero
							})]
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex flex-1 flex-col gap-1.5 px-4 pt-3.5 pb-4",
							children: [
								/* @__PURE__ */ jsxs("h3", {
									className: "font-display text-[19px] leading-[1.15] font-bold",
									children: [/* @__PURE__ */ jsxs("span", {
										className: "sr-only",
										children: [
											"Épreuve ",
											epreuve.numero,
											"\xA0: "
										]
									}), epreuve.nom]
								}),
								/* @__PURE__ */ jsx("p", {
									className: "text-[13.5px] leading-[1.45] text-encre-2",
									children: epreuve.description
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-auto pt-2.5 text-[10.5px] leading-[1.2] font-bold tracking-[0.1em] text-encre-2 uppercase",
									children: epreuve.format
								})
							]
						})]
					}, epreuve.numero);
				})
			}),
			/* @__PURE__ */ jsxs("p", {
				className: "mt-3 text-[11.5px] leading-snug text-encre-2",
				children: [
					"Photos d’ambiance\xA0:",
					" ",
					photos.map((photo, i) => /* @__PURE__ */ jsxs(Fragment$1, { children: [
						i > 0 ? ", " : "",
						/* @__PURE__ */ jsx("a", {
							href: photo.fiche,
							className: LIEN,
							children: photo.auteur
						}),
						" ",
						"(",
						/* @__PURE__ */ jsx("a", {
							href: photo.lienLicence,
							rel: "license",
							className: LIEN,
							children: photo.licence
						}),
						")"
					] }, photo.id)),
					", via Wikimedia Commons, ",
					RETOUCHE.replace("retouchée", "retouchées"),
					".",
					" ",
					/* @__PURE__ */ jsx(Link, {
						to: "/mentions-legales#credits",
						className: LIEN,
						children: "Crédits photos"
					}),
					"."
				]
			})
		]
	});
}
//#endregion
//#region app/lib/donnees.ts
var ErreurDonnees = class extends Error {};
/** Rejette en ErreurDonnees dès l'abandon du signal, sans attendre la promesse. */
function avantAbandon(promesse, signal) {
	return new Promise((resoudre, rejeter) => {
		const abandon = () => rejeter(new ErreurDonnees("Supabase non chargé dans le délai imparti"));
		if (signal.aborted) {
			abandon();
			return;
		}
		signal.addEventListener("abort", abandon, { once: true });
		promesse.then(resoudre, rejeter).finally(() => signal.removeEventListener("abort", abandon));
	});
}
/**
* Client Supabase, chargé à la demande ; un échec (variables absentes, réseau) devient ErreurDonnees.
* Le signal borne aussi le chargement du module supabase-js : un module lent ou bloqué ne retient pas
* la lecture au-delà du délai (le chargement continue, il servira à la lecture suivante).
*/
async function client(signal) {
	try {
		return await (signal ? avantAbandon(supabase(), signal) : supabase());
	} catch (erreur) {
		if (erreur instanceof ErreurDonnees) throw erreur;
		throw new ErreurDonnees(erreur instanceof Error ? erreur.message : String(erreur));
	}
}
/**
* Apostrophe typographique à l'affichage. La base contient des apostrophes droites
* (« Olympiades d'Aimargues ») : les textes affichés du calendrier et du palmarès passent tous ici, à
* la lecture. Les adresses (billetterie, source) n'y passent jamais.
*/
function apostrophes(texte) {
	return texte.replaceAll("'", "’");
}
var typographierCalendrier = (ligne) => ({
	...ligne,
	nom: apostrophes(ligne.nom),
	ville: apostrophes(ligne.ville),
	arenes: ligne.arenes === null ? null : apostrophes(ligne.arenes)
});
var typographierPalmares = (ligne) => ({
	...ligne,
	evenement: apostrophes(ligne.evenement),
	ville: apostrophes(ligne.ville),
	vainqueur: apostrophes(ligne.vainqueur),
	detail: ligne.detail === null ? null : apostrophes(ligne.detail)
});
/**
* Les lectures acceptent un signal d'abandon, qui borne le chargement du client puis la requête.
* postgrest-js refait jusqu'à trois fois une lecture qui échoue sur le réseau (après 1, 2 puis 4 s) ;
* une requête abandonnée n'est pas refaite. Dans le navigateur, le signal borne donc l'attente d'une
* navigation quand supabase-js ou Supabase ne répondent pas.
*/
async function lireCalendrier(signal) {
	const requete = (await client(signal)).from("calendrier").select("id, annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie").order("date_soiree");
	const { data, error } = await (signal ? requete.abortSignal(signal) : requete);
	if (error) throw new ErreurDonnees(`Calendrier indisponible : ${error.message}`);
	return data.map(typographierCalendrier);
}
async function lirePalmares(signal) {
	const requete = (await client(signal)).from("palmares").select("id, annee, evenement, ville, date_soiree, vainqueur, detail, statut, source_url").order("annee", { ascending: false }).order("date_soiree", { ascending: false });
	const { data, error } = await (signal ? requete.abortSignal(signal) : requete);
	if (error) throw new ErreurDonnees(`Palmarès indisponible : ${error.message}`);
	return data.map(typographierPalmares);
}
/**
* Dépôt d'un message de contact. Insertion seule, sans .select() : la base ne donne pas à anon le
* droit de relire la table, et supabase-js n'envoie alors que « return=minimal ».
*/
async function envoyerMessageContact(champs) {
	const { error } = await (await client()).from("messages_contact").insert(champs);
	if (error) throw new ErreurDonnees(`Message non enregistré : ${error.message}`);
}
/**
* Lecture qui ne lève jamais : null si les données sont indisponibles (Supabase injoignable,
* variables absentes au build). La page affiche alors son repli, et le pré-rendu ne casse pas.
*/
async function lireOuRepli(lecture) {
	try {
		return await lecture();
	} catch (erreur) {
		console.warn(erreur instanceof ErreurDonnees ? erreur.message : `Lecture des données impossible : ${String(erreur)}`);
		return null;
	}
}
//#endregion
//#region app/composants/FormulaireContact.tsx
var VIDE = {
	prenom: "",
	email: "",
	message: ""
};
var LIBELLE = "text-[12px] font-semibold text-encre-2";
var CHAMP = "min-h-12 w-full rounded-[13px] border border-[#958a77] bg-sable px-3.5 py-3 text-base text-encre aria-invalid:border-rouge";
var ERREUR = "flex items-start gap-1.5 text-[13px] leading-snug text-rouge";
/**
* Formulaire de contact (maquette : carte « Une question ? »), partagé par l'accueil et /contact.
*
* - Validation identique aux contraintes de public.messages_contact (app/lib/contact.ts).
* - Champ piège « site_web », invisible : s'il est rempli, rien n'est envoyé, le succès s'affiche.
* - Un seul envoi à la fois : verrou synchrone et bouton désactivé pendant l'envoi.
* - Insertion sans .select() (envoyerMessageContact).
*/
function FormulaireContact() {
	const id = useId();
	const [champs, setChamps] = useState(VIDE);
	const [erreurs, setErreurs] = useState({});
	const [verifier, setVerifier] = useState(false);
	const [envoi, setEnvoi] = useState("repos");
	const verrou = useRef(false);
	const [pret, setPret] = useState(false);
	useEffect(() => setPret(true), []);
	const { pathname } = useLocation();
	const piege = useRef(null);
	function modifier(nom, valeur) {
		const suivant = {
			...champs,
			[nom]: valeur
		};
		setChamps(suivant);
		if (verifier) setErreurs(validerContact(suivant));
		if (envoi === "succes" || envoi === "echec") setEnvoi("repos");
	}
	async function soumettre(evenement) {
		evenement.preventDefault();
		if (verrou.current) return;
		const trouvees = validerContact(champs);
		setVerifier(true);
		setErreurs(trouvees);
		if (Object.keys(trouvees).length > 0) {
			const premier = [
				"prenom",
				"email",
				"message"
			].find((nom) => trouvees[nom]);
			document.getElementById(`${id}-${premier}`)?.focus();
			return;
		}
		verrou.current = true;
		setEnvoi("en-cours");
		try {
			if (!piege.current?.value) await envoyerMessageContact(normaliserContact(champs));
			setChamps(VIDE);
			setVerifier(false);
			setEnvoi("succes");
		} catch {
			setEnvoi("echec");
		} finally {
			verrou.current = false;
		}
	}
	const champ = (nom) => ({
		id: `${id}-${nom}`,
		name: nom,
		value: champs[nom],
		"aria-invalid": erreurs[nom] ? true : void 0,
		"aria-describedby": [erreurs[nom] ? `${id}-${nom}-erreur` : null, nom === "message" ? `${id}-compteur` : null].filter(Boolean).join(" ") || void 0
	});
	const erreur = (nom) => erreurs[nom] ? /* @__PURE__ */ jsxs("p", {
		id: `${id}-${nom}-erreur`,
		className: ERREUR,
		children: [/* @__PURE__ */ jsx(Icone, {
			nom: "alerte",
			className: "mt-px size-4"
		}), erreurs[nom]]
	}) : null;
	const enCours = envoi === "en-cours";
	const restants = LIMITES_CONTACT.messageMax - longueur(champs.message);
	return /* @__PURE__ */ jsxs("form", {
		noValidate: true,
		method: "post",
		action: pathname,
		onSubmit: soumettre,
		className: "mt-3.5 grid gap-3 paysage:grid-cols-2",
		"aria-busy": enCours,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "grid content-start gap-1.5",
				children: [
					/* @__PURE__ */ jsx("label", {
						htmlFor: `${id}-prenom`,
						className: LIBELLE,
						children: "Prénom"
					}),
					/* @__PURE__ */ jsx("input", {
						...champ("prenom"),
						type: "text",
						autoComplete: "given-name",
						maxLength: LIMITES_CONTACT.prenom,
						onChange: (e) => modifier("prenom", e.target.value),
						className: CHAMP
					}),
					erreur("prenom")
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid content-start gap-1.5",
				children: [
					/* @__PURE__ */ jsx("label", {
						htmlFor: `${id}-email`,
						className: LIBELLE,
						children: "Email"
					}),
					/* @__PURE__ */ jsx("input", {
						...champ("email"),
						type: "email",
						inputMode: "email",
						autoComplete: "email",
						spellCheck: false,
						maxLength: LIMITES_CONTACT.email,
						onChange: (e) => modifier("email", e.target.value),
						className: CHAMP
					}),
					erreur("email")
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-1.5 paysage:col-span-2",
				children: [
					/* @__PURE__ */ jsx("label", {
						htmlFor: `${id}-message`,
						className: LIBELLE,
						children: "Message"
					}),
					/* @__PURE__ */ jsx("textarea", {
						...champ("message"),
						rows: 3,
						maxLength: LIMITES_CONTACT.messageMax,
						onChange: (e) => modifier("message", e.target.value),
						className: `${CHAMP} resize-y`
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-start justify-between gap-x-3 gap-y-1",
						children: [erreur("message") ?? /* @__PURE__ */ jsx("span", {}), /* @__PURE__ */ jsxs("p", {
							id: `${id}-compteur`,
							className: "ml-auto text-[12px] text-encre-2 tabular-nums",
							children: [
								longueur(champs.message),
								"\xA0/\xA02\xA0000 caractères",
								/* @__PURE__ */ jsxs("span", {
									className: "sr-only",
									children: [
										", ",
										restants,
										" restants, 10 au minimum"
									]
								})
							]
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				"aria-hidden": "true",
				className: "absolute -left-[9999px] size-px overflow-hidden",
				children: [/* @__PURE__ */ jsx("label", {
					htmlFor: `${id}-site_web`,
					children: "Site web, à laisser vide"
				}), /* @__PURE__ */ jsx("input", {
					ref: piege,
					id: `${id}-site_web`,
					name: "site_web",
					type: "text",
					tabIndex: -1,
					autoComplete: "off"
				})]
			}),
			/* @__PURE__ */ jsx("noscript", { children: /* @__PURE__ */ jsx("p", {
				className: "text-[13px] font-semibold text-rouge paysage:col-span-2",
				children: "Ce formulaire nécessite JavaScript."
			}) }),
			/* @__PURE__ */ jsxs("div", {
				className: "paysage:col-span-2",
				children: [
					/* @__PURE__ */ jsx("button", {
						type: "submit",
						disabled: enCours || !pret,
						className: "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-encre px-5 text-[15px] leading-none font-semibold text-sable transition-[filter,transform] hover:brightness-125 active:scale-[0.97] disabled:cursor-wait disabled:opacity-70",
						children: "Envoyer le message"
					}),
					/* @__PURE__ */ jsxs("div", {
						role: "status",
						children: [enCours ? /* @__PURE__ */ jsx("p", {
							className: "sr-only",
							children: "Envoi en cours…"
						}) : null, envoi === "succes" ? /* @__PURE__ */ jsxs("p", {
							className: "mt-3 flex items-center gap-2 rounded-[13px] bg-[rgba(47,122,79,.1)] px-3.5 py-3 text-[14px] font-semibold text-[#286b44]",
							children: [/* @__PURE__ */ jsx(Icone, { nom: "valide" }), "Merci, votre message est bien parti."]
						}) : null]
					}),
					/* @__PURE__ */ jsx("div", {
						role: "alert",
						children: envoi === "echec" ? /* @__PURE__ */ jsxs("p", {
							className: "mt-3 flex items-center gap-2 rounded-[13px] bg-[rgba(194,59,29,.08)] px-3.5 py-3 text-[14px] font-semibold text-rouge-alerte",
							children: [/* @__PURE__ */ jsx(Icone, { nom: "alerte" }), "L’envoi a échoué, réessayez dans un instant."]
						}) : null
					})
				]
			})
		]
	});
}
//#endregion
//#region app/composants/ManadesEdition.tsx
/**
* « Les manades de l'édition 2026 » (maquette : .engagees, « Les manades engagées ce soir »),
* avec leurs fers provisoires. Sur téléphone, les cinq noms tiennent sur une ligne de cinq colonnes
* au lieu de défiler à l'horizontale.
*/
function ManadesEdition() {
	return /* @__PURE__ */ jsxs("section", {
		"aria-labelledby": "titre-manades",
		className: "px-4 pt-[30px] pb-1 text-center paysage:pt-11",
		children: [/* @__PURE__ */ jsxs("h2", {
			id: "titre-manades",
			className: "text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] text-or-ink uppercase",
			children: ["Les manades de l’édition ", EDITION_MANADES.annee]
		}), /* @__PURE__ */ jsx("ul", {
			className: "mt-4 grid grid-cols-5 gap-1 tablette:flex tablette:justify-center tablette:gap-0",
			children: EDITION_MANADES.manades.map((manade) => /* @__PURE__ */ jsxs("li", {
				className: "flex min-w-0 flex-col items-center gap-[9px] text-[11px] leading-[1.15] font-extrabold tracking-[0.1em] text-encre uppercase tablette:border-l tablette:border-trait tablette:px-5 tablette:first:border-l-0 paysage:px-[34px] paysage:text-[12.5px]",
				children: [/* @__PURE__ */ jsx(Fer, { manade }), /* @__PURE__ */ jsx("span", {
					className: "text-balance break-words",
					children: manade
				})]
			}, manade))
		})]
	});
}
//#endregion
//#region app/composants/BadgeSoiree.tsx
/** Pastille d'état de la maquette (.chip). */
var CLASSE_PUCE = "inline-flex items-center rounded-full px-2.5 py-1.5 text-[10px] leading-none font-bold tracking-[0.12em] whitespace-nowrap uppercase";
/** Couleurs d'état de la charte (ok, alerte), assombries pour tenir 4,5:1 sur leur fond teinté. */
var PUCE_OK = `${CLASSE_PUCE} bg-[rgba(47,122,79,.12)] text-[#286b44]`;
var PUCE_ALERTE = `${CLASSE_PUCE} bg-[rgba(217,130,43,.14)] text-[#985512]`;
/**
* Badge d'une soirée : « Terminée », « Annulée », « Ce soir », sinon le statut de la date.
* #286b44 sur vert pâle 5,3:1, #985512 sur orangé pâle 4,87:1, rouge-alerte sur rouge pâle 5,56:1.
*/
function BadgeSoiree({ soiree, etat }) {
	if (etat === "terminee") return /* @__PURE__ */ jsx("span", {
		className: `${CLASSE_PUCE} bg-lin text-encre-2`,
		children: "Terminée"
	});
	if (etat === "annulee") return /* @__PURE__ */ jsx("span", {
		className: `${CLASSE_PUCE} bg-[rgba(194,59,29,.1)] text-rouge-alerte`,
		children: "Annulée"
	});
	if (etat === "ce-soir") return /* @__PURE__ */ jsx("span", {
		className: `${CLASSE_PUCE} bg-[#fffaf2] text-[#9a2c12]`,
		children: "Ce soir"
	});
	return soiree.statut === "confirmee" ? /* @__PURE__ */ jsx("span", {
		className: PUCE_OK,
		children: "Confirmée"
	}) : /* @__PURE__ */ jsx("span", {
		className: PUCE_ALERTE,
		children: "Date prévisionnelle"
	});
}
//#endregion
//#region app/composants/SaisonAccueil.tsx
var MOIS$1 = new Intl.DateTimeFormat("fr-FR", {
	month: "short",
	timeZone: "UTC"
});
/**
* Carte « Saison 2027 » de l'accueil (maquette : .card + .saison) : quatre soirées à partir de la
* prochaine, mise en avant, et le lien vers toutes les dates.
*/
function SaisonAccueil({ calendrier, maintenant }) {
	const saison = calendrier ? saisonAccueil(calendrier, maintenant) : null;
	return /* @__PURE__ */ jsxs("section", {
		"aria-labelledby": "titre-saison",
		className: "rounded-[22px] border border-trait bg-creme p-5",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-center justify-between gap-x-4",
			children: [/* @__PURE__ */ jsx("h2", {
				id: "titre-saison",
				className: "font-display text-[21px] leading-[1.2] font-bold",
				children: saison ? `Saison ${saison.annee}` : "Saison"
			}), /* @__PURE__ */ jsxs(Link, {
				to: "/dates",
				className: "inline-flex min-h-12 items-center gap-1.5 text-[13.5px] font-semibold text-rouge hover:underline",
				children: [saison ? `Les ${saison.total} dates` : "Toutes les dates", /* @__PURE__ */ jsx(Icone, {
					nom: "fleche",
					className: "size-[15px]"
				})]
			})]
		}), !saison ? /* @__PURE__ */ jsx("p", {
			className: "mt-3 text-encre-2",
			children: calendrier ? "Les dates de la saison seront bientôt publiées." : "Informations momentanément indisponibles"
		}) : /* @__PURE__ */ jsx("ul", {
			className: "mt-1 grid gap-0.5",
			children: saison.lignes.map(({ soiree, etat }) => {
				const [, mois, jour] = soiree.date_soiree.split("-").map(Number);
				const heure = formaterHeure(soiree.heure);
				const prochaine = etat === "prochaine";
				return /* @__PURE__ */ jsxs("li", {
					className: `grid grid-cols-[56px_1fr] items-center gap-x-3 gap-y-1.5 border-t py-2.5 first:border-t-0 paysage:grid-cols-[56px_1fr_auto] ${prochaine ? "-mx-2 rounded-[14px] border-transparent bg-[linear-gradient(90deg,rgba(236,116,51,.12),transparent)] px-2" : "border-trait"}`,
					children: [
						/* @__PURE__ */ jsxs("time", {
							dateTime: soiree.date_soiree,
							className: "row-span-2 text-center font-display text-[24px] leading-none font-bold italic paysage:row-span-1",
							children: [jour, /* @__PURE__ */ jsx("span", {
								className: "block font-sans text-[9.5px] leading-[1.3] font-bold tracking-[0.14em] text-encre-2 uppercase not-italic",
								children: MOIS$1.format(new Date(Date.UTC(2e3, mois - 1, 1)))
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ jsxs("p", {
								className: "text-[14.5px] leading-snug font-semibold",
								children: [soiree.ville, prochaine ? /* @__PURE__ */ jsx("span", {
									className: "sr-only",
									children: " (prochaine soirée)"
								}) : null]
							}), /* @__PURE__ */ jsx("p", {
								className: "text-[12.5px] leading-snug text-encre-2",
								children: [soiree.arenes, heure].filter(Boolean).join(" · ")
							})]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "col-start-2 paysage:col-start-auto",
							children: /* @__PURE__ */ jsx(BadgeSoiree, {
								soiree,
								etat
							})
						})
					]
				}, soiree.id);
			})
		})]
	});
}
//#endregion
//#region app/lib/relecture.ts
var INTERACTIONS = [
	"pointerdown",
	"touchstart",
	"keydown",
	"wheel"
];
var DELAI_NOUVEL_ESSAI = 5e3;
var relues = false;
var tentee = false;
var dernieres = {
	calendrier: null,
	palmares: null
};
/** Appelé quand le navigateur a lu les deux tables dans Supabase. */
function marquerDonneesRelues() {
	relues = true;
}
/** Vrai une fois les données relues dans le navigateur (et non plus seulement celles du pré-rendu). */
function donneesRelues() {
	return relues;
}
/** Appelé au début de chaque lecture du navigateur (relecture ou navigation), réussie ou non. */
function marquerLectureTentee() {
	tentee = true;
}
/**
* Vrai si les données affichées sont celles du pré-rendu (aucune lecture du navigateur encore
* tentée) et qu'il leur manque une table : elles sont relues dès l'hydratation.
*/
function relireDesLHydratation({ calendrier, palmares }) {
	return !relues && !tentee && (calendrier === null || palmares === null);
}
/**
* Retient, table par table, les dernières données non nulles affichées dans l'onglet : celles du
* pré-rendu à l'hydratation, puis chaque lecture du navigateur.
*/
function retenirDonnees({ calendrier, palmares }) {
	if (calendrier) dernieres.calendrier = calendrier;
	if (palmares) dernieres.palmares = palmares;
}
/** Dernières données affichées : dernier repli d'une lecture qui échoue. */
function dernieresDonnees() {
	return dernieres;
}
function useRelectureApresInteraction(donnees) {
	const { revalidate } = useRevalidator();
	const { calendrier, palmares } = donnees;
	const immediate = relireDesLHydratation(donnees);
	useEffect(() => {
		retenirDonnees({
			calendrier,
			palmares
		});
	}, [calendrier, palmares]);
	useEffect(() => {
		if (relues) return;
		let actif = true;
		const options = {
			capture: true,
			passive: true
		};
		const armer = () => {
			for (const type of INTERACTIONS) window.addEventListener(type, relire, options);
		};
		const retirer = () => {
			for (const type of INTERACTIONS) window.removeEventListener(type, relire, options);
		};
		let nouvelEssai;
		const rearmer = () => {
			if (!actif || relues) return;
			nouvelEssai = setTimeout(() => {
				if (actif && !relues) armer();
			}, DELAI_NOUVEL_ESSAI);
		};
		function relire() {
			retirer();
			if (!relues) revalidate().then(rearmer, rearmer);
		}
		if (immediate) relire();
		else armer();
		return () => {
			actif = false;
			clearTimeout(nouvelEssai);
			retirer();
		};
	}, [revalidate, immediate]);
}
//#endregion
//#region app/lib/donnees-vitrine.ts
/**
* Attente maximale de Supabase dans le navigateur. Au-delà, la page prend les données du pré-rendu :
* sans cette borne, les nouveaux essais de postgrest-js figeaient la navigation environ 7 s.
*/
var DELAI_LECTURE_NAVIGATEUR_MS = 3e3;
/** Lecture qui ne lève jamais : null pour une table illisible, et l'instant de lecture. */
async function lireDonneesVitrine(signal) {
	const [calendrier, palmares] = await Promise.all([lireOuRepli(() => lireCalendrier(signal)), lireOuRepli(() => lirePalmares(signal))]);
	return {
		calendrier,
		palmares,
		lueLe: (/* @__PURE__ */ new Date()).toISOString()
	};
}
/**
* Lecture dans le navigateur (à la première interaction, app/lib/relecture.ts, puis à chaque
* navigation vers la page) : données fraîches, pour qu'un palmarès complété apparaisse sans
* redéploiement. Chaque table que Supabase ne rend pas dans le délai est reprise, dans l'ordre, des
* données du pré-rendu (fichier .data servi par le site), puis des dernières données affichées dans
* l'onglet : hors ligne, la page garde ce qu'elle affiche. Si rien n'existe nulle part, null : la
* page affiche son message de repli.
*
* La relecture n'est comptée comme faite que si les deux tables sont fraîches : sinon, la prochaine
* interaction la retente.
*/
async function lireDonneesVitrineNavigateur(serverLoader) {
	marquerLectureTentee();
	const frais = await lireDonneesVitrine(AbortSignal.timeout(DELAI_LECTURE_NAVIGATEUR_MS));
	if (frais.calendrier && frais.palmares) {
		marquerDonneesRelues();
		retenirDonnees(frais);
		return frais;
	}
	const archive = await serverLoader().catch(() => null);
	const dernieres = dernieresDonnees();
	const donnees = {
		calendrier: frais.calendrier ?? archive?.calendrier ?? dernieres.calendrier ?? null,
		palmares: frais.palmares ?? archive?.palmares ?? dernieres.palmares ?? null,
		lueLe: frais.lueLe
	};
	retenirDonnees(donnees);
	return donnees;
}
//#endregion
//#region app/lib/classements.ts
/**
* Les `nombre` années les plus récentes du palmarès et du calendrier ont un onglet (2025, 2026,
* 2027 aujourd'hui) ; les années plus anciennes du palmarès vont aux éditions précédentes.
*/
function anneesClassements(palmares, calendrier, nombre = 3) {
	const annees = [.../* @__PURE__ */ new Set([...(palmares ?? []).map((p) => p.annee), ...(calendrier ?? []).map((s) => s.annee)])].sort((a, b) => b - a);
	const onglets = annees.slice(0, nombre);
	return {
		onglets,
		parDefaut: onglets.find((a) => palmares?.some((p) => p.annee === a)) ?? onglets[0] ?? null,
		precedentes: annees.slice(nombre).filter((a) => palmares?.some((p) => p.annee === a))
	};
}
/** Année de l'adresse (`?annee=2025`) si elle a un onglet, sinon l'année par défaut. */
function anneeChoisie(parametre, { onglets, parDefaut }) {
	const annee = Number(parametre);
	return parametre && onglets.includes(annee) ? annee : parDefaut;
}
/** Une soirée sans date est rangée en fin d'année, donc en tête du tri décroissant. */
var ordreResultat = (p) => p.date_soiree ?? `${p.annee}-12-31`;
/** Résultats d'une année, du plus récent au plus ancien. */
function resultatsAnnee(palmares, annee) {
	return palmares.filter((p) => p.annee === annee).sort((a, b) => ordreResultat(b).localeCompare(ordreResultat(a)));
}
var RANG = /^\s*(\d+)\.\s+([^,.()]+?)\s*(?:\(([^)]*)\))?\s*([,.]|$)/;
/**
* Lit un classement complet écrit dans le détail d'un résultat :
* « Classement : 1. Arlatenco, 2. Vinuesa (à quelques points), 3. Robert Michel. Suite… ».
* Renvoie null si le texte n'a pas cette forme : il s'affiche alors tel quel.
*/
function lireClassement(detail) {
	const debut = detail ? /^\s*Classement\s*:\s*/i.exec(detail) : null;
	if (!detail || !debut) return null;
	let reste = detail.slice(debut[0].length);
	const rangs = [];
	for (;;) {
		const m = RANG.exec(reste);
		if (!m) break;
		rangs.push({
			rang: Number(m[1]),
			manade: m[2].trim(),
			precision: m[3]?.trim() || null
		});
		reste = reste.slice(m[0].length);
		if (m[4] !== ",") break;
	}
	if (rangs.length < 2 || rangs[0].rang !== 1) return null;
	return {
		rangs,
		suite: reste.trim() || null
	};
}
//#endregion
//#region app/composants/CarteResultat.tsx
var DATE = new Intl.DateTimeFormat("fr-FR", {
	day: "numeric",
	month: "long",
	year: "numeric",
	timeZone: "UTC"
});
function dateResultat({ date_soiree, annee }) {
	if (!date_soiree) return String(annee);
	const [a, m, j] = date_soiree.split("-").map(Number);
	return DATE.format(new Date(Date.UTC(a, m - 1, j))).replace(/^1 /, "1er ");
}
/**
* Un résultat du palmarès (maquette : .palm-c) : fer, lieu et date, manade gagnante, soirée,
* détail, statut et source. Rien n'est écrit en dur : tout vient de la ligne du palmarès.
*/
function CarteResultat({ resultat, niveau = 3, aLaUne = false }) {
	const Titre = niveau === 3 ? "h3" : "h4";
	const classement = aLaUne ? lireClassement(resultat.detail) : null;
	const source = resultat.source_url ? domaine(resultat.source_url) : null;
	const vainqueur = resultat.vainqueur.trim();
	return /* @__PURE__ */ jsxs("article", {
		className: `flex flex-col gap-3.5 rounded-[22px] border border-trait bg-creme p-[18px] ${classement ? "col-span-full paysage:p-6" : ""}`,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: `grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 ${classement ? "items-center paysage:gap-x-6" : "items-start"}`,
				children: [/* @__PURE__ */ jsx(Fer, {
					manade: vainqueur,
					className: classement ? "paysage:size-[62px] paysage:text-[34px]" : "mt-0.5"
				}), /* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ jsxs("p", {
							className: "text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] text-or-ink uppercase",
							children: [
								resultat.ville,
								" · ",
								/* @__PURE__ */ jsx("time", {
									dateTime: resultat.date_soiree ?? String(resultat.annee),
									children: dateResultat(resultat)
								})
							]
						}),
						/* @__PURE__ */ jsxs(Titre, {
							className: `mt-1 font-display leading-[1.2] font-bold ${classement ? "text-[24px] paysage:text-[30px]" : "text-[20px]"}`,
							children: ["Manade ", vainqueur]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-0.5 text-[13px] font-medium text-encre-2",
							children: resultat.evenement
						}),
						!classement && resultat.detail ? /* @__PURE__ */ jsx("p", {
							className: "mt-1.5 text-[13.5px] text-encre-2",
							children: resultat.detail
						}) : null
					]
				})]
			}),
			classement ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("ol", {
				"aria-label": `Classement de la soirée de ${resultat.ville}`,
				className: "grid gap-x-4 tablette:grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))]",
				children: classement.rangs.map(({ rang, manade, precision }) => /* @__PURE__ */ jsxs("li", {
					className: "grid grid-cols-[3rem_minmax(0,1fr)] items-baseline border-t border-trait py-2 tablette:block tablette:pt-2.5",
					children: [/* @__PURE__ */ jsxs("span", {
						className: `font-display text-[26px] leading-none font-bold italic ${rang === 1 ? "text-rouge" : "text-encre"}`,
						children: [rang, /* @__PURE__ */ jsx("sup", {
							className: "text-[.45em]",
							children: rang === 1 ? "er" : "e"
						})]
					}), /* @__PURE__ */ jsxs("span", {
						className: "text-[14.5px] leading-snug font-semibold tablette:mt-1.5 tablette:block",
						children: [manade, precision ? /* @__PURE__ */ jsx("span", {
							className: "block text-[12.5px] font-normal text-encre-2",
							children: precision
						}) : null]
					})]
				}, `${rang}-${manade}`))
			}), classement.suite ? /* @__PURE__ */ jsx("p", {
				className: "-mt-1 text-[13.5px] text-encre-2",
				children: classement.suite
			}) : null] }) : null,
			/* @__PURE__ */ jsxs("p", {
				className: "mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-encre-2",
				children: [resultat.statut === "a_confirmer" ? /* @__PURE__ */ jsx("span", {
					className: PUCE_ALERTE,
					children: "À confirmer"
				}) : /* @__PURE__ */ jsx("span", {
					className: PUCE_OK,
					children: "Confirmé"
				}), resultat.source_url ? /* @__PURE__ */ jsxs("span", { children: [
					"Source\xA0:",
					" ",
					/* @__PURE__ */ jsx("a", {
						href: resultat.source_url,
						className: "underline underline-offset-2 hover:text-encre",
						children: source ?? "article"
					})
				] }) : null]
			})
		]
	});
}
//#endregion
//#region app/composants/OngletsAnnee.tsx
/** Pastille des onglets de la maquette (.tabs button) : 40 px de haut dans une cible de 48 px. */
var CLASSE_ONGLET = "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition-colors";
var ONGLET_ACTIF = "bg-encre text-sable";
var ONGLET_INACTIF = "text-encre-2 shadow-[inset_0_0_0_1px_var(--color-trait)] group-hover:bg-lin";
var idOnglet = (annee) => `onglet-${annee}`;
/**
* Onglets d'années (motif « Tabs » de l'APG ARIA, activation automatique) : flèches gauche et
* droite, Début et Fin. Seul l'onglet choisi est dans l'ordre de tabulation.
*/
function OngletsAnnee({ annees, choisie, onChoisir, panneau, libelle }) {
	const boutons = useRef(/* @__PURE__ */ new Map());
	function auClavier(evenement, rang) {
		const cible = {
			ArrowRight: annees[(rang + 1) % annees.length],
			ArrowLeft: annees[(rang - 1 + annees.length) % annees.length],
			Home: annees[0],
			End: annees.at(-1)
		}[evenement.key];
		if (cible === void 0) return;
		evenement.preventDefault();
		onChoisir(cible);
		boutons.current.get(cible)?.focus();
	}
	return /* @__PURE__ */ jsx("div", {
		role: "tablist",
		"aria-label": libelle,
		className: "mt-3.5 flex flex-wrap gap-x-1.5",
		children: annees.map((annee, rang) => {
			const actif = annee === choisie;
			return /* @__PURE__ */ jsx("button", {
				ref: (bouton) => {
					if (bouton) boutons.current.set(annee, bouton);
					else boutons.current.delete(annee);
				},
				type: "button",
				role: "tab",
				id: idOnglet(annee),
				"aria-selected": actif,
				"aria-controls": actif ? panneau : void 0,
				tabIndex: actif ? 0 : -1,
				onClick: () => onChoisir(annee),
				onKeyDown: (evenement) => auClavier(evenement, rang),
				className: "group inline-flex min-h-12 cursor-pointer items-center rounded-full",
				children: /* @__PURE__ */ jsx("span", {
					className: `${CLASSE_ONGLET} ${actif ? ONGLET_ACTIF : ONGLET_INACTIF}`,
					children: annee
				})
			}, annee);
		})
	});
}
//#endregion
//#region app/lib/hydratation.ts
var sAbonner = () => () => {};
/**
* false au pré-rendu et pendant l'hydratation, true ensuite (et dès le premier rendu lors d'une
* navigation côté client). Pour lire l'adresse sans écart d'hydratation : la page pré-rendue ne
* connaît pas les paramètres (`?annee=2025`), le premier rendu du navigateur doit donc l'ignorer.
*/
function useHydrate() {
	return useSyncExternalStore(sAbonner, () => true, () => false);
}
//#endregion
//#region app/composants/CarteDate.tsx
var MOIS = new Intl.DateTimeFormat("fr-FR", {
	month: "short",
	timeZone: "UTC"
});
/**
* Une soirée du calendrier (maquette : .dr). Le pavé de gauche (jour en Playfair italique, mois)
* sert au survol de la liste ; la date complète est écrite dans la carte.
* - Soirée du jour : fond couchant et bouton « Billetterie » blanc (maquette : .dr.now).
* - Prochaine soirée : teinte couchant légère, comme sur l'accueil.
* - Soirée passée : carte à plat, sans fond (la maquette l'estompait à 62 %, ce qui faisait tomber
*   le texte sous 4,5:1).
* La carte est son propre conteneur : badge et billetterie passent à droite dès qu'elle a la place.
*/
function CarteDate({ ligne }) {
	const { soiree, etat, vainqueur } = ligne;
	const ceSoir = etat === "ce-soir";
	const prochaine = etat === "prochaine";
	const passee = etat === "terminee" || etat === "annulee";
	const [, mois, jour] = soiree.date_soiree.split("-").map(Number);
	const heure = formaterHeure(soiree.heure);
	const billetterie = !passee ? soiree.lien_billetterie : null;
	const fond = ceSoir ? "carte-saison border-transparent text-white shadow-[0_18px_40px_-20px_rgba(169,46,23,.8)]" : prochaine ? "border-[rgba(194,59,29,.3)] bg-creme bg-[linear-gradient(90deg,rgba(236,116,51,.12),transparent_70%)]" : passee ? "border-trait" : "border-trait bg-creme";
	const secondaire = ceSoir ? "text-white" : "text-encre-2";
	return /* @__PURE__ */ jsx("article", {
		className: `@container h-full rounded-[18px] border ${fond}`,
		children: /* @__PURE__ */ jsxs("div", {
			className: "grid h-full grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2.5 py-3 pr-3.5 pl-2.5 @min-[30rem]:grid-cols-[64px_minmax(0,1fr)_auto]",
			children: [
				/* @__PURE__ */ jsx("p", {
					"aria-hidden": "true",
					className: `row-span-2 self-stretch border-r pr-2.5 text-center @min-[30rem]:row-span-1 ${ceSoir ? "border-white/35" : "border-trait"}`,
					children: /* @__PURE__ */ jsxs("span", {
						className: "flex h-full flex-col items-center justify-center",
						children: [/* @__PURE__ */ jsxs("span", {
							className: `font-display text-[30px] leading-none font-bold italic ${passee ? "text-encre-2" : ""}`,
							children: [jour, jour === 1 ? /* @__PURE__ */ jsx("sup", {
								className: "text-[.45em]",
								children: "er"
							}) : null]
						}), /* @__PURE__ */ jsx("span", {
							className: `mt-1.5 text-[9.5px] leading-[1.2] font-bold tracking-[0.14em] uppercase ${secondaire}`,
							children: MOIS.format(new Date(Date.UTC(2e3, mois - 1, 1)))
						})]
					})
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [
						prochaine ? /* @__PURE__ */ jsx("p", {
							className: "mb-0.5 text-[10.5px] leading-tight font-bold tracking-[0.14em] text-rouge uppercase",
							children: "Prochaine soirée"
						}) : null,
						/* @__PURE__ */ jsx("h4", {
							className: "text-[15px] leading-[1.25] font-bold",
							children: soiree.ville
						}),
						/* @__PURE__ */ jsxs("p", {
							className: `mt-0.5 text-[13px] leading-snug font-medium ${ceSoir ? "text-white" : "text-encre"}`,
							children: [/* @__PURE__ */ jsx("time", {
								dateTime: soiree.date_soiree,
								children: formaterDateLongue(soiree.date_soiree)
							}), heure ? /* @__PURE__ */ jsxs(Fragment, { children: [" · ", heure] }) : null]
						}),
						/* @__PURE__ */ jsx("p", {
							className: `mt-0.5 text-[12.5px] leading-snug ${secondaire}`,
							children: [soiree.nom, soiree.arenes].filter(Boolean).join(" · ")
						}),
						vainqueur ? /* @__PURE__ */ jsxs("p", {
							className: "mt-1.5 text-[13px] leading-snug",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: secondaire,
									children: "Vainqueur\xA0:"
								}),
								" ",
								/* @__PURE__ */ jsx("span", {
									className: "font-semibold",
									children: vainqueur.nom
								}),
								vainqueur.aConfirmer ? /* @__PURE__ */ jsx("span", {
									className: secondaire,
									children: " (à confirmer)"
								}) : null
							]
						}) : null
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 @min-[30rem]:col-start-auto @min-[30rem]:flex-col @min-[30rem]:items-end",
					children: [/* @__PURE__ */ jsx(BadgeSoiree, {
						soiree,
						etat
					}), billetterie ? /* @__PURE__ */ jsxs("a", {
						href: billetterie,
						target: "_blank",
						rel: "noopener noreferrer",
						className: ceSoir ? "inline-flex min-h-12 items-center gap-1.5 rounded-[11px] bg-[#fffaf2] px-3.5 text-[13.5px] font-semibold text-[#9a2c12] shadow-[0_14px_30px_-14px_rgba(60,10,0,.7)]" : "inline-flex min-h-12 items-center gap-1.5 text-[13.5px] font-semibold text-rouge hover:underline",
						children: [
							"Billetterie",
							/* @__PURE__ */ jsxs("span", {
								className: "sr-only",
								children: [
									" pour ",
									soiree.ville,
									" (nouvel onglet)"
								]
							}),
							/* @__PURE__ */ jsx(Icone, {
								nom: "externe",
								className: "size-[14px]"
							})
						]
					}) : null]
				})
			]
		})
	});
}
//#endregion
//#region app/lib/calendrier.ts
var MOIS_LONG = new Intl.DateTimeFormat("fr-FR", {
	month: "long",
	timeZone: "UTC"
});
var MOIS_COURT = new Intl.DateTimeFormat("fr-FR", {
	month: "short",
	timeZone: "UTC"
});
var majuscule = (texte) => texte.charAt(0).toLocaleUpperCase("fr-FR") + texte.slice(1);
var libelleMois = (mois, format) => majuscule(format.format(new Date(Date.UTC(2e3, mois - 1, 1))));
var moisDe = (s) => Number(s.date_soiree.slice(5, 7));
var normaliser = (ville) => ville.trim().toLocaleLowerCase("fr-FR");
/** Ordre du calendrier : la date, puis l'heure (inconnue en dernier), puis la ville. */
function ordre(a, b) {
	return a.date_soiree.localeCompare(b.date_soiree) || (a.heure ?? "99").localeCompare(b.heure ?? "99") || a.ville.localeCompare(b.ville, "fr");
}
/** Saison de la page : l'année de la prochaine soirée, sinon la dernière année du calendrier. */
function anneeSaison(calendrier, maintenant) {
	return prochaineSoiree(calendrier, maintenant)?.annee ?? Math.max(...calendrier.map((s) => s.annee));
}
function trouverVainqueur(soiree, palmares) {
	const ligne = palmares?.find((p) => p.annee === soiree.annee && normaliser(p.ville) === normaliser(soiree.ville));
	return ligne ? {
		nom: ligne.vainqueur.trim(),
		aConfirmer: ligne.statut === "a_confirmer"
	} : null;
}
/**
* Toutes les soirées du calendrier, une section par année : la saison en cours ou à venir d'abord
* (et les suivantes si elles sont déjà annoncées), puis les archives de la plus récente à la plus
* ancienne. Rien n'est compté en dur : totaux, mois et vainqueurs viennent des données.
*/
function sectionsDates(calendrier, palmares, maintenant) {
	if (calendrier.length === 0) return [];
	const aujourdhui = jourParis(maintenant);
	const prochaine = prochaineSoiree(calendrier, maintenant);
	const saison = anneeSaison(calendrier, maintenant);
	const annees = [...new Set(calendrier.map((s) => s.annee))];
	return [...annees.filter((a) => a >= saison).sort((a, b) => a - b), ...annees.filter((a) => a < saison).sort((a, b) => b - a)].map((annee) => {
		const soirees = calendrier.filter((s) => s.annee === annee).sort(ordre);
		const lignes = soirees.map((soiree) => ({
			soiree,
			etat: soiree.statut === "annulee" ? "annulee" : soiree.date_soiree === aujourdhui ? "ce-soir" : soiree.date_soiree < aujourdhui ? "terminee" : soiree.id === prochaine?.id ? "prochaine" : "a-venir",
			vainqueur: trouverVainqueur(soiree, palmares)
		}));
		const mois = [];
		for (const ligne of lignes.filter((l) => l.etat !== "ce-soir")) {
			const numero = moisDe(ligne.soiree);
			const groupe = mois.at(-1)?.mois === numero ? mois.at(-1) : void 0;
			if (groupe) groupe.lignes.push(ligne);
			else mois.push({
				mois: numero,
				libelle: libelleMois(numero, MOIS_LONG),
				lignes: [ligne]
			});
		}
		const numeros = soirees.map(moisDe);
		const frise = [];
		for (let m = Math.min(5, ...numeros); m <= Math.max(8, ...numeros); m++) frise.push({
			mois: m,
			court: libelleMois(m, MOIS_COURT),
			nombre: numeros.filter((n) => n === m).length
		});
		const type = annee >= saison ? "saison" : "archives";
		return {
			annee,
			type,
			id: `${type}-${annee}`,
			titre: `${type === "saison" ? "Saison" : "Archives"} ${annee}`,
			total: soirees.length,
			confirmees: soirees.filter((s) => s.statut === "confirmee").length,
			previsionnelles: soirees.filter((s) => s.statut === "previsionnelle").length,
			premiere: soirees[0] ?? null,
			derniere: soirees.at(-1) ?? null,
			ceSoir: lignes.filter((l) => l.etat === "ce-soir"),
			mois,
			frise
		};
	});
}
/**
* Note sur les dates prévisionnelles d'une saison. La phrase suit le nombre de dates confirmées ;
* null quand plus aucune date n'est prévisionnelle.
*/
function noteProjections({ annee, confirmees, previsionnelles }) {
	if (previsionnelles === 0) return null;
	if (confirmees > previsionnelles) return previsionnelles === 1 ? `Une date ${annee} est encore prévisionnelle, à confirmer par son organisateur.` : `${previsionnelles} dates ${annee} sont encore prévisionnelles, à confirmer par chaque organisateur.`;
	const debut = `Les dates ${annee} sont des projections, à confirmer par chaque organisateur.`;
	if (confirmees === 0) return `${debut} Aucune n’est encore confirmée.`;
	if (confirmees === 1) return `${debut} Une seule est déjà confirmée.`;
	return `${debut} ${confirmees} sont déjà confirmées.`;
}
//#endregion
//#region app/composants/TexteLegal.tsx
var LIEN_TEXTE = "font-semibold text-rouge underline underline-offset-2 hover:text-encre";
/** Colonne de lecture des pages juridiques, avec les mêmes marges que TitrePage. */
function CorpsLegal({ children }) {
	return /* @__PURE__ */ jsx("div", {
		className: "grid max-w-[72ch] gap-8 px-4 pt-6 tablette:px-7 paysage:px-10 bureau:px-14",
		children
	});
}
function SectionLegale({ id, titre, children }) {
	return /* @__PURE__ */ jsxs("section", {
		"aria-labelledby": id,
		className: "grid gap-2.5 text-[15px] leading-relaxed text-encre-2 [&_ul]:grid [&_ul]:gap-1.5 [&_ul]:pl-5 [&_ul]:list-disc",
		children: [/* @__PURE__ */ jsx("h2", {
			id,
			className: "font-display text-[22px] leading-[1.2] font-bold text-encre tablette:text-[26px]",
			children: titre
		}), children]
	});
}
/**
* Encadré des informations que l'organisateur doit encore fournir (question 6 du CDC).
* Jamais de texte inventé à la place : le trou reste visible.
*/
function EncadreOrganisateur({ children }) {
	return /* @__PURE__ */ jsxs("div", {
		role: "group",
		"aria-labelledby": "encadre-organisateur",
		className: "rounded-[18px] border-2 border-dashed border-rouge bg-creme p-4 text-[15px] leading-relaxed text-encre-2",
		children: [/* @__PURE__ */ jsx("p", {
			id: "encadre-organisateur",
			className: "font-display text-[19px] leading-tight font-bold text-encre",
			children: "À compléter par l’organisateur"
		}), /* @__PURE__ */ jsx("div", {
			className: "mt-2 grid gap-2",
			children
		})]
	});
}
//#endregion
//#region app/composants/CreditsPhotos.tsx
var LIBELLES = {
	gardian: "Affiche de l’accueil",
	arenes: "Arènes de Nîmes",
	manade: "Manade et gardian",
	chevaux: "Chevaux de Camargue"
};
/** Liste des crédits, générée depuis app/donnees/photos-accueil.ts (jamais écrite à la main). */
function CreditsPhotos() {
	return /* @__PURE__ */ jsx("ul", {
		"aria-label": "Crédits photos",
		className: "!list-none !pl-0",
		children: Object.values(PHOTOS_ACCUEIL).map((photo) => /* @__PURE__ */ jsxs("li", { children: [
			/* @__PURE__ */ jsx("a", {
				href: photo.fiche,
				className: LIEN_TEXTE,
				children: LIBELLES[photo.id]
			}),
			"\xA0: ",
			photo.auteur,
			", ",
			/* @__PURE__ */ jsx("a", {
				href: photo.lienLicence,
				rel: "license",
				className: LIEN_TEXTE,
				children: photo.licence
			}),
			", via Wikimedia Commons, ",
			photo.modification,
			"."
		] }, photo.id))
	});
}
//#endregion
//#region app/lib/notation.ts
function passageOuvert(soiree, passage, maintenant) {
	return (soiree.statut === "publiee" || soiree.statut === "en_cours") && (soiree.mode_vote === "deblocage" ? passage.statut_public === "ouvert" : maintenant >= Date.parse(soiree.vote_debut) && maintenant < Date.parse(soiree.vote_fin));
}
/** Planning public mis en cache sur Railway, relecture décalée et uniquement à l'écran. */
function usePlanningNotation() {
	const [planning, setPlanning] = useState(null);
	const [erreur, setErreur] = useState(null);
	const [chargement, setChargement] = useState(true);
	useEffect(() => {
		let arrete = false;
		let occupe = false;
		let timer;
		const controle = new AbortController();
		async function lire() {
			if (arrete || occupe) return;
			if (document.visibilityState !== "visible") {
				timer = setTimeout(lire, 1e4);
				return;
			}
			occupe = true;
			try {
				const reponse = await fetch("/api/notation/planning", { signal: AbortSignal.any([controle.signal, AbortSignal.timeout(6e3)]) });
				if (!reponse.ok) throw new Error("indisponible");
				const data = await reponse.json();
				if (!Array.isArray(data.soirees) || typeof data.fileActive !== "boolean") throw new Error("invalide");
				if (!arrete) {
					setPlanning(data);
					setErreur(null);
				}
			} catch {
				if (!arrete) setErreur("Le planning ne peut pas être actualisé. Les dernières informations connues restent affichées.");
			} finally {
				occupe = false;
				if (!arrete) {
					setChargement(false);
					timer = setTimeout(lire, 1e4 + Math.random() * 2e3);
				}
			}
		}
		function reprendre() {
			if (document.visibilityState === "visible" && !occupe) {
				clearTimeout(timer);
				timer = setTimeout(lire, Math.random() * 1e3);
			}
		}
		lire();
		document.addEventListener("visibilitychange", reprendre);
		window.addEventListener("online", reprendre);
		return () => {
			arrete = true;
			controle.abort();
			clearTimeout(timer);
			document.removeEventListener("visibilitychange", reprendre);
			window.removeEventListener("online", reprendre);
		};
	}, []);
	return {
		planning,
		erreur,
		chargement
	};
}
/** Relecture des notes confirmées du compte, sans scruter les notes de tous les votants. */
function useNotesConfirmees(compte, passages) {
	const [etat, setEtat] = useState({
		compte,
		notes: {},
		erreur: false
	});
	const ids = [...new Set(passages)].sort().join(",");
	useEffect(() => {
		if (!ids) return;
		let arrete = false;
		const controle = new AbortController();
		async function lire() {
			try {
				const client = await supabase();
				const { data: session } = await client.auth.getSession();
				if (arrete || session.session?.user.id !== compte) return;
				const { data, error } = await client.from("notes_public").select("passage_id,note").eq("votant_id", compte).in("passage_id", ids.split(",")).limit(200).abortSignal(AbortSignal.any([controle.signal, AbortSignal.timeout(6e3)]));
				if (error) throw error;
				if (!arrete) setEtat({
					compte,
					notes: Object.fromEntries((data ?? []).map((n) => [n.passage_id, n.note])),
					erreur: false
				});
			} catch {
				if (!arrete) setEtat((ancien) => ({
					compte,
					notes: ancien.compte === compte ? ancien.notes : {},
					erreur: true
				}));
			}
		}
		lire();
		window.addEventListener("online", lire);
		return () => {
			arrete = true;
			controle.abort();
			window.removeEventListener("online", lire);
		};
	}, [compte, ids]);
	return etat.compte === compte ? etat : {
		compte,
		notes: {},
		erreur: false
	};
}
//#endregion
//#region app/composants/NotationPublic.tsx
var motifs = {
	vote_ferme: "Vote fermé, note non prise en compte.",
	email_non_verifie: "Validez votre adresse email avant de noter.",
	identifiant_reutilise: "Cet envoi ne peut pas être confirmé. Choisissez à nouveau votre note.",
	trop_de_modifications: "Le nombre maximal de corrections a été atteint pour ce passage.",
	limite_atteinte: "Le nombre maximal de corrections a été atteint pour ce passage.",
	trop_actions: "Le nombre maximal de corrections a été atteint pour ce passage."
};
function etatNote(item) {
	switch (item.statut) {
		case "pending": return `Note ${item.note}/10 gardée sur cet appareil, en attente d’envoi.`;
		case "sending": return `Envoi de la note ${item.note}/10…`;
		case "queued": return `Note ${item.note}/10 reçue, en attente d’enregistrement.`;
		case "confirmed": return `Note ${item.note}/10 enregistrée.`;
		case "rejected": return motifs[item.motif ?? ""] ?? "Cette note n’a pas été prise en compte. Vous pouvez réessayer si le vote est encore ouvert.";
	}
}
function NotationPublic({ compte }) {
	const { planning, chargement, erreur } = usePlanningNotation();
	const file = useFileNotes(compte);
	const [erreurSaisie, setErreurSaisie] = useState(null);
	const maintenant = useMaintenant(null);
	const confirmees = useNotesConfirmees(compte, planning?.soirees.flatMap((s) => s.epreuves.flatMap((e) => e.passages.map((p) => p.id))) ?? []);
	const dernieres = /* @__PURE__ */ new Map();
	for (const item of [...file.items].sort((a, b) => a.sequence - b.sequence || a.createdAt - b.createdAt || a.id.localeCompare(b.id))) dernieres.set(item.passageId, item);
	const enAttente = file.items.filter((i) => [
		"pending",
		"sending",
		"queued"
	].includes(i.statut));
	async function noter(passage, note) {
		setErreurSaisie(null);
		try {
			await file.enqueue(passage, note);
		} catch {
			setErreurSaisie("La note n’a pas pu être gardée sur cet appareil. Vérifiez l’espace disponible et réessayez en gardant cette page ouverte.");
		}
	}
	return /* @__PURE__ */ jsxs("section", {
		"aria-label": "Vos notes",
		className: "mx-auto max-w-5xl px-4 pb-8 tablette:px-7 paysage:px-10",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "mb-6 rounded-2xl border border-trait bg-lin p-5",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "font-display text-2xl",
						children: "Vos notes, de 1 à 10"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-2 text-sm text-encre-2",
						children: "Choisissez une note pour l’envoyer. Vous pouvez la corriger tant que le vote est ouvert. Attendez la mention « enregistrée » pour savoir qu’elle est prise en compte."
					}),
					enAttente.length ? /* @__PURE__ */ jsxs("p", {
						role: "status",
						className: "mt-3 font-semibold",
						children: [
							enAttente.length,
							" ",
							enAttente.length > 1 ? "actions en attente" : "action en attente",
							". L’envoi reprend automatiquement avec la connexion. Gardez le site ouvert ou revenez sur cet appareil."
						]
					}) : null
				]
			}),
			file.storageError || erreurSaisie ? /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "mb-5 rounded-xl border border-rouge/30 bg-creme p-4 text-rouge-alerte",
				children: erreurSaisie ?? "Le stockage de cet appareil est indisponible. Aucune nouvelle note ne peut être gardée pour le moment."
			}) : null,
			erreur ? /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "mb-5 text-encre-2",
				children: erreur
			}) : null,
			confirmees.erreur ? /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "mb-5 text-encre-2",
				children: "Vos anciennes notes ne peuvent pas être relues pour le moment. Les nouveaux envois gardent leur propre confirmation."
			}) : null,
			chargement ? /* @__PURE__ */ jsx("p", {
				role: "status",
				children: "Lecture des passages…"
			}) : null,
			planning && !planning.fileActive ? /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "mb-5 rounded-xl bg-lin p-4",
				children: "L’enregistrement des notes n’est pas encore activé."
			}) : null,
			planning && planning.soirees.length === 0 ? /* @__PURE__ */ jsx("p", { children: "Les votes ouvriront le soir de l’Olympiade. Aucun passage n’est proposé pour le moment." }) : null,
			planning?.soirees.map((soiree) => /* @__PURE__ */ jsxs("section", {
				"aria-labelledby": `soiree-${soiree.id}`,
				className: "mb-8",
				children: [
					/* @__PURE__ */ jsx("h2", {
						id: `soiree-${soiree.id}`,
						className: "font-display text-3xl",
						children: soiree.nom
					}),
					soiree.message_public ? /* @__PURE__ */ jsx("p", {
						className: "mt-2 text-encre-2",
						children: soiree.message_public
					}) : null,
					soiree.epreuves.filter((e) => e.notee).map((epreuve) => /* @__PURE__ */ jsxs("div", {
						className: "mt-6",
						children: [/* @__PURE__ */ jsx("h3", {
							className: "mb-3 text-lg font-semibold",
							children: epreuve.nom
						}), /* @__PURE__ */ jsx("div", {
							className: "grid gap-4 tablette:grid-cols-2",
							children: epreuve.passages.map((passage) => {
								const item = dernieres.get(passage.id);
								const selection = item?.note ?? confirmees.notes[passage.id];
								const ouvert = passageOuvert(soiree, passage, maintenant?.getTime() ?? Date.now());
								return /* @__PURE__ */ jsxs("fieldset", {
									className: "min-w-0 rounded-[22px] border border-trait bg-creme p-5",
									children: [
										/* @__PURE__ */ jsx("legend", {
											className: "px-2 font-display text-2xl",
											children: passage.manades.nom
										}),
										/* @__PURE__ */ jsx("p", {
											className: "mb-3 text-sm text-encre-2",
											children: ouvert ? "À vous de noter" : passage.statut_public === "a_venir" && soiree.mode_vote === "deblocage" ? "Vote à venir" : "Vote fermé"
										}),
										/* @__PURE__ */ jsx("div", {
											className: "grid grid-cols-5 gap-2",
											children: Array.from({ length: 10 }, (_, i) => i + 1).map((n) => /* @__PURE__ */ jsx("button", {
												type: "button",
												"aria-label": `${n} sur 10`,
												"aria-pressed": selection === n,
												disabled: !ouvert || !planning.fileActive || file.loading || !!file.storageError,
												onClick: () => void noter(passage.id, n),
												className: `min-h-12 rounded-xl border text-lg font-semibold tabular-nums disabled:opacity-45 ${selection === n ? "border-encre bg-encre text-sable" : "border-trait bg-sable text-encre hover:border-encre"}`,
												children: n
											}, n))
										}),
										/* @__PURE__ */ jsx("p", {
											role: "status",
											className: `mt-4 min-h-12 text-sm ${item?.statut === "rejected" ? "text-rouge-alerte" : "text-encre-2"}`,
											children: item ? etatNote(item) : selection ? `Note ${selection}/10 enregistrée.` : "Aucune note enregistrée."
										})
									]
								}, passage.id);
							})
						})]
					}, epreuve.id))
				]
			}, soiree.id)),
			file.items.length ? /* @__PURE__ */ jsxs("details", {
				className: "rounded-2xl border border-trait bg-creme p-5",
				children: [
					/* @__PURE__ */ jsx("summary", {
						className: "min-h-12 cursor-pointer font-semibold",
						children: "Suivi de vos derniers envois"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mb-3 text-sm text-encre-2",
						children: "Les notes gardées sur l’appareil doivent parvenir au serveur avant la fermeture du vote. Une note déjà reçue à temps peut finir d’être enregistrée ensuite."
					}),
					/* @__PURE__ */ jsx("ul", {
						className: "space-y-2",
						children: file.items.slice(0, 20).map((item) => /* @__PURE__ */ jsxs("li", {
							className: "border-t border-trait pt-2 text-sm",
							children: [
								/* @__PURE__ */ jsx("time", {
									dateTime: new Date(item.createdAt).toISOString(),
									children: new Date(item.createdAt).toLocaleTimeString("fr-FR", {
										hour: "2-digit",
										minute: "2-digit"
									})
								}),
								" · ",
								etatNote(item)
							]
						}, item.id))
					})
				]
			}) : null
		]
	});
}
//#endregion
//#region app/lib/useAccesAdmin.ts
/** Contrôle d'affichage seulement : chaque lecture des métriques est aussi protégée côté serveur. */
function useAccesAdmin() {
	const { session, chargement } = useSession();
	const [verification, setVerification] = useState(null);
	const jeton = session?.access_token;
	const id = session?.user.id;
	useEffect(() => {
		if (!jeton || !id) return;
		let actif = true;
		const controle = new AbortController();
		(async () => {
			try {
				const { data, error } = await (await supabase()).from("profils").select("role").eq("id", id).abortSignal(AbortSignal.any([controle.signal, AbortSignal.timeout(5e3)])).maybeSingle();
				if (actif) setVerification({
					jeton,
					acces: error ? "erreur" : data?.role === "admin" ? "autorise" : "refuse"
				});
			} catch {
				if (actif) setVerification({
					jeton,
					acces: "erreur"
				});
			}
		})();
		return () => {
			actif = false;
			controle.abort();
		};
	}, [jeton, id]);
	return {
		acces: chargement ? "chargement" : !jeton ? "anonyme" : verification?.jeton === jeton ? verification.acces : "chargement",
		session
	};
}
//#endregion
//#region app/lib/supervision.ts
/** Le p95 est une borne d'histogramme ; 3001 désigne le compartiment ouvert au-delà de 3 s. */
var latence = (ms) => ms == null ? "Indisponible" : ms > 3e3 ? "> 3 000 ms" : `≤ ${nombre(ms, 1)} ms`;
var nombre = (valeur, decimales = 0) => valeur == null || !Number.isFinite(valeur) ? "Indisponible" : valeur.toLocaleString("fr-FR", { maximumFractionDigits: decimales });
function octets(valeur) {
	if (valeur == null || !Number.isFinite(valeur)) return "Indisponible";
	const unites = [
		"o",
		"Ko",
		"Mo",
		"Go",
		"To"
	];
	const index = valeur > 0 ? Math.min(4, Math.floor(Math.log(valeur) / Math.log(1e3))) : 0;
	return `${nombre(valeur / 1e3 ** index, 1)} ${unites[Math.max(0, index)]}`;
}
function exporterMesures(mesures) {
	return "﻿" + ["minute_utc;requetes;erreurs_5xx;octets_reponse;p95_ms;cpu_ms;memoire_octets;retard_ms;requetes_simultanees_max;connexions_http_max;instances;comptes_actifs", ...mesures.map((m) => [
		new Date(m.minute).toISOString(),
		m.requests,
		m.errors5xx,
		m.responseBytes,
		m.p95Ms ?? "",
		m.cpuMs,
		m.rssBytes,
		m.eventLoopLagMs,
		m.inflightMax,
		m.httpConnectionsMax,
		m.instances,
		m.authenticatedActiveUsers ?? ""
	].join(";"))].join("\r\n");
}
//#endregion
export { demandeValide as $, SaisonAccueil as A, TEXTE_INSCRIPTIONS_FERMEES as B, anneesClassements as C, lireDonneesVitrineNavigateur as D, lireDonneesVitrine as E, Epreuves as F, TitrePage as G, CreditAffiche as H, EPREUVES as I, Icone as J, PiedDePage as K, DernierVainqueur as L, FormulaireContact as M, lireCalendrier as N, donneesRelues as O, lireOuRepli as P, demandeEnCours as Q, BlocNoter as R, anneeChoisie as S, DELAI_LECTURE_NAVIGATEUR_MS as T, SuiviNotes as U, Affiche as V, SuiviPresence as W, useMaintenant as X, useSession as Y, ETAT_SOIREE as Z, ONGLET_ACTIF as _, useAccesAdmin as a, oublierDemande as at, idOnglet as b, CorpsLegal as c, verifierCode as ct, SectionLegale as d, momentSoiree as dt, demanderCode as et, noteProjections as f, prochaineSoireeA as ft, CLASSE_ONGLET as g, useHydrate as h, VILLE_AFFICHE as ht, octets as i, normaliserEmail as it, ManadesEdition as j, useRelectureApresInteraction as k, EncadreOrganisateur as l, supabase as lt, CarteDate as m, jourParis as mt, latence as n, memoriserDemande as nt, NotationPublic as o, traduireErreurAuth as ot, sectionsDates as p, soireeDeReference as pt, Entete as q, nombre as r, normaliserCode as rt, CreditsPhotos as s, validerInscription as st, exporterMesures as t, formaterDecompte as tt, LIEN_TEXTE as u, formaterJourMois as ut, ONGLET_INACTIF as v, resultatsAnnee as w, CarteResultat as x, OngletsAnnee as y, INSCRIPTION_OUVERTE as z };
