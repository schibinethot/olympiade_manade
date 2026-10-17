import { $ as useRelectureApresInteraction, A as CorpsLegal, At as useInstantanePublic, B as CLASSE_ONGLET, Bt as normaliserEmail, C as nombre, Ct as ConsentementCookies, D as IdentitePublique, Dt as useSession, E as NotationPublic, Et as Icone, F as noteProjections, Ft as demandeValide, G as CarteResultat, Gt as verifierTotp, H as ONGLET_INACTIF, Ht as traduireErreurAuth, I as sectionsDates, It as demanderCode, J as resultatsAnnee, Jt as momentSoiree, K as anneeChoisie, Kt as supabase, L as CarteDate, Lt as formaterDecompte, M as SectionLegale, Mt as commencerEnrolementTotp, N as FormulaireContact, Nt as connecterAdmin, O as CHAMPS_IDENTITE, Ot as useMaintenant, P as evenementsDesDates, Pt as demandeEnCours, Q as donneesRelues, R as useHydrate, Rt as memoriserDemande, S as latence, St as PiedDePage, T as useAccesAdmin, Tt as Entete, U as OngletsAnnee, Ut as validerInscription, V as ONGLET_ACTIF, Vt as oublierDemande, W as idOnglet, Wt as verifierCode, X as lireDonneesVitrine, Xt as soireeDeReference, Y as DELAI_LECTURE_NAVIGATEUR_MS, Yt as presentationAfficheAccueil, Z as lireDonneesVitrineNavigateur, Zt as jourParis, _ as CARTE$1, _t as BanniereDeblocage, a as depuisChampParis, at as VerificationHumaine, b as useClientAdmin, bt as SuiviNotes, c as horairesModele, ct as DernierVainqueur, d as documentPdf, dt as TEXTE_INSCRIPTIONS_FERMEES, et as lireCalendrier, f as matriceQr, ft as Affiche, g as BOUTON_PLEIN, gt as ServiceTravailleur, h as BOUTON$1, ht as PrecisionAccueil, i as champParis, it as InscriptionActualites, j as LIEN_TEXTE, jt as MESSAGES_AUTH, k as CreditsPhotos, kt as FournisseurEtatSoiree, l as slugifier, lt as BlocNoter, m as AideCookies, mt as VILLE_AFFICHE, n as ImportPlanning, nt as SaisonAccueil, o as etapesEchange, ot as Epreuves, p as telechargerFichier, pt as CreditAffiche, q as anneesClassements, qt as formaterJourMois, r as EPREUVES_MODELE, rt as ManadesEdition, s as fenetreDefaut, st as EPREUVES, t as etapesReordre, tt as lireOuRepli, u as CodeQr, ut as INSCRIPTION_OUVERTE, v as CHAMP$1, vt as CoqueAndroid, w as octets, wt as useConsentementCookies, x as exporterMesures, xt as TitrePage, y as CadreAdmin, yt as SuiviPresence, z as ClassementCalcule, zt as normaliserCode } from "./assets/app-yzMUrpDZ.js";
import { Link, Links, Meta, Navigate, Outlet, Scripts, ScrollRestoration, ServerRouter, UNSAFE_withComponentProps, UNSAFE_withErrorBoundaryProps, UNSAFE_withHydrateFallbackProps, isRouteErrorResponse, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { OTPInput, OTPInputContext } from "input-otp";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region node_modules/.pnpm/@react-router+dev@8.4.0_react-router@8.4.0_react-dom@19.3.0_react@19.3.0__react@19.3.0__3900bbcba3aa462d3a0441387023a823/node_modules/@react-router/dev/dist/config/defaults/entry.server.web.tsx
var entry_server_web_exports = /* @__PURE__ */ __exportAll({
	default: () => handleRequest,
	streamTimeout: () => streamTimeout
});
var streamTimeout = 5e3;
async function handleRequest(request, responseStatusCode, responseHeaders, routerContext, _loadContext) {
	if (request.method.toUpperCase() === "HEAD") return new Response(null, {
		status: responseStatusCode,
		headers: responseHeaders
	});
	let shellRendered = false;
	let userAgent = request.headers.get("user-agent");
	const body = await renderToReadableStream(/* @__PURE__ */ jsx(ServerRouter, {
		context: routerContext,
		url: request.url
	}), {
		signal: AbortSignal.timeout(6e3),
		onError(error) {
			responseStatusCode = 500;
			if (shellRendered) console.error(error);
		}
	});
	shellRendered = true;
	if (userAgent && isbot(userAgent) || routerContext.isSpaMode) await body.allReady;
	responseHeaders.set("Content-Type", "text/html");
	return new Response(body, {
		headers: responseHeaders,
		status: responseStatusCode
	});
}
//#endregion
//#region app/app.css?url
var app_default = "/assets/app-DaTw1SyK.css";
//#endregion
//#region app/root.tsx
var root_exports = /* @__PURE__ */ __exportAll({
	ErrorBoundary: () => ErrorBoundary,
	HydrateFallback: () => HydrateFallback,
	Layout: () => Layout,
	default: () => root_default,
	links: () => links,
	meta: () => meta$25
});
var police = (fichier) => ({
	rel: "preload",
	href: `/polices/${fichier}`,
	as: "font",
	type: "font/woff2",
	crossOrigin: "anonymous"
});
var links = () => [
	{
		rel: "stylesheet",
		href: app_default,
		precedence: "default"
	},
	police("inter-latin-wght-normal.woff2"),
	police("kaushan-script-latin-400-normal.woff2"),
	police("playfair-display-latin-wght-normal.woff2"),
	police("playfair-display-latin-wght-italic.woff2"),
	{
		rel: "icon",
		href: "/favicon.svg",
		type: "image/svg+xml"
	},
	{
		rel: "manifest",
		href: "/manifest.webmanifest"
	}
];
var meta$25 = () => [{ title: "Olympiade des Manades" }, {
	name: "description",
	content: "Le public note les manades, en direct, aux côtés du jury."
}];
function Layout({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "fr",
		children: [/* @__PURE__ */ jsxs("head", { children: [
			/* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
			/* @__PURE__ */ jsx("meta", {
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover"
			}),
			/* @__PURE__ */ jsx("meta", {
				name: "theme-color",
				content: "#f7f4ed"
			}),
			/* @__PURE__ */ jsx(Meta, {}),
			/* @__PURE__ */ jsx(Links, {})
		] }), /* @__PURE__ */ jsxs("body", { children: [
			children,
			/* @__PURE__ */ jsx(ScrollRestoration, {}),
			/* @__PURE__ */ jsx(Scripts, {})
		] })]
	});
}
/** Coque commune : conteneur des container queries (`app`), en-tête, contenu, pied de page. */
function Coque({ children, generique = false }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "@container/app flex min-h-dvh flex-col",
		children: [
			/* @__PURE__ */ jsx("a", {
				href: "#contenu",
				className: "sr-only z-30 rounded-xl bg-encre px-4 py-3 text-sable focus:not-sr-only focus:fixed focus:top-3 focus:left-3",
				children: "Aller au contenu"
			}),
			/* @__PURE__ */ jsx(Entete, { generique }),
			/* @__PURE__ */ jsx("main", {
				id: "contenu",
				className: "flex-1",
				children
			}),
			/* @__PURE__ */ jsx(PiedDePage, {})
		]
	});
}
var root_default = UNSAFE_withComponentProps(function App() {
	return /* @__PURE__ */ jsx(CoqueAndroid, { children: /* @__PURE__ */ jsxs(FournisseurEtatSoiree, { children: [
		/* @__PURE__ */ jsx(ServiceTravailleur, {}),
		/* @__PURE__ */ jsx(ConsentementCookies, {}),
		/* @__PURE__ */ jsxs(Coque, { children: [
			/* @__PURE__ */ jsx(BanniereDeblocage, {}),
			/* @__PURE__ */ jsx(SuiviPresence, {}),
			/* @__PURE__ */ jsx(SuiviNotes, {}),
			/* @__PURE__ */ jsx(Outlet, {})
		] })
	] }) });
});
var HydrateFallback = UNSAFE_withHydrateFallbackProps(function HydrateFallback() {
	return /* @__PURE__ */ jsx(Coque, {
		generique: true,
		children: /* @__PURE__ */ jsx("p", {
			role: "status",
			className: "px-4 pt-6 text-encre-2 tablette:px-7 paysage:px-10 bureau:px-14",
			children: "Chargement…"
		})
	});
});
var ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary({ error }) {
	const introuvable = isRouteErrorResponse(error) && error.status === 404;
	return /* @__PURE__ */ jsx(Coque, { children: /* @__PURE__ */ jsx(TitrePage, {
		surtitre: introuvable ? "Erreur 404" : "Erreur",
		titre: introuvable ? "Page introuvable" : "Un problème est survenu",
		children: /* @__PURE__ */ jsxs("p", { children: [
			introuvable ? "Cette adresse ne correspond à aucune page du site." : "La page n’a pas pu s’afficher. Réessayez dans un instant.",
			" ",
			/* @__PURE__ */ jsx(Link, {
				to: "/",
				className: "font-semibold text-rouge underline underline-offset-2",
				children: "Retour à l’accueil"
			})
		] })
	}) });
});
//#endregion
//#region app/routes/accueil.tsx
var accueil_exports = /* @__PURE__ */ __exportAll({
	clientLoader: () => clientLoader$3,
	default: () => accueil_default,
	loader: () => loader$2,
	meta: () => meta$24
});
var meta$24 = () => [
	{ title: "Olympiade des Manades" },
	{
		tagName: "link",
		rel: "canonical",
		href: "https://olympiadedesmanades.fr/"
	},
	{
		property: "og:url",
		content: "https://olympiadedesmanades.fr/"
	},
	{
		name: "description",
		content: "Les Olympiades camarguaises : le public note les manades, en direct, aux côtés du jury. Saison 2027."
	}
];
async function loader$2() {
	return lireDonneesVitrine();
}
async function clientLoader$3({ serverLoader }) {
	return lireDonneesVitrineNavigateur(serverLoader);
}
var accueil_default = UNSAFE_withComponentProps(function Accueil({ loaderData }) {
	const { calendrier, palmares, lueLe } = loaderData;
	const maintenant = useMaintenant(lueLe);
	const instantane = useInstantanePublic();
	useRelectureApresInteraction(loaderData);
	const soiree = calendrier ? soireeDeReference(calendrier, maintenant) : null;
	const affiche = calendrier ? presentationAfficheAccueil(calendrier, VILLE_AFFICHE, maintenant) : null;
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx(InscriptionActualites, {}),
		/* @__PURE__ */ jsxs("section", {
			"aria-label": "À l’affiche",
			className: "grid gap-x-[18px] gap-y-3.5 px-4 pt-3.5 tablette:grid-cols-[1.12fr_1fr] tablette:px-7 tablette:pt-[22px] paysage:grid-cols-[1.5fr_1fr] paysage:gap-x-[22px] paysage:px-10 paysage:pt-[26px] bureau:px-14 bureau:pt-[30px]",
			children: [
				/* @__PURE__ */ jsx(Affiche, { presentation: affiche }),
				/* @__PURE__ */ jsx(BlocNoter, {
					etat: instantane.etat,
					soiree,
					calendrierDisponible: calendrier !== null,
					maintenant,
					direct: instantane.etat === "ouvert" && instantane.soiree ? {
						epreuve: instantane.soiree.epreuveEnCours ?? void 0,
						manadeEnPiste: instantane.soiree.manadeEnPiste ?? void 0
					} : void 0
				}),
				/* @__PURE__ */ jsx(CreditAffiche, { className: "-mt-2 px-1 tablette:-mt-2.5" })
			]
		}),
		/* @__PURE__ */ jsx(PrecisionAccueil, {}),
		/* @__PURE__ */ jsx(ManadesEdition, {}),
		/* @__PURE__ */ jsx(Epreuves, {}),
		/* @__PURE__ */ jsx(DernierVainqueur, { palmares }),
		/* @__PURE__ */ jsx("div", {
			className: "px-4 pt-9 pb-1 tablette:px-7 tablette:pt-11 paysage:px-10 paysage:pt-14 bureau:px-14",
			children: /* @__PURE__ */ jsx(SaisonAccueil, {
				calendrier,
				maintenant
			})
		})
	] });
});
//#endregion
//#region app/routes/classements.tsx
var classements_exports = /* @__PURE__ */ __exportAll({
	clientLoader: () => clientLoader$2,
	default: () => classements_default,
	loader: () => loader$1,
	meta: () => meta$23,
	shouldRevalidate: () => shouldRevalidate
});
var meta$23 = () => [{ title: "Classements · Olympiade des Manades" }, {
	name: "description",
	content: "Palmarès des Olympiades des manades : le vainqueur de chaque soirée, avec sa source."
}];
async function loader$1() {
	return lireDonneesVitrine();
}
async function clientLoader$2({ serverLoader }) {
	return lireDonneesVitrineNavigateur(serverLoader);
}
function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }) {
	return currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search && donneesRelues() ? false : defaultShouldRevalidate;
}
var PANNEAU = "panneau-classements";
var MARGES = "px-4 tablette:px-7 paysage:px-10 bureau:px-14";
var GRILLE = "grid gap-3 paysage:grid-cols-3";
/** Année sans résultat mais avec des soirées à venir : les classements viendront du direct. */
function AnneeEnDirect({ annee, soirees }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex max-w-[44rem] gap-4 rounded-[22px] border border-trait bg-creme p-5 tablette:p-6",
		children: [/* @__PURE__ */ jsx("span", {
			"aria-hidden": "true",
			className: "grid size-11 flex-none place-items-center rounded-full bg-[rgba(194,59,29,.1)] text-rouge",
			children: /* @__PURE__ */ jsx(Icone, {
				nom: "horloge",
				className: "size-5"
			})
		}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("p", {
			className: "font-display text-[20px] leading-[1.25] font-bold tablette:text-[22px]",
			children: [
				"Les classements ",
				annee,
				" s’afficheront en direct pendant les soirées\xA0: jury et prix du public."
			]
		}), soirees ? /* @__PURE__ */ jsxs(Link, {
			to: `/dates#saison-${annee}`,
			className: "mt-1 inline-flex min-h-12 items-center gap-1.5 text-[13.5px] font-semibold text-rouge hover:underline",
			children: [
				"Les ",
				soirees,
				" dates ",
				annee,
				/* @__PURE__ */ jsx(Icone, {
					nom: "fleche",
					className: "size-[15px]"
				})
			]
		}) : null] })]
	});
}
var classements_default = UNSAFE_withComponentProps(function Classements({ loaderData }) {
	const { calendrier, palmares, lueLe } = loaderData;
	const maintenant = useMaintenant(lueLe);
	useRelectureApresInteraction(loaderData);
	const hydrate = useHydrate();
	const [parametres, setParametres] = useSearchParams();
	const annees = anneesClassements(palmares, calendrier);
	const instantane = useInstantanePublic();
	const anneeDirect = instantane.soiree?.dateSoiree ? Number(instantane.soiree.dateSoiree.slice(0, 4)) : null;
	const annee = anneeChoisie(hydrate ? parametres.get("annee") : null, annees);
	const avecOnglets = annee !== null && annees.onglets.length > 1;
	const choisir = (choix) => setParametres({ annee: String(choix) }, {
		replace: true,
		preventScrollReset: true
	});
	const resultats = palmares && annee !== null ? resultatsAnnee(palmares, annee) : [];
	const soirDirect = annee !== null && anneeDirect === annee ? instantane.soiree : null;
	const classementDirect = soirDirect?.classements ?? null;
	const aujourdhui = jourParis(maintenant);
	const soireesAnnee = calendrier?.filter((s) => s.annee === annee && s.statut !== "annulee") ?? [];
	const aVenir = soireesAnnee.some((s) => s.date_soiree >= aujourdhui);
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx(TitrePage, {
			surtitre: "Palmarès",
			titre: annee !== null ? /* @__PURE__ */ jsxs(Fragment, { children: ["Classements ", /* @__PURE__ */ jsx("em", { children: annee })] }) : "Classements",
			bas: avecOnglets ? /* @__PURE__ */ jsx(OngletsAnnee, {
				annees: annees.onglets,
				choisie: annee,
				onChoisir: choisir,
				panneau: PANNEAU,
				libelle: "Année du palmarès"
			}) : null,
			children: /* @__PURE__ */ jsx("p", { children: "Le vainqueur de chaque soirée, avec sa source. «\xA0À\xA0confirmer\xA0»\xA0: le résultat n’est pas encore vérifié." })
		}),
		/* @__PURE__ */ jsxs("div", {
			id: PANNEAU,
			role: avecOnglets ? "tabpanel" : void 0,
			"aria-labelledby": avecOnglets ? idOnglet(annee) : void 0,
			tabIndex: avecOnglets ? 0 : void 0,
			className: `${MARGES} mt-[18px] rounded-sm tablette:mt-[22px] paysage:mt-[26px]`,
			children: [
				annee !== null ? /* @__PURE__ */ jsxs("h2", {
					className: "sr-only",
					children: ["Palmarès ", annee]
				}) : null,
				classementDirect ? /* @__PURE__ */ jsxs("div", {
					className: "mb-8",
					children: [
						/* @__PURE__ */ jsxs("h2", {
							className: "mb-3 font-display text-[22px] leading-tight font-bold",
							children: ["Classement calculé · ", soirDirect?.nom]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mb-4 text-sm text-encre-2",
							children: "Relecture de l’instantané public, selon le réglage de visibilité de la soirée."
						}),
						/* @__PURE__ */ jsx(ClassementCalcule, { classements: classementDirect })
					]
				}) : null,
				!palmares ? /* @__PURE__ */ jsx("p", {
					className: "text-encre-2",
					children: "Informations momentanément indisponibles. Réessayez dans un instant."
				}) : resultats.length ? /* @__PURE__ */ jsx("div", {
					className: GRILLE,
					children: resultats.map((resultat, rang) => /* @__PURE__ */ jsx(CarteResultat, {
						resultat,
						aLaUne: rang === 0 && !classementDirect
					}, resultat.id))
				}) : classementDirect ? null : annee !== null && aVenir ? /* @__PURE__ */ jsx(AnneeEnDirect, {
					annee,
					soirees: soireesAnnee.length
				}) : /* @__PURE__ */ jsxs("p", {
					className: "text-encre-2",
					children: [
						"Aucun résultat publié pour ",
						annee ?? "cette année",
						"."
					]
				})
			]
		}),
		palmares && annees.precedentes.length ? /* @__PURE__ */ jsx("div", {
			className: `${MARGES} pt-10 paysage:pt-14`,
			children: /* @__PURE__ */ jsxs("details", {
				className: "group rounded-[22px] border border-trait",
				children: [/* @__PURE__ */ jsxs("summary", {
					className: "flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-[22px] px-5 py-3 [&::-webkit-details-marker]:hidden",
					children: [
						/* @__PURE__ */ jsx("h2", {
							className: "font-display text-[21px] leading-[1.2] font-bold",
							children: "Éditions précédentes"
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-[13.5px] text-encre-2",
							children: annees.precedentes.join(", ")
						}),
						/* @__PURE__ */ jsx(Icone, {
							nom: "chevron",
							className: "ml-auto size-5 text-encre-2 transition-transform duration-200 group-open:rotate-180"
						})
					]
				}), /* @__PURE__ */ jsx("div", {
					className: `${GRILLE} px-3 pb-3 tablette:px-4 tablette:pb-4`,
					children: annees.precedentes.flatMap((precedente) => resultatsAnnee(palmares, precedente)).map((resultat) => /* @__PURE__ */ jsx(CarteResultat, { resultat }, resultat.id))
				})]
			})
		}) : null
	] });
});
//#endregion
//#region app/routes/dates.tsx
var dates_exports = /* @__PURE__ */ __exportAll({
	clientLoader: () => clientLoader$1,
	default: () => dates_default,
	loader: () => loader,
	meta: () => meta$22
});
var meta$22 = () => [{ title: "Dates · Olympiade des Manades" }, {
	name: "description",
	content: "Toutes les soirées d’Olympiades des manades : la saison à venir et les archives des années passées."
}];
async function loader() {
	return lireDonneesVitrine();
}
async function clientLoader$1({ serverLoader }) {
	return lireDonneesVitrineNavigateur(serverLoader);
}
var lignesDe = (section) => [...section.ceSoir, ...section.mois.flatMap((m) => m.lignes)];
var CLASSE_SECTION = "grid scroll-mt-[calc(env(safe-area-inset-top)+84px)] gap-[18px] px-4 tablette:px-7 paysage:grid-cols-[320px_minmax(0,1fr)] paysage:items-start paysage:gap-7 paysage:px-10 bureau:grid-cols-[360px_minmax(0,1fr)] bureau:px-14";
var CLASSE_ENTETE_SECTION = "rounded-[24px] p-[22px] paysage:sticky paysage:top-[calc(env(safe-area-inset-top)+88px)]";
var CLASSE_MOIS = "mb-2.5 text-[11px] leading-none font-bold tracking-[0.2em] text-or-ink uppercase";
/** Barre d'ancres vers chaque année, au style des onglets de la maquette. Rien n'y est masqué. */
function BarreAnnees({ sections }) {
	return /* @__PURE__ */ jsx("nav", {
		"aria-label": "Années du calendrier",
		className: "mt-3.5",
		children: /* @__PURE__ */ jsx("ul", {
			className: "flex flex-wrap gap-x-1.5",
			children: sections.map((section, rang) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", {
				href: `#${section.id}`,
				className: "group inline-flex min-h-12 items-center rounded-full",
				children: /* @__PURE__ */ jsxs("span", {
					className: `${CLASSE_ONGLET} ${rang === 0 ? ONGLET_ACTIF : ONGLET_INACTIF}`,
					children: [section.titre, /* @__PURE__ */ jsxs("span", {
						className: "font-medium tabular-nums",
						children: [
							"(",
							section.total,
							/* @__PURE__ */ jsxs("span", {
								className: "sr-only",
								children: [" soirée", section.total > 1 ? "s" : ""]
							}),
							")"
						]
					})]
				})
			}) }, section.id))
		})
	});
}
function Statistique({ nombre, libelle }) {
	return /* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("span", {
		className: "block font-display text-[32px] leading-none font-bold italic",
		children: nombre
	}), /* @__PURE__ */ jsx("span", {
		className: "text-[11px]",
		children: libelle
	})] });
}
/** Carte de la saison (maquette : .season) : période, frise des mois, chiffres, dates prévisionnelles. */
function EnteteSaison({ section }) {
	const nimes = lignesDe(section).find((l) => l.soiree.ville === "Nîmes" && l.soiree.statut !== "annulee")?.soiree;
	const note = noteProjections(section);
	return /* @__PURE__ */ jsxs("div", {
		className: `carte-saison text-white ${CLASSE_ENTETE_SECTION}`,
		children: [
			/* @__PURE__ */ jsx("h2", {
				id: `titre-${section.id}`,
				className: "font-brush text-[38px] leading-none font-normal",
				children: section.titre
			}),
			section.premiere && section.derniere ? /* @__PURE__ */ jsxs("p", {
				className: "mt-2 text-[13.5px]",
				children: [
					"Du ",
					formaterJourMois(section.premiere.date_soiree),
					" au ",
					formaterJourMois(section.derniere.date_soiree),
					", au fil des fêtes votives.",
					nimes ? ` La plus grande soirée se tient aux arènes de Nîmes, le ${formaterJourMois(nimes.date_soiree)}.` : ""
				]
			}) : null,
			/* @__PURE__ */ jsx("ul", {
				"aria-label": "Soirées par mois",
				className: "mt-[18px] grid auto-cols-fr grid-flow-col gap-1.5",
				children: section.frise.map((m) => /* @__PURE__ */ jsxs("li", {
					className: "flex flex-col gap-1.5 text-[10px] leading-none font-bold tracking-[0.14em] uppercase",
					children: [/* @__PURE__ */ jsx("span", {
						"aria-hidden": "true",
						className: `flex h-11 items-end rounded-[10px] bg-[rgba(60,10,0,.22)] p-1.5 ${m.nombre > 6 ? "gap-[2px]" : "gap-[3px]"}`,
						children: Array.from({ length: m.nombre }, (_, i) => /* @__PURE__ */ jsx("i", { className: "h-full flex-1 rounded-[3px] bg-[#ffe2c2] opacity-90" }, i))
					}), /* @__PURE__ */ jsxs("span", { children: [m.court, /* @__PURE__ */ jsxs("span", {
						className: "sr-only",
						children: [
							" ",
							": ",
							m.nombre,
							" soirée",
							m.nombre > 1 ? "s" : ""
						]
					})] })]
				}, m.mois))
			}),
			/* @__PURE__ */ jsxs("ul", {
				className: "mt-[18px] flex flex-wrap gap-x-[18px] gap-y-2",
				children: [
					/* @__PURE__ */ jsx(Statistique, {
						nombre: section.total,
						libelle: section.total > 1 ? "soirées" : "soirée"
					}),
					/* @__PURE__ */ jsx(Statistique, {
						nombre: section.confirmees,
						libelle: section.confirmees > 1 ? "confirmées" : "confirmée"
					}),
					/* @__PURE__ */ jsx(Statistique, {
						nombre: EPREUVES.length,
						libelle: "épreuves par soirée"
					})
				]
			}),
			note ? /* @__PURE__ */ jsxs("p", {
				className: "mt-[18px] flex gap-2.5 rounded-[14px] bg-[rgba(60,10,0,.22)] p-3 text-[13px] leading-snug",
				children: [/* @__PURE__ */ jsx(Icone, {
					nom: "horloge",
					className: "mt-px size-4"
				}), note]
			}) : null
		]
	});
}
/** Carte d'une année passée : plus sobre que la saison, avec le lien vers son palmarès. */
function EnteteArchives({ section }) {
	const resultats = lignesDe(section).filter((l) => l.vainqueur).length;
	return /* @__PURE__ */ jsxs("div", {
		className: `border border-trait bg-lin/50 ${CLASSE_ENTETE_SECTION}`,
		children: [
			/* @__PURE__ */ jsxs("h2", {
				id: `titre-${section.id}`,
				className: "font-display text-[30px] leading-[1.05] font-bold",
				children: ["Archives ", /* @__PURE__ */ jsx("em", {
					className: "text-rouge",
					children: section.annee
				})]
			}),
			section.premiere && section.derniere ? /* @__PURE__ */ jsxs("p", {
				className: "mt-2 text-[13.5px] text-encre-2",
				children: [
					"Du ",
					formaterJourMois(section.premiere.date_soiree),
					" au ",
					formaterJourMois(section.derniere.date_soiree),
					" ",
					section.annee,
					"."
				]
			}) : null,
			/* @__PURE__ */ jsxs("ul", {
				className: "mt-4 flex flex-wrap gap-x-[18px] gap-y-2",
				children: [/* @__PURE__ */ jsx(Statistique, {
					nombre: section.total,
					libelle: section.total > 1 ? "soirées" : "soirée"
				}), resultats ? /* @__PURE__ */ jsx(Statistique, {
					nombre: resultats,
					libelle: resultats > 1 ? "résultats connus" : "résultat connu"
				}) : null]
			}),
			resultats ? /* @__PURE__ */ jsxs(Link, {
				to: `/classements?annee=${section.annee}`,
				className: "mt-2 inline-flex min-h-12 items-center gap-1.5 text-[13.5px] font-semibold text-rouge hover:underline",
				children: [
					"Le palmarès ",
					section.annee,
					/* @__PURE__ */ jsx(Icone, {
						nom: "fleche",
						className: "size-[15px]"
					})
				]
			}) : null
		]
	});
}
function Groupe({ titre, lignes, pleineLargeur = false }) {
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
		className: CLASSE_MOIS,
		children: titre
	}), /* @__PURE__ */ jsx("ul", {
		className: `grid gap-2 ${pleineLargeur ? "" : "paysage:grid-cols-2"}`,
		children: lignes.map((ligne) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(CarteDate, { ligne }) }, ligne.soiree.id))
	})] });
}
function SectionAnnee({ section, premiere }) {
	return /* @__PURE__ */ jsxs("section", {
		id: section.id,
		"aria-labelledby": `titre-${section.id}`,
		className: `${CLASSE_SECTION} ${premiere ? "mt-[18px] tablette:mt-[22px] paysage:mt-[26px]" : "mt-12 paysage:mt-16"}`,
		children: [section.type === "saison" ? /* @__PURE__ */ jsx(EnteteSaison, { section }) : /* @__PURE__ */ jsx(EnteteArchives, { section }), /* @__PURE__ */ jsxs("div", {
			className: "grid gap-[22px]",
			children: [section.ceSoir.length ? /* @__PURE__ */ jsx(Groupe, {
				titre: "Ce soir",
				lignes: section.ceSoir,
				pleineLargeur: true
			}) : null, section.mois.map((m) => /* @__PURE__ */ jsx(Groupe, {
				titre: m.libelle,
				lignes: m.lignes
			}, m.mois))]
		})]
	});
}
var dates_default = UNSAFE_withComponentProps(function Dates({ loaderData }) {
	const { calendrier, palmares, lueLe } = loaderData;
	const maintenant = useMaintenant(lueLe);
	useRelectureApresInteraction(loaderData);
	const sections = calendrier ? sectionsDates(calendrier, palmares, maintenant) : [];
	const saison = sections.find((s) => s.type === "saison");
	const evenements = calendrier?.length ? evenementsDesDates(calendrier) : null;
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		evenements ? /* @__PURE__ */ jsx("script", {
			type: "application/ld+json",
			dangerouslySetInnerHTML: { __html: JSON.stringify(evenements).replaceAll("<", "\\u003c") }
		}) : null,
		/* @__PURE__ */ jsx(TitrePage, {
			surtitre: "Calendrier",
			titre: saison ? /* @__PURE__ */ jsxs(Fragment, { children: ["Dates ", /* @__PURE__ */ jsx("em", { children: saison.annee })] }) : "Dates",
			bas: sections.length > 1 ? /* @__PURE__ */ jsx(BarreAnnees, { sections }) : null,
			children: /* @__PURE__ */ jsx("p", { children: "Les soirées d’Olympiades dans le Gard, l’Hérault et les Bouches-du-Rhône, de la saison à venir aux années passées." })
		}),
		!calendrier ? /* @__PURE__ */ jsx("p", {
			className: "px-4 pt-6 text-encre-2 tablette:px-7 paysage:px-10 bureau:px-14",
			children: "Informations momentanément indisponibles. Réessayez dans un instant."
		}) : sections.length === 0 ? /* @__PURE__ */ jsx("p", {
			className: "px-4 pt-6 text-encre-2 tablette:px-7 paysage:px-10 bureau:px-14",
			children: "Les dates de la saison seront bientôt publiées."
		}) : sections.map((section, rang) => /* @__PURE__ */ jsx(SectionAnnee, {
			section,
			premiere: rang === 0
		}, section.id))
	] });
});
//#endregion
//#region app/routes/contact.tsx
var contact_exports = /* @__PURE__ */ __exportAll({
	default: () => contact_default,
	meta: () => meta$21
});
var meta$21 = () => [{ title: "Contact · Olympiade des Manades" }, {
	name: "description",
	content: "Infos, dates, une manade à inscrire, une photo à proposer : écrivez à l’organisation."
}];
var contact_default = UNSAFE_withComponentProps(function Contact() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TitrePage, {
		surtitre: "Infos & dates",
		titre: "Contact",
		children: /* @__PURE__ */ jsx("p", { children: "Infos, dates, une manade à inscrire, une photo à proposer\xA0: écrivez à l’organisation, elle vous répond." })
	}), /* @__PURE__ */ jsx("div", {
		className: "px-4 pt-5 tablette:px-7 paysage:px-10 bureau:px-14",
		children: /* @__PURE__ */ jsxs("section", {
			"aria-labelledby": "titre-formulaire",
			className: "max-w-[720px] rounded-[22px] border border-trait bg-creme p-5",
			children: [
				/* @__PURE__ */ jsx("h2", {
					id: "titre-formulaire",
					className: "font-display text-[21px] leading-[1.2] font-bold",
					children: "Écrire à l’organisation"
				}),
				/* @__PURE__ */ jsx(FormulaireContact, {}),
				/* @__PURE__ */ jsxs("p", {
					className: "mt-4 text-[12.5px] text-encre-2",
					children: [
						"Vos données (prénom, email, message) servent uniquement à vous répondre. Vous pouvez en demander l’effacement à tout moment. Détails et droits\xA0:",
						" ",
						/* @__PURE__ */ jsx(Link, {
							to: "/confidentialite",
							className: "underline underline-offset-2 hover:text-encre",
							children: "politique de confidentialité"
						}),
						"."
					]
				})
			]
		})
	})] });
});
//#endregion
//#region app/routes/mentions-legales.tsx
var mentions_legales_exports = /* @__PURE__ */ __exportAll({
	default: () => mentions_legales_default,
	meta: () => meta$20
});
var meta$20 = () => [{ title: "Mentions légales · Olympiade des Manades" }, {
	name: "description",
	content: "Éditeur, hébergeurs et crédits du site de l’Olympiade des Manades."
}];
var mentions_legales_default = UNSAFE_withComponentProps(function MentionsLegales() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TitrePage, {
		surtitre: "Informations",
		titre: "Mentions légales"
	}), /* @__PURE__ */ jsxs(CorpsLegal, { children: [
		/* @__PURE__ */ jsx(SectionLegale, {
			id: "editeur",
			titre: "Éditeur du site",
			children: /* @__PURE__ */ jsx(IdentitePublique, { repli: /* @__PURE__ */ jsx("p", { children: "Ces informations seront fournies par l’organisateur\xA0: nom ou raison sociale, forme juridique, siège ou adresse, téléphone, email, numéro d’immatriculation, capital le cas échéant, numéro de TVA, directeur de la publication." }) })
		}),
		/* @__PURE__ */ jsx(SectionLegale, {
			id: "hebergement",
			titre: "Hébergement",
			children: /* @__PURE__ */ jsxs("ul", { children: [/* @__PURE__ */ jsxs("li", { children: [
				/* @__PURE__ */ jsx("strong", { children: "Railway Corp." }),
				", 548 Market St PMB 68956, San Francisco, California 94104, États-Unis. Contact\xA0: privacy@railway.com, site",
				" ",
				/* @__PURE__ */ jsx("a", {
					href: "https://railway.com",
					target: "_blank",
					rel: "noopener noreferrer",
					className: LIEN_TEXTE,
					children: "railway.com"
				}),
				". Héberge le site. Aucun téléphone n’est publié par l’hébergeur."
			] }), /* @__PURE__ */ jsxs("li", { children: [
				/* @__PURE__ */ jsx("strong", { children: "Supabase" }),
				", exploité par Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513, et, pour certains contrats, par Supabase, Inc., 3500 S. DuPont Highway, Dover, Kent County, DE 19901, États-Unis. Contact\xA0: legal@supabase.io, site",
				" ",
				/* @__PURE__ */ jsx("a", {
					href: "https://supabase.com",
					target: "_blank",
					rel: "noopener noreferrer",
					className: LIEN_TEXTE,
					children: "supabase.com"
				}),
				". Héberge la base de données, dans l’Union européenne (Paris). Aucun téléphone n’est publié par l’hébergeur."
			] })] })
		}),
		/* @__PURE__ */ jsx(SectionLegale, {
			id: "conception",
			titre: "Conception et réalisation",
			children: /* @__PURE__ */ jsxs("p", { children: [
				"Site conçu et réalisé par",
				" ",
				/* @__PURE__ */ jsx("a", {
					href: "https://tpmge.com/#olympiade-des-manades",
					target: "_blank",
					rel: "noopener noreferrer",
					className: LIEN_TEXTE,
					children: "TPMGE"
				}),
				", en collaboration avec Atch Élevage, partenaire officiel de l’Olympiade des Manades."
			] })
		}),
		/* @__PURE__ */ jsxs(SectionLegale, {
			id: "credits",
			titre: "Crédits photos",
			children: [
				/* @__PURE__ */ jsx("p", { children: "Photographies sous licence libre, retouchées pour le site\xA0:" }),
				/* @__PURE__ */ jsx(CreditsPhotos, {}),
				/* @__PURE__ */ jsx("p", { children: "Les versions retouchées de ces photographies sont mises à disposition sous la même licence que l’original." })
			]
		}),
		/* @__PURE__ */ jsx(SectionLegale, {
			id: "propriete",
			titre: "Propriété intellectuelle",
			children: /* @__PURE__ */ jsx("p", { children: "Les textes, logos et éléments graphiques du site sont protégés (CPI L.111-1 et L.335-2). Toute reproduction sans autorisation est interdite, à l’exception des photographies sous licence libre mentionnées ci-dessus. L’usage du nom et du logo de l’Olympiade des Manades et de ceux d’Atch Élevage reste soumis à l’accord de leurs titulaires." })
		}),
		/* @__PURE__ */ jsx(SectionLegale, {
			id: "donnees",
			titre: "Données personnelles",
			children: /* @__PURE__ */ jsxs("p", { children: [
				"Le traitement des données est décrit dans la",
				" ",
				/* @__PURE__ */ jsx(Link, {
					to: "/confidentialite",
					className: LIEN_TEXTE,
					children: "politique de confidentialité"
				}),
				". Pour toute demande, utilisez le",
				" ",
				/* @__PURE__ */ jsx(Link, {
					to: "/contact",
					className: LIEN_TEXTE,
					children: "formulaire de contact"
				}),
				"."
			] })
		})
	] })] });
});
//#endregion
//#region app/routes/confidentialite.tsx
var confidentialite_exports = /* @__PURE__ */ __exportAll({
	default: () => confidentialite_default,
	meta: () => meta$19
});
var meta$19 = () => [{ title: "Confidentialité · Olympiade des Manades" }, {
	name: "description",
	content: "Données collectées, finalités, durée de conservation et droits RGPD."
}];
var LIEN_CONTACT = /* @__PURE__ */ jsx(Link, {
	to: "/contact",
	className: LIEN_TEXTE,
	children: "formulaire de contact"
});
var confidentialite_default = UNSAFE_withComponentProps(function Confidentialite() {
	const { afficherPreferences } = useConsentementCookies();
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TitrePage, {
		surtitre: "Vos données",
		titre: "Confidentialité"
	}), /* @__PURE__ */ jsxs(CorpsLegal, { children: [
		/* @__PURE__ */ jsx(SectionLegale, {
			id: "responsable",
			titre: "Responsable du traitement",
			children: /* @__PURE__ */ jsx(IdentitePublique, { repli: /* @__PURE__ */ jsx("p", { children: "L’identité et les coordonnées du responsable du traitement seront fournies par l’organisateur." }) })
		}),
		/* @__PURE__ */ jsx(SectionLegale, {
			id: "donnees",
			titre: "Données collectées",
			children: /* @__PURE__ */ jsxs("ul", { children: [
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Visiteurs du site" }), "\xA0: nos hébergeurs traitent des données techniques de connexion (adresse IP, date et heure, pages demandées, type de navigateur) pour assurer le fonctionnement et la sécurité du site. Le serveur conserve aussi des compteurs techniques agrégés (requêtes, erreurs, volume de données et temps de réponse), sans adresse IP ni historique individuel de navigation dans ces compteurs. Base légale\xA0: intérêt légitime à sécuriser le service (art. 6(1)(f) RGPD). Durée\xA0: celle fixée par chaque hébergeur pour ses journaux techniques."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Choix relatifs aux cookies" }), "\xA0: à chaque choix, nous enregistrons un identifiant pseudonyme du navigateur, l’adresse IP pseudonymisée, le type de navigateur, la page et la date, ainsi que les catégories acceptées. Ces données servent à prouver votre consentement (art. 7(1) et 6(1)(c) RGPD)."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Formulaire de contact" }), "\xA0: prénom, email, message et date d’envoi. Les trois champs du formulaire sont obligatoires pour que nous puissions vous répondre. Une vérification anti-robot protège le dépôt. Le serveur utilise temporairement l’adresse de connexion pour limiter les tentatives, sans l’enregistrer avec votre message."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Inscription au vote" }), "\xA0: prénom et email, puis un code reçu par email pour vous connecter."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Abonnement aux actualités" }), "\xA0: adresse email, date et texte du consentement, recueillis dans l’encart de l’accueil. La case d’accord est décochée par défaut. Cette inscription est indépendante du compte de vote et protégée par une vérification anti-robot."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Disponibilité du service" }), "\xA0: lorsque vous êtes connecté et que l’application est visible, un signal périodique met à jour la dernière activité de votre compte pour estimer le nombre de comptes actifs. Il ne contient ni la page visitée, ni l’adresse IP, ni le contenu de vos notes. Seuls les administrateurs peuvent consulter les statistiques agrégées."] })
			] })
		}),
		/* @__PURE__ */ jsxs(SectionLegale, {
			id: "finalites",
			titre: "Finalités et bases légales",
			children: [
				/* @__PURE__ */ jsxs("ul", { children: [/* @__PURE__ */ jsx("li", { children: "Répondre à votre message\xA0: intérêt légitime de l’organisation à répondre aux demandes qui lui sont adressées (art. 6(1)(f) RGPD)." }), /* @__PURE__ */ jsx("li", { children: "Donner accès au vote et envoyer les notifications liées à la soirée\xA0: votre consentement, recueilli par une case à cocher à l’inscription (art. 6(1)(a) RGPD). Vous pouvez le retirer à tout moment." })] }),
				/* @__PURE__ */ jsx("p", { children: "Aucune newsletter sans case dédiée, décochée par défaut." }),
				/* @__PURE__ */ jsxs("p", { children: [
					"Avec votre accord, l’organisation peut vous adresser les actualités, dates, informations pratiques, ouverture des votes, notations et résultats de l’Olympiade des Manades. Vous pouvez retirer cet accord via le ",
					LIEN_CONTACT,
					"."
				] }),
				/* @__PURE__ */ jsx("p", { children: "Aucune décision fondée exclusivement sur un traitement automatisé ne vous concerne." })
			]
		}),
		/* @__PURE__ */ jsx(SectionLegale, {
			id: "destinataires",
			titre: "Destinataires",
			children: /* @__PURE__ */ jsx("p", { children: "Vos données sont accessibles à l’organisateur et aux personnes habilitées à répondre, ainsi qu’à nos sous-traitants listés plus bas." })
		}),
		/* @__PURE__ */ jsx(SectionLegale, {
			id: "duree",
			titre: "Durée de conservation",
			children: /* @__PURE__ */ jsxs("ul", { children: [
				/* @__PURE__ */ jsx("li", { children: "Abonnement aux actualités\xA0: adresse et consentement conservés jusqu’à votre demande de retrait ou l’arrêt de la liste d’information." }),
				/* @__PURE__ */ jsx("li", { children: "Comptes spectateurs inactifs\xA0: supprimés après 24 mois d’inactivité." }),
				/* @__PURE__ */ jsx("li", { children: "Mesures techniques agrégées et derniers signaux d’activité\xA0: conservation de 30 jours." }),
				/* @__PURE__ */ jsx("li", { children: "Preuves de vos choix relatifs aux cookies\xA0: conservées 12 mois, puis supprimées." }),
				/* @__PURE__ */ jsx("li", { children: "Messages de contact\xA0: conservés le temps nécessaire pour vous répondre, puis supprimés. La durée exacte sera fixée avec l’organisateur." })
			] })
		}),
		/* @__PURE__ */ jsxs(SectionLegale, {
			id: "traceurs",
			titre: "Traceurs et stockage local",
			children: [
				/* @__PURE__ */ jsx("p", { children: "Les formulaires utilisent Cloudflare Turnstile pour la vérification anti-robot." }),
				/* @__PURE__ */ jsxs("p", { children: [
					/* @__PURE__ */ jsx("strong", { children: "Traceurs nécessaires" }),
					"\xA0: le cookie ",
					/* @__PURE__ */ jsx("code", { children: "cc_cookie" }),
					" conserve votre choix de consentement, au plus 13\xA0mois. Le cookie ",
					/* @__PURE__ */ jsx("code", { children: "olympiade_acces" }),
					" ouvre l’accès à la préversion du site. L’identifiant ",
					/* @__PURE__ */ jsx("code", { children: "cc_visitor_id" }),
					", conservé dans le stockage local, relie votre choix à sa preuve sans vous identifier."
				] }),
				/* @__PURE__ */ jsxs("p", { children: [
					/* @__PURE__ */ jsx("strong", { children: "Mesure d’audience" }),
					"\xA0: avec votre accord, des traceurs Google Analytics (",
					/* @__PURE__ */ jsx("code", { children: "_ga" }),
					", ",
					/* @__PURE__ */ jsx("code", { children: "_ga_*" }),
					", ",
					/* @__PURE__ */ jsx("code", { children: "_gid" }),
					") mesurent la fréquentation du site. Aucun cookie de mesure n’est déposé sans votre consentement explicite."
				] }),
				/* @__PURE__ */ jsxs("p", { children: [/* @__PURE__ */ jsx("strong", { children: "Publicité et réseaux sociaux" }), "\xA0: avec votre accord, des traceurs publicitaires (Meta Pixel, Google Ads) permettent de mesurer l’efficacité de nos campagnes. Aucun cookie publicitaire n’est déposé sans votre consentement explicite."] }),
				/* @__PURE__ */ jsxs("p", { children: [
					"Vous pouvez modifier votre choix à tout moment en cliquant sur «\xA0",
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: afficherPreferences,
						className: LIEN_TEXTE,
						children: "Gérer les cookies"
					}),
					"\xA0». Refuser est aussi simple qu’accepter et ne limite pas l’accès au site. À l’expiration de votre choix, il vous est demandé à nouveau."
				] }),
				/* @__PURE__ */ jsx("p", { children: "Lorsque vous vous inscrivez, une donnée de session est enregistrée dans votre navigateur pour vous reconnaître. Elle est strictement nécessaire au service, ne sert à aucun suivi et est supprimée à votre déconnexion." }),
				/* @__PURE__ */ jsx("p", { children: "Vos notes en attente d’envoi sont conservées sur cet appareil pour reprendre en cas de coupure, séparément pour chaque compte. Elles sont envoyées lorsque vous revenez sur le site avec le même compte et une connexion. Les confirmations locales sont conservées au plus 7 jours et les refus au plus 30 jours, avec nettoyage à l’utilisation. Les reçus serveur restent associés à votre compte pour éviter les doublons lors des reprises. Effacer les données du navigateur supprime les notes qui n’ont pas encore été reçues par le serveur." })
			]
		}),
		/* @__PURE__ */ jsxs(SectionLegale, {
			id: "soustraitants",
			titre: "Sous-traitants et transferts",
			children: [/* @__PURE__ */ jsxs("ul", { children: [
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Supabase" }), "\xA0: base de données (région de l’Union européenne, Paris) et, pour l’instant, envoi des emails de connexion."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Railway" }), "\xA0: hébergement du site."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Cloudflare Turnstile" }), "\xA0: vérification anti-robot des formulaires de connexion et de contact. Pour le contact, le serveur lui transmet le résultat de la vérification et l’adresse de connexion, sans le prénom, l’email ni le contenu du message."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Brevo" }), "\xA0: envoi des emails lorsque le SMTP est activé."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Anthropic" }), "\xA0: lecture du planning déposé par l’organisateur, seulement si une clé est configurée. Le fichier est traité pour préparer un brouillon et n’est pas conservé après la demande. Le tableau validé reste lié à la soirée."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Services de notification du navigateur" }), " (Apple, Google, Mozilla, Microsoft)\xA0: envoi des alertes de soirée si vous les acceptez. L’application Android, si elle est installée, utilise le même site. Elle n’est pas ouverte au public par défaut."] })
			] }), /* @__PURE__ */ jsxs("p", { children: [
				"Railway Corp. est établie aux États-Unis. Supabase est exploitée par Supabase Pte. Ltd. (Singapour) et Supabase, Inc. (États-Unis). La base de données est hébergée dans l’Union européenne (Paris) et le site est servi depuis l’Europe. Tout accès depuis un pays hors de l’Union européenne est encadré par les clauses contractuelles types de la Commission européenne, prévues dans l’accord de traitement des données de chaque prestataire (art. 28 et 46 RGPD). Une copie des garanties peut être demandée via le ",
				LIEN_CONTACT,
				"."
			] })]
		}),
		/* @__PURE__ */ jsxs(SectionLegale, {
			id: "droits",
			titre: "Vos droits",
			children: [
				/* @__PURE__ */ jsx("p", { children: "Vous disposez des droits d’accès, de rectification, d’effacement, d’opposition, de limitation et de portabilité de vos données, et du droit de retirer votre consentement à tout moment (vote et notifications). Vous pouvez aussi définir des directives sur le sort de vos données après votre décès (loi Informatique et Libertés, art. 85)." }),
				/* @__PURE__ */ jsxs("p", { children: [
					"Pour supprimer votre compte spectateur, ouvrez la page",
					" ",
					/* @__PURE__ */ jsx(Link, {
						to: "/compte",
						className: LIEN_TEXTE,
						children: "Supprimer mon compte"
					}),
					" ",
					"une fois connecté. Pour les autres droits, écrivez-nous via le ",
					LIEN_CONTACT,
					". Nous répondons dans un délai d’un mois (art. 12(3) RGPD). Une pièce d’identité n’est demandée qu’en cas de doute raisonnable sur votre identité."
				] }),
				/* @__PURE__ */ jsxs("p", { children: [
					"Vous pouvez introduire une réclamation auprès de la CNIL, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, ou en ligne\xA0:",
					" ",
					/* @__PURE__ */ jsx("a", {
						href: "https://www.cnil.fr/fr/plaintes",
						target: "_blank",
						rel: "noopener noreferrer",
						className: LIEN_TEXTE,
						children: "formulaire de plainte de la CNIL"
					}),
					"."
				] })
			]
		})
	] })] });
});
//#endregion
//#region app/routes/noter.tsx
var noter_exports = /* @__PURE__ */ __exportAll({
	clientLoader: () => clientLoader,
	default: () => noter_default,
	meta: () => meta$18
});
var meta$18 = () => [{ title: "Noter les manades · Olympiade des Manades" }, {
	name: "robots",
	content: "noindex"
}];
async function clientLoader() {
	return {
		calendrier: await lireOuRepli(() => lireCalendrier(AbortSignal.timeout(DELAI_LECTURE_NAVIGATEUR_MS))),
		lueLe: (/* @__PURE__ */ new Date()).toISOString()
	};
}
var LIEN = "font-semibold text-rouge underline underline-offset-2";
var noter_default = UNSAFE_withComponentProps(function Noter({ loaderData }) {
	const { calendrier, lueLe } = loaderData;
	const maintenant = useMaintenant(lueLe);
	const soiree = calendrier ? soireeDeReference(calendrier, maintenant) : null;
	const { session, prenom, chargement } = useSession();
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(TitrePage, {
		surtitre: "Notation du public",
		titre: session ? "Notez les manades" : "Les votes ouvriront le soir de l’Olympiade",
		children: [/* @__PURE__ */ jsxs("p", { children: [
			session ? `Bonjour${prenom ? ` ${prenom}` : ""}. ` : "",
			soiree ? `Les votes ouvriront ${momentSoiree(soiree)}. ` : "",
			session ? "Retrouvez les passages proposés et le suivi de vos notes ci-dessous." : "Le soir venu, vous donnerez une note de 1 à 10 à chaque manade, dès la fin de son passage."
		] }), /* @__PURE__ */ jsxs("p", {
			className: "mt-3 flex flex-wrap gap-x-5 gap-y-1",
			children: [
				!session && !chargement ? INSCRIPTION_OUVERTE ? /* @__PURE__ */ jsx(Link, {
					to: "/inscription",
					className: LIEN,
					children: "Inscrivez-vous dès maintenant, vous serez prêt le soir venu"
				}) : /* @__PURE__ */ jsx("span", {
					className: "font-semibold text-encre",
					children: TEXTE_INSCRIPTIONS_FERMEES
				}) : null,
				/* @__PURE__ */ jsx(Link, {
					to: "/dates",
					className: LIEN,
					children: "Voir les dates"
				}),
				session ? /* @__PURE__ */ jsx(Link, {
					to: "/compte",
					className: LIEN,
					children: "Supprimer mon compte"
				}) : null
			]
		})]
	}), session ? /* @__PURE__ */ jsx(NotationPublic, { compte: session.user.id }, session.user.id) : null] });
});
//#endregion
//#region app/composants/CadreInscription.tsx
var ETAPES = ["Prénom et email", "Code reçu"];
/**
* Mise en page des deux pages d'inscription (maquette : écran spect:inscription, bloc .ins) :
* photo des arènes en duotone, puis carte du formulaire qui la chevauche sur téléphone et tablette,
* côte à côte à partir de 1000 px. L'étape 3 de la maquette (notifications) viendra avec le lot 2.
*/
function CadreInscription({ etape, children }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "grid paysage:min-h-[640px] paysage:grid-cols-[1.05fr_1fr]",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "duo photo-arenes relative isolate flex min-h-[230px] flex-col justify-end gap-2.5 overflow-hidden px-5 pt-7 pb-11 text-white [--position:50%_40%] tablette:min-h-[380px] tablette:px-10 tablette:pt-14 tablette:pb-[90px] paysage:min-h-full paysage:justify-center paysage:px-14 paysage:py-14",
			children: [
				/* @__PURE__ */ jsx("div", {
					"aria-hidden": "true",
					className: "voile-inscription absolute inset-0 -z-10"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "text-[10.5px] leading-tight font-bold tracking-[0.2em] text-[#ffe2c2] uppercase",
					children: "Notation du public"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "font-brush text-[40px] leading-[.98] tablette:text-[58px] paysage:text-[76px]",
					children: "Le public note aussi"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "max-w-[34ch] text-[14px] leading-[1.45]",
					children: "Donnez votre note à chaque manade, de 1 à 10, depuis les gradins."
				}),
				/* @__PURE__ */ jsxs("ul", {
					className: "mt-2.5 hidden gap-2.5 text-[14px] paysage:grid",
					children: [
						/* @__PURE__ */ jsx(Point, {
							icone: "mail",
							children: "Un code par email, pas de mot de passe"
						}),
						/* @__PURE__ */ jsx(Point, {
							icone: "calendrier",
							children: "Inscription possible dès maintenant, avant la soirée"
						}),
						/* @__PURE__ */ jsx(Point, {
							icone: "trophee",
							children: "Votre voix compte pour le Prix du public"
						})
					]
				})
			]
		}), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 -mt-[22px] flex flex-col gap-[18px] rounded-t-[26px] bg-sable px-[18px] pt-[22px] pb-[18px] tablette:mx-10 tablette:-mt-10 tablette:mb-10 tablette:rounded-[28px] tablette:p-[30px] tablette:shadow-[0_30px_70px_-30px_rgba(60,30,10,.35)] paysage:m-0 paysage:w-full paysage:max-w-[620px] paysage:justify-center paysage:justify-self-center paysage:rounded-none paysage:px-16 paysage:py-14 paysage:shadow-none",
			children: [/* @__PURE__ */ jsx("ol", {
				"aria-label": "Étapes de l’inscription",
				className: "grid grid-cols-2 gap-2",
				children: ETAPES.map((libelle, index) => {
					const numero = index + 1;
					const etat = numero < etape ? "faite" : numero === etape ? "en-cours" : "a-venir";
					return /* @__PURE__ */ jsxs("li", {
						"aria-current": etat === "en-cours" ? "step" : void 0,
						className: `flex flex-col gap-[7px] text-[11.5px] leading-[1.25] font-semibold ${etat === "en-cours" ? "text-encre" : "text-encre-2"}`,
						children: [/* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							className: `block h-1 w-full rounded-sm ${etat === "faite" ? "bg-or" : etat === "en-cours" ? "bg-couchant-bouton" : "bg-trait"}`
						}), /* @__PURE__ */ jsxs("span", { children: [
							numero,
							". ",
							libelle,
							etat === "faite" ? /* @__PURE__ */ jsx("span", {
								className: "sr-only",
								children: " (faite)"
							}) : null
						] })]
					}, libelle);
				})
			}), children]
		})]
	});
}
function Point({ icone, children }) {
	return /* @__PURE__ */ jsxs("li", {
		className: "flex items-center gap-2.5",
		children: [/* @__PURE__ */ jsx("span", {
			className: "grid size-[30px] place-items-center rounded-full bg-white/18",
			children: /* @__PURE__ */ jsx(Icone, {
				nom: icone,
				className: "size-[18px]"
			})
		}), children]
	});
}
/** Titre et texte d'introduction d'une étape (maquette : .ins-card h3 et .lead). */
function TitreEtape({ titre, children }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "grid gap-1.5",
		children: [/* @__PURE__ */ jsx("h1", {
			className: "font-display text-[26px] leading-[1.12] font-bold tablette:text-[30px]",
			children: titre
		}), children ? /* @__PURE__ */ jsx("div", {
			className: "text-[14.5px] leading-normal text-encre-2",
			children
		}) : null]
	});
}
//#endregion
//#region app/composants/FormulaireInscription.tsx
var LIBELLE = "text-[12px] font-semibold text-encre-2";
var CHAMP = "min-h-12 w-full rounded-[13px] border border-[#958a77] bg-sable px-3.5 py-3 text-base text-encre aria-invalid:border-rouge";
var ERREUR = "flex items-start gap-1.5 text-[13px] leading-snug text-rouge";
/** Bouton principal en dégradé couchant (maquette : .btn-sun.btn-lg). */
var BOUTON_PRINCIPAL = "inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[17px] bg-couchant-bouton px-6 text-[16.5px] leading-none font-semibold text-white shadow-[0_10px_24px_-10px_rgba(194,59,29,0.75),inset_0_1px_0_rgba(255,255,255,0.25)] transition-[filter,transform] hover:brightness-105 active:scale-[0.97] disabled:cursor-wait disabled:opacity-70";
/**
* Étape 1 : prénom, email et consentement, puis envoi du code (supabase.auth.signInWithOtp).
*
* - Un seul envoi à la fois : verrou synchrone (repris d'un projet interne) et bouton
*   désactivé pendant l'envoi.
* - Même suite pour un email déjà inscrit : rien ne révèle qu'un compte existe.
* - La demande (prénom, email, heure d'envoi) passe à /inscription/code par l'onglet
*   (sessionStorage) et par l'état de navigation, si le stockage est refusé.
*/
function FormulaireInscription({ initial }) {
	const id = useId();
	const navigate = useNavigate();
	const [champs, setChamps] = useState({
		prenom: initial?.prenom ?? "",
		email: initial?.email ?? "",
		consentement: false
	});
	const [erreurs, setErreurs] = useState({});
	const [verifier, setVerifier] = useState(false);
	const [envoi, setEnvoi] = useState("repos");
	const [echec, setEchec] = useState(null);
	const [captchaToken, setCaptchaToken] = useState(null);
	const [reinitialisationCaptcha, setReinitialisationCaptcha] = useState(0);
	const verrou = useRef(false);
	function modifier(nom, valeur) {
		const suivant = {
			...champs,
			[nom]: valeur
		};
		setChamps(suivant);
		if (verifier) setErreurs(validerInscription(suivant));
	}
	async function soumettre(evenement) {
		evenement.preventDefault();
		if (verrou.current) return;
		const trouvees = validerInscription(champs);
		setVerifier(true);
		setErreurs(trouvees);
		if (Object.keys(trouvees).length > 0) {
			const premier = [
				"prenom",
				"email",
				"consentement"
			].find((nom) => trouvees[nom]);
			document.getElementById(`${id}-${premier}`)?.focus();
			return;
		}
		if (!captchaToken) {
			setEchec("Validez la vérification anti-robot avant de continuer.");
			return;
		}
		verrou.current = true;
		setEnvoi("en-cours");
		setEchec(null);
		const prenom = champs.prenom.trim();
		const email = normaliserEmail(champs.email);
		try {
			await demanderCode(prenom, email, captchaToken);
			const demande = {
				prenom,
				email,
				envoyeeLe: Date.now()
			};
			memoriserDemande(demande);
			navigate("/inscription/code", { state: demande });
		} catch (erreur) {
			setEchec(traduireErreurAuth(erreur, "demande"));
			setEnvoi("echec");
			verrou.current = false;
		} finally {
			setCaptchaToken(null);
			setReinitialisationCaptcha((valeur) => valeur + 1);
		}
	}
	const description = (nom, ...autres) => [erreurs[nom] ? `${id}-${nom}-erreur` : null, ...autres].filter(Boolean).join(" ") || void 0;
	const erreur = (nom) => erreurs[nom] ? /* @__PURE__ */ jsxs("p", {
		id: `${id}-${nom}-erreur`,
		className: ERREUR,
		children: [/* @__PURE__ */ jsx(Icone, {
			nom: "alerte",
			className: "mt-px size-4"
		}), erreurs[nom]]
	}) : null;
	const enCours = envoi === "en-cours";
	return /* @__PURE__ */ jsxs("form", {
		noValidate: true,
		onSubmit: soumettre,
		"aria-busy": enCours,
		className: "grid gap-[18px]",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "grid gap-1.5",
					children: [
						/* @__PURE__ */ jsx("label", {
							htmlFor: `${id}-prenom`,
							className: LIBELLE,
							children: "Prénom"
						}),
						/* @__PURE__ */ jsx("input", {
							id: `${id}-prenom`,
							name: "prenom",
							type: "text",
							autoComplete: "given-name",
							maxLength: 60,
							value: champs.prenom,
							onChange: (e) => modifier("prenom", e.target.value),
							"aria-invalid": erreurs.prenom ? true : void 0,
							"aria-describedby": description("prenom"),
							className: CHAMP
						}),
						erreur("prenom")
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "grid gap-1.5",
					children: [
						/* @__PURE__ */ jsx("label", {
							htmlFor: `${id}-email`,
							className: LIBELLE,
							children: "Email"
						}),
						/* @__PURE__ */ jsx("input", {
							id: `${id}-email`,
							name: "email",
							type: "email",
							inputMode: "email",
							autoComplete: "email",
							autoCapitalize: "none",
							spellCheck: false,
							maxLength: 254,
							value: champs.email,
							onChange: (e) => modifier("email", e.target.value),
							"aria-invalid": erreurs.email ? true : void 0,
							"aria-describedby": description("email"),
							className: CHAMP
						}),
						erreur("email")
					]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-[22px_1fr] gap-x-2.5 gap-y-1 text-[13px] leading-[1.45] text-encre-2",
				children: [
					/* @__PURE__ */ jsxs("span", {
						className: "relative mt-px grid size-[22px] place-items-center",
						children: [/* @__PURE__ */ jsx("input", {
							id: `${id}-consentement`,
							name: "consentement",
							type: "checkbox",
							checked: champs.consentement,
							onChange: (e) => modifier("consentement", e.target.checked),
							"aria-invalid": erreurs.consentement ? true : void 0,
							"aria-describedby": description("consentement", `${id}-usage`),
							className: "peer size-[22px] cursor-pointer appearance-none rounded-[7px] border-[1.5px] border-[#958a77] bg-creme checked:border-encre checked:bg-encre aria-invalid:border-rouge"
						}), /* @__PURE__ */ jsx(Icone, {
							nom: "valide",
							className: "pointer-events-none absolute size-[15px] text-sable opacity-0 peer-checked:opacity-100"
						})]
					}),
					/* @__PURE__ */ jsxs("label", {
						htmlFor: `${id}-consentement`,
						className: "cursor-pointer",
						children: [
							"J’accepte la",
							" ",
							/* @__PURE__ */ jsxs(Link, {
								to: "/confidentialite",
								target: "_blank",
								rel: "noopener",
								className: "font-semibold text-rouge underline underline-offset-2",
								children: ["politique de confidentialité", /* @__PURE__ */ jsx("span", {
									className: "sr-only",
									children: " (nouvel onglet)"
								})]
							})
						]
					}),
					/* @__PURE__ */ jsx("p", {
						id: `${id}-usage`,
						className: "col-start-2",
						children: "Votre prénom et votre email servent uniquement à l’inscription et au vote du public."
					}),
					/* @__PURE__ */ jsx("div", {
						className: "col-start-2",
						children: erreur("consentement")
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-2.5",
				children: [
					/* @__PURE__ */ jsx(VerificationHumaine, {
						action: "inscription",
						reinitialisation: reinitialisationCaptcha,
						onJetonChange: setCaptchaToken
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "submit",
						disabled: enCours,
						className: BOUTON_PRINCIPAL,
						children: ["Recevoir mon code", /* @__PURE__ */ jsx(Icone, { nom: "fleche" })]
					}),
					/* @__PURE__ */ jsx("div", {
						role: "status",
						className: "sr-only",
						children: enCours ? "Envoi du code…" : ""
					}),
					/* @__PURE__ */ jsx("div", {
						role: "alert",
						children: echec ? /* @__PURE__ */ jsxs("p", {
							className: "flex items-start gap-2 rounded-[13px] bg-[rgba(194,59,29,.08)] px-3.5 py-3 text-[14px] font-semibold text-rouge-alerte",
							children: [/* @__PURE__ */ jsx(Icone, {
								nom: "alerte",
								className: "mt-0.5 size-[18px]"
							}), echec]
						}) : null
					})
				]
			})
		]
	});
}
//#endregion
//#region app/routes/inscription.tsx
var inscription_exports = /* @__PURE__ */ __exportAll({
	default: () => inscription_default,
	meta: () => meta$17
});
var meta$17 = () => [
	{ title: "Inscription · Olympiade des Manades" },
	{
		name: "description",
		content: "Inscrivez-vous en 30 secondes pour noter les manades : prénom, email, puis un code à 6 chiffres reçu par email."
	},
	{
		name: "robots",
		content: "noindex"
	}
];
var inscription_default = UNSAFE_withComponentProps(function Inscription() {
	const { session } = useSession();
	const [precedente] = useState(demandeEnCours);
	if (session) return /* @__PURE__ */ jsx(Navigate, {
		to: "/noter",
		replace: true
	});
	return /* @__PURE__ */ jsxs(CadreInscription, {
		etape: 1,
		children: [/* @__PURE__ */ jsx(TitreEtape, {
			titre: "Le soir venu, vous notez aussi",
			children: /* @__PURE__ */ jsx("p", { children: "Votre prénom et votre email suffisent. Pas de mot de passe." })
		}), /* @__PURE__ */ jsx(FormulaireInscription, { initial: precedente })]
	});
});
//#endregion
//#region app/lib/useOtpCooldown.ts
var OTP_COOLDOWN_SECONDS = 60;
/**
* Délai de 60 s entre deux envois de code (« Renvoyer le code »). Supabase refuse de toute façon
* un nouvel envoi avant 60 s (auth.email.max_frequency).
*/
function useOtpCooldown() {
	const [cooldownSeconds, setCooldownSeconds] = useState(0);
	const timerRef = useRef(null);
	const actif = cooldownSeconds > 0;
	useEffect(() => {
		if (actif) timerRef.current = setInterval(() => {
			setCooldownSeconds((prev) => {
				if (prev <= 1) {
					if (timerRef.current) clearInterval(timerRef.current);
					return 0;
				}
				return prev - 1;
			});
		}, 1e3);
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [actif]);
	const startCooldown = useCallback((secondes = OTP_COOLDOWN_SECONDS) => {
		setCooldownSeconds(Math.max(0, Math.min(OTP_COOLDOWN_SECONDS, Math.ceil(secondes))));
	}, []);
	const resetCooldown = useCallback(() => {
		setCooldownSeconds(0);
		if (timerRef.current) clearInterval(timerRef.current);
	}, []);
	return {
		cooldownSeconds,
		isOnCooldown: cooldownSeconds > 0,
		startCooldown,
		resetCooldown
	};
}
/** Secondes restantes avant de pouvoir renvoyer un code envoyé à `envoyeeLe` (ms). */
function delaiRestant(envoyeeLe, maintenant = Date.now()) {
	return Math.max(0, OTP_COOLDOWN_SECONDS - Math.floor((maintenant - envoyeeLe) / 1e3));
}
//#endregion
//#region app/composants/SaisieCode.tsx
var LONGUEUR = 6;
/** Ne garde que les chiffres (une lettre tapée au clavier d'ordinateur est ignorée). */
var chiffres = (texte) => texte.replace(/[^0-9]/g, "").slice(0, LONGUEUR);
function SaisieCode({ id, valeur, onChange, invalide = false, description }) {
	const champ = useRef(null);
	const changer = useRef(onChange);
	useEffect(() => {
		changer.current = onChange;
	}, [onChange]);
	useEffect(() => {
		const input = champ.current;
		if (!input) return;
		const remplacer = (texte, evenement) => {
			const code = texte ? normaliserCode(texte) : null;
			if (!code) return;
			evenement.preventDefault();
			evenement.stopPropagation();
			changer.current(code);
		};
		const avantSaisie = (evenement) => {
			if (evenement.data && evenement.data.length > 1) remplacer(evenement.data, evenement);
		};
		const coller = (evenement) => remplacer(evenement.clipboardData?.getData("text/plain"), evenement);
		input.addEventListener("beforeinput", avantSaisie);
		input.addEventListener("paste", coller);
		return () => {
			input.removeEventListener("beforeinput", avantSaisie);
			input.removeEventListener("paste", coller);
		};
	}, []);
	return /* @__PURE__ */ jsx(OTPInput, {
		ref: champ,
		id,
		name: "code",
		value: valeur,
		onChange: (texte) => onChange(chiffres(texte)),
		maxLength: LONGUEUR,
		pattern: "[0-9]*",
		inputMode: "numeric",
		autoComplete: "one-time-code",
		pasteTransformer: chiffres,
		noScriptCSSFallback: null,
		"aria-invalid": invalide || void 0,
		"aria-describedby": description,
		containerClassName: "w-full max-w-[440px]",
		children: /* @__PURE__ */ jsx("div", {
			"aria-hidden": "true",
			className: "grid grid-cols-6 gap-2",
			children: Array.from({ length: LONGUEUR }, (_, index) => /* @__PURE__ */ jsx(Case, {
				index,
				invalide
			}, index))
		})
	});
}
function Case({ index, invalide }) {
	const { char, hasFakeCaret, isActive } = useContext(OTPInputContext).slots[index];
	return /* @__PURE__ */ jsxs("div", {
		className: `relative grid aspect-[.84] place-items-center rounded-[15px] border-[1.5px] bg-creme font-display text-[30px] leading-none font-semibold text-encre lining-nums tabular-nums transition-[border-color,box-shadow] ${invalide || isActive ? "border-rouge" : char ? "border-or-ink" : "border-[#958a77]"} ${isActive ? "shadow-[0_0_0_4px_rgba(236,116,51,.16)]" : ""}`,
		children: [char, hasFakeCaret ? /* @__PURE__ */ jsx("div", {
			className: "pointer-events-none absolute inset-0 grid place-items-center",
			children: /* @__PURE__ */ jsx("div", { className: "h-[30px] w-0.5 animate-caret-blink bg-orange" })
		}) : null]
	});
}
//#endregion
//#region app/composants/FormulaireCode.tsx
var CODE_INCOMPLET = "Saisissez les 6 chiffres du code reçu par email.";
/**
* Étape 2 : saisie du code reçu, « Renvoyer le code » après 60 s, « Changer d'email ».
*
* - Pas de vérification automatique à 6 chiffres (le projet d'origine la faisait) : le parcours du
*   plan valide par le bouton « Valider », ou la touche Entrée.
* - Verrou synchrone sur la vérification et sur le renvoi : un double clic ne part qu'une fois.
* - Code refusé : message, saisie vidée et remise au focus, pour réessayer tout de suite. La
*   saisie n'est donc jamais désactivée (un champ désactivé ne peut pas reprendre le focus).
*/
function FormulaireCode({ demande }) {
	const id = useId();
	const navigate = useNavigate();
	const [code, setCode] = useState("");
	const [etat, setEtat] = useState("repos");
	const [erreur, setErreur] = useState(null);
	const [info, setInfo] = useState(null);
	const [captchaToken, setCaptchaToken] = useState(null);
	const [reinitialisationCaptcha, setReinitialisationCaptcha] = useState(0);
	const verrou = useRef(false);
	const { cooldownSeconds, isOnCooldown, startCooldown } = useOtpCooldown();
	useEffect(() => {
		startCooldown(delaiRestant(demande.envoyeeLe));
	}, [demande.envoyeeLe, startCooldown]);
	const champ = `${id}-code`;
	const focaliser = () => document.getElementById(champ)?.focus();
	async function valider(evenement) {
		evenement.preventDefault();
		if (verrou.current) return;
		const saisi = normaliserCode(code);
		if (!saisi) {
			setErreur(CODE_INCOMPLET);
			setInfo(null);
			focaliser();
			return;
		}
		verrou.current = true;
		setEtat("verification");
		setErreur(null);
		setInfo(null);
		try {
			await verifierCode(demande.email, saisi);
			oublierDemande();
			navigate("/noter", { replace: true });
		} catch (echec) {
			setErreur(traduireErreurAuth(echec, "verification"));
			setCode("");
			setEtat("repos");
			verrou.current = false;
			focaliser();
		}
	}
	async function renvoyer() {
		if (verrou.current || isOnCooldown) return;
		if (!captchaToken) {
			setErreur("Validez la vérification anti-robot avant de renvoyer un code.");
			return;
		}
		verrou.current = true;
		setEtat("renvoi");
		setErreur(null);
		setInfo(null);
		try {
			await demanderCode(demande.prenom, demande.email, captchaToken);
			memoriserDemande({
				...demande,
				envoyeeLe: Date.now()
			});
			startCooldown();
			setInfo(`Un nouveau code a été envoyé à ${demande.email}.`);
		} catch (echec) {
			setErreur(traduireErreurAuth(echec, "demande"));
		} finally {
			setEtat("repos");
			verrou.current = false;
			setCaptchaToken(null);
			setReinitialisationCaptcha((valeur) => valeur + 1);
		}
	}
	const occupe = etat !== "repos";
	return /* @__PURE__ */ jsxs("form", {
		noValidate: true,
		onSubmit: valider,
		"aria-busy": occupe,
		className: "grid gap-[18px]",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-2",
				children: [
					/* @__PURE__ */ jsx("label", {
						htmlFor: champ,
						className: "text-[12px] font-semibold text-encre-2",
						children: "Code à 6 chiffres"
					}),
					/* @__PURE__ */ jsx(SaisieCode, {
						id: champ,
						valeur: code,
						onChange: (valeur) => {
							setCode(valeur);
							if (erreur === CODE_INCOMPLET) setErreur(null);
						},
						invalide: erreur !== null,
						description: `${id}-aide${erreur ? ` ${id}-erreur` : ""}`
					}),
					/* @__PURE__ */ jsx("p", {
						id: `${id}-aide`,
						className: "text-[12.5px] text-encre-2",
						children: "Vous pouvez coller le code reçu, même avec des espaces."
					}),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
						role: "alert",
						id: `${id}-erreur`,
						children: erreur ? /* @__PURE__ */ jsxs("p", {
							className: "mt-1 flex items-start gap-2 rounded-[13px] bg-[rgba(194,59,29,.08)] px-3.5 py-3 text-[14px] font-semibold text-rouge-alerte",
							children: [/* @__PURE__ */ jsx(Icone, {
								nom: "alerte",
								className: "mt-0.5 size-[18px]"
							}), erreur]
						}) : null
					}), /* @__PURE__ */ jsxs("div", {
						role: "status",
						children: [
							info ? /* @__PURE__ */ jsxs("p", {
								className: "mt-1 flex items-start gap-2 rounded-[13px] bg-[rgba(47,122,79,.1)] px-3.5 py-3 text-[14px] font-semibold text-[#286b44]",
								children: [/* @__PURE__ */ jsx(Icone, {
									nom: "valide",
									className: "mt-0.5 size-[18px]"
								}), info]
							}) : null,
							etat === "verification" ? /* @__PURE__ */ jsx("span", {
								className: "sr-only",
								children: "Vérification du code…"
							}) : null,
							etat === "renvoi" ? /* @__PURE__ */ jsx("span", {
								className: "sr-only",
								children: "Envoi d’un nouveau code…"
							}) : null
						]
					})] })
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-0.5 text-[12.5px] leading-snug",
				children: [
					/* @__PURE__ */ jsx(VerificationHumaine, {
						action: "renvoi-code",
						reinitialisation: reinitialisationCaptcha,
						onJetonChange: setCaptchaToken,
						classe: "mb-2"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center justify-between gap-x-2.5",
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: renvoyer,
							disabled: isOnCooldown || occupe,
							className: "inline-flex min-h-12 items-center font-semibold text-rouge underline underline-offset-2 disabled:cursor-not-allowed disabled:font-medium disabled:text-encre-2 disabled:no-underline",
							children: isOnCooldown ? `Renvoyer le code dans ${formaterDecompte(cooldownSeconds)}` : "Renvoyer le code"
						}), /* @__PURE__ */ jsx(Link, {
							to: "/inscription",
							className: "inline-flex min-h-12 items-center font-semibold text-rouge underline underline-offset-2",
							children: "Changer d’email"
						})]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-encre-2",
						children: "Le lien de connexion du même email marche aussi."
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-2.5",
				children: [/* @__PURE__ */ jsxs("button", {
					type: "submit",
					disabled: occupe,
					className: BOUTON_PRINCIPAL,
					children: ["Valider", /* @__PURE__ */ jsx(Icone, { nom: "fleche" })]
				}), /* @__PURE__ */ jsxs("p", {
					className: "flex items-center gap-2 text-[12px] text-encre-2",
					children: [/* @__PURE__ */ jsx(Icone, {
						nom: "cadenas",
						className: "size-[15px]"
					}), "Vous restez connecté sur cet appareil, sans mot de passe."]
				})]
			})
		]
	});
}
//#endregion
//#region app/routes/inscription-code.tsx
var inscription_code_exports = /* @__PURE__ */ __exportAll({
	default: () => inscription_code_default,
	meta: () => meta$16
});
var meta$16 = () => [{ title: "Code reçu · Olympiade des Manades" }, {
	name: "robots",
	content: "noindex"
}];
/** Paramètres d'une adresse (« ?a=1 » ou « #a=1 »). */
function parametres(texte) {
	return new URLSearchParams(texte.replace(/^[?#]/, ""));
}
/**
* Étape 2 de l'inscription. On y arrive :
* - depuis /inscription, avec la demande en cours (état de navigation ou stockage de l'onglet) ;
* - par le lien de secours de l'email : supabase-js échange le « code » de l'adresse (PKCE) contre
*   une session, puis la page mène à /noter. Supabase renvoie ici aussi un lien expiré, avec
*   « error_code » dans l'adresse.
*/
var inscription_code_default = UNSAFE_withComponentProps(function InscriptionCode() {
	const { session, chargement } = useSession();
	const { state, search, hash } = useLocation();
	const [demande] = useState(() => demandeValide(state) ?? demandeEnCours());
	const [adresse] = useState(() => {
		const requete = parametres(search);
		return {
			lienExpire: [requete, parametres(hash)].some((p) => p.has("error_code") || p.has("error_description")),
			echangeEnCours: requete.has("code")
		};
	});
	if (session) return /* @__PURE__ */ jsx(Navigate, {
		to: "/noter",
		replace: true
	});
	return /* @__PURE__ */ jsxs(CadreInscription, {
		etape: 2,
		children: [
			/* @__PURE__ */ jsx(TitreEtape, {
				titre: "Entrez le code reçu",
				children: demande ? /* @__PURE__ */ jsxs("p", { children: [
					"Nous avons envoyé un code à 6 chiffres à ",
					/* @__PURE__ */ jsx("b", {
						className: "font-semibold text-encre [overflow-wrap:anywhere]",
						children: demande.email
					}),
					". Il est valable 1 heure."
				] }) : null
			}),
			adresse.lienExpire ? /* @__PURE__ */ jsxs("p", {
				role: "alert",
				className: "flex items-start gap-2 rounded-[13px] bg-[rgba(194,59,29,.08)] px-3.5 py-3 text-[14px] font-semibold text-rouge-alerte",
				children: [/* @__PURE__ */ jsx(Icone, {
					nom: "alerte",
					className: "mt-0.5 size-[18px]"
				}), /* @__PURE__ */ jsx("span", { children: "Ce lien de connexion n’est plus valable. Saisissez le code à 6 chiffres reçu dans le même email, ou demandez un nouveau code." })]
			}) : null,
			adresse.echangeEnCours && chargement ? /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "text-encre-2",
				children: "Connexion en cours…"
			}) : demande ? /* @__PURE__ */ jsx(FormulaireCode, { demande }) : /* @__PURE__ */ jsxs("div", {
				className: "grid gap-3 text-encre-2",
				children: [
					/* @__PURE__ */ jsx("p", { children: "Aucune demande de code en cours sur cet appareil." }),
					/* @__PURE__ */ jsx("p", { children: "Le lien de connexion de l’email s’ouvre dans le navigateur où le code a été demandé. Ailleurs, demandez un nouveau code\xA0: il arrive en quelques instants." }),
					/* @__PURE__ */ jsxs(Link, {
						to: "/inscription",
						className: "inline-flex min-h-12 items-center gap-1.5 self-start font-semibold text-rouge underline underline-offset-2",
						children: ["Recevoir un code", /* @__PURE__ */ jsx(Icone, {
							nom: "fleche",
							className: "size-4"
						})]
					})
				]
			})
		]
	});
});
//#endregion
//#region app/routes/admin.tsx
var admin_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_default,
	meta: () => meta$15
});
var meta$15 = () => [{ title: "Administration · Olympiade des Manades" }, {
	name: "robots",
	content: "noindex"
}];
var admin_default = UNSAFE_withComponentProps(function Admin() {
	const { acces, facteurId, session } = useAccesAdmin();
	const [erreur, setErreur] = useState(null);
	const [enCours, setEnCours] = useState(false);
	const [captchaToken, setCaptchaToken] = useState(null);
	const [reinitialisationCaptcha, setReinitialisationCaptcha] = useState(0);
	const [enrolement, setEnrolement] = useState(null);
	useEffect(() => {
		setEnrolement(null);
		setErreur(null);
	}, [session?.user.id]);
	async function connecter(evenement) {
		evenement.preventDefault();
		if (enCours) return;
		const champs = new FormData(evenement.currentTarget);
		setEnCours(true);
		setErreur(null);
		try {
			if (!captchaToken) throw new Error(MESSAGES_AUTH.verificationHumaine);
			await connecterAdmin(String(champs.get("email") ?? ""), String(champs.get("mot-de-passe") ?? ""), captchaToken);
		} catch (echec) {
			const statut = typeof echec === "object" && echec !== null && "status" in echec ? echec.status : void 0;
			const message = echec instanceof Error ? echec.message : "";
			setErreur(message === MESSAGES_AUTH.verificationHumaine ? message : statut === 429 ? "Trop de tentatives. Réessayez dans quelques minutes." : "Connexion refusée. Vérifiez vos identifiants et votre réseau.");
		} finally {
			setEnCours(false);
			setCaptchaToken(null);
			setReinitialisationCaptcha((valeur) => valeur + 1);
		}
	}
	async function preparerTotp() {
		if (enCours) return;
		setEnCours(true);
		setErreur(null);
		try {
			setEnrolement(await commencerEnrolementTotp());
		} catch {
			setErreur("Impossible de préparer l’authentification à deux facteurs. Réessayez.");
		} finally {
			setEnCours(false);
		}
	}
	async function confirmerTotp(evenement) {
		evenement.preventDefault();
		if (enCours) return;
		const champs = new FormData(evenement.currentTarget);
		const id = enrolement?.facteurId ?? facteurId;
		if (!id) return;
		setEnCours(true);
		setErreur(null);
		try {
			await verifierTotp(id, String(champs.get("code-totp") ?? ""));
			setEnrolement(null);
		} catch {
			setErreur("Code incorrect ou expiré. Vérifiez l’heure de votre appareil puis réessayez.");
		} finally {
			setEnCours(false);
		}
	}
	const formulaireTotp = (id) => /* @__PURE__ */ jsxs("form", {
		onSubmit: confirmerTotp,
		className: "grid max-w-md gap-5 rounded-[22px] border border-trait bg-creme p-6",
		children: [
			/* @__PURE__ */ jsxs("label", {
				className: "grid gap-2 font-medium",
				children: ["Code de l’application d’authentification", /* @__PURE__ */ jsx("input", {
					name: "code-totp",
					inputMode: "numeric",
					autoComplete: "one-time-code",
					required: true,
					minLength: 6,
					maxLength: 6,
					pattern: "[0-9]{6}",
					className: "min-h-12 w-full rounded-xl border border-trait bg-sable px-3"
				})]
			}),
			/* @__PURE__ */ jsx("button", {
				disabled: enCours || !id,
				className: "min-h-12 rounded-xl bg-encre px-5 font-semibold text-sable disabled:opacity-60",
				children: enCours ? "Vérification…" : "Vérifier le second facteur"
			}),
			erreur ? /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "text-rouge-alerte",
				children: erreur
			}) : null
		]
	});
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TitrePage, {
		surtitre: "Espace organisateur",
		titre: "Administration",
		children: /* @__PURE__ */ jsx("p", { children: "Connectez-vous avec votre compte administrateur pour préparer une soirée, la piloter, puis suivre l’activité du service." })
	}), /* @__PURE__ */ jsx("div", {
		className: "px-4 tablette:px-7 paysage:px-10 bureau:px-14",
		children: acces === "chargement" ? /* @__PURE__ */ jsx("p", {
			role: "status",
			children: "Vérification de l’accès…"
		}) : acces === "autorise" ? /* @__PURE__ */ jsxs("nav", {
			className: "grid max-w-md gap-3",
			"aria-label": "Espaces d’administration",
			children: [
				/* @__PURE__ */ jsx(Link, {
					to: "/admin/soirees",
					className: "inline-flex min-h-12 items-center rounded-xl border border-trait px-5 font-semibold",
					children: "Mes soirées"
				}),
				/* @__PURE__ */ jsx(Link, {
					to: "/admin/participants",
					className: "inline-flex min-h-12 items-center rounded-xl border border-trait px-5 font-semibold",
					children: "Participants"
				}),
				/* @__PURE__ */ jsx(Link, {
					to: "/admin/juges",
					className: "inline-flex min-h-12 items-center rounded-xl border border-trait px-5 font-semibold",
					children: "Juges"
				}),
				/* @__PURE__ */ jsx(Link, {
					to: "/admin/messages",
					className: "inline-flex min-h-12 items-center rounded-xl border border-trait px-5 font-semibold",
					children: "Messages de contact"
				}),
				/* @__PURE__ */ jsx(Link, {
					to: "/admin/abonnes",
					className: "inline-flex min-h-12 items-center rounded-xl border border-trait px-5 font-semibold",
					children: "Abonnés aux actualités"
				}),
				/* @__PURE__ */ jsx(Link, {
					to: "/admin/statistiques",
					className: "inline-flex min-h-12 items-center rounded-xl bg-encre px-5 font-semibold text-sable",
					children: "Statistiques et charge →"
				})
			]
		}) : acces === "deux-facteurs-requis" && facteurId ? /* @__PURE__ */ jsxs("div", {
			className: "grid gap-4",
			children: [/* @__PURE__ */ jsx("p", { children: "Entrez le code à 6 chiffres de votre application d’authentification." }), formulaireTotp(facteurId)]
		}) : acces === "enrolement-requis" ? /* @__PURE__ */ jsxs("div", {
			className: "grid max-w-md gap-5 rounded-[22px] border border-trait bg-creme p-6",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "grid gap-2",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "text-xl font-semibold",
						children: "Activer le second facteur"
					}), /* @__PURE__ */ jsx("p", { children: "Les fonctions d’administration restent verrouillées tant qu’un code TOTP n’a pas été configuré et vérifié." })]
				}),
				!enrolement ? /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: preparerTotp,
					disabled: enCours,
					className: "min-h-12 rounded-xl bg-encre px-5 font-semibold text-sable disabled:opacity-60",
					children: enCours ? "Préparation…" : "Configurer mon application"
				}) : /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsx("img", {
						src: enrolement.qrCode,
						alt: "QR code à scanner dans l’application d’authentification",
						className: "size-52 max-w-full rounded-lg bg-white p-2"
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "text-sm",
						children: ["Si vous ne pouvez pas scanner le QR code, saisissez cette clé\xA0: ", /* @__PURE__ */ jsx("code", {
							className: "break-all font-mono",
							children: enrolement.secret
						})]
					}),
					formulaireTotp(enrolement.facteurId)
				] }),
				erreur && !enrolement ? /* @__PURE__ */ jsx("p", {
					role: "alert",
					className: "text-rouge-alerte",
					children: erreur
				}) : null
			]
		}) : acces === "refuse" ? /* @__PURE__ */ jsx("p", {
			role: "alert",
			children: "Ce compte n’a pas accès à l’administration. Déconnectez-vous pour utiliser un autre compte."
		}) : acces === "erreur" ? /* @__PURE__ */ jsx("p", {
			role: "alert",
			children: "Impossible de vérifier vos droits. Rechargez la page pour réessayer."
		}) : /* @__PURE__ */ jsxs("form", {
			onSubmit: connecter,
			className: "grid max-w-md gap-5 rounded-[22px] border border-trait bg-creme p-6",
			children: [
				/* @__PURE__ */ jsxs("label", {
					className: "grid gap-2 font-medium",
					children: ["Email administrateur", /* @__PURE__ */ jsx("input", {
						name: "email",
						type: "email",
						autoComplete: "username",
						required: true,
						maxLength: 254,
						className: "min-h-12 w-full rounded-xl border border-trait bg-sable px-3"
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "grid gap-2 font-medium",
					children: ["Mot de passe", /* @__PURE__ */ jsx("input", {
						name: "mot-de-passe",
						type: "password",
						autoComplete: "current-password",
						required: true,
						className: "min-h-12 w-full rounded-xl border border-trait bg-sable px-3"
					})]
				}),
				/* @__PURE__ */ jsx(VerificationHumaine, {
					action: "admin-connexion",
					reinitialisation: reinitialisationCaptcha,
					onJetonChange: setCaptchaToken
				}),
				/* @__PURE__ */ jsx("button", {
					disabled: enCours,
					className: "min-h-12 rounded-xl bg-encre px-5 font-semibold text-sable disabled:opacity-60",
					children: enCours ? "Connexion…" : "Se connecter"
				}),
				erreur ? /* @__PURE__ */ jsx("p", {
					role: "alert",
					className: "text-rouge-alerte",
					children: erreur
				}) : null,
				/* @__PURE__ */ jsx("p", {
					className: "text-sm text-encre-2",
					children: "L’accès est réservé aux comptes habilités par l’organisateur."
				})
			]
		})
	})] });
});
//#endregion
//#region app/routes/admin-statistiques.tsx
var admin_statistiques_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_statistiques_default,
	meta: () => meta$14
});
var meta$14 = () => [{ title: "Statistiques et charge · Administration" }, {
	name: "robots",
	content: "noindex"
}];
var CARTE = "rounded-[22px] border border-trait bg-creme p-5 tablette:p-6";
var BOUTON = "inline-flex min-h-12 items-center justify-center rounded-xl border border-trait px-4 text-sm font-semibold disabled:opacity-50";
var heure = (iso) => new Date(iso).toLocaleTimeString("fr-FR", {
	hour: "2-digit",
	minute: "2-digit"
});
var admin_statistiques_default = UNSAFE_withComponentProps(function Statistiques() {
	const { acces, session } = useAccesAdmin();
	const jeton = session?.access_token;
	const [heures, setHeures] = useState(1);
	const [courbe, setCourbe] = useState("requests");
	const [essai, setEssai] = useState(0);
	const [etat, setEtat] = useState({
		heures: 1,
		donnees: null,
		erreur: null,
		enCours: false
	});
	useEffect(() => {
		if (acces !== "autorise" || !jeton) return;
		let arrete = false;
		let enCours = false;
		let refuse = false;
		let timer;
		const controle = new AbortController();
		async function lire() {
			if (arrete || enCours || refuse) return;
			if (document.visibilityState !== "visible") {
				timer = setTimeout(() => void lire(), 3e4);
				return;
			}
			enCours = true;
			setEtat((avant) => ({
				jeton,
				heures,
				donnees: avant.jeton === jeton && avant.heures === heures ? avant.donnees : null,
				erreur: null,
				enCours: true
			}));
			try {
				const reponse = await fetch(`/api/admin/supervision?heures=${heures}`, {
					headers: { Authorization: `Bearer ${jeton}` },
					cache: "no-store",
					signal: AbortSignal.any([controle.signal, AbortSignal.timeout(1e4)])
				});
				if (!reponse.ok) {
					refuse = reponse.status === 401 || reponse.status === 403;
					throw new Error(refuse ? "L’accès a expiré ou ce compte n’est plus administrateur. Reconnectez-vous." : reponse.status === 429 ? "Actualisations trop rapprochées. Nouvelle tentative dans 30 secondes." : "La supervision est indisponible. Vérifiez la configuration du service et réessayez.");
				}
				const donnees = await reponse.json();
				if (!donnees.server || !donnees.database || !donnees.activeUsers || !Array.isArray(donnees.server.history)) throw new Error("Réponse de supervision incomplète.");
				if (!arrete) setEtat({
					jeton,
					heures,
					donnees,
					erreur: null,
					enCours: false
				});
			} catch (echec) {
				if (!arrete) setEtat((avant) => ({
					jeton,
					heures,
					donnees: refuse ? null : avant.donnees,
					erreur: echec instanceof Error && echec.name === "Error" ? echec.message : "Mesures non actualisées. Vérifiez la connexion.",
					enCours: false
				}));
			} finally {
				enCours = false;
				if (!arrete && !refuse) timer = setTimeout(() => void lire(), 3e4);
			}
		}
		function reprendre() {
			if (document.visibilityState !== "visible" || enCours) return;
			clearTimeout(timer);
			lire();
		}
		lire();
		document.addEventListener("visibilitychange", reprendre);
		return () => {
			arrete = true;
			controle.abort();
			clearTimeout(timer);
			document.removeEventListener("visibilitychange", reprendre);
		};
	}, [
		acces,
		jeton,
		heures,
		essai
	]);
	const data = acces === "autorise" && etat.jeton === jeton && etat.heures === heures ? etat.donnees : null;
	function exporter() {
		if (!data) return;
		const url = URL.createObjectURL(new Blob([exporterMesures(data.server.history)], { type: "text/csv;charset=utf-8" }));
		const lien = document.createElement("a");
		lien.href = url;
		lien.download = `supervision-${new Date(data.generatedAt).toISOString().slice(0, 10)}-${heures}h.csv`;
		lien.click();
		setTimeout(() => URL.revokeObjectURL(url), 1e3);
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto max-w-[1600px] px-4 pt-8 tablette:px-7 paysage:px-10 bureau:px-14",
		children: [
			/* @__PURE__ */ jsx(Link, {
				to: "/admin",
				className: "inline-flex min-h-12 items-center text-sm font-medium text-encre-2 underline underline-offset-4",
				children: "← Administration"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-3 flex flex-wrap items-end justify-between gap-5",
				children: [/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("p", {
						className: "text-xs font-bold tracking-[.18em] text-or-ink uppercase",
						children: "Supervision du service"
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "mt-2 font-display text-4xl tablette:text-5xl",
						children: "Statistiques et charge"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-3 max-w-2xl text-encre-2",
						children: "Connexions, notes et ressources : l’activité réelle de votre application."
					})
				] }), acces === "autorise" ? /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setEssai((n) => n + 1),
					disabled: etat.enCours,
					className: `${BOUTON} bg-encre text-sable`,
					children: etat.enCours ? "Actualisation…" : "Actualiser"
				}) : null]
			}),
			acces === "chargement" ? /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "mt-8",
				children: "Vérification de l’accès…"
			}) : acces !== "autorise" ? /* @__PURE__ */ jsxs("div", {
				className: `${CARTE} mt-8`,
				children: [/* @__PURE__ */ jsx("p", {
					role: acces === "anonyme" ? "status" : "alert",
					children: acces === "anonyme" ? "Connectez-vous pour consulter les statistiques." : acces === "refuse" ? "Ces statistiques sont réservées aux administrateurs." : acces === "enrolement-requis" ? "Activez l’authentification à deux facteurs depuis la page d’administration." : acces === "deux-facteurs-requis" ? "Vérifiez votre code d’authentification à deux facteurs depuis la page d’administration." : "Impossible de vérifier vos droits. Réessayez depuis l’administration."
				}), /* @__PURE__ */ jsx(Link, {
					to: "/admin",
					className: `${BOUTON} mt-4`,
					children: "Accéder à l’administration"
				})]
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("section", {
					"aria-label": "Objectif de capacité",
					className: "mt-7 flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-encre p-6 text-sable",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "text-xs font-bold tracking-[.16em] text-or-clair uppercase",
						children: "Objectif de la soirée"
					}), /* @__PURE__ */ jsxs("p", {
						className: "mt-2 font-display text-3xl",
						children: [/* @__PURE__ */ jsx("span", {
							className: "tabular-nums",
							children: "5 000"
						}), " personnes en simultané"]
					})] }), /* @__PURE__ */ jsxs("div", {
						className: "max-w-sm",
						children: [/* @__PURE__ */ jsx("p", {
							className: "font-semibold text-or-clair",
							children: "Capacité à valider par un test de charge"
						}), /* @__PURE__ */ jsx("p", {
							className: "mt-1 text-sm text-nuit-mute",
							children: "Les mesures ci-dessous décrivent l’activité observée. Elles ne garantissent pas la capacité maximale."
						})]
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "my-5 flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsx("div", {
						role: "group",
						"aria-label": "Période des mesures serveur",
						className: "inline-flex gap-1 rounded-2xl bg-lin p-1",
						children: [1, 24].map((n) => /* @__PURE__ */ jsx("button", {
							type: "button",
							"aria-pressed": heures === n,
							onClick: () => setHeures(n),
							className: `min-h-12 rounded-xl px-4 text-sm font-semibold ${heures === n ? "bg-creme text-encre shadow-sm" : "text-encre-2"}`,
							children: n === 1 ? "Dernière heure" : "24 heures"
						}, n))
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: exporter,
						disabled: !data?.server.history.length,
						className: BOUTON,
						children: "Exporter les mesures"
					})]
				}),
				etat.erreur ? /* @__PURE__ */ jsxs("p", {
					role: "alert",
					className: "mb-5 rounded-xl border border-rouge/30 bg-creme p-4 text-rouge-alerte",
					children: [etat.erreur, data ? " Les dernières mesures connues restent affichées." : ""]
				}) : null,
				!data ? /* @__PURE__ */ jsx("p", {
					role: "status",
					className: "py-8 text-encre-2",
					children: etat.enCours ? "Lecture des mesures…" : "Aucune mesure disponible pour le moment."
				}) : /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("p", {
						className: "mb-5 text-sm text-encre-2",
						children: [
							"Mesuré le ",
							new Date(data.generatedAt).toLocaleString("fr-FR"),
							" · Actualisation toutes les 30 secondes, lorsque cet écran est visible."
						]
					}),
					data.sources.serverPersistence !== "available" ? /* @__PURE__ */ jsx("p", {
						className: "mb-5 rounded-xl border border-trait bg-lin p-4 text-sm",
						children: data.sources.serverPersistence === "unconfigured" ? "Historique permanent non configuré. Les mesures serveur sont conservées en mémoire depuis le dernier démarrage." : "L’enregistrement de l’historique est momentanément indisponible. Les mesures locales restent visibles."
					}) : null,
					data.sources.databaseStatus === "error" ? /* @__PURE__ */ jsx("p", {
						role: "status",
						className: "mb-5 rounded-xl border border-trait bg-lin p-4 text-sm",
						children: "Les mesures de la base sont indisponibles. Vérifiez que la migration de supervision est appliquée et que Supabase est accessible."
					}) : null,
					/* @__PURE__ */ jsxs("div", {
						className: "grid gap-4 tablette:grid-cols-2 paysage:grid-cols-4",
						children: [
							/* @__PURE__ */ jsx(Indicateur, {
								titre: "Comptes actifs",
								valeur: nombre(data.activeUsers.authenticatedLast2m),
								detail: "Signal reçu depuis moins de 2 minutes. Visiteurs non connectés exclus."
							}),
							/* @__PURE__ */ jsx(Indicateur, {
								titre: "Notes du public",
								valeur: nombre(data.votes.public.total),
								detail: data.votes.public.modifiedLast5m == null ? "Activité récente indisponible." : `${nombre(data.votes.public.modifiedLast5m)} notes créées ou modifiées depuis 5 minutes.`
							}),
							/* @__PURE__ */ jsx(Indicateur, {
								titre: "Requêtes serveur",
								valeur: nombre(data.server.totals.requests),
								detail: `Sur la période mesurée (${heures} h maximum). Appels directs à Supabase exclus.`
							}),
							/* @__PURE__ */ jsx(Indicateur, {
								titre: "Erreurs serveur",
								valeur: nombre(data.server.totals.errors5xx),
								detail: data.server.totals.requests ? `${nombre(100 * data.server.totals.errors5xx / data.server.totals.requests, 2)} % des réponses sont des erreurs 5xx.` : "Aucune requête observée sur la période.",
								alerte: data.server.totals.errors5xx > 0
							})
						]
					}),
					/* @__PURE__ */ jsxs("section", {
						className: "mt-6",
						"aria-labelledby": "titre-file",
						children: [/* @__PURE__ */ jsx("h2", {
							id: "titre-file",
							className: "mb-4 font-display text-2xl",
							children: "File d’attente des notes"
						}), !data.fileNotes ? /* @__PURE__ */ jsx("p", {
							className: `${CARTE} text-sm text-encre-2`,
							children: "Les mesures de la file sont indisponibles. Vérifiez son installation et la connexion à la base."
						}) : /* @__PURE__ */ jsxs(Fragment, { children: [data.fileNotes.workersActive === 0 ? /* @__PURE__ */ jsx("p", {
							role: "alert",
							className: "mb-4 rounded-xl border border-rouge/30 bg-creme p-4 text-rouge-alerte",
							children: "Aucun traitement actif détecté depuis 30 secondes. Les notes reçues restent en attente dans la base."
						}) : null, /* @__PURE__ */ jsxs("div", {
							className: "grid gap-4 tablette:grid-cols-2 paysage:grid-cols-4",
							children: [
								/* @__PURE__ */ jsx(Indicateur, {
									titre: "Notes en attente",
									valeur: nombre(data.fileNotes.queued),
									detail: "Actions reçues par le serveur et pas encore enregistrées. Les notes encore sur les téléphones ne sont pas comptées.",
									alerte: data.fileNotes.queued > 1e3
								}),
								/* @__PURE__ */ jsx(Indicateur, {
									titre: "Attente la plus ancienne",
									valeur: data.fileNotes.oldestQueuedAt ? `${nombre(Math.max(0, (Date.parse(data.generatedAt) - Date.parse(data.fileNotes.oldestQueuedAt)) / 1e3))} s` : "0 s",
									detail: "Âge de la plus ancienne action reçue et toujours en attente.",
									alerte: !!data.fileNotes.oldestQueuedAt && Date.parse(data.generatedAt) - Date.parse(data.fileNotes.oldestQueuedAt) > 1e4
								}),
								/* @__PURE__ */ jsx(Indicateur, {
									titre: "Confirmations depuis 5 min",
									valeur: nombre(data.fileNotes.confirmedLast5m),
									detail: `${nombre(data.fileNotes.confirmedLastHour)} sur la dernière heure. Une confirmation correspond à une écriture terminée.`
								}),
								/* @__PURE__ */ jsx(Indicateur, {
									titre: "Traitements actifs",
									valeur: nombre(data.fileNotes.workersActive),
									detail: `${nombre(data.fileNotes.rejectedLastHour)} actions refusées depuis 1 h. Dernier signal : ${data.fileNotes.lastWorkerAt ? heure(data.fileNotes.lastWorkerAt) : "aucun"}.`,
									alerte: data.fileNotes.workersActive === 0
								})
							]
						})] })]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-5 grid gap-5 paysage:grid-cols-[1.6fr_1fr]",
						children: [/* @__PURE__ */ jsxs("section", {
							className: CARTE,
							"aria-labelledby": "titre-trafic",
							children: [
								/* @__PURE__ */ jsx("h2", {
									id: "titre-trafic",
									className: "font-display text-2xl",
									children: "Évolution de l’activité"
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-1 text-sm text-encre-2",
									children: "Une mesure par minute · intervalles enregistrés uniquement"
								}),
								/* @__PURE__ */ jsx("div", {
									role: "group",
									"aria-label": "Mesure du graphique",
									className: "mt-3 flex flex-wrap gap-2",
									children: ["requests", "authenticatedActiveUsers"].map((cle) => /* @__PURE__ */ jsx("button", {
										type: "button",
										"aria-pressed": courbe === cle,
										onClick: () => setCourbe(cle),
										className: `${BOUTON} ${courbe === cle ? "bg-lin" : ""}`,
										children: cle === "requests" ? "Requêtes" : "Comptes actifs"
									}, cle))
								}),
								/* @__PURE__ */ jsx(Courbe, {
									mesures: data.server.history,
									indicateur: courbe
								})
							]
						}), /* @__PURE__ */ jsxs("section", {
							className: CARTE,
							"aria-labelledby": "titre-donnees",
							children: [
								/* @__PURE__ */ jsx("h2", {
									id: "titre-donnees",
									className: "font-display text-2xl",
									children: "Données et enregistrements"
								}),
								/* @__PURE__ */ jsxs("dl", {
									className: "mt-4 divide-y divide-trait",
									children: [
										/* @__PURE__ */ jsx(Ligne, {
											terme: "Comptes inscrits",
											valeur: nombre(data.activeUsers.profilesTotal)
										}),
										/* @__PURE__ */ jsx(Ligne, {
											terme: "Notes du jury",
											valeur: nombre(data.votes.jury.total)
										}),
										/* @__PURE__ */ jsx(Ligne, {
											terme: "Notes touchées depuis 1 h",
											valeur: nombre(data.votes.public.modifiedLastHour == null || data.votes.jury.modifiedLastHour == null ? null : data.votes.public.modifiedLastHour + data.votes.jury.modifiedLastHour)
										}),
										/* @__PURE__ */ jsx(Ligne, {
											terme: "Volume de la base",
											valeur: octets(data.database.sizeBytes)
										}),
										/* @__PURE__ */ jsx(Ligne, {
											terme: "Réponses Railway (volume estimé)",
											valeur: octets(data.server.totals.responseBytes)
										}),
										/* @__PURE__ */ jsx(Ligne, {
											terme: "Transferts Supabase",
											valeur: "Non mesurés ici"
										})
									]
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-3 text-xs text-encre-2",
									children: "Une note corrigée conserve une seule ligne. Ces compteurs ne représentent pas le nombre total de tentatives d’enregistrement. Le volume des réponses est estimé hors en-têtes ; ce n’est pas le trafic facturé."
								})
							]
						})]
					}),
					/* @__PURE__ */ jsxs("section", {
						className: "mt-6",
						"aria-labelledby": "titre-ressources",
						children: [
							/* @__PURE__ */ jsx("h2", {
								id: "titre-ressources",
								className: "mb-4 font-display text-2xl",
								children: "Ressources et temps de réponse"
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "grid gap-4 tablette:grid-cols-2 paysage:grid-cols-4",
								children: [
									/* @__PURE__ */ jsx(Indicateur, {
										titre: "Mémoire du processus",
										valeur: octets(data.server.current.rssBytes),
										detail: "Mesure actuelle sur l’instance qui répond."
									}),
									/* @__PURE__ */ jsx(Indicateur, {
										titre: "Temps de réponse p95",
										valeur: latence(data.server.latencyMs.p95),
										detail: "Borne estimée côté serveur. N’inclut ni le réseau mobile, ni l’écriture du vote dans Supabase."
									}),
									/* @__PURE__ */ jsx(Indicateur, {
										titre: "Connexions à la base",
										valeur: `${nombre(data.database.connections.current)} / ${nombre(data.database.connections.max)}`,
										detail: "Connexions PostgreSQL, distinctes des personnes connectées."
									}),
									/* @__PURE__ */ jsx(Indicateur, {
										titre: "Retard du serveur",
										valeur: `${nombre(data.server.current.eventLoopLagMs, 1)} ms`,
										detail: "Retard de la boucle Node : une hausse persistante peut signaler une saturation."
									})
								]
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "mt-4 text-sm text-encre-2",
								children: [
									"Actuellement : ",
									nombre(data.server.current.inflight),
									" requêtes en cours et ",
									nombre(data.server.current.httpConnections),
									" connexions HTTP sur cette instance. Temps CPU cumulé sur la période : ",
									nombre(data.server.totals.cpuMs / 1e3, 1),
									" s."
								]
							})
						]
					}),
					/* @__PURE__ */ jsxs("details", {
						className: `${CARTE} mt-6`,
						children: [
							/* @__PURE__ */ jsx("summary", {
								className: "min-h-12 cursor-pointer font-semibold",
								children: "Journal des mesures par minute"
							}),
							/* @__PURE__ */ jsx("p", {
								className: "my-3 text-sm text-encre-2",
								children: "Les 30 dernières minutes enregistrées. L’export contient toute la période disponible."
							}),
							/* @__PURE__ */ jsx("div", {
								className: "overflow-x-auto",
								children: /* @__PURE__ */ jsxs("table", {
									className: "w-full text-left text-sm tabular-nums",
									children: [
										/* @__PURE__ */ jsx("caption", {
											className: "sr-only",
											children: "Mesures serveur enregistrées"
										}),
										/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: [
											"Heure",
											"Requêtes",
											"Erreurs 5xx",
											"Données",
											"p95",
											"Mémoire",
											"Comptes actifs",
											"Instances"
										].map((t) => /* @__PURE__ */ jsx("th", {
											scope: "col",
											className: "border-b border-trait px-3 py-3 font-semibold",
											children: t
										}, t)) }) }),
										/* @__PURE__ */ jsx("tbody", { children: data.server.history.slice(-30).reverse().map((m) => /* @__PURE__ */ jsxs("tr", {
											className: "border-b border-trait last:border-0",
											children: [
												/* @__PURE__ */ jsx("td", {
													className: "px-3 py-3",
													children: /* @__PURE__ */ jsx("time", {
														dateTime: m.minute,
														children: heure(m.minute)
													})
												}),
												/* @__PURE__ */ jsx("td", {
													className: "px-3 py-3",
													children: nombre(m.requests)
												}),
												/* @__PURE__ */ jsx("td", {
													className: "px-3 py-3",
													children: nombre(m.errors5xx)
												}),
												/* @__PURE__ */ jsx("td", {
													className: "px-3 py-3",
													children: octets(m.responseBytes)
												}),
												/* @__PURE__ */ jsx("td", {
													className: "px-3 py-3",
													children: m.p95Ms == null ? "—" : latence(m.p95Ms)
												}),
												/* @__PURE__ */ jsx("td", {
													className: "px-3 py-3",
													children: octets(m.rssBytes)
												}),
												/* @__PURE__ */ jsx("td", {
													className: "px-3 py-3",
													children: nombre(m.authenticatedActiveUsers)
												}),
												/* @__PURE__ */ jsx("td", {
													className: "px-3 py-3",
													children: nombre(m.instances)
												})
											]
										}, m.minute)) })
									]
								})
							})
						]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-5 text-sm text-encre-2",
						children: "Mesures techniques agrégées, sans email, adresse IP ni contenu des notes dans ce journal. L’historique permanent conserve 30 jours de mesures."
					})
				] })
			] })
		]
	});
});
function Indicateur({ titre, valeur, detail, alerte = false }) {
	return /* @__PURE__ */ jsxs("section", {
		className: CARTE,
		children: [
			/* @__PURE__ */ jsx("h3", {
				className: "text-xs font-bold tracking-[.1em] text-encre-2 uppercase",
				children: titre
			}),
			/* @__PURE__ */ jsx("p", {
				className: `mt-3 break-words text-3xl font-semibold tabular-nums ${alerte ? "text-rouge-alerte" : "text-encre"}`,
				children: valeur
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-2 text-xs leading-relaxed text-encre-2",
				children: detail
			})
		]
	});
}
function Ligne({ terme, valeur }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-baseline justify-between gap-4 py-3 text-sm",
		children: [/* @__PURE__ */ jsx("dt", {
			className: "text-encre-2",
			children: terme
		}), /* @__PURE__ */ jsx("dd", {
			className: "text-right font-semibold tabular-nums",
			children: valeur
		})]
	});
}
function Courbe({ mesures: toutes, indicateur }) {
	const mesures = toutes.filter((m) => m[indicateur] != null);
	if (!mesures.length) return /* @__PURE__ */ jsx("p", {
		className: "grid min-h-48 place-content-center text-sm text-encre-2",
		children: indicateur === "requests" ? "Le graphique apparaîtra après la première minute enregistrée." : "Aucune mesure historique des comptes actifs. L’enregistrement permanent doit être actif."
	});
	const valeur = (m) => m[indicateur] ?? 0;
	const unite = indicateur === "requests" ? "requêtes / min" : "comptes actifs";
	const max = Math.max(1, ...mesures.map(valeur));
	const debut = Date.parse(mesures[0].minute);
	const fin = Date.parse(mesures[mesures.length - 1].minute);
	const x = (m) => mesures.length === 1 ? 320 : 24 + (Date.parse(m.minute) - debut) / Math.max(6e4, fin - debut) * 592;
	const y = (m) => 172 - valeur(m) / max * 136;
	return /* @__PURE__ */ jsxs("figure", {
		className: "mt-4",
		children: [/* @__PURE__ */ jsxs("svg", {
			viewBox: "0 0 640 210",
			role: "img",
			"aria-label": `${unite} : ${mesures.length} minutes observées, maximum ${nombre(Math.max(...mesures.map(valeur)))}.`,
			className: "w-full text-or-ink",
			children: [
				[
					36,
					104,
					172
				].map((v) => /* @__PURE__ */ jsx("line", {
					x1: "24",
					x2: "616",
					y1: v,
					y2: v,
					stroke: "currentColor",
					opacity: ".18"
				}, v)),
				/* @__PURE__ */ jsxs("text", {
					x: "24",
					y: "20",
					className: "text-[22px] tablette:text-[12px]",
					fill: "currentColor",
					children: [
						nombre(max),
						" ",
						unite
					]
				}),
				mesures.map((m, i) => /* @__PURE__ */ jsxs("g", { children: [i > 0 && Date.parse(m.minute) - Date.parse(mesures[i - 1].minute) <= 9e4 ? /* @__PURE__ */ jsx("line", {
					x1: x(mesures[i - 1]),
					y1: y(mesures[i - 1]),
					x2: x(m),
					y2: y(m),
					stroke: "currentColor",
					strokeWidth: "2"
				}) : null, /* @__PURE__ */ jsx("circle", {
					cx: x(m),
					cy: y(m),
					r: mesures.length > 120 ? 1 : 3,
					fill: "currentColor",
					children: /* @__PURE__ */ jsxs("title", { children: [
						heure(m.minute),
						" : ",
						nombre(valeur(m)),
						" ",
						unite
					] })
				})] }, m.minute)),
				/* @__PURE__ */ jsx("text", {
					x: "24",
					y: "201",
					className: "text-[22px] tablette:text-[12px]",
					fill: "currentColor",
					children: heure(mesures[0].minute)
				}),
				/* @__PURE__ */ jsx("text", {
					x: "616",
					y: "201",
					textAnchor: "end",
					className: "text-[22px] tablette:text-[12px]",
					fill: "currentColor",
					children: heure(mesures[mesures.length - 1].minute)
				})
			]
		}), /* @__PURE__ */ jsx("figcaption", {
			className: "text-xs text-encre-2",
			children: indicateur === "requests" ? "Le trafic du site inclut les fichiers et les pages. Les votes sont envoyés directement à la base." : "Comptes connectés ayant signalé leur présence depuis moins de 2 minutes, tous appareils confondus."
		})]
	});
}
//#endregion
//#region app/routes/admin-cookies.tsx
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
var admin_cookies_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_cookies_default,
	meta: () => meta$13
});
var LIBELLE_ACTION = {
	accept_all: "Tout accepté",
	reject_all: "Tout refusé",
	custom: "Personnalisé"
};
var TAILLE_PAGE_JOURNAL = 50;
function meta$13() {
	return [{ title: "Cookies · Administration" }, {
		name: "robots",
		content: "noindex"
	}];
}
var admin_cookies_default = UNSAFE_withComponentProps(function AdminCookies() {
	return /* @__PURE__ */ jsx(CadreAdmin, {
		surtitre: "Configuration",
		titre: "Consentement cookies",
		children: /* @__PURE__ */ jsx(Contenu$3, {})
	});
});
var ONGLETS = [
	{
		cle: "aide",
		libelle: "Comment ça marche"
	},
	{
		cle: "reglages",
		libelle: "Réglages"
	},
	{
		cle: "statistiques",
		libelle: "Statistiques"
	},
	{
		cle: "journal",
		libelle: "Journal"
	}
];
function estOnglet(valeur) {
	return valeur === "aide" || valeur === "reglages" || valeur === "statistiques" || valeur === "journal";
}
function Contenu$3() {
	const [params, setParams] = useSearchParams();
	const demande = params.get("onglet");
	const onglet = estOnglet(demande) ? demande : "aide";
	const refs = useRef([]);
	function activer(cle, focalise = false) {
		setParams((prec) => {
			const copie = new URLSearchParams(prec);
			if (cle === "aide") copie.delete("onglet");
			else copie.set("onglet", cle);
			return copie;
		}, { replace: true });
		if (focalise) {
			const index = ONGLETS.findIndex((o) => o.cle === cle);
			setTimeout(() => refs.current[index]?.focus(), 0);
		}
	}
	function onTouche(evt, index) {
		const dernier = ONGLETS.length - 1;
		let suivant = null;
		if (evt.key === "ArrowRight") suivant = index === dernier ? 0 : index + 1;
		else if (evt.key === "ArrowLeft") suivant = index === 0 ? dernier : index - 1;
		else if (evt.key === "Home") suivant = 0;
		else if (evt.key === "End") suivant = dernier;
		if (suivant === null) return;
		evt.preventDefault();
		activer(ONGLETS[suivant].cle, true);
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "grid gap-5",
		children: [/* @__PURE__ */ jsx("div", {
			role: "tablist",
			"aria-label": "Onglets cookies",
			className: "flex flex-wrap gap-2",
			children: ONGLETS.map((o, i) => {
				const actif = o.cle === onglet;
				return /* @__PURE__ */ jsx("button", {
					ref: (el) => {
						refs.current[i] = el;
					},
					type: "button",
					role: "tab",
					id: `onglet-cookies-${o.cle}`,
					"aria-selected": actif,
					"aria-controls": actif ? `panneau-cookies-${o.cle}` : void 0,
					tabIndex: actif ? 0 : -1,
					onClick: () => activer(o.cle),
					onKeyDown: (e) => onTouche(e, i),
					className: `${BOUTON$1} ${actif ? "bg-encre text-sable" : ""}`,
					children: o.libelle
				}, o.cle);
			})
		}), /* @__PURE__ */ jsxs("div", {
			role: "tabpanel",
			id: `panneau-cookies-${onglet}`,
			"aria-labelledby": `onglet-cookies-${onglet}`,
			children: [
				onglet === "aide" && /* @__PURE__ */ jsx(AideCookies, { onAllerVers: (cible) => activer(cible, false) }),
				onglet === "reglages" && /* @__PURE__ */ jsx(OngletReglages, {}),
				onglet === "statistiques" && /* @__PURE__ */ jsx(OngletStatistiques, {}),
				onglet === "journal" && /* @__PURE__ */ jsx(OngletJournal, {})
			]
		})]
	});
}
function OngletReglages() {
	const { client, erreurClient } = useClientAdmin();
	const [params, setParams] = useState(null);
	const [erreur, setErreur] = useState(null);
	const [enCours, setEnCours] = useState(false);
	const [confirmation, setConfirmation] = useState(null);
	useEffect(() => {
		if (!client) return;
		let actif = true;
		(async () => {
			const { data, error } = await client.from("parametres_cookies").select("*").eq("id", 1).single();
			if (!actif) return;
			if (error) setErreur("Les réglages sont indisponibles.");
			else setParams(data);
		})();
		return () => {
			actif = false;
		};
	}, [client]);
	async function enregistrer() {
		if (!client || !params || enCours) return;
		setEnCours(true);
		setErreur(null);
		const { error } = await client.from("parametres_cookies").update({
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
			duree_consentement_jours: params.duree_consentement_jours
		}).eq("id", 1);
		setEnCours(false);
		if (error) setErreur("L’enregistrement a échoué. Réessayez.");
		else setConfirmation("Paramètres enregistrés.");
	}
	function modif(cle, valeur) {
		setParams((avant) => avant ? {
			...avant,
			[cle]: valeur
		} : avant);
		setConfirmation(null);
	}
	if (erreurClient) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreurClient
	});
	if (!params && !erreur) return /* @__PURE__ */ jsx("p", {
		role: "status",
		children: "Lecture des réglages…"
	});
	if (erreur && !params) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreur
	});
	if (!params) return null;
	return /* @__PURE__ */ jsxs("div", {
		className: "grid gap-5",
		children: [
			/* @__PURE__ */ jsxs("section", {
				className: CARTE$1,
				"aria-labelledby": "titre-textes",
				children: [/* @__PURE__ */ jsx("h2", {
					id: "titre-textes",
					className: "font-display text-2xl",
					children: "Textes du bandeau"
				}), /* @__PURE__ */ jsxs("div", {
					className: "mt-4 grid gap-4",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "titre",
								className: "text-sm font-semibold",
								children: "Titre"
							}), /* @__PURE__ */ jsx("input", {
								id: "titre",
								className: CHAMP$1,
								value: params.titre,
								maxLength: 80,
								onChange: (e) => modif("titre", e.target.value)
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "description",
								className: "text-sm font-semibold",
								children: "Description"
							}), /* @__PURE__ */ jsx("textarea", {
								id: "description",
								className: `${CHAMP$1} min-h-[5rem] py-2`,
								value: params.description,
								maxLength: 600,
								onChange: (e) => modif("description", e.target.value)
							})]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "grid grid-cols-2 gap-4 tablette:grid-cols-4",
							children: [
								["texte_tout_accepter", "Tout accepter"],
								["texte_refuser", "Tout refuser"],
								["texte_personnaliser", "Personnaliser"],
								["texte_enregistrer", "Enregistrer"]
							].map(([cle, libelle]) => /* @__PURE__ */ jsxs("div", {
								className: "grid gap-1.5",
								children: [/* @__PURE__ */ jsx("label", {
									htmlFor: cle,
									className: "text-sm font-semibold",
									children: libelle
								}), /* @__PURE__ */ jsx("input", {
									id: cle,
									className: CHAMP$1,
									value: params[cle],
									maxLength: 80,
									onChange: (e) => modif(cle, e.target.value)
								})]
							}, cle))
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "url_confidentialite",
								className: "text-sm font-semibold",
								children: "URL Confidentialité"
							}), /* @__PURE__ */ jsx("input", {
								id: "url_confidentialite",
								className: CHAMP$1,
								value: params.url_confidentialite,
								maxLength: 200,
								onChange: (e) => modif("url_confidentialite", e.target.value)
							})]
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: CARTE$1,
				"aria-labelledby": "titre-categories",
				children: [/* @__PURE__ */ jsx("h2", {
					id: "titre-categories",
					className: "font-display text-2xl",
					children: "Catégories"
				}), /* @__PURE__ */ jsxs("div", {
					className: "mt-4 grid gap-6",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "grid gap-3",
						children: [/* @__PURE__ */ jsxs("label", {
							className: "flex items-center gap-3 text-sm font-semibold",
							children: [/* @__PURE__ */ jsx("input", {
								type: "checkbox",
								className: "h-4 w-4",
								checked: params.mesure_active,
								onChange: (e) => modif("mesure_active", e.target.checked)
							}), "Mesure d'audience active"]
						}), params.mesure_active && /* @__PURE__ */ jsxs("div", {
							className: "grid gap-3 pl-4 border-l-2 border-trait",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "grid gap-1.5",
								children: [/* @__PURE__ */ jsx("label", {
									htmlFor: "mesure_titre",
									className: "text-sm font-semibold",
									children: "Titre"
								}), /* @__PURE__ */ jsx("input", {
									id: "mesure_titre",
									className: "min-h-12 w-full rounded-xl border border-trait bg-sable px-3",
									value: params.mesure_titre,
									maxLength: 80,
									onChange: (e) => modif("mesure_titre", e.target.value)
								})]
							}), /* @__PURE__ */ jsxs("div", {
								className: "grid gap-1.5",
								children: [/* @__PURE__ */ jsx("label", {
									htmlFor: "mesure_description",
									className: "text-sm font-semibold",
									children: "Description"
								}), /* @__PURE__ */ jsx("textarea", {
									id: "mesure_description",
									className: `min-h-12 w-full rounded-xl border border-trait bg-sable px-3 min-h-[4rem] py-2`,
									value: params.mesure_description,
									maxLength: 600,
									onChange: (e) => modif("mesure_description", e.target.value)
								})]
							})]
						})]
					}), /* @__PURE__ */ jsxs("div", {
						className: "grid gap-3",
						children: [/* @__PURE__ */ jsxs("label", {
							className: "flex items-center gap-3 text-sm font-semibold",
							children: [/* @__PURE__ */ jsx("input", {
								type: "checkbox",
								className: "h-4 w-4",
								checked: params.publicite_active,
								onChange: (e) => modif("publicite_active", e.target.checked)
							}), "Publicité active"]
						}), params.publicite_active && /* @__PURE__ */ jsxs("div", {
							className: "grid gap-3 pl-4 border-l-2 border-trait",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "grid gap-1.5",
								children: [/* @__PURE__ */ jsx("label", {
									htmlFor: "publicite_titre",
									className: "text-sm font-semibold",
									children: "Titre"
								}), /* @__PURE__ */ jsx("input", {
									id: "publicite_titre",
									className: "min-h-12 w-full rounded-xl border border-trait bg-sable px-3",
									value: params.publicite_titre,
									maxLength: 80,
									onChange: (e) => modif("publicite_titre", e.target.value)
								})]
							}), /* @__PURE__ */ jsxs("div", {
								className: "grid gap-1.5",
								children: [/* @__PURE__ */ jsx("label", {
									htmlFor: "publicite_description",
									className: "text-sm font-semibold",
									children: "Description"
								}), /* @__PURE__ */ jsx("textarea", {
									id: "publicite_description",
									className: `min-h-12 w-full rounded-xl border border-trait bg-sable px-3 min-h-[4rem] py-2`,
									value: params.publicite_description,
									maxLength: 600,
									onChange: (e) => modif("publicite_description", e.target.value)
								})]
							})]
						})]
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: CARTE$1,
				"aria-labelledby": "titre-duree",
				children: [/* @__PURE__ */ jsx("h2", {
					id: "titre-duree",
					className: "font-display text-2xl",
					children: "Durée de validité"
				}), /* @__PURE__ */ jsxs("div", {
					className: "mt-4 grid gap-1.5",
					children: [
						/* @__PURE__ */ jsx("label", {
							htmlFor: "duree",
							className: "text-sm font-semibold",
							children: "Durée (jours, 1 à 395)"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "duree",
							type: "number",
							min: 1,
							max: 395,
							className: `${CHAMP$1} w-32`,
							value: params.duree_consentement_jours,
							onChange: (e) => modif("duree_consentement_jours", Math.min(395, Math.max(1, parseInt(e.target.value) || 1)))
						}),
						/* @__PURE__ */ jsx("p", {
							className: "text-sm text-encre-2",
							children: "Recommandé\xA0: 365 jours (13\xA0mois CNIL)."
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-3",
				children: [
					erreur ? /* @__PURE__ */ jsx("p", {
						role: "alert",
						className: "text-rouge-alerte",
						children: erreur
					}) : null,
					confirmation ? /* @__PURE__ */ jsx("p", {
						role: "status",
						className: "text-ok",
						children: confirmation
					}) : null,
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: BOUTON_PLEIN,
						disabled: enCours,
						onClick: () => void enregistrer(),
						children: enCours ? "Enregistrement…" : "Enregistrer les réglages"
					})
				]
			})
		]
	});
}
function OngletStatistiques() {
	const { client, erreurClient } = useClientAdmin();
	const [periode, setPeriode] = useState("30");
	const [stats, setStats] = useState(null);
	const [chargement, setChargement] = useState(false);
	const [erreur, setErreur] = useState(null);
	useEffect(() => {
		if (!client) return;
		let actif = true;
		setChargement(true);
		setErreur(null);
		setStats(null);
		(async () => {
			try {
				const depuis = (/* @__PURE__ */ new Date(Date.now() - parseInt(periode) * 24 * 60 * 60 * 1e3)).toISOString();
				const [{ count: total }, { count: accept_all }, { count: reject_all }, { count: custom }, { count: tauxMesure }, { count: tauxPublicite }] = await Promise.all([
					client.from("consentements_cookies").select("id", {
						count: "exact",
						head: true
					}).gte("cree_le", depuis),
					client.from("consentements_cookies").select("id", {
						count: "exact",
						head: true
					}).gte("cree_le", depuis).eq("action", "accept_all"),
					client.from("consentements_cookies").select("id", {
						count: "exact",
						head: true
					}).gte("cree_le", depuis).eq("action", "reject_all"),
					client.from("consentements_cookies").select("id", {
						count: "exact",
						head: true
					}).gte("cree_le", depuis).eq("action", "custom"),
					client.from("consentements_cookies").select("id", {
						count: "exact",
						head: true
					}).gte("cree_le", depuis).eq("mesure_acceptee", true),
					client.from("consentements_cookies").select("id", {
						count: "exact",
						head: true
					}).gte("cree_le", depuis).eq("publicite_acceptee", true)
				]);
				if (!actif) return;
				const t = total ?? 0;
				setStats({
					total: t,
					accept_all: accept_all ?? 0,
					reject_all: reject_all ?? 0,
					custom: custom ?? 0,
					tauxMesure: t > 0 ? Math.round((tauxMesure ?? 0) / t * 100) : 0,
					tauxPublicite: t > 0 ? Math.round((tauxPublicite ?? 0) / t * 100) : 0
				});
			} catch {
				if (actif) setErreur("Les statistiques sont indisponibles.");
			} finally {
				if (actif) setChargement(false);
			}
		})();
		return () => {
			actif = false;
		};
	}, [client, periode]);
	if (erreurClient) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreurClient
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "grid gap-5",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-3",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-sm font-semibold",
					children: "Période\xA0:"
				}), [
					"7",
					"30",
					"90",
					"365"
				].map((p) => /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: `${BOUTON$1} ${periode === p ? "bg-encre text-sable" : ""}`,
					onClick: () => setPeriode(p),
					children: [p, "\xA0j"]
				}, p))]
			}),
			chargement ? /* @__PURE__ */ jsx("p", {
				role: "status",
				children: "Calcul des statistiques…"
			}) : null,
			erreur ? /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "text-rouge-alerte",
				children: erreur
			}) : null,
			stats ? /* @__PURE__ */ jsx("div", {
				className: "grid gap-4 tablette:grid-cols-2 paysage:grid-cols-3",
				children: [
					{
						libelle: "Total",
						valeur: stats.total
					},
					{
						libelle: "Tout accepté",
						valeur: stats.accept_all
					},
					{
						libelle: "Tout refusé",
						valeur: stats.reject_all
					},
					{
						libelle: "Personnalisé",
						valeur: stats.custom
					},
					{
						libelle: "Taux mesure",
						valeur: `${stats.tauxMesure} %`
					},
					{
						libelle: "Taux publicité",
						valeur: `${stats.tauxPublicite} %`
					}
				].map(({ libelle, valeur }) => /* @__PURE__ */ jsxs("div", {
					className: CARTE$1,
					children: [/* @__PURE__ */ jsx("p", {
						className: "text-xs font-bold tracking-[.18em] text-or-ink uppercase",
						children: libelle
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-2 font-display text-4xl",
						children: valeur
					})]
				}, libelle))
			}) : null
		]
	});
}
function OngletJournal() {
	const { client, erreurClient } = useClientAdmin();
	const [lignes, setLignes] = useState(null);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(0);
	const [erreur, setErreur] = useState(null);
	const [revision, setRevision] = useState(0);
	const [enPurge, setEnPurge] = useState(false);
	const [confirmationPurge, setConfirmationPurge] = useState(false);
	useEffect(() => {
		if (!client) return;
		let actif = true;
		setLignes(null);
		setErreur(null);
		(async () => {
			try {
				const { data, error, count } = await client.from("consentements_cookies").select("id,visiteur_id,ip_hachee,agent_utilisateur,consentement_donne,mesure_acceptee,publicite_acceptee,action,url_page,provenance,cree_le", { count: "exact" }).order("cree_le", { ascending: false }).range(page * TAILLE_PAGE_JOURNAL, (page + 1) * TAILLE_PAGE_JOURNAL - 1);
				if (!actif) return;
				if (error) throw error;
				setLignes(data ?? []);
				setTotal(count ?? 0);
			} catch {
				if (actif) setErreur("Le journal est indisponible.");
			}
		})();
		return () => {
			actif = false;
		};
	}, [
		client,
		page,
		revision
	]);
	async function purger() {
		if (!client || enPurge) return;
		setEnPurge(true);
		setErreur(null);
		const limite = (/* @__PURE__ */ new Date(Date.now() - 31536e6)).toISOString();
		try {
			const { error } = await client.from("consentements_cookies").delete().lt("cree_le", limite);
			if (error) throw error;
			setConfirmationPurge(false);
			setPage(0);
			setRevision((v) => v + 1);
		} catch {
			setErreur("La purge a échoué. Réessayez.");
		} finally {
			setEnPurge(false);
		}
	}
	if (erreurClient) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreurClient
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "grid gap-5",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsx("p", {
					className: "text-sm text-encre-2",
					children: "Consentements enregistrés pour audit RGPD."
				}), confirmationPurge ? /* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "text-sm",
							children: "Supprimer toutes les entrées de plus d'un an\xA0?"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: `${BOUTON$1} text-rouge-alerte`,
							disabled: enPurge,
							onClick: () => void purger(),
							children: enPurge ? "Purge…" : "Confirmer la purge"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: BOUTON$1,
							disabled: enPurge,
							onClick: () => setConfirmationPurge(false),
							children: "Annuler"
						})
					]
				}) : /* @__PURE__ */ jsx("button", {
					type: "button",
					className: `${BOUTON$1} text-rouge-alerte`,
					onClick: () => setConfirmationPurge(true),
					children: "Purger (>\xA0365 jours)"
				})]
			}),
			erreur ? /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "text-rouge-alerte",
				children: erreur
			}) : null,
			!lignes && !erreur ? /* @__PURE__ */ jsx("p", {
				role: "status",
				children: "Lecture du journal…"
			}) : null,
			lignes?.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: CARTE$1,
				children: "Aucune entrée dans le journal."
			}) : null,
			lignes?.length ? /* @__PURE__ */ jsx("div", {
				className: `${CARTE$1} overflow-x-auto`,
				children: /* @__PURE__ */ jsxs("table", {
					className: "w-full text-sm",
					"aria-label": "Journal des consentements",
					children: [/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", {
						className: "border-b border-trait text-left text-xs font-bold tracking-[.14em] text-encre-2 uppercase",
						children: [
							/* @__PURE__ */ jsx("th", {
								className: "pb-2 pr-4 whitespace-nowrap",
								children: "Date"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "pb-2 pr-4 whitespace-nowrap",
								children: "Action"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "pb-2 pr-4 whitespace-nowrap",
								children: "Mesure"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "pb-2 pr-4 whitespace-nowrap",
								children: "Publicité"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "pb-2 pr-4",
								children: "Page"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "pb-2 pr-4",
								children: "Provenance"
							}),
							/* @__PURE__ */ jsx("th", {
								className: "pb-2",
								children: "Visiteur"
							})
						]
					}) }), /* @__PURE__ */ jsx("tbody", { children: lignes.map((ligne) => /* @__PURE__ */ jsxs("tr", {
						className: "border-b border-trait last:border-0",
						children: [
							/* @__PURE__ */ jsx("td", {
								className: "py-3 pr-4 whitespace-nowrap text-encre-2",
								children: new Date(ligne.cree_le).toLocaleString("fr-FR", {
									dateStyle: "short",
									timeStyle: "short"
								})
							}),
							/* @__PURE__ */ jsx("td", {
								className: "py-3 pr-4",
								children: /* @__PURE__ */ jsx("span", {
									className: `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ligne.action === "accept_all" ? "bg-ok/10 text-ok" : ligne.action === "reject_all" ? "bg-rouge/10 text-rouge-alerte" : "bg-ambre/15 text-or-ink"}`,
									children: LIBELLE_ACTION[ligne.action]
								})
							}),
							/* @__PURE__ */ jsx("td", {
								className: "py-3 pr-4",
								children: ligne.mesure_acceptee ? "✓" : "–"
							}),
							/* @__PURE__ */ jsx("td", {
								className: "py-3 pr-4",
								children: ligne.publicite_acceptee ? "✓" : "–"
							}),
							/* @__PURE__ */ jsx("td", {
								className: "py-3 pr-4 max-w-[200px] truncate text-encre-2",
								children: ligne.url_page ?? "–"
							}),
							/* @__PURE__ */ jsx("td", {
								className: "py-3 pr-4 text-encre-2",
								children: ligne.provenance ?? "–"
							}),
							/* @__PURE__ */ jsxs("td", {
								className: "py-3 font-mono text-xs text-encre-2",
								children: [ligne.visiteur_id.substring(0, 8), "…"]
							})
						]
					}, ligne.id)) })]
				})
			}) : null,
			total > TAILLE_PAGE_JOURNAL ? /* @__PURE__ */ jsxs("nav", {
				"aria-label": "Pages du journal",
				className: "flex items-center justify-between gap-3",
				children: [
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: BOUTON$1,
						disabled: page === 0,
						onClick: () => setPage((v) => v - 1),
						children: "← Précédente"
					}),
					/* @__PURE__ */ jsxs("span", {
						className: "text-sm",
						children: [
							"Page ",
							page + 1,
							" sur ",
							Math.ceil(total / TAILLE_PAGE_JOURNAL)
						]
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: BOUTON$1,
						disabled: (page + 1) * TAILLE_PAGE_JOURNAL >= total,
						onClick: () => setPage((v) => v + 1),
						children: "Suivante →"
					})
				]
			}) : null
		]
	});
}
//#endregion
//#region app/routes/admin-participants.tsx
var admin_participants_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_participants_default,
	meta: () => meta$12
});
var ROLES = {
	admin: "Administrateur",
	juge: "Juge",
	spectateur: "Spectateur"
};
function meta$12() {
	return [{ title: "Participants · Administration" }, {
		name: "robots",
		content: "noindex"
	}];
}
var admin_participants_default = UNSAFE_withComponentProps(function Participants() {
	return /* @__PURE__ */ jsx(CadreAdmin, {
		surtitre: "Préparation",
		titre: "Participants",
		children: /* @__PURE__ */ jsx(Liste$2, {})
	});
});
function Liste$2() {
	const { client, session, erreurClient } = useClientAdmin();
	const [lignes, setLignes] = useState(null);
	const [erreur, setErreur] = useState(null);
	const [info, setInfo] = useState(null);
	useEffect(() => {
		if (!client) return;
		let actif = true;
		client.rpc("lire_participants").then(({ data, error }) => {
			if (!actif) return;
			if (error) setErreur("La liste des participants est indisponible. Vérifiez que la migration de pilotage est appliquée.");
			else setLignes(data ?? []);
		});
		return () => {
			actif = false;
		};
	}, [client]);
	if (erreurClient || erreur) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreurClient ?? erreur
	});
	if (!lignes) return /* @__PURE__ */ jsx("p", {
		role: "status",
		children: "Lecture des participants…"
	});
	return /* @__PURE__ */ jsxs("section", {
		className: CARTE$1,
		"aria-labelledby": "titre-participants",
		children: [
			/* @__PURE__ */ jsx("h2", {
				id: "titre-participants",
				className: "font-display text-2xl",
				children: "Comptes"
			}),
			/* @__PURE__ */ jsxs("p", {
				className: "mt-1 text-sm text-encre-2",
				children: [
					lignes.length,
					" compte",
					lignes.length > 1 ? "s" : "",
					". Le rôle se change côté serveur, pas depuis cette liste."
				]
			}),
			/* @__PURE__ */ jsx("ul", {
				className: "mt-4 divide-y divide-trait",
				children: lignes.map((personne) => /* @__PURE__ */ jsxs("li", {
					className: "flex min-h-12 flex-wrap items-center justify-between gap-2 py-2",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "font-semibold",
							children: personne.prenom
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-sm text-encre-2",
							children: personne.email
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-sm",
							children: ROLES[personne.role] ?? personne.role
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-sm text-encre-2",
							children: personne.consentement_le ? "Consentement enregistré" : "Consentement en attente"
						})
					]
				}, personne.id))
			}),
			!lignes.length ? /* @__PURE__ */ jsx("p", {
				className: "mt-3 text-sm text-encre-2",
				children: "Aucun compte pour le moment."
			}) : null,
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "mt-4 inline-flex min-h-12 items-center rounded-xl border border-trait px-4 text-sm font-semibold",
				onClick: () => void (async () => {
					if (!session?.access_token || !window.confirm("Supprimer les comptes spectateurs inactifs depuis 24 mois ?")) return;
					const reponse = await fetch("/api/admin/purge-comptes", {
						method: "POST",
						headers: { Authorization: `Bearer ${session.access_token}` }
					});
					const corps = await reponse.json().catch(() => null);
					setInfo(reponse.ok ? `${corps?.supprimes ?? 0} compte(s) supprimé(s).` : "La purge n’a pas abouti.");
				})(),
				children: "Purger les comptes inactifs (24 mois)"
			}),
			info ? /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "mt-2 text-sm",
				children: info
			}) : null,
			/* @__PURE__ */ jsx("p", {
				className: "mt-4 text-sm text-encre-2",
				children: "Les inscriptions publiques restent fermées tant que le drapeau prévu n’est pas activé."
			})
		]
	});
}
//#endregion
//#region app/routes/admin-messages.tsx
var admin_messages_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_messages_default,
	meta: () => meta$11
});
function meta$11() {
	return [{ title: "Messages · Administration" }, {
		name: "robots",
		content: "noindex"
	}];
}
var admin_messages_default = UNSAFE_withComponentProps(function Messages() {
	return /* @__PURE__ */ jsx(CadreAdmin, {
		surtitre: "Préparation",
		titre: "Messages de contact",
		children: /* @__PURE__ */ jsx(Liste$1, {})
	});
});
function Liste$1() {
	const { client, erreurClient } = useClientAdmin();
	const [lignes, setLignes] = useState(null);
	const [erreur, setErreur] = useState(null);
	const [enCours, setEnCours] = useState(null);
	useEffect(() => {
		if (!client) return;
		let actif = true;
		client.from("messages_contact").select("id, prenom, email, message, cree_le, traite").order("cree_le", { ascending: false }).then(({ data, error }) => {
			if (!actif) return;
			if (error) setErreur("Les messages sont indisponibles.");
			else setLignes(data ?? []);
		});
		return () => {
			actif = false;
		};
	}, [client]);
	async function traiter(id) {
		if (!client || enCours) return;
		setEnCours(id);
		setErreur(null);
		const { error } = await client.from("messages_contact").update({ traite: true }).eq("id", id);
		setEnCours(null);
		if (error) setErreur("Le message n’a pas pu être marqué comme traité.");
		else setLignes((avant) => avant?.map((message) => message.id === id ? {
			...message,
			traite: true
		} : message) ?? null);
	}
	if (erreurClient) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreurClient
	});
	if (!lignes && !erreur) return /* @__PURE__ */ jsx("p", {
		role: "status",
		children: "Lecture des messages…"
	});
	return /* @__PURE__ */ jsxs("section", {
		className: "grid gap-4",
		"aria-labelledby": "titre-messages",
		children: [
			/* @__PURE__ */ jsx("h2", {
				id: "titre-messages",
				className: "sr-only",
				children: "Messages reçus"
			}),
			erreur ? /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "text-rouge-alerte",
				children: erreur
			}) : null,
			!lignes?.length ? /* @__PURE__ */ jsx("p", {
				className: CARTE$1,
				children: "Aucun message pour le moment."
			}) : lignes.map((message) => /* @__PURE__ */ jsxs("article", {
				className: CARTE$1,
				children: [
					/* @__PURE__ */ jsxs("header", {
						className: "flex flex-wrap items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ jsx("h3", {
							className: "font-display text-2xl",
							children: message.prenom
						}), /* @__PURE__ */ jsx("time", {
							className: "text-sm text-encre-2",
							dateTime: message.cree_le,
							children: new Date(message.cree_le).toLocaleString("fr-FR")
						})]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-1 text-sm text-encre-2",
						children: message.email
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-3 whitespace-pre-wrap",
						children: message.message
					}),
					message.traite ? /* @__PURE__ */ jsx("p", {
						className: "mt-3 text-sm font-semibold",
						children: "Traité"
					}) : /* @__PURE__ */ jsx("button", {
						type: "button",
						className: `${BOUTON$1} mt-3 bg-encre text-sable`,
						disabled: enCours === message.id,
						onClick: () => void traiter(message.id),
						children: enCours === message.id ? "Enregistrement…" : "Marquer comme traité"
					})
				]
			}, message.id))
		]
	});
}
//#endregion
//#region app/routes/admin-abonnes.tsx
var admin_abonnes_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_abonnes_default,
	meta: () => meta$10
});
var TAILLE_PAGE = 50;
function meta$10() {
	return [{ title: "Abonnés · Administration" }, {
		name: "robots",
		content: "noindex"
	}];
}
var admin_abonnes_default = UNSAFE_withComponentProps(function Abonnes() {
	return /* @__PURE__ */ jsx(CadreAdmin, {
		surtitre: "Actualités",
		titre: "Abonnés aux actualités",
		children: /* @__PURE__ */ jsx(Liste, {})
	});
});
function Liste() {
	const { client, erreurClient } = useClientAdmin();
	const [lignes, setLignes] = useState(null);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(0);
	const [revision, setRevision] = useState(0);
	const [erreur, setErreur] = useState(null);
	const [confirmation, setConfirmation] = useState(null);
	const [enCours, setEnCours] = useState(false);
	useEffect(() => {
		if (!client) return;
		let actif = true;
		setLignes(null);
		setErreur(null);
		(async () => {
			try {
				const { data, error, count } = await client.from("abonnements_actualites").select("id,email,consentement_le", { count: "exact" }).order("consentement_le", { ascending: false }).order("id").range(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE - 1);
				if (!actif) return;
				if (error) throw error;
				setLignes(data ?? []);
				setTotal(count ?? 0);
			} catch {
				if (actif) setErreur("La liste des abonnés est indisponible.");
			}
		})();
		return () => {
			actif = false;
		};
	}, [
		client,
		page,
		revision
	]);
	async function retirer(id) {
		if (!client || enCours) return;
		setEnCours(true);
		setErreur(null);
		try {
			const { data, error } = await client.from("abonnements_actualites").delete().eq("id", id).select("id");
			if (error || !data?.length) throw error ?? /* @__PURE__ */ new Error("Suppression non confirmée");
			setConfirmation(null);
			if (lignes?.length === 1 && page > 0) setPage((valeur) => valeur - 1);
			else setRevision((valeur) => valeur + 1);
		} catch {
			setErreur("Le retrait n’a pas pu être confirmé. Réessayez.");
		} finally {
			setEnCours(false);
		}
	}
	return /* @__PURE__ */ jsxs("section", {
		className: `${CARTE$1} min-w-0`,
		"aria-label": "Liste des abonnés",
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "text-sm text-encre-2",
				children: "Adresses recueillies sur l’accueil pour les actualités, informations pratiques, résultats et notations. Aucun envoi automatique n’est déclenché par une inscription."
			}),
			/* @__PURE__ */ jsx("div", {
				role: "alert",
				children: erreurClient || erreur ? /* @__PURE__ */ jsx("p", {
					className: "mt-4 text-rouge-alerte",
					children: erreurClient || erreur
				}) : null
			}),
			!lignes && !erreur && !erreurClient ? /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "mt-4",
				children: "Lecture des abonnés…"
			}) : null,
			erreur ? /* @__PURE__ */ jsx("button", {
				className: `${BOUTON$1} mt-3`,
				onClick: () => setRevision((valeur) => valeur + 1),
				children: "Réessayer"
			}) : null,
			lignes ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("h2", {
					className: "mt-5 font-display text-2xl",
					children: [
						total,
						" abonné",
						total > 1 ? "s" : ""
					]
				}),
				!lignes.length ? /* @__PURE__ */ jsx("p", {
					className: "mt-3",
					children: "Aucune inscription pour le moment."
				}) : /* @__PURE__ */ jsx("ul", {
					className: "mt-3 divide-y divide-trait",
					children: lignes.map((abonne) => /* @__PURE__ */ jsxs("li", {
						className: "flex flex-wrap items-center justify-between gap-3 py-4",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ jsx("p", {
								className: "font-semibold break-all",
								children: abonne.email
							}), /* @__PURE__ */ jsxs("p", {
								className: "mt-1 text-xs text-encre-2",
								children: ["Consentement reçu le ", /* @__PURE__ */ jsx("time", {
									dateTime: abonne.consentement_le,
									children: new Date(abonne.consentement_le).toLocaleString("fr-FR")
								})]
							})]
						}), confirmation === abonne.id ? /* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "text-sm",
									children: "Retirer cette adresse\xA0?"
								}),
								/* @__PURE__ */ jsx("button", {
									className: BOUTON$1,
									disabled: enCours,
									onClick: () => void retirer(abonne.id),
									children: enCours ? "Retrait…" : "Confirmer le retrait"
								}),
								/* @__PURE__ */ jsx("button", {
									className: BOUTON$1,
									disabled: enCours,
									onClick: () => setConfirmation(null),
									children: "Annuler"
								})
							]
						}) : /* @__PURE__ */ jsx("button", {
							className: BOUTON$1,
							disabled: enCours,
							onClick: () => setConfirmation(abonne.id),
							"aria-label": `Retirer ${abonne.email}`,
							children: "Retirer"
						})]
					}, abonne.id))
				}),
				total > TAILLE_PAGE ? /* @__PURE__ */ jsxs("nav", {
					"aria-label": "Pages des abonnés",
					className: "mt-4 flex items-center justify-between gap-3",
					children: [
						/* @__PURE__ */ jsx("button", {
							className: BOUTON$1,
							disabled: page === 0 || enCours,
							onClick: () => {
								setConfirmation(null);
								setPage((valeur) => valeur - 1);
							},
							children: "Précédente"
						}),
						/* @__PURE__ */ jsxs("span", {
							className: "text-sm",
							children: [
								"Page ",
								page + 1,
								" sur ",
								Math.ceil(total / TAILLE_PAGE)
							]
						}),
						/* @__PURE__ */ jsx("button", {
							className: BOUTON$1,
							disabled: (page + 1) * TAILLE_PAGE >= total || enCours,
							onClick: () => {
								setConfirmation(null);
								setPage((valeur) => valeur + 1);
							},
							children: "Suivante"
						})
					]
				}) : null
			] }) : null
		]
	});
}
//#endregion
//#region app/routes/admin-juges.tsx
var admin_juges_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_juges_default,
	meta: () => meta$9
});
function meta$9() {
	return [{ title: "Juges · Administration" }, {
		name: "robots",
		content: "noindex"
	}];
}
var admin_juges_default = UNSAFE_withComponentProps(function Juges() {
	return /* @__PURE__ */ jsx(CadreAdmin, {
		surtitre: "Préparation",
		titre: "Juges",
		children: /* @__PURE__ */ jsx(Contenu$2, {})
	});
});
function Contenu$2() {
	const { client, session, erreurClient } = useClientAdmin();
	const [juges, setJuges] = useState(null);
	const [soirees, setSoirees] = useState([]);
	const [erreur, setErreur] = useState(null);
	const [lien, setLien] = useState(null);
	const [enCours, setEnCours] = useState(false);
	useEffect(() => {
		if (!client) return;
		let actif = true;
		Promise.all([client.rpc("lire_participants"), client.from("soirees").select("id, nom, date_soiree").order("date_soiree", { ascending: false })]).then(([personnes, liste]) => {
			if (!actif) return;
			if (personnes.error || liste.error) setErreur("La liste des juges est indisponible.");
			else {
				setJuges((personnes.data ?? []).filter((personne) => personne.role === "juge"));
				setSoirees(liste.data ?? []);
			}
		});
		return () => {
			actif = false;
		};
	}, [client]);
	async function creer(evenement) {
		evenement.preventDefault();
		if (!session?.access_token || enCours) return;
		const champs = new FormData(evenement.currentTarget);
		setEnCours(true);
		setErreur(null);
		setLien(null);
		try {
			const reponse = await fetch("/api/admin/juges", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`
				},
				body: JSON.stringify({
					prenom: String(champs.get("prenom") ?? ""),
					email: String(champs.get("email") ?? ""),
					soireeId: String(champs.get("soiree") ?? "")
				})
			});
			const corps = await reponse.json().catch(() => null);
			if (!reponse.ok) {
				setErreur(corps?.error === "service_indisponible" ? "La création d’un juge demande la clé serveur. Le rattachement d’un juge déjà existant reste possible sur la soirée." : "Le juge n’a pas pu être créé. Vérifiez les champs et la configuration.");
				return;
			}
			setLien(corps?.lien ?? null);
			evenement.currentTarget.reset();
		} catch {
			setErreur("Le juge n’a pas pu être créé.");
		} finally {
			setEnCours(false);
		}
	}
	if (erreurClient) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreurClient
	});
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("section", {
		className: CARTE$1,
		children: [
			/* @__PURE__ */ jsx("h2", {
				className: "font-display text-2xl",
				children: "Nouveau juge"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-1 text-sm text-encre-2",
				children: "Le lien personnel s’affiche ici. Sans SMTP, transmettez-le vous-même au juge. Aucune inscription publique n’est ouverte."
			}),
			/* @__PURE__ */ jsxs("form", {
				onSubmit: (evenement) => void creer(evenement),
				className: "mt-4 grid gap-3",
				children: [
					/* @__PURE__ */ jsxs("label", {
						className: "grid gap-2 font-medium",
						children: ["Prénom", /* @__PURE__ */ jsx("input", {
							name: "prenom",
							required: true,
							maxLength: 60,
							className: CHAMP$1
						})]
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "grid gap-2 font-medium",
						children: ["Email", /* @__PURE__ */ jsx("input", {
							name: "email",
							type: "email",
							required: true,
							maxLength: 254,
							className: CHAMP$1
						})]
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "grid gap-2 font-medium",
						children: ["Soirée", /* @__PURE__ */ jsxs("select", {
							name: "soiree",
							required: true,
							className: CHAMP$1,
							children: [/* @__PURE__ */ jsx("option", {
								value: "",
								children: "Choisir"
							}), soirees.map((soiree) => /* @__PURE__ */ jsx("option", {
								value: soiree.id,
								children: soiree.nom
							}, soiree.id))]
						})]
					}),
					/* @__PURE__ */ jsx("button", {
						className: BOUTON_PLEIN,
						disabled: enCours || !soirees.length,
						children: enCours ? "Création…" : "Créer le lien du juge"
					})
				]
			}),
			erreur ? /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "mt-3 text-rouge-alerte",
				children: erreur
			}) : null,
			lien ? /* @__PURE__ */ jsxs("div", {
				className: "mt-4 grid gap-3",
				children: [
					/* @__PURE__ */ jsxs("p", {
						className: "break-all text-sm",
						children: ["Lien personnel : ", /* @__PURE__ */ jsx("a", {
							className: "underline",
							href: lien,
							children: lien
						})]
					}),
					/* @__PURE__ */ jsx(CodeQr, {
						valeur: lien,
						libelle: "QR code du lien personnel du juge"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm text-encre-2",
						children: "Transmettez le lien ou le QR au juge. Aucun SMS n’est envoyé."
					})
				]
			}) : null
		]
	}), /* @__PURE__ */ jsxs("section", {
		className: CARTE$1,
		children: [/* @__PURE__ */ jsx("h2", {
			className: "font-display text-2xl",
			children: "Juges connus"
		}), !juges ? /* @__PURE__ */ jsx("p", {
			role: "status",
			className: "mt-3",
			children: "Lecture…"
		}) : juges.length ? /* @__PURE__ */ jsx("ul", {
			className: "mt-3 divide-y divide-trait",
			children: juges.map((juge) => /* @__PURE__ */ jsxs("li", {
				className: "flex min-h-12 items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsx("span", {
					className: "font-semibold",
					children: juge.prenom
				}), /* @__PURE__ */ jsx("span", {
					className: "text-sm text-encre-2",
					children: juge.email
				})]
			}, juge.id))
		}) : /* @__PURE__ */ jsx("p", {
			className: "mt-3 text-sm text-encre-2",
			children: "Aucun juge pour le moment."
		})]
	})] });
}
//#endregion
//#region app/routes/admin-soirees.tsx
var admin_soirees_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_soirees_default,
	meta: () => meta$8
});
var STATUTS$1 = {
	brouillon: "Brouillon",
	publiee: "Publiée",
	en_cours: "En cours",
	terminee: "Terminée",
	reportee: "Reportée",
	annulee: "Annulée"
};
function meta$8() {
	return [{ title: "Soirées · Administration" }, {
		name: "robots",
		content: "noindex"
	}];
}
var admin_soirees_default = UNSAFE_withComponentProps(function Soirees() {
	return /* @__PURE__ */ jsx(CadreAdmin, {
		surtitre: "Préparation",
		titre: "Mes soirées",
		children: /* @__PURE__ */ jsx(Contenu$1, {})
	});
});
function Contenu$1() {
	const { client, erreurClient } = useClientAdmin();
	const [soirees, setSoirees] = useState(null);
	const [manades, setManades] = useState([]);
	const [erreur, setErreur] = useState(null);
	const [enCours, setEnCours] = useState(false);
	async function recharger(actuel = client) {
		if (!actuel) return;
		const [liste, annuaire] = await Promise.all([actuel.from("soirees").select("id, slug, nom, date_soiree, lieu, statut").order("date_soiree", { ascending: false }), actuel.from("manades").select("id, nom, ville").order("nom")]);
		if (liste.error || annuaire.error) setErreur("Les soirées sont indisponibles.");
		else {
			setSoirees(liste.data ?? []);
			setManades(annuaire.data ?? []);
		}
	}
	useEffect(() => {
		if (client) recharger(client);
	}, [client]);
	async function creer(evenement) {
		evenement.preventDefault();
		if (!client || enCours) return;
		const champs = new FormData(evenement.currentTarget);
		const nom = String(champs.get("nom") ?? "").trim();
		const date = String(champs.get("date") ?? "");
		const lieu = String(champs.get("lieu") ?? "").trim();
		const fenetre = fenetreDefaut(date);
		setEnCours(true);
		setErreur(null);
		let slug = slugifier(`${nom}-${date.slice(0, 4)}`);
		for (let essai = 0; essai < 5; essai += 1) {
			const { error } = await client.from("soirees").insert({
				slug,
				nom,
				date_soiree: date,
				lieu: lieu || null,
				vote_debut: fenetre.voteDebut,
				vote_fin: fenetre.voteFin,
				statut: "brouillon"
			});
			if (!error) {
				evenement.currentTarget.reset();
				await recharger();
				setEnCours(false);
				return;
			}
			if (!/duplicate|unique/i.test(error.message)) {
				setErreur("La soirée n’a pas pu être créée.");
				setEnCours(false);
				return;
			}
			slug = `${slugifier(nom)}-${essai + 2}`;
		}
		setErreur("La soirée n’a pas pu être créée.");
		setEnCours(false);
	}
	async function ajouterManade(evenement) {
		evenement.preventDefault();
		if (!client || enCours) return;
		const champs = new FormData(evenement.currentTarget);
		setEnCours(true);
		setErreur(null);
		const { error } = await client.from("manades").insert({
			nom: String(champs.get("nom") ?? "").trim(),
			ville: String(champs.get("ville") ?? "").trim() || null
		});
		setEnCours(false);
		if (error) setErreur("La manade n’a pas pu être ajoutée à l’annuaire.");
		else {
			evenement.currentTarget.reset();
			await recharger();
		}
	}
	if (erreurClient) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreurClient
	});
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs("section", {
			className: CARTE$1,
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-2xl",
					children: "Nouvelle soirée"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-1 text-sm text-encre-2",
					children: "Créée en brouillon, invisible du public. Fenêtre de vote par défaut : 21h00–23h30, heure de Paris."
				}),
				/* @__PURE__ */ jsxs("form", {
					onSubmit: (evenement) => void creer(evenement),
					className: "mt-4 grid gap-3 tablette:grid-cols-2",
					children: [
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Nom", /* @__PURE__ */ jsx("input", {
								name: "nom",
								required: true,
								maxLength: 120,
								className: CHAMP$1
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Date", /* @__PURE__ */ jsx("input", {
								name: "date",
								type: "date",
								required: true,
								className: CHAMP$1
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium tablette:col-span-2",
							children: ["Lieu", /* @__PURE__ */ jsx("input", {
								name: "lieu",
								maxLength: 160,
								className: CHAMP$1
							})]
						}),
						/* @__PURE__ */ jsx("button", {
							className: BOUTON_PLEIN,
							disabled: enCours,
							children: enCours ? "Enregistrement…" : "Créer la soirée"
						})
					]
				})
			]
		}),
		erreur ? /* @__PURE__ */ jsx("p", {
			role: "alert",
			className: "text-rouge-alerte",
			children: erreur
		}) : null,
		/* @__PURE__ */ jsxs("section", {
			className: CARTE$1,
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-2xl",
					children: "Soirées"
				}),
				!soirees ? /* @__PURE__ */ jsx("p", {
					role: "status",
					className: "mt-3",
					children: "Lecture…"
				}) : /* @__PURE__ */ jsx("ul", {
					className: "mt-3 divide-y divide-trait",
					children: soirees.map((soiree) => /* @__PURE__ */ jsxs("li", {
						className: "flex min-h-14 flex-wrap items-center justify-between gap-3 py-2",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
							className: "font-semibold",
							children: soiree.nom
						}), /* @__PURE__ */ jsxs("p", {
							className: "text-sm text-encre-2",
							children: [
								soiree.date_soiree,
								" · ",
								soiree.lieu || "Lieu à préciser",
								" · ",
								STATUTS$1[soiree.statut] ?? soiree.statut
							]
						})] }), /* @__PURE__ */ jsx(Link, {
							to: `/admin/soirees/${soiree.id}`,
							className: BOUTON$1,
							children: "Préparer"
						})]
					}, soiree.id))
				}),
				soirees && !soirees.length ? /* @__PURE__ */ jsx("p", {
					className: "mt-3 text-sm text-encre-2",
					children: "Aucune soirée. Le public reste hors soirée."
				}) : null
			]
		}),
		/* @__PURE__ */ jsxs("section", {
			className: CARTE$1,
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-2xl",
					children: "Annuaire des manades"
				}),
				/* @__PURE__ */ jsxs("form", {
					onSubmit: (evenement) => void ajouterManade(evenement),
					className: "mt-4 grid gap-3 tablette:grid-cols-[1fr_1fr_auto]",
					children: [
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Nom", /* @__PURE__ */ jsx("input", {
								name: "nom",
								required: true,
								maxLength: 80,
								className: CHAMP$1
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Ville", /* @__PURE__ */ jsx("input", {
								name: "ville",
								maxLength: 80,
								className: CHAMP$1
							})]
						}),
						/* @__PURE__ */ jsx("button", {
							className: `${BOUTON_PLEIN} self-end`,
							disabled: enCours,
							children: "Ajouter"
						})
					]
				}),
				/* @__PURE__ */ jsx("ul", {
					className: "mt-4 columns-1 tablette:columns-2",
					children: manades.map((manade) => /* @__PURE__ */ jsxs("li", {
						className: "min-h-8",
						children: [manade.nom, manade.ville ? ` · ${manade.ville}` : ""]
					}, manade.id))
				})
			]
		})
	] });
}
//#endregion
//#region app/routes/admin-soiree.tsx
var admin_soiree_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_soiree_default,
	meta: () => meta$7
});
var STATUTS = [
	"brouillon",
	"publiee",
	"en_cours",
	"terminee",
	"reportee",
	"annulee"
];
function meta$7() {
	return [{ title: "Préparation · Administration" }, {
		name: "robots",
		content: "noindex"
	}];
}
var admin_soiree_default = UNSAFE_withComponentProps(function PreparationSoiree() {
	const { soireeId = "" } = useParams();
	return /* @__PURE__ */ jsx(CadreAdmin, {
		surtitre: "Préparation",
		titre: "Soirée",
		children: /* @__PURE__ */ jsx(Editeur, { soireeId })
	});
});
function Editeur({ soireeId }) {
	const { client, session, erreurClient } = useClientAdmin();
	const [soiree, setSoiree] = useState(null);
	const [annuaire, setAnnuaire] = useState([]);
	const [engages, setEngages] = useState([]);
	const [epreuves, setEpreuves] = useState([]);
	const [passages, setPassages] = useState([]);
	const [juges, setJuges] = useState([]);
	const [rattaches, setRattaches] = useState([]);
	const [erreur, setErreur] = useState(null);
	const [info, setInfo] = useState(null);
	const [enCours, setEnCours] = useState(false);
	const [origine, setOrigine] = useState("");
	useEffect(() => {
		setOrigine(window.location.origin);
	}, []);
	async function recharger() {
		if (!client) return;
		const [s, m, sm, e, p, j, sj] = await Promise.all([
			client.from("soirees").select("*").eq("id", soireeId).maybeSingle(),
			client.from("manades").select("id, nom").order("nom"),
			client.from("soiree_manades").select("manade_id, ordre").eq("soiree_id", soireeId).order("ordre"),
			client.from("epreuves").select("id, ordre, nom, description, notee, heure_debut, heure_fin").eq("soiree_id", soireeId).order("ordre"),
			client.from("passages").select("id, epreuve_id, manade_id, ordre"),
			client.from("profils").select("id, prenom").eq("role", "juge").order("prenom"),
			client.from("soiree_juges").select("juge_id").eq("soiree_id", soireeId)
		]);
		if (s.error || !s.data) {
			setErreur("Cette soirée est introuvable.");
			return;
		}
		setSoiree(s.data);
		setAnnuaire(m.data ?? []);
		setEngages(sm.data ?? []);
		const epreuveIds = new Set((e.data ?? []).map((epreuve) => epreuve.id));
		setEpreuves(e.data ?? []);
		setPassages((p.data ?? []).filter((passage) => epreuveIds.has(passage.epreuve_id)));
		setJuges(j.data ?? []);
		setRattaches((sj.data ?? []).map((ligne) => ligne.juge_id));
	}
	useEffect(() => {
		if (client) recharger();
	}, [client, soireeId]);
	async function executer(action) {
		if (enCours) return;
		setEnCours(true);
		setErreur(null);
		setInfo(null);
		const { error } = await action();
		setEnCours(false);
		if (error) setErreur(error.message || "L’enregistrement n’a pas abouti.");
		else {
			setInfo("Enregistré.");
			await recharger();
		}
	}
	async function enregistrerInfos(evenement) {
		evenement.preventDefault();
		if (!client || !soiree) return;
		const champs = new FormData(evenement.currentTarget);
		const delai = String(champs.get("delai") ?? "");
		await executer(() => client.from("soirees").update({
			nom: String(champs.get("nom") ?? "").trim(),
			lieu: String(champs.get("lieu") ?? "").trim() || null,
			date_soiree: String(champs.get("date") ?? soiree.date_soiree),
			vote_debut: depuisChampParis(String(champs.get("debut") ?? "")),
			vote_fin: depuisChampParis(String(champs.get("fin") ?? "")),
			mode_vote: String(champs.get("mode_vote")),
			mode_fenetre: String(champs.get("mode_fenetre")),
			delai_vote_minutes: delai === "" ? null : Number(delai),
			bareme_jury: Number(champs.get("bareme")),
			mode_classement: String(champs.get("mode_classement")),
			methode_general: String(champs.get("methode")),
			poids_jury: Number(champs.get("poids")),
			classement_visible: champs.get("visible") === "on",
			statut: String(champs.get("statut")),
			message_public: String(champs.get("message") ?? "").trim() || null
		}).eq("id", soiree.id));
	}
	async function basculerManade(manadeId, present) {
		if (!client) return;
		await executer(async () => {
			if (present) {
				const passagesManade = passages.filter((passage) => passage.manade_id === manadeId).map((passage) => passage.id);
				if (passagesManade.length) {
					const suppression = await client.from("passages").delete().in("id", passagesManade);
					if (suppression.error) return suppression;
				}
				return client.from("soiree_manades").delete().eq("soiree_id", soireeId).eq("manade_id", manadeId);
			}
			const ordre = (engages.at(-1)?.ordre ?? 0) + 1;
			const ajout = await client.from("soiree_manades").insert({
				soiree_id: soireeId,
				manade_id: manadeId,
				ordre
			});
			if (ajout.error) return ajout;
			if (epreuves.length) return client.from("passages").insert(epreuves.map((epreuve) => ({
				epreuve_id: epreuve.id,
				manade_id: manadeId,
				ordre: (passages.filter((passage) => passage.epreuve_id === epreuve.id).at(-1)?.ordre ?? 0) + 1
			})));
			return ajout;
		});
	}
	async function deplacerManade(index, sens) {
		if (!client) return;
		const voisin = engages[index + sens];
		const courant = engages[index];
		if (!voisin || !courant) return;
		const [temporaire, ordreCourant, ordreVoisin] = etapesEchange(courant.ordre, voisin.ordre);
		await executer(async () => {
			const a = await client.from("soiree_manades").update({ ordre: temporaire }).eq("soiree_id", soireeId).eq("manade_id", courant.manade_id);
			if (a.error) return a;
			const b = await client.from("soiree_manades").update({ ordre: ordreCourant }).eq("soiree_id", soireeId).eq("manade_id", voisin.manade_id);
			if (b.error) return b;
			return client.from("soiree_manades").update({ ordre: ordreVoisin }).eq("soiree_id", soireeId).eq("manade_id", courant.manade_id);
		});
	}
	async function poserModele() {
		if (!client || !soiree) return;
		if (epreuves.length && !window.confirm("Remplacer le planning actuel par les 4 épreuves de référence ? Les passages déjà notés ne peuvent pas être supprimés.")) return;
		const horaires = horairesModele(soiree.date_soiree);
		await executer(async () => {
			if (epreuves.length) {
				const suppression = await client.from("epreuves").delete().eq("soiree_id", soireeId);
				if (suppression.error) return suppression;
			}
			const creees = await client.from("epreuves").insert(EPREUVES_MODELE.map((epreuve, index) => ({
				soiree_id: soireeId,
				ordre: index + 1,
				nom: epreuve.nom,
				description: epreuve.description,
				notee: true,
				heure_debut: horaires[index]?.heureDebut,
				heure_fin: horaires[index]?.heureFin
			}))).select("id");
			if (creees.error || !creees.data) return creees;
			if (!engages.length) return creees;
			return client.from("passages").insert(creees.data.flatMap((epreuve) => engages.map((manade) => ({
				epreuve_id: epreuve.id,
				manade_id: manade.manade_id,
				ordre: manade.ordre
			}))));
		});
	}
	async function ajouterEpreuve(evenement) {
		evenement.preventDefault();
		if (!client) return;
		const champs = new FormData(evenement.currentTarget);
		const nom = String(champs.get("nom") ?? "").trim();
		await executer(async () => {
			const creee = await client.from("epreuves").insert({
				soiree_id: soireeId,
				ordre: (epreuves.at(-1)?.ordre ?? 0) + 1,
				nom,
				description: String(champs.get("description") ?? "").trim() || null,
				notee: champs.get("notee") === "on"
			}).select("id").single();
			if (creee.error || !creee.data) return creee;
			if (!engages.length) return creee;
			return client.from("passages").insert(engages.map((manade) => ({
				epreuve_id: creee.data.id,
				manade_id: manade.manade_id,
				ordre: manade.ordre
			})));
		});
	}
	async function deplacerEpreuve(index, sens) {
		if (!client) return;
		const courant = epreuves[index];
		const voisin = epreuves[index + sens];
		if (!courant || !voisin) return;
		const [temporaire, ordreCourant, ordreVoisin] = etapesEchange(courant.ordre, voisin.ordre);
		await executer(async () => {
			const a = await client.from("epreuves").update({ ordre: temporaire }).eq("id", courant.id);
			if (a.error) return a;
			const b = await client.from("epreuves").update({ ordre: ordreCourant }).eq("id", voisin.id);
			if (b.error) return b;
			return client.from("epreuves").update({ ordre: ordreVoisin }).eq("id", courant.id);
		});
	}
	async function supprimerEpreuve(id) {
		if (!client || !window.confirm("Supprimer cette épreuve et ses passages ?")) return;
		await executer(() => client.from("epreuves").delete().eq("id", id));
	}
	async function glisser(table, liste, depuis, vers) {
		if (!client) return;
		const etapes = etapesReordre(liste, depuis, vers);
		if (!etapes.length) return;
		await executer(async () => {
			for (const etape of etapes) {
				const resultat = await (table === "soiree_manades" ? client.from(table).update({ ordre: etape.ordre }).eq("soiree_id", soireeId).eq("manade_id", etape.id) : client.from(table).update({ ordre: etape.ordre }).eq("id", etape.id));
				if (resultat.error) return resultat;
			}
			return { error: null };
		});
	}
	function depot(evenement, vers, appliquer) {
		evenement.preventDefault();
		const depuis = Number(evenement.dataTransfer.getData("text/plain"));
		if (Number.isInteger(depuis)) appliquer(depuis);
	}
	async function deplacerPassage(epreuveId, index, sens) {
		if (!client) return;
		const liste = passages.filter((passage) => passage.epreuve_id === epreuveId).sort((a, b) => a.ordre - b.ordre);
		const courant = liste[index];
		const voisin = liste[index + sens];
		if (!courant || !voisin) return;
		const [temporaire, ordreCourant, ordreVoisin] = etapesEchange(courant.ordre, voisin.ordre);
		await executer(async () => {
			const a = await client.from("passages").update({ ordre: temporaire }).eq("id", courant.id);
			if (a.error) return a;
			const b = await client.from("passages").update({ ordre: ordreCourant }).eq("id", voisin.id);
			if (b.error) return b;
			return client.from("passages").update({ ordre: ordreVoisin }).eq("id", courant.id);
		});
	}
	async function basculerJuge(jugeId, present) {
		if (!client) return;
		await executer(() => present ? client.from("soiree_juges").delete().eq("soiree_id", soireeId).eq("juge_id", jugeId) : client.from("soiree_juges").insert({
			soiree_id: soireeId,
			juge_id: jugeId
		}));
	}
	async function dupliquer() {
		if (!client || !soiree) return;
		await executer(async () => {
			let slug = `${slugifier(soiree.slug)}-copie`.slice(0, 60);
			let identifiant = null;
			for (let essai = 0; essai < 5; essai += 1) {
				const copie = await client.from("soirees").insert({
					slug,
					nom: `${soiree.nom} (copie)`,
					date_soiree: soiree.date_soiree,
					lieu: soiree.lieu,
					vote_debut: soiree.vote_debut,
					vote_fin: soiree.vote_fin,
					mode_vote: soiree.mode_vote,
					mode_fenetre: soiree.mode_fenetre,
					delai_vote_minutes: soiree.delai_vote_minutes,
					bareme_jury: soiree.bareme_jury,
					mode_classement: soiree.mode_classement,
					methode_general: soiree.methode_general,
					poids_jury: soiree.poids_jury,
					classement_visible: false,
					statut: "brouillon"
				}).select("id").single();
				if (!copie.error && copie.data) {
					identifiant = copie.data.id;
					break;
				}
				if (!copie.error || !/duplicate|unique/i.test(copie.error.message)) return copie;
				slug = `${slugifier(soiree.slug)}-copie-${essai + 2}`.slice(0, 60);
			}
			if (!identifiant) return { error: { message: "La copie n’a pas pu être créée." } };
			if (engages.length) {
				const liens = await client.from("soiree_manades").insert(engages.map((manade) => ({
					soiree_id: identifiant,
					manade_id: manade.manade_id,
					ordre: manade.ordre
				})));
				if (liens.error) return liens;
			}
			if (epreuves.length) {
				const creees = await client.from("epreuves").insert(epreuves.map((epreuve) => ({
					soiree_id: identifiant,
					ordre: epreuve.ordre,
					nom: epreuve.nom,
					description: epreuve.description,
					notee: epreuve.notee,
					heure_debut: epreuve.heure_debut,
					heure_fin: epreuve.heure_fin
				}))).select("id, ordre");
				if (creees.error || !creees.data) return creees;
				const parOrdre = new Map(creees.data.map((epreuve) => [epreuve.ordre, epreuve.id]));
				const aCopier = passages.flatMap((passage) => {
					const source = epreuves.find((epreuve) => epreuve.id === passage.epreuve_id);
					const epreuveId = source ? parOrdre.get(source.ordre) : void 0;
					return epreuveId ? [{
						epreuve_id: epreuveId,
						manade_id: passage.manade_id,
						ordre: passage.ordre
					}] : [];
				});
				if (aCopier.length) {
					const copies = await client.from("passages").insert(aCopier);
					if (copies.error) return copies;
				}
			}
			return { error: null };
		});
	}
	if (erreurClient) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreurClient
	});
	if (!soiree) return /* @__PURE__ */ jsx("p", {
		role: "status",
		children: erreur ?? "Lecture de la soirée…"
	});
	const nomManade = new Map(annuaire.map((manade) => [manade.id, manade.nom]));
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ jsx(Link, {
					to: `/admin/soirees/${soiree.id}/direct`,
					className: BOUTON_PLEIN,
					children: "Cockpit en direct"
				}),
				/* @__PURE__ */ jsx(Link, {
					to: `/admin/soirees/${soiree.id}/resultats`,
					className: BOUTON$1,
					children: "Résultats"
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: BOUTON$1,
					onClick: () => void dupliquer(),
					disabled: enCours,
					children: "Dupliquer"
				})
			]
		}),
		erreur ? /* @__PURE__ */ jsx("p", {
			role: "alert",
			className: "text-rouge-alerte",
			children: erreur
		}) : null,
		info ? /* @__PURE__ */ jsx("p", {
			role: "status",
			className: "text-sm",
			children: info
		}) : null,
		/* @__PURE__ */ jsxs("form", {
			onSubmit: (evenement) => void enregistrerInfos(evenement),
			className: `${CARTE$1} grid gap-3`,
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-2xl",
					children: "Infos et réglages"
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "grid gap-2 font-medium",
					children: ["Nom", /* @__PURE__ */ jsx("input", {
						name: "nom",
						defaultValue: soiree.nom,
						required: true,
						className: CHAMP$1
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "grid gap-2 font-medium",
					children: ["Lieu", /* @__PURE__ */ jsx("input", {
						name: "lieu",
						defaultValue: soiree.lieu ?? "",
						className: CHAMP$1
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "grid gap-2 font-medium",
					children: ["Date", /* @__PURE__ */ jsx("input", {
						name: "date",
						type: "date",
						defaultValue: soiree.date_soiree,
						required: true,
						className: CHAMP$1
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "grid gap-3 tablette:grid-cols-2",
					children: [/* @__PURE__ */ jsxs("label", {
						className: "grid gap-2 font-medium",
						children: ["Début des votes", /* @__PURE__ */ jsx("input", {
							name: "debut",
							type: "datetime-local",
							defaultValue: champParis(soiree.vote_debut),
							required: true,
							className: CHAMP$1
						})]
					}), /* @__PURE__ */ jsxs("label", {
						className: "grid gap-2 font-medium",
						children: ["Fin des votes", /* @__PURE__ */ jsx("input", {
							name: "fin",
							type: "datetime-local",
							defaultValue: champParis(soiree.vote_fin),
							required: true,
							className: CHAMP$1
						})]
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "grid gap-3 tablette:grid-cols-2",
					children: [
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Mode de vote", /* @__PURE__ */ jsxs("select", {
								name: "mode_vote",
								defaultValue: soiree.mode_vote,
								className: CHAMP$1,
								children: [/* @__PURE__ */ jsx("option", {
									value: "deblocage",
									children: "Par déblocage"
								}), /* @__PURE__ */ jsx("option", {
									value: "libre",
									children: "Libre"
								})]
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Fenêtre", /* @__PURE__ */ jsxs("select", {
								name: "mode_fenetre",
								defaultValue: soiree.mode_fenetre,
								className: CHAMP$1,
								children: [/* @__PURE__ */ jsx("option", {
									value: "ajustable",
									children: "Ajustable"
								}), /* @__PURE__ */ jsx("option", {
									value: "automatique",
									children: "Automatique"
								})]
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Délai de vote (minutes, vide = désactivé)", /* @__PURE__ */ jsx("input", {
								name: "delai",
								type: "number",
								min: 1,
								max: 30,
								defaultValue: soiree.delai_vote_minutes ?? "",
								className: CHAMP$1
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Barème du jury", /* @__PURE__ */ jsxs("select", {
								name: "bareme",
								defaultValue: soiree.bareme_jury,
								className: CHAMP$1,
								children: [/* @__PURE__ */ jsx("option", {
									value: 20,
									children: "Sur 20"
								}), /* @__PURE__ */ jsx("option", {
									value: 10,
									children: "Sur 10"
								})]
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Classement officiel", /* @__PURE__ */ jsxs("select", {
								name: "mode_classement",
								defaultValue: soiree.mode_classement,
								className: CHAMP$1,
								children: [
									/* @__PURE__ */ jsx("option", {
										value: "separe",
										children: "Jury et prix du public"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "combine",
										children: "Combiné"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "jury",
										children: "Jury seul"
									})
								]
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Méthode du général", /* @__PURE__ */ jsxs("select", {
								name: "methode",
								defaultValue: soiree.methode_general,
								className: CHAMP$1,
								children: [/* @__PURE__ */ jsx("option", {
									value: "points",
									children: "Points par place"
								}), /* @__PURE__ */ jsx("option", {
									value: "moyenne",
									children: "Moyenne"
								})]
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Poids du jury (%)", /* @__PURE__ */ jsx("input", {
								name: "poids",
								type: "number",
								min: 0,
								max: 100,
								defaultValue: soiree.poids_jury,
								className: CHAMP$1
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Statut", /* @__PURE__ */ jsx("select", {
								name: "statut",
								defaultValue: soiree.statut,
								className: CHAMP$1,
								children: STATUTS.map((statut) => /* @__PURE__ */ jsx("option", {
									value: statut,
									children: statut
								}, statut))
							})]
						})
					]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "flex min-h-12 items-center gap-3 font-medium",
					children: [/* @__PURE__ */ jsx("input", {
						name: "visible",
						type: "checkbox",
						defaultChecked: soiree.classement_visible
					}), " Classement visible du public"]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "grid gap-2 font-medium",
					children: ["Message public (report ou annulation)", /* @__PURE__ */ jsx("textarea", {
						name: "message",
						defaultValue: soiree.message_public ?? "",
						maxLength: 500,
						className: `${CHAMP$1} min-h-24 py-2`
					})]
				}),
				/* @__PURE__ */ jsx("button", {
					className: BOUTON_PLEIN,
					disabled: enCours,
					children: enCours ? "Enregistrement…" : "Enregistrer"
				})
			]
		}),
		/* @__PURE__ */ jsxs("section", {
			className: CARTE$1,
			children: [/* @__PURE__ */ jsx("h2", {
				className: "font-display text-2xl",
				children: "Manades"
			}), /* @__PURE__ */ jsx("ul", {
				className: "mt-3 grid gap-2",
				children: annuaire.map((manade) => {
					const index = engages.findIndex((lien) => lien.manade_id === manade.id);
					return /* @__PURE__ */ jsxs("li", {
						className: "flex min-h-12 flex-wrap items-center gap-2",
						draggable: index >= 0,
						onDragStart: (evenement) => evenement.dataTransfer.setData("text/plain", String(index)),
						onDragOver: (evenement) => evenement.preventDefault(),
						onDrop: (evenement) => depot(evenement, index, (depuis) => void glisser("soiree_manades", engages.map((lien) => ({
							id: lien.manade_id,
							ordre: lien.ordre
						})), depuis, index)),
						children: [/* @__PURE__ */ jsxs("button", {
							type: "button",
							className: BOUTON$1,
							onClick: () => void basculerManade(manade.id, index >= 0),
							children: [
								index >= 0 ? "Retirer" : "Engager",
								" ",
								manade.nom
							]
						}), index >= 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("span", {
								className: "text-sm text-encre-2",
								children: ["Ordre ", engages[index]?.ordre]
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								className: BOUTON$1,
								onClick: () => void deplacerManade(index, -1),
								disabled: index === 0,
								children: "Monter"
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								className: BOUTON$1,
								onClick: () => void deplacerManade(index, 1),
								disabled: index === engages.length - 1,
								children: "Descendre"
							})
						] }) : null]
					}, manade.id);
				})
			})]
		}),
		/* @__PURE__ */ jsxs("section", {
			className: CARTE$1,
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center justify-between gap-3",
					children: [
						/* @__PURE__ */ jsx("h2", {
							className: "font-display text-2xl",
							children: "Planning"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: BOUTON$1,
							onClick: () => void poserModele(),
							disabled: enCours,
							children: "Modèle des 4 épreuves"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-2 w-full text-sm text-encre-2",
							children: "Glissez une ligne pour changer l’ordre, ou utilisez Monter et Descendre. Les notes déjà enregistrées ne sont pas modifiées."
						})
					]
				}),
				epreuves.map((epreuve, index) => {
					const liste = passages.filter((passage) => passage.epreuve_id === epreuve.id).sort((a, b) => a.ordre - b.ordre);
					return /* @__PURE__ */ jsxs("article", {
						className: "mt-4 border-t border-trait pt-4",
						draggable: true,
						onDragStart: (evenement) => evenement.dataTransfer.setData("text/plain", String(index)),
						onDragOver: (evenement) => evenement.preventDefault(),
						onDrop: (evenement) => depot(evenement, index, (depuis) => void glisser("epreuves", epreuves.map((ligne) => ({
							id: ligne.id,
							ordre: ligne.ordre
						})), depuis, index)),
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [
									/* @__PURE__ */ jsxs("h3", {
										className: "font-semibold",
										children: [
											epreuve.ordre,
											". ",
											epreuve.nom,
											epreuve.notee ? "" : " · démonstration"
										]
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										className: BOUTON$1,
										onClick: () => void deplacerEpreuve(index, -1),
										disabled: index === 0,
										children: "Monter"
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										className: BOUTON$1,
										onClick: () => void deplacerEpreuve(index, 1),
										disabled: index === epreuves.length - 1,
										children: "Descendre"
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										className: BOUTON$1,
										onClick: () => void supprimerEpreuve(epreuve.id),
										children: "Supprimer"
									})
								]
							}),
							epreuve.description ? /* @__PURE__ */ jsx("p", {
								className: "mt-1 text-sm text-encre-2",
								children: epreuve.description
							}) : null,
							/* @__PURE__ */ jsx("ul", {
								className: "mt-2 grid gap-1",
								children: liste.map((passage, rang) => /* @__PURE__ */ jsxs("li", {
									className: "flex min-h-12 items-center gap-2",
									draggable: true,
									onDragStart: (evenement) => {
										evenement.stopPropagation();
										evenement.dataTransfer.setData("text/plain", String(rang));
									},
									onDragOver: (evenement) => evenement.preventDefault(),
									onDrop: (evenement) => {
										evenement.stopPropagation();
										depot(evenement, rang, (depuis) => void glisser("passages", liste.map((ligne) => ({
											id: ligne.id,
											ordre: ligne.ordre
										})), depuis, rang));
									},
									children: [
										/* @__PURE__ */ jsx("span", { children: nomManade.get(passage.manade_id) ?? "Manade" }),
										/* @__PURE__ */ jsx("button", {
											type: "button",
											className: BOUTON$1,
											onClick: () => void deplacerPassage(epreuve.id, rang, -1),
											disabled: rang === 0,
											children: "Monter"
										}),
										/* @__PURE__ */ jsx("button", {
											type: "button",
											className: BOUTON$1,
											onClick: () => void deplacerPassage(epreuve.id, rang, 1),
											disabled: rang === liste.length - 1,
											children: "Descendre"
										})
									]
								}, passage.id))
							})
						]
					}, epreuve.id);
				}),
				/* @__PURE__ */ jsxs("form", {
					onSubmit: (evenement) => void ajouterEpreuve(evenement),
					className: "mt-4 grid gap-3",
					children: [
						/* @__PURE__ */ jsx("h3", {
							className: "font-semibold",
							children: "Saisie manuelle"
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Nom", /* @__PURE__ */ jsx("input", {
								name: "nom",
								required: true,
								className: CHAMP$1
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "grid gap-2 font-medium",
							children: ["Description", /* @__PURE__ */ jsx("textarea", {
								name: "description",
								className: `${CHAMP$1} min-h-20 py-2`
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "flex min-h-12 items-center gap-3",
							children: [/* @__PURE__ */ jsx("input", {
								name: "notee",
								type: "checkbox",
								defaultChecked: true
							}), " Épreuve notée"]
						}),
						/* @__PURE__ */ jsx("button", {
							className: BOUTON_PLEIN,
							disabled: enCours,
							children: "Ajouter l’épreuve"
						})
					]
				})
			]
		}),
		client ? /* @__PURE__ */ jsx(ImportPlanning, {
			client,
			soireeId,
			jour: soiree.date_soiree,
			dejaSaisi: epreuves.length > 0,
			sessionToken: session?.access_token,
			onApplique: () => void recharger()
		}) : null,
		/* @__PURE__ */ jsxs("section", {
			className: CARTE$1,
			children: [/* @__PURE__ */ jsx("h2", {
				className: "font-display text-2xl",
				children: "Juges de la soirée"
			}), !juges.length ? /* @__PURE__ */ jsx("p", {
				className: "mt-2 text-sm text-encre-2",
				children: "Aucun compte juge. Créez-en un depuis la page Juges."
			}) : /* @__PURE__ */ jsx("ul", {
				className: "mt-3 grid gap-2",
				children: juges.map((juge) => {
					const present = rattaches.includes(juge.id);
					return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
						type: "button",
						className: BOUTON$1,
						onClick: () => void basculerJuge(juge.id, present),
						children: [
							present ? "Retirer" : "Rattacher",
							" ",
							juge.prenom
						]
					}) }, juge.id);
				})
			})]
		}),
		/* @__PURE__ */ jsxs("section", {
			className: CARTE$1,
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-2xl",
					children: "QR code de vote et affiche"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-1 text-sm text-encre-2",
					children: "À afficher dans les arènes. Le public ouvre /noter. Les inscriptions restent fermées tant que le drapeau de build n’est pas ouvert."
				}),
				origine && soiree ? /* @__PURE__ */ jsx("div", {
					className: "mt-4 inline-block rounded-2xl bg-white p-3",
					children: /* @__PURE__ */ jsx(CodeQr, {
						valeur: `${origine}/noter`,
						libelle: `QR code de vote pour ${soiree.nom}`
					})
				}) : null,
				/* @__PURE__ */ jsx("p", {
					className: "mt-2 break-all text-sm",
					children: origine ? `${origine}/noter` : "/noter"
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: `${BOUTON$1} mt-3`,
					onClick: () => {
						if (!soiree || !origine) return;
						const url = `${origine}/noter`;
						telechargerFichier(`affiche-${soiree.slug}.pdf`, documentPdf({
							titre: soiree.nom,
							lignes: [
								soiree.lieu ?? "",
								soiree.date_soiree,
								"Votez sur votre téléphone",
								url
							],
							qr: matriceQr(url),
							legendeQr: "Scannez pour noter les manades"
						}), "application/pdf");
					},
					children: "Télécharger l’affiche PDF"
				})
			]
		})
	] });
}
//#endregion
//#region app/routes/admin-direct.tsx
var admin_direct_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_direct_default,
	meta: () => meta$6
});
function meta$6() {
	return [{ title: "Cockpit · Administration" }, {
		name: "robots",
		content: "noindex"
	}];
}
var admin_direct_default = UNSAFE_withComponentProps(function Cockpit() {
	const { soireeId = "" } = useParams();
	return /* @__PURE__ */ jsx(CadreAdmin, {
		surtitre: "En direct",
		titre: "Cockpit",
		children: /* @__PURE__ */ jsx(Pilotage, { soireeId })
	});
});
function Pilotage({ soireeId }) {
	const { client, session, erreurClient } = useClientAdmin();
	const [soiree, setSoiree] = useState(null);
	const [epreuves, setEpreuves] = useState([]);
	const [passages, setPassages] = useState([]);
	const [noms, setNoms] = useState(/* @__PURE__ */ new Map());
	const [votes, setVotes] = useState(/* @__PURE__ */ new Map());
	const [jugesEnRetard, setJugesEnRetard] = useState([]);
	const [erreur, setErreur] = useState(null);
	const [enCours, setEnCours] = useState(false);
	const [confirmation, setConfirmation] = useState(null);
	const [minutes, setMinutes] = useState(5);
	const [maintenant, setMaintenant] = useState(() => Date.now());
	async function recharger() {
		if (!client) return;
		const [s, e, manades] = await Promise.all([
			client.from("soirees").select("id, nom, statut, mode_vote, delai_vote_minutes").eq("id", soireeId).maybeSingle(),
			client.from("epreuves").select("id, ordre, nom, notee, heure_debut, heure_fin").eq("soiree_id", soireeId).order("ordre"),
			client.from("soiree_manades").select("manade_id, manades(nom)").eq("soiree_id", soireeId)
		]);
		if (s.error || !s.data) {
			setErreur("Soirée introuvable.");
			return;
		}
		setSoiree(s.data);
		const listeEpreuves = e.data ?? [];
		setEpreuves(listeEpreuves);
		const ids = listeEpreuves.map((epreuve) => epreuve.id);
		const p = ids.length ? await client.from("passages").select("id, epreuve_id, manade_id, ordre, statut_public, statut_jury, jury_lie_au_public, fin_passage_le, ferme_le").in("epreuve_id", ids) : {
			data: [],
			error: null
		};
		if (p.error) {
			setErreur("Les passages sont indisponibles.");
			return;
		}
		const liste = p.data ?? [];
		setPassages(liste);
		const carte = /* @__PURE__ */ new Map();
		for (const lien of manades.data ?? []) {
			const nom = Array.isArray(lien.manades) ? lien.manades[0]?.nom : lien.manades?.nom;
			if (nom) carte.set(lien.manade_id, nom);
		}
		setNoms(carte);
		const passageIds = liste.map((passage) => passage.id);
		if (passageIds.length) {
			const notes = await client.from("notes_public").select("passage_id").in("passage_id", passageIds);
			const compte = /* @__PURE__ */ new Map();
			for (const note of notes.data ?? []) compte.set(note.passage_id, (compte.get(note.passage_id) ?? 0) + 1);
			setVotes(compte);
			const jury = await client.from("notes_jury").select("passage_id, juge_id").in("passage_id", passageIds);
			const rattaches = await client.from("soiree_juges").select("juge_id, profils(prenom)").eq("soiree_id", soireeId);
			const ouverts = new Set(liste.filter((passage) => passage.statut_jury === "ouvert").map((passage) => passage.id));
			const notesParJuge = /* @__PURE__ */ new Map();
			for (const note of jury.data ?? []) {
				const ensemble = notesParJuge.get(note.juge_id) ?? /* @__PURE__ */ new Set();
				ensemble.add(note.passage_id);
				notesParJuge.set(note.juge_id, ensemble);
			}
			const retard = [];
			for (const juge of rattaches.data ?? []) {
				const prenom = Array.isArray(juge.profils) ? juge.profils[0]?.prenom : juge.profils?.prenom;
				const faites = notesParJuge.get(juge.juge_id) ?? /* @__PURE__ */ new Set();
				if ([...ouverts].some((id) => !faites.has(id))) retard.push(prenom ?? "Juge");
			}
			setJugesEnRetard(retard);
		}
	}
	useEffect(() => {
		if (!client) return;
		recharger();
		const minuteur = setInterval(() => {
			setMaintenant(Date.now());
			recharger();
		}, 8e3);
		return () => clearInterval(minuteur);
	}, [client, soireeId]);
	async function executer(action) {
		if (!client || enCours) return;
		setEnCours(true);
		setErreur(null);
		const { error } = await action();
		setEnCours(false);
		setConfirmation(null);
		if (error) setErreur(error.message || "L’action n’a pas abouti.");
		else await recharger();
		return !error;
	}
	async function prevenir(texte) {
		if (!session?.access_token) return;
		await fetch("/api/notifications/diffuser", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${session.access_token}`
			},
			body: JSON.stringify({
				cle: soireeId,
				texte,
				url: "/noter"
			})
		}).catch(() => void 0);
	}
	function maj(ids, valeurs) {
		if (!client) return Promise.resolve({ error: { message: "Indisponible" } });
		return client.from("passages").update(valeurs).in("id", ids);
	}
	function juryASuivre(cibles) {
		return cibles.length > 0 && cibles.every((passage) => passage.jury_lie_au_public && passage.statut_jury !== "verrouille");
	}
	async function debloquer(cibles) {
		if (await executer(() => maj(cibles.map((passage) => passage.id), juryASuivre(cibles) ? {
			statut_public: "ouvert",
			statut_jury: "ouvert"
		} : { statut_public: "ouvert" }))) {
			const manade = cibles.length === 1 ? noms.get(cibles[0].manade_id) : null;
			const epreuve = epreuves.find((ligne) => ligne.id === cibles[0]?.epreuve_id)?.nom ?? "Passage";
			prevenir(manade ? `${epreuve} en piste : manade ${manade}` : `${epreuve} en piste`);
		}
	}
	async function fermer(cibles) {
		await executer(() => maj(cibles.map((passage) => passage.id), {
			statut_public: "clos",
			ferme_le: (/* @__PURE__ */ new Date()).toISOString(),
			...juryASuivre(cibles) ? { statut_jury: "clos" } : {}
		}));
	}
	async function passageTermine(passage) {
		const fin = (/* @__PURE__ */ new Date()).toISOString();
		const delai = soiree?.delai_vote_minutes;
		await executer(() => maj([passage.id], {
			fin_passage_le: fin,
			ferme_le: delai == null ? null : new Date(Date.now() + delai * 6e4).toISOString()
		}));
	}
	async function prolonger(passage) {
		const base = passage.ferme_le && Date.parse(passage.ferme_le) > Date.now() ? Date.parse(passage.ferme_le) : Date.now();
		await executer(() => maj([passage.id], {
			statut_public: "ouvert",
			ferme_le: new Date(base + minutes * 6e4).toISOString()
		}));
	}
	async function decalerSuite(ordre) {
		if (!client) return;
		await executer(async () => {
			const suivantes = epreuves.filter((epreuve) => epreuve.ordre > ordre && epreuve.heure_debut && epreuve.heure_fin);
			for (const epreuve of suivantes) {
				const resultat = await client.from("epreuves").update({
					heure_debut: new Date(Date.parse(epreuve.heure_debut ?? "") + minutes * 6e4).toISOString(),
					heure_fin: new Date(Date.parse(epreuve.heure_fin ?? "") + minutes * 6e4).toISOString()
				}).eq("id", epreuve.id);
				if (resultat.error) return resultat;
			}
			return { error: null };
		});
	}
	if (erreurClient) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreurClient
	});
	if (!soiree) return /* @__PURE__ */ jsx("p", {
		role: "status",
		children: erreur ?? "Lecture du cockpit…"
	});
	const courante = epreuves.find((epreuve) => passages.some((passage) => passage.epreuve_id === epreuve.id && passage.statut_public === "ouvert")) ?? epreuves.find((epreuve) => epreuve.notee) ?? epreuves[0];
	const liste = passages.filter((passage) => passage.epreuve_id === courante?.id).sort((a, b) => a.ordre - b.ordre);
	async function glisserPassages(depuis, vers) {
		if (!client) return;
		const etapes = etapesReordre(liste.map((passage) => ({
			id: passage.id,
			ordre: passage.ordre
		})), depuis, vers);
		if (!etapes.length) return;
		await executer(async () => {
			for (const etape of etapes) {
				const resultat = await client.from("passages").update({ ordre: etape.ordre }).eq("id", etape.id);
				if (resultat.error) return resultat;
			}
			return { error: null };
		});
	}
	function deposer(evenement, vers) {
		evenement.preventDefault();
		const depuis = Number(evenement.dataTransfer.getData("text/plain"));
		if (Number.isInteger(depuis)) glisserPassages(depuis, vers);
	}
	function exporterPdf() {
		if (!soiree || !courante) return;
		const lignes = [
			soiree.nom,
			courante.nom,
			...liste.map((passage) => `${noms.get(passage.manade_id) ?? "Manade"} · ${votes.get(passage.id) ?? 0} vote(s) · ${passage.statut_public}`)
		];
		telechargerFichier(`cockpit-${soiree.nom}.pdf`, documentPdf({
			titre: "Cockpit",
			lignes
		}), "application/pdf");
	}
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs("p", {
			className: "text-sm text-encre-2",
			children: [
				soiree.nom,
				" · ",
				soiree.statut,
				" · ",
				soiree.mode_vote === "libre" ? "Vote libre" : "Vote par déblocage"
			]
		}),
		/* @__PURE__ */ jsx(Link, {
			to: `/admin/soirees/${soireeId}`,
			className: "text-sm underline",
			children: "Retour à la préparation"
		}),
		erreur ? /* @__PURE__ */ jsx("p", {
			role: "alert",
			className: "text-rouge-alerte",
			children: erreur
		}) : null,
		/* @__PURE__ */ jsxs("label", {
			className: "grid max-w-xs gap-2 font-medium",
			children: ["Minutes (décalage ou prolongation)", /* @__PURE__ */ jsx("input", {
				type: "number",
				min: 1,
				max: 30,
				value: minutes,
				onChange: (evenement) => setMinutes(Number(evenement.target.value)),
				className: CHAMP$1
			})]
		}),
		courante ? /* @__PURE__ */ jsxs("section", {
			className: CARTE$1,
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-3xl",
					children: courante.nom
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-4 flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: BOUTON_PLEIN,
							disabled: enCours,
							onClick: () => void debloquer(liste),
							children: "Débloquer l’épreuve"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: BOUTON$1,
							disabled: enCours,
							onClick: () => setConfirmation(confirmation === "fermer" ? null : "fermer"),
							children: "Fermer l’épreuve"
						}),
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							className: BOUTON$1,
							disabled: enCours,
							onClick: () => void decalerSuite(courante.ordre),
							children: [
								"Décaler la suite de +",
								minutes,
								" min"
							]
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: BOUTON$1,
							onClick: exporterPdf,
							children: "Exporter le suivi PDF"
						})
					]
				}),
				confirmation === "fermer" ? /* @__PURE__ */ jsx("button", {
					type: "button",
					className: `${BOUTON_PLEIN} mt-3`,
					onClick: () => void fermer(liste),
					children: "Confirmer la fermeture"
				}) : null,
				/* @__PURE__ */ jsx("ul", {
					className: "mt-5 grid gap-3",
					children: liste.map((passage, rang) => {
						const reste = passage.ferme_le ? Math.max(0, Math.ceil((Date.parse(passage.ferme_le) - maintenant) / 1e3)) : null;
						return /* @__PURE__ */ jsxs("li", {
							className: "rounded-xl border border-trait p-3",
							draggable: true,
							onDragStart: (evenement) => evenement.dataTransfer.setData("text/plain", String(rang)),
							onDragOver: (evenement) => evenement.preventDefault(),
							onDrop: (evenement) => deposer(evenement, rang),
							children: [
								/* @__PURE__ */ jsx("p", {
									className: "font-semibold",
									children: noms.get(passage.manade_id) ?? "Manade"
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "text-sm text-encre-2",
									children: [
										votes.get(passage.id) ?? 0,
										" vote",
										(votes.get(passage.id) ?? 0) > 1 ? "s" : "",
										" · public ",
										passage.statut_public,
										" · jury ",
										passage.statut_jury
									]
								}),
								reste !== null && passage.statut_public === "ouvert" ? /* @__PURE__ */ jsx("p", {
									className: "text-sm",
									children: reste > 0 ? `Fermeture automatique dans ${reste} s` : "Échéance de vote dépassée"
								}) : null,
								/* @__PURE__ */ jsxs("div", {
									className: "mt-2 flex flex-wrap gap-2",
									children: [
										/* @__PURE__ */ jsx("button", {
											type: "button",
											className: BOUTON_PLEIN,
											disabled: enCours,
											onClick: () => void debloquer([passage]),
											children: "Débloquer"
										}),
										/* @__PURE__ */ jsx("button", {
											type: "button",
											className: BOUTON$1,
											disabled: enCours,
											onClick: () => void fermer([passage]),
											children: "Fermer"
										}),
										/* @__PURE__ */ jsx("button", {
											type: "button",
											className: BOUTON$1,
											disabled: enCours,
											onClick: () => void passageTermine(passage),
											children: "Passage terminé"
										}),
										/* @__PURE__ */ jsxs("button", {
											type: "button",
											className: BOUTON$1,
											disabled: enCours,
											onClick: () => void prolonger(passage),
											children: [
												"Prolonger de +",
												minutes,
												" min"
											]
										})
									]
								})
							]
						}, passage.id);
					})
				})
			]
		}) : /* @__PURE__ */ jsx("p", { children: "Aucune épreuve. Préparez le planning d’abord." }),
		/* @__PURE__ */ jsxs("section", {
			className: CARTE$1,
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-2xl",
					children: "Juges en retard"
				}),
				jugesEnRetard.length ? /* @__PURE__ */ jsx("ul", {
					className: "mt-2",
					children: jugesEnRetard.map((nom) => /* @__PURE__ */ jsx("li", { children: nom }, nom))
				}) : /* @__PURE__ */ jsx("p", {
					className: "mt-2 text-sm text-encre-2",
					children: "Aucun retard sur les passages ouverts au jury."
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-4 flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: BOUTON$1,
							onClick: () => setConfirmation(confirmation === "verrouiller" ? null : "verrouiller"),
							children: "Verrouiller le jury"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: BOUTON$1,
							onClick: () => setConfirmation(confirmation === "terminer" ? null : "terminer"),
							children: "Terminer la soirée"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: BOUTON$1,
							onClick: () => setConfirmation(confirmation === "annuler" ? null : "annuler"),
							children: "Annuler la soirée"
						})
					]
				}),
				confirmation === "verrouiller" ? /* @__PURE__ */ jsx("button", {
					type: "button",
					className: `${BOUTON_PLEIN} mt-3`,
					onClick: () => void executer(() => maj(passages.map((p) => p.id), { statut_jury: "verrouille" })),
					children: "Confirmer le verrouillage"
				}) : null,
				confirmation === "terminer" && client ? /* @__PURE__ */ jsx("button", {
					type: "button",
					className: `${BOUTON_PLEIN} mt-3`,
					onClick: () => void executer(() => client.from("soirees").update({ statut: "terminee" }).eq("id", soireeId)),
					children: "Confirmer la fin"
				}) : null,
				confirmation === "annuler" && client ? /* @__PURE__ */ jsx("button", {
					type: "button",
					className: `${BOUTON_PLEIN} mt-3`,
					onClick: () => void executer(() => client.from("soirees").update({ statut: "annulee" }).eq("id", soireeId)),
					children: "Confirmer l’annulation"
				}) : null
			]
		})
	] });
}
//#endregion
//#region serveur/classements.mjs
/**
* @typedef {{
*   id: string,
*   epreuveId: string,
*   epreuveNom: string,
*   epreuveOrdre: number,
*   manadeId: string,
*   manadeNom: string,
*   publicOuvert: boolean,
*   juryOuvert: boolean,
*   notesPublic: number[],
*   notesJury: number[],
* }} PassageCalcul
*/
/**
* @typedef {{
*   mode: 'separe' | 'combine' | 'jury',
*   methode: 'points' | 'moyenne',
*   poidsJury: number,
*   baremeJury: number,
* }} ReglagesClassement
*/
/**
* @typedef {{
*   manadeId: string,
*   manadeNom: string,
*   score: number,
*   votes: number | null,
*   rang: number,
*   points: number,
* }} LigneEpreuve
*/
/**
* @typedef {{
*   manadeId: string,
*   manadeNom: string,
*   total: number,
*   epreuves: number,
*   rang: number,
* }} LigneGeneral
*/
/**
* @typedef {{
*   provisoire: boolean,
*   officiel: 'separe' | 'combine' | 'jury',
*   methode: 'points' | 'moyenne',
*   parEpreuve: {
*     epreuveId: string,
*     nom: string,
*     ordre: number,
*     public: LigneEpreuve[] | null,
*     jury: LigneEpreuve[] | null,
*     combine: LigneEpreuve[] | null,
*   }[],
*   general: {
*     public: LigneGeneral[] | null,
*     jury: LigneGeneral[] | null,
*     combine: LigneGeneral[] | null,
*   },
* }} ResultatClassements
*/
/** @param {number} a @param {number} b */
function presqueEgal(a, b) {
	return Math.abs(a - b) < 1e-9;
}
/** @param {number[]} notes */
function moyenne(notes) {
	if (notes.length === 0) return null;
	return notes.reduce((somme, note) => somme + note, 0) / notes.length;
}
/**
* @param {{ manadeId: string, manadeNom: string, score: number, votes: number | null }[]} lignes
* @returns {LigneEpreuve[]}
*/
function classerEpreuve(lignes) {
	const tries = [...lignes].sort((a, b) => b.score - a.score || a.manadeNom.localeCompare(b.manadeNom, "fr"));
	const n = tries.length;
	let rang = 1;
	return tries.map((ligne, index) => {
		if (index > 0 && !presqueEgal(ligne.score, tries[index - 1].score)) rang = index + 1;
		return {
			...ligne,
			rang,
			points: n - rang + 1
		};
	});
}
/**
* @param {Map<string, { manadeId: string, manadeNom: string, scores: number[], points: number }>} parManade
* @param {'points' | 'moyenne'} methode
* @returns {LigneGeneral[]}
*/
function classerGeneral(parManade, methode) {
	/** @type {{ manadeId: string, manadeNom: string, total: number, epreuves: number }[]} */
	const lignes = [];
	for (const manade of parManade.values()) {
		if (manade.scores.length === 0 && manade.points === 0 && methode === "moyenne") continue;
		if (methode === "moyenne" && manade.scores.length === 0) continue;
		const total = methode === "points" ? manade.points : manade.scores.reduce((somme, score) => somme + score, 0) / manade.scores.length;
		lignes.push({
			manadeId: manade.manadeId,
			manadeNom: manade.manadeNom,
			total,
			epreuves: manade.scores.length
		});
	}
	const tries = lignes.sort((a, b) => b.total - a.total || a.manadeNom.localeCompare(b.manadeNom, "fr"));
	let rang = 1;
	return tries.map((ligne, index) => {
		if (index > 0 && !presqueEgal(ligne.total, tries[index - 1].total)) rang = index + 1;
		return {
			...ligne,
			rang
		};
	});
}
/**
* @param {PassageCalcul[]} passages
* @param {'public' | 'jury' | 'combine'} canal
* @param {ReglagesClassement} reglages
*/
function scoresEpreuve(passages, canal, reglages) {
	/** @type {{ manadeId: string, manadeNom: string, score: number, votes: number | null }[]} */
	const lignes = [];
	for (const passage of passages) {
		const publicMoyenne = moyenne(passage.notesPublic);
		const juryBrut = moyenne(passage.notesJury);
		const juryDix = juryBrut === null || reglages.baremeJury <= 0 ? null : juryBrut * (10 / reglages.baremeJury);
		let score = null;
		let votes = null;
		if (canal === "public") {
			score = publicMoyenne;
			votes = passage.notesPublic.length;
		} else if (canal === "jury") {
			score = juryDix;
			votes = passage.notesJury.length;
		} else if (publicMoyenne !== null && juryDix !== null) {
			const poids = Math.min(100, Math.max(0, reglages.poidsJury)) / 100;
			score = poids * juryDix + (1 - poids) * publicMoyenne;
			votes = passage.notesPublic.length;
		}
		if (score === null) continue;
		lignes.push({
			manadeId: passage.manadeId,
			manadeNom: passage.manadeNom,
			score,
			votes
		});
	}
	return classerEpreuve(lignes);
}
/**
* @param {PassageCalcul[]} passages
* @param {ReglagesClassement} reglages
* @returns {ResultatClassements}
*/
function calculerClassements(passages, reglages) {
	const groupes = /* @__PURE__ */ new Map();
	for (const passage of passages) {
		const liste = groupes.get(passage.epreuveId) ?? [];
		liste.push(passage);
		groupes.set(passage.epreuveId, liste);
	}
	const epreuves = [...groupes.entries()].map(([epreuveId, liste]) => ({
		epreuveId,
		nom: liste[0]?.epreuveNom ?? "",
		ordre: liste[0]?.epreuveOrdre ?? 0,
		passages: liste
	})).sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"));
	/** @type {ResultatClassements['parEpreuve']} */
	const parEpreuve = [];
	/** @type {Map<string, Map<string, { manadeId: string, manadeNom: string, scores: number[], points: number }>>} */
	const cumuls = /* @__PURE__ */ new Map([
		["public", /* @__PURE__ */ new Map()],
		["jury", /* @__PURE__ */ new Map()],
		["combine", /* @__PURE__ */ new Map()]
	]);
	for (const epreuve of epreuves) {
		/** @type {Record<'public' | 'jury' | 'combine', LigneEpreuve[]>} */
		const canaux = {
			public: scoresEpreuve(epreuve.passages, "public", reglages),
			jury: scoresEpreuve(epreuve.passages, "jury", reglages),
			combine: scoresEpreuve(epreuve.passages, "combine", reglages)
		};
		for (const canal of [
			"public",
			"jury",
			"combine"
		]) {
			const cumul = cumuls.get(canal);
			if (!cumul) continue;
			for (const ligne of canaux[canal]) {
				const existant = cumul.get(ligne.manadeId) ?? {
					manadeId: ligne.manadeId,
					manadeNom: ligne.manadeNom,
					scores: [],
					points: 0
				};
				existant.scores.push(ligne.score);
				existant.points += ligne.points;
				cumul.set(ligne.manadeId, existant);
			}
		}
		parEpreuve.push({
			epreuveId: epreuve.epreuveId,
			nom: epreuve.nom,
			ordre: epreuve.ordre,
			public: canaux.public,
			jury: canaux.jury,
			combine: canaux.combine
		});
	}
	return {
		provisoire: passages.some((passage) => passage.publicOuvert || passage.juryOuvert || passage.notesJury.length === 0),
		officiel: reglages.mode,
		methode: reglages.methode,
		parEpreuve,
		general: {
			public: classerGeneral(cumuls.get("public") ?? /* @__PURE__ */ new Map(), reglages.methode),
			jury: classerGeneral(cumuls.get("jury") ?? /* @__PURE__ */ new Map(), reglages.methode),
			combine: classerGeneral(cumuls.get("combine") ?? /* @__PURE__ */ new Map(), reglages.methode)
		}
	};
}
/** @param {string} valeur */
function celluleCsv(valeur) {
	if (/[;"\r\n]/.test(valeur)) return `"${valeur.replaceAll("\"", "\"\"")}"`;
	return valeur;
}
/** Export des classements calculés, séparateur point-virgule, comme la supervision. @param {ResultatClassements} resultat */
function exporterClassementsCsv(resultat) {
	const entete = "portee;epreuve;canal;rang;manade;score;votes_ou_epreuves;points;provisoire";
	/** @type {string[]} */
	const lignes = [];
	for (const epreuve of resultat.parEpreuve) for (const canal of [
		"public",
		"jury",
		"combine"
	]) for (const ligne of epreuve[canal] ?? []) lignes.push([
		"epreuve",
		epreuve.nom,
		canal,
		String(ligne.rang),
		ligne.manadeNom,
		String(ligne.score),
		String(ligne.votes ?? ""),
		String(ligne.points),
		resultat.provisoire ? "oui" : "non"
	].map(celluleCsv).join(";"));
	for (const canal of [
		"public",
		"jury",
		"combine"
	]) for (const ligne of resultat.general[canal] ?? []) lignes.push([
		"general",
		"",
		canal,
		String(ligne.rang),
		ligne.manadeNom,
		String(ligne.total),
		String(ligne.epreuves),
		"",
		resultat.provisoire ? "oui" : "non"
	].map(celluleCsv).join(";"));
	return `\uFEFF${[entete, ...lignes].join("\r\n")}`;
}
//#endregion
//#region app/routes/admin-resultats.tsx
var admin_resultats_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_resultats_default,
	meta: () => meta$5
});
function meta$5() {
	return [{ title: "Résultats · Administration" }, {
		name: "robots",
		content: "noindex"
	}];
}
var admin_resultats_default = UNSAFE_withComponentProps(function Resultats() {
	const { soireeId = "" } = useParams();
	return /* @__PURE__ */ jsx(CadreAdmin, {
		surtitre: "Résultats",
		titre: "Classements",
		children: /* @__PURE__ */ jsx(Calcul, { soireeId })
	});
});
function Calcul({ soireeId }) {
	const { client, session, erreurClient } = useClientAdmin();
	const [resultat, setResultat] = useState(null);
	const [nom, setNom] = useState("");
	const [visible, setVisible] = useState(true);
	const [erreur, setErreur] = useState(null);
	const [avis, setAvis] = useState([]);
	useEffect(() => {
		if (!client) return;
		let actif = true;
		(async () => {
			const soiree = await client.from("soirees").select("nom, mode_classement, methode_general, poids_jury, bareme_jury, classement_visible").eq("id", soireeId).maybeSingle();
			if (!actif) return;
			if (soiree.error || !soiree.data) {
				setErreur("Soirée introuvable.");
				return;
			}
			setNom(soiree.data.nom);
			setVisible(Boolean(soiree.data.classement_visible));
			const epreuves = await client.from("epreuves").select("id, nom, ordre, notee").eq("soiree_id", soireeId);
			const ids = (epreuves.data ?? []).map((epreuve) => epreuve.id);
			const [passages, manades] = await Promise.all([ids.length ? client.from("passages").select("id, epreuve_id, manade_id, statut_public, statut_jury, ferme_le").in("epreuve_id", ids) : Promise.resolve({
				data: [],
				error: null
			}), client.from("manades").select("id, nom")]);
			const liste = passages.data ?? [];
			const notesP = liste.length ? await client.from("notes_public").select("passage_id, note").in("passage_id", liste.map((p) => p.id)) : { data: [] };
			const notesJ = liste.length ? await client.from("notes_jury").select("passage_id, note").in("passage_id", liste.map((p) => p.id)) : { data: [] };
			if (!actif) return;
			const noms = new Map((manades.data ?? []).map((manade) => [manade.id, manade.nom]));
			const epreuveParId = new Map((epreuves.data ?? []).map((epreuve) => [epreuve.id, epreuve]));
			const publics = /* @__PURE__ */ new Map();
			const jurys = /* @__PURE__ */ new Map();
			for (const note of notesP.data ?? []) {
				const valeurs = publics.get(note.passage_id) ?? [];
				valeurs.push(Number(note.note));
				publics.set(note.passage_id, valeurs);
			}
			for (const note of notesJ.data ?? []) {
				const valeurs = jurys.get(note.passage_id) ?? [];
				valeurs.push(Number(note.note));
				jurys.set(note.passage_id, valeurs);
			}
			const passagesCalcul = liste.flatMap((passage) => {
				const epreuve = epreuveParId.get(passage.epreuve_id);
				if (!epreuve?.notee) return [];
				const ferme = passage.ferme_le ? Date.parse(passage.ferme_le) <= Date.now() : false;
				return [{
					id: passage.id,
					epreuveId: passage.epreuve_id,
					epreuveNom: epreuve.nom,
					epreuveOrdre: epreuve.ordre,
					manadeId: passage.manade_id,
					manadeNom: noms.get(passage.manade_id) ?? "Manade",
					publicOuvert: passage.statut_public === "ouvert" && !ferme,
					juryOuvert: passage.statut_jury === "ouvert",
					notesPublic: publics.get(passage.id) ?? [],
					notesJury: jurys.get(passage.id) ?? []
				}];
			});
			const lectureAvis = await client.from("avis_soiree").select("etoiles, commentaire").eq("soiree_id", soireeId);
			if (!actif) return;
			setAvis(lectureAvis.data ?? []);
			setResultat(calculerClassements(passagesCalcul, {
				mode: soiree.data.mode_classement,
				methode: soiree.data.methode_general,
				poidsJury: soiree.data.poids_jury,
				baremeJury: soiree.data.bareme_jury
			}));
		})();
		return () => {
			actif = false;
		};
	}, [client, soireeId]);
	function exporter() {
		if (!resultat) return;
		const url = URL.createObjectURL(new Blob([exporterClassementsCsv(resultat)], { type: "text/csv;charset=utf-8" }));
		const lien = document.createElement("a");
		lien.href = url;
		lien.download = `classements-${nom || "soiree"}.csv`;
		lien.click();
		setTimeout(() => URL.revokeObjectURL(url), 1e3);
	}
	function exporterPdf() {
		if (!resultat) return;
		const lignes = [
			nom,
			resultat.provisoire ? "Classement provisoire" : "Classement",
			...resultat.parEpreuve.flatMap((epreuve) => {
				const lignesEpreuve = epreuve.public ?? epreuve.jury ?? epreuve.combine ?? [];
				return [`${epreuve.nom}`, ...lignesEpreuve.map((ligne) => `${ligne.rang}. ${ligne.manadeNom} — ${ligne.score}`)];
			})
		];
		telechargerFichier(`classements-${nom || "soiree"}.pdf`, documentPdf({
			titre: "Résultats",
			lignes
		}), "application/pdf");
	}
	async function reveler(valeur) {
		if (!client) return;
		const { error } = await client.from("soirees").update({ classement_visible: valeur }).eq("id", soireeId);
		if (error) setErreur("La visibilité n’a pas pu être modifiée.");
		else {
			setVisible(valeur);
			if (valeur && session?.access_token) await fetch("/api/notifications/diffuser", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`
				},
				body: JSON.stringify({
					cle: `${soireeId}-classement`,
					texte: "Le classement est révélé.",
					url: "/classements"
				})
			}).catch(() => void 0);
		}
	}
	if (erreurClient) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreurClient
	});
	if (erreur) return /* @__PURE__ */ jsx("p", {
		role: "alert",
		className: "text-rouge-alerte",
		children: erreur
	});
	if (!resultat) return /* @__PURE__ */ jsx("p", {
		role: "status",
		children: "Calcul des classements…"
	});
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: BOUTON$1,
					onClick: exporter,
					children: "Exporter CSV"
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: BOUTON$1,
					onClick: exporterPdf,
					children: "Exporter PDF"
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: BOUTON$1,
					onClick: () => void reveler(!visible),
					children: visible ? "Masquer le classement public" : "Révéler le classement public"
				}),
				/* @__PURE__ */ jsx(Link, {
					to: `/admin/soirees/${soireeId}/direct`,
					className: BOUTON$1,
					children: "Cockpit"
				})
			]
		}),
		/* @__PURE__ */ jsxs("p", {
			className: "text-sm text-encre-2",
			children: [
				nom,
				" · ",
				visible ? "visible du public lorsque la soirée réelle est activée" : "masqué pour le public"
			]
		}),
		/* @__PURE__ */ jsx(ClassementCalcule, { classements: resultat }),
		/* @__PURE__ */ jsxs("section", {
			className: "rounded-[22px] border border-trait bg-creme p-5",
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-2xl",
					children: "Avis des spectateurs"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-1 text-sm text-encre-2",
					children: avis.length ? `Moyenne ${(avis.reduce((total, ligne) => total + ligne.etoiles, 0) / avis.length).toFixed(1)} sur 5 · ${avis.length} avis` : "Aucun avis."
				}),
				/* @__PURE__ */ jsx("ul", {
					className: "mt-3 grid gap-2 text-sm",
					children: avis.filter((ligne) => ligne.commentaire).map((ligne) => /* @__PURE__ */ jsxs("li", { children: [
						ligne.etoiles,
						"/5 — ",
						ligne.commentaire
					] }, ligne.commentaire))
				})
			]
		})
	] });
}
//#endregion
//#region app/routes/admin-vitrine.tsx
var admin_vitrine_exports = /* @__PURE__ */ __exportAll({
	default: () => admin_vitrine_default,
	meta: () => meta$4
});
function meta$4() {
	return [{ title: "Vitrine · Administration" }, {
		name: "robots",
		content: "noindex"
	}];
}
var admin_vitrine_default = UNSAFE_withComponentProps(function VitrineAdmin() {
	return /* @__PURE__ */ jsx(CadreAdmin, {
		surtitre: "Vitrine",
		titre: "Contenus",
		children: /* @__PURE__ */ jsx(Contenu, {})
	});
});
function Contenu() {
	const { client, erreurClient } = useClientAdmin();
	const [dates, setDates] = useState([]);
	const [palmares, setPalmares] = useState([]);
	const [identite, setIdentite] = useState({
		raison_sociale: "",
		forme_juridique: "",
		adresse: "",
		telephone: "",
		email: "",
		immatriculation: "",
		capital: "",
		tva: "",
		directeur_publication: ""
	});
	const [precision, setPrecision] = useState("");
	const [info, setInfo] = useState(null);
	const [erreur, setErreur] = useState(null);
	useEffect(() => {
		if (!client) return;
		let actif = true;
		Promise.all([
			client.from("calendrier").select("id, annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie").order("date_soiree"),
			client.from("palmares").select("id, annee, evenement, ville, date_soiree, vainqueur, detail, statut, source_url").order("annee", { ascending: false }),
			client.from("identite_legale").select("*").limit(1).maybeSingle(),
			client.from("contenus_vitrine").select("valeur").eq("cle", "accueil_precision").maybeSingle()
		]).then(([cal, pal, idt, texte]) => {
			if (!actif) return;
			if (cal.error || pal.error) setErreur("La vitrine est illisible. Appliquez les migrations.");
			setDates(cal.data ?? []);
			setPalmares(pal.data ?? []);
			if (idt.data) setIdentite({
				...identite,
				...idt.data
			});
			setPrecision(texte.data?.valeur ?? "");
		});
		return () => {
			actif = false;
		};
	}, [client]);
	async function sauverIdentite(evenement) {
		evenement.preventDefault();
		if (!client) return;
		const champs = Object.fromEntries(CHAMPS_IDENTITE.map(({ cle }) => [cle, identite[cle]?.trim() || null]));
		const { error } = await client.from("identite_legale").upsert({
			id: true,
			...champs
		});
		setErreur(error ? "L’identité n’a pas été enregistrée." : null);
		setInfo(error ? null : "Identité enregistrée. Aucun nom n’est inventé : les champs vides restent vides.");
	}
	async function sauverPrecision(evenement) {
		evenement.preventDefault();
		if (!client) return;
		const valeur = precision.trim();
		const { error } = valeur ? await client.from("contenus_vitrine").upsert({
			cle: "accueil_precision",
			valeur
		}) : await client.from("contenus_vitrine").delete().eq("cle", "accueil_precision");
		setErreur(error ? "Le texte n’a pas été enregistré." : null);
		setInfo(error ? null : "Texte d’accueil enregistré.");
	}
	async function ajouterPhoto(evenement) {
		evenement.preventDefault();
		if (!client) return;
		const champs = new FormData(evenement.currentTarget);
		const { error } = await client.from("photos_vitrine").insert({
			url: String(champs.get("url") ?? ""),
			legende: String(champs.get("legende") ?? ""),
			auteur: String(champs.get("auteur") ?? ""),
			licence: String(champs.get("licence") ?? "")
		});
		setErreur(error ? "La photo n’a pas été ajoutée. L’adresse doit commencer par https:// et le crédit est obligatoire." : null);
		if (!error) evenement.currentTarget.reset();
	}
	if (erreurClient) return /* @__PURE__ */ jsx("p", {
		className: "text-rouge-alerte",
		children: erreurClient
	});
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		erreur ? /* @__PURE__ */ jsx("p", {
			className: "text-rouge-alerte",
			children: erreur
		}) : null,
		info ? /* @__PURE__ */ jsx("p", {
			role: "status",
			children: info
		}) : null,
		/* @__PURE__ */ jsxs("form", {
			onSubmit: (evenement) => void sauverIdentite(evenement),
			className: `${CARTE$1} grid gap-3`,
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-2xl",
					children: "Éditeur et responsable"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "text-sm text-encre-2",
					children: "Laissez vide ce que l’organisateur n’a pas encore donné. Le site n’affiche alors que l’encadré à compléter."
				}),
				CHAMPS_IDENTITE.map(({ cle, libelle }) => /* @__PURE__ */ jsxs("label", {
					className: "grid gap-2 text-sm font-medium",
					children: [libelle, /* @__PURE__ */ jsx("input", {
						className: CHAMP$1,
						value: identite[cle] ?? "",
						onChange: (evenement) => setIdentite({
							...identite,
							[cle]: evenement.target.value
						})
					})]
				}, cle)),
				/* @__PURE__ */ jsx("button", {
					className: BOUTON_PLEIN,
					children: "Enregistrer l’identité"
				})
			]
		}),
		/* @__PURE__ */ jsxs("form", {
			onSubmit: (evenement) => void sauverPrecision(evenement),
			className: `${CARTE$1} grid gap-3`,
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-2xl",
					children: "Texte d’accueil"
				}),
				/* @__PURE__ */ jsx("textarea", {
					className: `${CHAMP$1} min-h-24 py-2`,
					value: precision,
					maxLength: 2e3,
					onChange: (evenement) => setPrecision(evenement.target.value)
				}),
				/* @__PURE__ */ jsx("button", {
					className: BOUTON_PLEIN,
					children: "Enregistrer le texte"
				})
			]
		}),
		/* @__PURE__ */ jsxs("form", {
			onSubmit: (evenement) => void ajouterPhoto(evenement),
			className: `${CARTE$1} grid gap-3`,
			children: [
				/* @__PURE__ */ jsx("h2", {
					className: "font-display text-2xl",
					children: "Photo supplémentaire"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "text-sm text-encre-2",
					children: "Les photos déjà créditées de la vitrine restent en place. Une photo ajoutée ici doit avoir un auteur et une licence."
				}),
				/* @__PURE__ */ jsx("input", {
					name: "url",
					type: "url",
					required: true,
					placeholder: "https://",
					className: CHAMP$1
				}),
				/* @__PURE__ */ jsx("input", {
					name: "legende",
					required: true,
					placeholder: "Légende",
					className: CHAMP$1
				}),
				/* @__PURE__ */ jsx("input", {
					name: "auteur",
					required: true,
					placeholder: "Auteur",
					className: CHAMP$1
				}),
				/* @__PURE__ */ jsx("input", {
					name: "licence",
					required: true,
					placeholder: "Licence",
					className: CHAMP$1
				}),
				/* @__PURE__ */ jsx("button", {
					className: BOUTON_PLEIN,
					children: "Ajouter la photo"
				})
			]
		}),
		/* @__PURE__ */ jsxs("section", {
			className: CARTE$1,
			children: [
				/* @__PURE__ */ jsxs("h2", {
					className: "font-display text-2xl",
					children: [
						"Dates (",
						dates.length,
						")"
					]
				}),
				/* @__PURE__ */ jsx("ul", {
					className: "mt-3 grid gap-2 text-sm",
					children: dates.slice(0, 12).map((date) => /* @__PURE__ */ jsxs("li", { children: [
						date.date_soiree,
						" · ",
						date.nom,
						" · ",
						date.ville,
						" · ",
						date.statut
					] }, date.id))
				}),
				/* @__PURE__ */ jsx(DateForme, { onCreer: async (ligne) => {
					if (!client) return;
					const { error } = await client.from("calendrier").insert(ligne);
					setErreur(error ? "La date n’a pas été ajoutée." : null);
					if (!error) {
						const relu = await client.from("calendrier").select("id, annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie").order("date_soiree");
						setDates(relu.data ?? []);
					}
				} })
			]
		}),
		/* @__PURE__ */ jsxs("section", {
			className: CARTE$1,
			children: [
				/* @__PURE__ */ jsxs("h2", {
					className: "font-display text-2xl",
					children: [
						"Palmarès (",
						palmares.length,
						")"
					]
				}),
				/* @__PURE__ */ jsx("ul", {
					className: "mt-3 grid gap-2 text-sm",
					children: palmares.slice(0, 8).map((ligne) => /* @__PURE__ */ jsxs("li", { children: [
						ligne.annee,
						" · ",
						ligne.evenement,
						" · ",
						ligne.vainqueur,
						" · ",
						ligne.statut === "a_confirmer" ? "à confirmer" : "confirmé"
					] }, ligne.id))
				}),
				/* @__PURE__ */ jsx(PalmaresForme, { onCreer: async (ligne) => {
					if (!client) return;
					const { error } = await client.from("palmares").insert(ligne);
					setErreur(error ? "Le palmarès n’a pas été ajouté." : null);
					if (!error) {
						const relu = await client.from("palmares").select("id, annee, evenement, ville, date_soiree, vainqueur, detail, statut, source_url").order("annee", { ascending: false });
						setPalmares(relu.data ?? []);
					}
				} })
			]
		})
	] });
}
function DateForme({ onCreer }) {
	return /* @__PURE__ */ jsxs("form", {
		className: "mt-4 grid gap-2",
		onSubmit: (evenement) => {
			evenement.preventDefault();
			const champs = new FormData(evenement.currentTarget);
			const date = String(champs.get("date") ?? "");
			onCreer({
				annee: Number(date.slice(0, 4)),
				nom: String(champs.get("nom") ?? ""),
				ville: String(champs.get("ville") ?? ""),
				date_soiree: date,
				heure: String(champs.get("heure") ?? "") || null,
				statut: "previsionnelle"
			});
		},
		children: [/* @__PURE__ */ jsxs("div", {
			className: "grid gap-2 tablette:grid-cols-2",
			children: [
				/* @__PURE__ */ jsx("input", {
					name: "nom",
					required: true,
					placeholder: "Nom",
					className: CHAMP$1
				}),
				/* @__PURE__ */ jsx("input", {
					name: "ville",
					required: true,
					placeholder: "Ville",
					className: CHAMP$1
				}),
				/* @__PURE__ */ jsx("input", {
					name: "date",
					type: "date",
					required: true,
					className: CHAMP$1
				}),
				/* @__PURE__ */ jsx("input", {
					name: "heure",
					type: "time",
					className: CHAMP$1
				})
			]
		}), /* @__PURE__ */ jsx("button", {
			className: BOUTON$1,
			children: "Ajouter une date"
		})]
	});
}
function PalmaresForme({ onCreer }) {
	return /* @__PURE__ */ jsxs("form", {
		className: "mt-4 grid gap-2",
		onSubmit: (evenement) => {
			evenement.preventDefault();
			const champs = new FormData(evenement.currentTarget);
			onCreer({
				annee: Number(champs.get("annee")),
				evenement: String(champs.get("evenement") ?? ""),
				ville: String(champs.get("ville") ?? ""),
				vainqueur: String(champs.get("vainqueur") ?? ""),
				statut: "a_confirmer"
			});
		},
		children: [/* @__PURE__ */ jsxs("div", {
			className: "grid gap-2 tablette:grid-cols-2",
			children: [
				/* @__PURE__ */ jsx("input", {
					name: "annee",
					type: "number",
					required: true,
					placeholder: "Année",
					className: CHAMP$1
				}),
				/* @__PURE__ */ jsx("input", {
					name: "evenement",
					required: true,
					placeholder: "Soirée",
					className: CHAMP$1
				}),
				/* @__PURE__ */ jsx("input", {
					name: "ville",
					required: true,
					placeholder: "Ville",
					className: CHAMP$1
				}),
				/* @__PURE__ */ jsx("input", {
					name: "vainqueur",
					required: true,
					placeholder: "Vainqueur",
					className: CHAMP$1
				})
			]
		}), /* @__PURE__ */ jsx("button", {
			className: BOUTON$1,
			children: "Ajouter un résultat"
		})]
	});
}
//#endregion
//#region app/routes/compte.tsx
var compte_exports = /* @__PURE__ */ __exportAll({
	default: () => compte_default,
	meta: () => meta$3
});
function meta$3() {
	return [{ title: "Mon compte · Olympiade des Manades" }, {
		name: "robots",
		content: "noindex"
	}];
}
var compte_default = UNSAFE_withComponentProps(function Compte() {
	const { session, chargement, prenom } = useSession();
	const naviguer = useNavigate();
	const [confirmation, setConfirmation] = useState(false);
	const [erreur, setErreur] = useState(null);
	const [enCours, setEnCours] = useState(false);
	async function supprimer() {
		if (!session?.access_token || enCours) return;
		setEnCours(true);
		setErreur(null);
		try {
			if (!(await fetch("/api/compte", {
				method: "DELETE",
				headers: { Authorization: `Bearer ${session.access_token}` }
			})).ok) {
				setErreur("La suppression n’a pas abouti. Un compte organisateur ou juge se retire avec l’organisateur.");
				return;
			}
			await (await supabase()).auth.signOut();
			naviguer("/");
		} catch {
			setErreur("La suppression n’a pas abouti.");
		} finally {
			setEnCours(false);
		}
	}
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TitrePage, {
		surtitre: "Compte",
		titre: "Supprimer mon compte",
		children: /* @__PURE__ */ jsx("p", { children: "Cette action efface le compte spectateur, ses notes et ses avis. Elle est irréversible." })
	}), /* @__PURE__ */ jsxs("div", {
		className: "mx-auto max-w-xl px-4 pt-6",
		children: [
			chargement ? /* @__PURE__ */ jsx("p", {
				role: "status",
				children: "Vérification…"
			}) : null,
			!chargement && !session ? /* @__PURE__ */ jsx("p", { children: "Connectez-vous pour supprimer votre compte." }) : null,
			session ? /* @__PURE__ */ jsxs("section", {
				className: "rounded-[22px] border border-trait bg-creme p-5",
				children: [
					/* @__PURE__ */ jsxs("p", { children: [
						"Compte de ",
						prenom || "ce spectateur",
						"."
					] }),
					confirmation ? /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "mt-4 inline-flex min-h-12 items-center rounded-xl bg-encre px-4 font-semibold text-sable",
						disabled: enCours,
						onClick: () => void supprimer(),
						children: enCours ? "Suppression…" : "Confirmer la suppression"
					}) : /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "mt-4 inline-flex min-h-12 items-center rounded-xl border border-trait px-4 font-semibold",
						onClick: () => setConfirmation(true),
						children: "Supprimer mon compte"
					}),
					erreur ? /* @__PURE__ */ jsx("p", {
						className: "mt-3 text-sm text-rouge-alerte",
						children: erreur
					}) : null
				]
			}) : null
		]
	})] });
});
//#endregion
//#region app/routes/ecran.tsx
var ecran_exports = /* @__PURE__ */ __exportAll({
	default: () => ecran_default,
	meta: () => meta$2
});
function meta$2() {
	return [{ title: "Écran · Olympiade des Manades" }, {
		name: "robots",
		content: "noindex"
	}];
}
function estInstantane(valeur) {
	if (!valeur || typeof valeur !== "object") return false;
	const etat = valeur.etat;
	return etat === "hors-soiree" || etat === "ouvert";
}
var ecran_default = UNSAFE_withComponentProps(function Ecran() {
	const { slug = "" } = useParams();
	const contexte = useInstantanePublic();
	const [cible, setCible] = useState(null);
	useEffect(() => {
		let arrete = false;
		async function lire() {
			try {
				const reponse = await fetch(`/api/etat-soiree?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
				if (!reponse.ok) return;
				const corps = await reponse.json();
				if (!arrete && estInstantane(corps)) setCible(corps);
			} catch {}
		}
		lire();
		const minuteur = setInterval(() => void lire(), 8e3);
		return () => {
			arrete = true;
			clearInterval(minuteur);
		};
	}, [slug]);
	const instantane = cible ?? contexte;
	const soiree = instantane.soiree?.slug === slug ? instantane.soiree : null;
	const ouvert = soiree && instantane.etat === "ouvert";
	const [origine, setOrigine] = useState("");
	useEffect(() => {
		setOrigine(window.location.origin);
	}, []);
	const urlVote = origine ? `${origine}/noter` : "";
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-dvh bg-encre px-6 py-8 text-sable",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-end justify-between gap-4",
			children: [/* @__PURE__ */ jsx("p", {
				className: "text-sm font-bold tracking-[.2em] text-or-clair uppercase",
				children: "Olympiade des Manades"
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "inline-flex min-h-12 items-center rounded-xl bg-sable px-4 font-semibold text-encre",
				onClick: () => void document.documentElement.requestFullscreen?.(),
				children: "Plein écran"
			})]
		}), instantane.source === "fige" ? /* @__PURE__ */ jsx("h1", {
			className: "mt-10 font-display text-5xl",
			children: "L’affichage public n’est pas activé."
		}) : !soiree ? /* @__PURE__ */ jsx("h1", {
			className: "mt-10 font-display text-5xl",
			children: "En attente de la soirée."
		}) : /* @__PURE__ */ jsxs(Fragment, { children: [
			/* @__PURE__ */ jsx("h1", {
				className: "mt-6 font-display text-5xl tablette:text-7xl",
				children: soiree.nom
			}),
			soiree.messagePublic && (soiree.statut === "reportee" || soiree.statut === "annulee") ? /* @__PURE__ */ jsx("p", {
				className: "mt-6 max-w-4xl text-3xl",
				children: soiree.messagePublic
			}) : null,
			/* @__PURE__ */ jsx("p", {
				className: "mt-8 font-display text-4xl tablette:text-6xl",
				children: soiree.epreuveEnCours ?? "Épreuve à venir"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-3 text-3xl",
				children: soiree.manadeEnPiste ? soiree.manadeEnPiste : "Manade à venir"
			}),
			ouvert ? /* @__PURE__ */ jsx("p", {
				className: "mt-6 text-4xl font-bold text-or-clair",
				children: "Votez maintenant !"
			}) : null,
			/* @__PURE__ */ jsxs("div", {
				className: "mt-8 inline-block rounded-2xl bg-white p-4 text-encre",
				children: [urlVote ? /* @__PURE__ */ jsx(CodeQr, {
					valeur: urlVote,
					libelle: "QR code pour noter les manades",
					taille: 280
				}) : /* @__PURE__ */ jsx("p", {
					className: "text-2xl",
					children: "QR code de vote"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-3 max-w-xs text-lg font-semibold text-encre",
					children: "Votez maintenant sur votre téléphone"
				})]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-4 break-all text-xl",
				children: urlVote || "/noter"
			}),
			soiree.classements ? /* @__PURE__ */ jsx("div", {
				className: "mt-10 text-encre",
				children: /* @__PURE__ */ jsx(ClassementCalcule, { classements: soiree.classements })
			}) : /* @__PURE__ */ jsx("p", {
				className: "mt-10 text-2xl",
				children: "Le classement sera révélé au moment de la remise des prix."
			})
		] })]
	});
});
//#endregion
//#region app/routes/jury.tsx
var jury_exports = /* @__PURE__ */ __exportAll({
	default: () => jury_default,
	meta: () => meta$1
});
function meta$1() {
	return [{ title: "Jury · Olympiade des Manades" }, {
		name: "robots",
		content: "noindex"
	}];
}
var jury_default = UNSAFE_withComponentProps(function Jury() {
	const { session, chargement } = useSession();
	const [passages, setPassages] = useState(null);
	const [erreur, setErreur] = useState(null);
	const [info, setInfo] = useState(null);
	useEffect(() => {
		if (!session) return;
		let actif = true;
		(async () => {
			const client = await supabase();
			const profil = await client.from("profils").select("role").eq("id", session.user.id).maybeSingle();
			if (!actif) return;
			if (profil.error || profil.data?.role !== "juge" && profil.data?.role !== "admin") {
				setErreur("Cet écran est réservé aux juges de la soirée.");
				setPassages([]);
				return;
			}
			const soirees = ((await client.from("soiree_juges").select("soiree_id").eq("juge_id", session.user.id)).data ?? []).map((lien) => lien.soiree_id);
			if (!soirees.length) {
				setPassages([]);
				return;
			}
			const epreuves = await client.from("epreuves").select("id, nom, soiree_id, notee").in("soiree_id", soirees).eq("notee", true);
			const reglages = await client.from("soirees").select("id, bareme_jury").in("id", soirees);
			const baremes = new Map((reglages.data ?? []).map((soiree) => [soiree.id, soiree.bareme_jury]));
			const epreuveIds = (epreuves.data ?? []).map((epreuve) => epreuve.id);
			const liste = epreuveIds.length ? await client.from("passages").select("id, epreuve_id, manade_id, statut_jury").in("epreuve_id", epreuveIds).eq("statut_jury", "ouvert") : { data: [] };
			const manadeIds = [...new Set((liste.data ?? []).map((passage) => passage.manade_id))];
			const manades = manadeIds.length ? await client.from("manades").select("id, nom").in("id", manadeIds) : { data: [] };
			const noms = new Map((manades.data ?? []).map((manade) => [manade.id, manade.nom]));
			const epreuveParId = new Map((epreuves.data ?? []).map((epreuve) => [epreuve.id, epreuve]));
			const notes = await client.from("notes_jury").select("passage_id, note").eq("juge_id", session.user.id);
			const deja = new Map((notes.data ?? []).map((note) => [note.passage_id, Number(note.note)]));
			if (!actif) return;
			setPassages((liste.data ?? []).map((passage) => {
				const epreuve = epreuveParId.get(passage.epreuve_id);
				return {
					id: passage.id,
					manade: noms.get(passage.manade_id) ?? "Manade",
					epreuve: epreuve?.nom ?? "Épreuve",
					bareme: baremes.get(epreuve?.soiree_id ?? "") ?? 20,
					note: deja.get(passage.id) ?? null
				};
			}));
		})().catch(() => {
			if (actif) setErreur("La notation du jury est indisponible.");
		});
		return () => {
			actif = false;
		};
	}, [session]);
	async function noter(passage, note) {
		if (!session) return;
		setErreur(null);
		setInfo(null);
		const { error } = await (await supabase()).from("notes_jury").upsert({
			passage_id: passage.id,
			juge_id: session.user.id,
			note
		});
		if (error) setErreur("La note n’a pas été enregistrée. Le passage est peut-être fermé.");
		else {
			setInfo("Note enregistrée.");
			setPassages((avant) => avant?.map((ligne) => ligne.id === passage.id ? {
				...ligne,
				note
			} : ligne) ?? null);
		}
	}
	if (chargement) return /* @__PURE__ */ jsx("p", {
		className: "px-4 pt-8",
		role: "status",
		children: "Vérification…"
	});
	if (!session) return /* @__PURE__ */ jsxs("p", {
		className: "px-4 pt-8",
		children: ["Ouvrez le lien personnel transmis par l’organisateur. ", /* @__PURE__ */ jsx(Link, {
			to: "/admin",
			className: "underline",
			children: "Connexion organisateur"
		})]
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto grid max-w-xl gap-4 px-4 pt-8 pb-16",
		children: [
			/* @__PURE__ */ jsx("h1", {
				className: "font-display text-4xl",
				children: "Notation du jury"
			}),
			erreur ? /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "text-rouge-alerte",
				children: erreur
			}) : null,
			info ? /* @__PURE__ */ jsx("p", {
				role: "status",
				children: info
			}) : null,
			!passages ? /* @__PURE__ */ jsx("p", {
				role: "status",
				children: "Lecture des passages ouverts…"
			}) : passages.length ? passages.map((passage) => /* @__PURE__ */ jsxs("section", {
				className: "rounded-[22px] border border-trait bg-creme p-5",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "font-display text-2xl",
						children: passage.manade
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "text-sm text-encre-2",
						children: [
							passage.epreuve,
							" · sur ",
							passage.bareme,
							passage.note != null ? ` · votre note ${passage.note}` : ""
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ jsx("button", {
								type: "button",
								className: "inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-trait px-3 font-semibold",
								onClick: () => void noter(passage, Math.max(0, (passage.note ?? passage.bareme) - .5)),
								children: "−"
							}),
							/* @__PURE__ */ jsxs("button", {
								type: "button",
								className: "inline-flex min-h-12 items-center justify-center rounded-xl bg-encre px-4 font-semibold text-sable",
								onClick: () => void noter(passage, passage.note ?? passage.bareme),
								children: ["Enregistrer ", passage.note ?? passage.bareme]
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								className: "inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-trait px-3 font-semibold",
								onClick: () => void noter(passage, Math.min(passage.bareme, (passage.note ?? 0) + .5)),
								children: "+"
							})
						]
					})
				]
			}, passage.id)) : /* @__PURE__ */ jsx("p", { children: "Aucun passage n’est ouvert pour le jury." })
		]
	});
});
//#endregion
//#region app/routes/introuvable.tsx
var introuvable_exports = /* @__PURE__ */ __exportAll({
	default: () => introuvable_default,
	meta: () => meta
});
var meta = () => [{ title: "Page introuvable · Olympiade des Manades" }, {
	name: "robots",
	content: "noindex"
}];
var introuvable_default = UNSAFE_withComponentProps(function Introuvable() {
	return /* @__PURE__ */ jsx(TitrePage, {
		surtitre: "Erreur 404",
		titre: "Page introuvable",
		children: /* @__PURE__ */ jsxs("p", { children: [
			"Cette adresse ne correspond à aucune page du site.",
			" ",
			/* @__PURE__ */ jsx(Link, {
				to: "/",
				className: "font-semibold text-rouge underline underline-offset-2",
				children: "Retour à l’accueil"
			})
		] })
	});
});
//#endregion
//#region \0virtual:react-router/server-manifest
var server_manifest_default = {
	"entry": {
		"module": "/assets/entry.client-kTvsq1ON.js",
		"imports": ["/assets/rolldown-runtime-CbXtAM7H.js", "/assets/react-pRPD1JoA.js"],
		"css": []
	},
	"routes": {
		"root": {
			"id": "root",
			"parentId": void 0,
			"path": "",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": true,
			"module": "/assets/root-Bfy7Qvd4.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/accueil": {
			"id": "routes/accueil",
			"parentId": "root",
			"path": void 0,
			"index": true,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": true,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/accueil-Clrh7rVZ.js",
			"imports": [
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/classements": {
			"id": "routes/classements",
			"parentId": "root",
			"path": "classements",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": true,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/classements-BV_Qepts.js",
			"imports": [
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/dates": {
			"id": "routes/dates",
			"parentId": "root",
			"path": "dates",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": true,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/dates-C7S9njbF.js",
			"imports": [
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/contact": {
			"id": "routes/contact",
			"parentId": "root",
			"path": "contact",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/contact-D92F6Y44.js",
			"imports": [
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/mentions-legales": {
			"id": "routes/mentions-legales",
			"parentId": "root",
			"path": "mentions-legales",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/mentions-legales-RTqai0GN.js",
			"imports": [
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/confidentialite": {
			"id": "routes/confidentialite",
			"parentId": "root",
			"path": "confidentialite",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/confidentialite-AnnjCXQ-.js",
			"imports": [
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/noter": {
			"id": "routes/noter",
			"parentId": "root",
			"path": "noter",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": true,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/noter-CwCpAlCc.js",
			"imports": [
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/inscription": {
			"id": "routes/inscription",
			"parentId": "root",
			"path": "inscription",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/inscription-C0GTyXEC.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js",
				"/assets/FormulaireInscription-D8GLgd71.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/inscription-code": {
			"id": "routes/inscription-code",
			"parentId": "root",
			"path": "inscription/code",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/inscription-code-rTEdRpVE.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js",
				"/assets/FormulaireInscription-D8GLgd71.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin": {
			"id": "routes/admin",
			"parentId": "root",
			"path": "admin",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-D4TIE7_W.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin-statistiques": {
			"id": "routes/admin-statistiques",
			"parentId": "root",
			"path": "admin/statistiques",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-statistiques-CPrEOJC_.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin-cookies": {
			"id": "routes/admin-cookies",
			"parentId": "root",
			"path": "admin/cookies",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-cookies-DjRWwBf-.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin-participants": {
			"id": "routes/admin-participants",
			"parentId": "root",
			"path": "admin/participants",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-participants-jaj2NxLX.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin-messages": {
			"id": "routes/admin-messages",
			"parentId": "root",
			"path": "admin/messages",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-messages-CITwKPyO.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin-abonnes": {
			"id": "routes/admin-abonnes",
			"parentId": "root",
			"path": "admin/abonnes",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-abonnes-D9ysxI-m.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin-juges": {
			"id": "routes/admin-juges",
			"parentId": "root",
			"path": "admin/juges",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-juges-DRRwpU48.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin-soirees": {
			"id": "routes/admin-soirees",
			"parentId": "root",
			"path": "admin/soirees",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-soirees-CI5ZXk45.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin-soiree": {
			"id": "routes/admin-soiree",
			"parentId": "root",
			"path": "admin/soirees/:soireeId",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-soiree-DGNDUNty.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin-direct": {
			"id": "routes/admin-direct",
			"parentId": "root",
			"path": "admin/soirees/:soireeId/direct",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-direct-D2S_GZNm.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin-resultats": {
			"id": "routes/admin-resultats",
			"parentId": "root",
			"path": "admin/soirees/:soireeId/resultats",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-resultats-CRxE9l7g.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/admin-vitrine": {
			"id": "routes/admin-vitrine",
			"parentId": "root",
			"path": "admin/vitrine",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/admin-vitrine-Bi4J6GOw.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/compte": {
			"id": "routes/compte",
			"parentId": "root",
			"path": "compte",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/compte-BUzVd5_X.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/ecran": {
			"id": "routes/ecran",
			"parentId": "root",
			"path": "ecran/:slug",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/ecran-BtHfvfmW.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/jury": {
			"id": "routes/jury",
			"parentId": "root",
			"path": "jury",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/jury-j0wEkI0_.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/introuvable": {
			"id": "routes/introuvable",
			"parentId": "root",
			"path": "*",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/introuvable-OLic1anY.js",
			"imports": [
				"/assets/react-pRPD1JoA.js",
				"/assets/app-DYHWtS2h.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": ["/assets/app-BGE5VRyy.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		}
	},
	"url": "/assets/manifest-bbd57e16.js",
	"version": "bbd57e16",
	"sri": void 0
};
//#endregion
//#region \0virtual:react-router/server-build
var assetsBuildDirectory = "build/client";
var basename = "/";
var future = {
	"unstable_enableNodeReadableStream": false,
	"unstable_optimizeDeps": false
};
var ssr = false;
var isSpaMode = false;
var prerender = [
	"/",
	"/classements",
	"/dates",
	"/contact",
	"/mentions-legales",
	"/confidentialite"
];
var routeDiscovery = { "mode": "initial" };
var publicPath = "/";
var entry = { module: entry_server_web_exports };
var routes = {
	"root": {
		id: "root",
		parentId: void 0,
		path: "",
		index: void 0,
		caseSensitive: void 0,
		module: root_exports
	},
	"routes/accueil": {
		id: "routes/accueil",
		parentId: "root",
		path: void 0,
		index: true,
		caseSensitive: void 0,
		module: accueil_exports
	},
	"routes/classements": {
		id: "routes/classements",
		parentId: "root",
		path: "classements",
		index: void 0,
		caseSensitive: void 0,
		module: classements_exports
	},
	"routes/dates": {
		id: "routes/dates",
		parentId: "root",
		path: "dates",
		index: void 0,
		caseSensitive: void 0,
		module: dates_exports
	},
	"routes/contact": {
		id: "routes/contact",
		parentId: "root",
		path: "contact",
		index: void 0,
		caseSensitive: void 0,
		module: contact_exports
	},
	"routes/mentions-legales": {
		id: "routes/mentions-legales",
		parentId: "root",
		path: "mentions-legales",
		index: void 0,
		caseSensitive: void 0,
		module: mentions_legales_exports
	},
	"routes/confidentialite": {
		id: "routes/confidentialite",
		parentId: "root",
		path: "confidentialite",
		index: void 0,
		caseSensitive: void 0,
		module: confidentialite_exports
	},
	"routes/noter": {
		id: "routes/noter",
		parentId: "root",
		path: "noter",
		index: void 0,
		caseSensitive: void 0,
		module: noter_exports
	},
	"routes/inscription": {
		id: "routes/inscription",
		parentId: "root",
		path: "inscription",
		index: void 0,
		caseSensitive: void 0,
		module: inscription_exports
	},
	"routes/inscription-code": {
		id: "routes/inscription-code",
		parentId: "root",
		path: "inscription/code",
		index: void 0,
		caseSensitive: void 0,
		module: inscription_code_exports
	},
	"routes/admin": {
		id: "routes/admin",
		parentId: "root",
		path: "admin",
		index: void 0,
		caseSensitive: void 0,
		module: admin_exports
	},
	"routes/admin-statistiques": {
		id: "routes/admin-statistiques",
		parentId: "root",
		path: "admin/statistiques",
		index: void 0,
		caseSensitive: void 0,
		module: admin_statistiques_exports
	},
	"routes/admin-cookies": {
		id: "routes/admin-cookies",
		parentId: "root",
		path: "admin/cookies",
		index: void 0,
		caseSensitive: void 0,
		module: admin_cookies_exports
	},
	"routes/admin-participants": {
		id: "routes/admin-participants",
		parentId: "root",
		path: "admin/participants",
		index: void 0,
		caseSensitive: void 0,
		module: admin_participants_exports
	},
	"routes/admin-messages": {
		id: "routes/admin-messages",
		parentId: "root",
		path: "admin/messages",
		index: void 0,
		caseSensitive: void 0,
		module: admin_messages_exports
	},
	"routes/admin-abonnes": {
		id: "routes/admin-abonnes",
		parentId: "root",
		path: "admin/abonnes",
		index: void 0,
		caseSensitive: void 0,
		module: admin_abonnes_exports
	},
	"routes/admin-juges": {
		id: "routes/admin-juges",
		parentId: "root",
		path: "admin/juges",
		index: void 0,
		caseSensitive: void 0,
		module: admin_juges_exports
	},
	"routes/admin-soirees": {
		id: "routes/admin-soirees",
		parentId: "root",
		path: "admin/soirees",
		index: void 0,
		caseSensitive: void 0,
		module: admin_soirees_exports
	},
	"routes/admin-soiree": {
		id: "routes/admin-soiree",
		parentId: "root",
		path: "admin/soirees/:soireeId",
		index: void 0,
		caseSensitive: void 0,
		module: admin_soiree_exports
	},
	"routes/admin-direct": {
		id: "routes/admin-direct",
		parentId: "root",
		path: "admin/soirees/:soireeId/direct",
		index: void 0,
		caseSensitive: void 0,
		module: admin_direct_exports
	},
	"routes/admin-resultats": {
		id: "routes/admin-resultats",
		parentId: "root",
		path: "admin/soirees/:soireeId/resultats",
		index: void 0,
		caseSensitive: void 0,
		module: admin_resultats_exports
	},
	"routes/admin-vitrine": {
		id: "routes/admin-vitrine",
		parentId: "root",
		path: "admin/vitrine",
		index: void 0,
		caseSensitive: void 0,
		module: admin_vitrine_exports
	},
	"routes/compte": {
		id: "routes/compte",
		parentId: "root",
		path: "compte",
		index: void 0,
		caseSensitive: void 0,
		module: compte_exports
	},
	"routes/ecran": {
		id: "routes/ecran",
		parentId: "root",
		path: "ecran/:slug",
		index: void 0,
		caseSensitive: void 0,
		module: ecran_exports
	},
	"routes/jury": {
		id: "routes/jury",
		parentId: "root",
		path: "jury",
		index: void 0,
		caseSensitive: void 0,
		module: jury_exports
	},
	"routes/introuvable": {
		id: "routes/introuvable",
		parentId: "root",
		path: "*",
		index: void 0,
		caseSensitive: void 0,
		module: introuvable_exports
	}
};
var allowedActionOrigins = false;
//#endregion
export { allowedActionOrigins, server_manifest_default as assets, assetsBuildDirectory, basename, entry, future, isSpaMode, prerender, publicPath, routeDiscovery, routes, ssr };
