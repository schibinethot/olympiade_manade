import { $ as demandeValide, A as SaisonAccueil, B as TEXTE_INSCRIPTIONS_FERMEES, C as anneesClassements, D as lireDonneesVitrineNavigateur, E as lireDonneesVitrine, F as Epreuves, G as TitrePage, H as CreditAffiche, I as EPREUVES, J as Icone, K as PiedDePage, L as DernierVainqueur, M as FormulaireContact, N as lireCalendrier, O as donneesRelues, P as lireOuRepli, Q as demandeEnCours, R as BlocNoter, S as anneeChoisie, T as DELAI_LECTURE_NAVIGATEUR_MS, U as SuiviNotes, V as Affiche, W as SuiviPresence, X as useMaintenant, Y as useSession, Z as ETAT_SOIREE, _ as ONGLET_ACTIF, a as useAccesAdmin, at as oublierDemande, b as idOnglet, c as CorpsLegal, ct as verifierCode, d as SectionLegale, dt as momentSoiree, et as demanderCode, f as noteProjections, ft as prochaineSoireeA, g as CLASSE_ONGLET, h as useHydrate, ht as VILLE_AFFICHE, i as octets, it as normaliserEmail, j as ManadesEdition, k as useRelectureApresInteraction, l as EncadreOrganisateur, lt as supabase, m as CarteDate, mt as jourParis, n as latence, nt as memoriserDemande, o as NotationPublic, ot as traduireErreurAuth, p as sectionsDates, pt as soireeDeReference, q as Entete, r as nombre, rt as normaliserCode, s as CreditsPhotos, st as validerInscription, t as exporterMesures, tt as formaterDecompte, u as LIEN_TEXTE, ut as formaterJourMois, v as ONGLET_INACTIF, w as resultatsAnnee, x as CarteResultat, y as OngletsAnnee, z as INSCRIPTION_OUVERTE } from "./assets/app-DRsXX6hm.js";
import { Link, Links, Meta, Navigate, Outlet, Scripts, ScrollRestoration, ServerRouter, UNSAFE_withComponentProps, UNSAFE_withErrorBoundaryProps, UNSAFE_withHydrateFallbackProps, isRouteErrorResponse, useLocation, useNavigate, useSearchParams } from "react-router";
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
//#region node_modules/.pnpm/@react-router+dev@8.4.0_react-router@8.4.0_react-dom@19.3.0_react@19.3.0__react@19.3.0__61ab97f2d391a02f47cb0a7d0e4cd79f/node_modules/@react-router/dev/dist/config/defaults/entry.server.web.tsx
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
var app_default = "/assets/app-COfw4lFa.css";
//#endregion
//#region app/root.tsx
var root_exports = /* @__PURE__ */ __exportAll({
	ErrorBoundary: () => ErrorBoundary,
	HydrateFallback: () => HydrateFallback,
	Layout: () => Layout,
	default: () => root_default,
	links: () => links,
	meta: () => meta$12
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
	}
];
var meta$12 = () => [{ title: "Olympiade des Manades" }, {
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
	return /* @__PURE__ */ jsxs(Coque, { children: [
		/* @__PURE__ */ jsx(SuiviPresence, {}),
		/* @__PURE__ */ jsx(SuiviNotes, {}),
		/* @__PURE__ */ jsx(Outlet, {})
	] });
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
	meta: () => meta$11
});
var meta$11 = () => [{ title: "Olympiade des Manades" }, {
	name: "description",
	content: "Les Olympiades camarguaises : le public note les manades, en direct, aux côtés du jury. Saison 2027."
}];
async function loader$2() {
	return lireDonneesVitrine();
}
async function clientLoader$3({ serverLoader }) {
	return lireDonneesVitrineNavigateur(serverLoader);
}
var accueil_default = UNSAFE_withComponentProps(function Accueil({ loaderData }) {
	const { calendrier, palmares, lueLe } = loaderData;
	const maintenant = useMaintenant(lueLe);
	useRelectureApresInteraction(loaderData);
	const soiree = calendrier ? soireeDeReference(calendrier, maintenant) : null;
	const soireeAffiche = calendrier ? prochaineSoireeA(calendrier, VILLE_AFFICHE, maintenant) : null;
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs("section", {
			"aria-label": "À l’affiche",
			className: "grid gap-x-[18px] gap-y-3.5 px-4 pt-3.5 tablette:grid-cols-[1.12fr_1fr] tablette:px-7 tablette:pt-[22px] paysage:grid-cols-[1.5fr_1fr] paysage:gap-x-[22px] paysage:px-10 paysage:pt-[26px] bureau:px-14 bureau:pt-[30px]",
			children: [
				/* @__PURE__ */ jsx(Affiche, { soiree: soireeAffiche }),
				/* @__PURE__ */ jsx(BlocNoter, {
					etat: ETAT_SOIREE,
					soiree,
					calendrierDisponible: calendrier !== null,
					maintenant
				}),
				/* @__PURE__ */ jsx(CreditAffiche, { className: "-mt-2 px-1 tablette:-mt-2.5" })
			]
		}),
		/* @__PURE__ */ jsx(ManadesEdition, {}),
		/* @__PURE__ */ jsx(Epreuves, {}),
		/* @__PURE__ */ jsx(DernierVainqueur, { palmares }),
		/* @__PURE__ */ jsxs("div", {
			className: "grid gap-3.5 px-4 pt-9 pb-1 tablette:grid-cols-[1.25fr_1fr] tablette:gap-[18px] tablette:px-7 tablette:pt-11 paysage:px-10 paysage:pt-14 bureau:px-14",
			children: [/* @__PURE__ */ jsx(SaisonAccueil, {
				calendrier,
				maintenant
			}), /* @__PURE__ */ jsxs("section", {
				"aria-labelledby": "titre-contact",
				className: "rounded-[22px] border border-trait bg-creme p-5",
				children: [
					/* @__PURE__ */ jsx("h2", {
						id: "titre-contact",
						className: "font-display text-[21px] leading-[1.2] font-bold",
						children: "Une question\xA0?"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-1.5 text-[14px] text-encre-2",
						children: "Une manade à inscrire, une photo à proposer\xA0: l’organisation vous répond."
					}),
					/* @__PURE__ */ jsx(FormulaireContact, {})
				]
			})]
		})
	] });
});
//#endregion
//#region app/routes/classements.tsx
var classements_exports = /* @__PURE__ */ __exportAll({
	clientLoader: () => clientLoader$2,
	default: () => classements_default,
	loader: () => loader$1,
	meta: () => meta$10,
	shouldRevalidate: () => shouldRevalidate
});
var meta$10 = () => [{ title: "Classements · Olympiade des Manades" }, {
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
	const annee = anneeChoisie(hydrate ? parametres.get("annee") : null, annees);
	const avecOnglets = annee !== null && annees.onglets.length > 1;
	const choisir = (choix) => setParametres({ annee: String(choix) }, {
		replace: true,
		preventScrollReset: true
	});
	const resultats = palmares && annee !== null ? resultatsAnnee(palmares, annee) : [];
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
			children: [annee !== null ? /* @__PURE__ */ jsxs("h2", {
				className: "sr-only",
				children: ["Palmarès ", annee]
			}) : null, !palmares ? /* @__PURE__ */ jsx("p", {
				className: "text-encre-2",
				children: "Informations momentanément indisponibles. Réessayez dans un instant."
			}) : resultats.length ? /* @__PURE__ */ jsx("div", {
				className: GRILLE,
				children: resultats.map((resultat, rang) => /* @__PURE__ */ jsx(CarteResultat, {
					resultat,
					aLaUne: rang === 0
				}, resultat.id))
			}) : annee !== null && aVenir ? /* @__PURE__ */ jsx(AnneeEnDirect, {
				annee,
				soirees: soireesAnnee.length
			}) : /* @__PURE__ */ jsxs("p", {
				className: "text-encre-2",
				children: [
					"Aucun résultat publié pour ",
					annee ?? "cette année",
					"."
				]
			})]
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
	meta: () => meta$9
});
var meta$9 = () => [{ title: "Dates · Olympiade des Manades" }, {
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
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TitrePage, {
		surtitre: "Calendrier",
		titre: saison ? /* @__PURE__ */ jsxs(Fragment, { children: ["Dates ", /* @__PURE__ */ jsx("em", { children: saison.annee })] }) : "Dates",
		bas: sections.length > 1 ? /* @__PURE__ */ jsx(BarreAnnees, { sections }) : null,
		children: /* @__PURE__ */ jsx("p", { children: "Les soirées d’Olympiades dans le Gard, l’Hérault et les Bouches-du-Rhône, de la saison à venir aux années passées." })
	}), !calendrier ? /* @__PURE__ */ jsx("p", {
		className: "px-4 pt-6 text-encre-2 tablette:px-7 paysage:px-10 bureau:px-14",
		children: "Informations momentanément indisponibles. Réessayez dans un instant."
	}) : sections.length === 0 ? /* @__PURE__ */ jsx("p", {
		className: "px-4 pt-6 text-encre-2 tablette:px-7 paysage:px-10 bureau:px-14",
		children: "Les dates de la saison seront bientôt publiées."
	}) : sections.map((section, rang) => /* @__PURE__ */ jsx(SectionAnnee, {
		section,
		premiere: rang === 0
	}, section.id))] });
});
//#endregion
//#region app/routes/contact.tsx
var contact_exports = /* @__PURE__ */ __exportAll({
	default: () => contact_default,
	meta: () => meta$8
});
var meta$8 = () => [{ title: "Contact · Olympiade des Manades" }, {
	name: "description",
	content: "Une question, une manade à inscrire, une photo à proposer : écrivez à l’organisation."
}];
var contact_default = UNSAFE_withComponentProps(function Contact() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TitrePage, {
		surtitre: "Une question ?",
		titre: "Contact",
		children: /* @__PURE__ */ jsx("p", { children: "Une manade à inscrire, une photo à proposer\xA0: l’organisation vous répond." })
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
	meta: () => meta$7
});
var meta$7 = () => [{ title: "Mentions légales · Olympiade des Manades" }, {
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
			children: /* @__PURE__ */ jsx(EncadreOrganisateur, { children: /* @__PURE__ */ jsx("p", { children: "Ces informations seront fournies par l’organisateur\xA0: nom ou raison sociale, forme juridique, siège ou adresse, téléphone, email, numéro d’immatriculation, capital le cas échéant, numéro de TVA, directeur de la publication." }) })
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
	meta: () => meta$6
});
var meta$6 = () => [{ title: "Confidentialité · Olympiade des Manades" }, {
	name: "description",
	content: "Données collectées, finalités, durée de conservation et droits RGPD."
}];
var LIEN_CONTACT = /* @__PURE__ */ jsx(Link, {
	to: "/contact",
	className: LIEN_TEXTE,
	children: "formulaire de contact"
});
var confidentialite_default = UNSAFE_withComponentProps(function Confidentialite() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TitrePage, {
		surtitre: "Vos données",
		titre: "Confidentialité"
	}), /* @__PURE__ */ jsxs(CorpsLegal, { children: [
		/* @__PURE__ */ jsx(SectionLegale, {
			id: "responsable",
			titre: "Responsable du traitement",
			children: /* @__PURE__ */ jsx(EncadreOrganisateur, { children: /* @__PURE__ */ jsx("p", { children: "L’identité et les coordonnées du responsable du traitement seront fournies par l’organisateur." }) })
		}),
		/* @__PURE__ */ jsx(SectionLegale, {
			id: "donnees",
			titre: "Données collectées",
			children: /* @__PURE__ */ jsxs("ul", { children: [
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Visiteurs du site" }), "\xA0: nos hébergeurs traitent des données techniques de connexion (adresse IP, date et heure, pages demandées, type de navigateur) pour assurer le fonctionnement et la sécurité du site. Le serveur conserve aussi des compteurs techniques agrégés (requêtes, erreurs, volume de données et temps de réponse), sans adresse IP ni historique individuel de navigation dans ces compteurs. Nous n’utilisons aucun outil de mesure d’audience publicitaire. Base légale\xA0: intérêt légitime à sécuriser le service (art. 6(1)(f) RGPD). Durée\xA0: celle fixée par chaque hébergeur pour ses journaux techniques."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Formulaire de contact" }), "\xA0: prénom, email, message et date d’envoi. Les trois champs du formulaire sont obligatoires pour que nous puissions vous répondre."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Inscription au vote" }), "\xA0: prénom et email, puis un code reçu par email pour vous connecter."] }),
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Disponibilité du service" }), "\xA0: lorsque vous êtes connecté et que l’application est visible, un signal périodique met à jour la dernière activité de votre compte pour estimer le nombre de comptes actifs. Il ne contient ni la page visitée, ni l’adresse IP, ni le contenu de vos notes. Seuls les administrateurs peuvent consulter les statistiques agrégées."] })
			] })
		}),
		/* @__PURE__ */ jsxs(SectionLegale, {
			id: "finalites",
			titre: "Finalités et bases légales",
			children: [
				/* @__PURE__ */ jsxs("ul", { children: [/* @__PURE__ */ jsx("li", { children: "Répondre à votre message\xA0: intérêt légitime de l’organisation à répondre aux demandes qui lui sont adressées (art. 6(1)(f) RGPD)." }), /* @__PURE__ */ jsx("li", { children: "Donner accès au vote et envoyer les notifications liées à la soirée\xA0: votre consentement, recueilli par une case à cocher à l’inscription (art. 6(1)(a) RGPD). Vous pouvez le retirer à tout moment." })] }),
				/* @__PURE__ */ jsx("p", { children: "Aucune newsletter sans case dédiée, décochée par défaut." }),
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
				/* @__PURE__ */ jsx("li", { children: "Comptes spectateurs inactifs\xA0: supprimés après 24 mois d’inactivité." }),
				/* @__PURE__ */ jsx("li", { children: "Mesures techniques agrégées et derniers signaux d’activité\xA0: conservation de 30 jours." }),
				/* @__PURE__ */ jsx("li", { children: "Messages de contact\xA0: conservés le temps nécessaire pour vous répondre, puis supprimés. La durée exacte sera fixée avec l’organisateur." })
			] })
		}),
		/* @__PURE__ */ jsxs(SectionLegale, {
			id: "traceurs",
			titre: "Traceurs et stockage local",
			children: [
				/* @__PURE__ */ jsx("p", { children: "Aucun traceur tiers, aucun cookie publicitaire, aucun outil de mesure d’audience." }),
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
				/* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsx("strong", { children: "Brevo" }), "\xA0: envoi des emails, prévu pour remplacer le service d’email de Supabase."] })
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
					"Pour exercer ces droits, écrivez-nous via le ",
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
	meta: () => meta$5
});
var meta$5 = () => [{ title: "Noter les manades · Olympiade des Manades" }, {
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
			!session && soiree ? `Les votes ouvriront ${momentSoiree(soiree)}. ` : "",
			session ? "Retrouvez les passages proposés et le suivi de vos notes ci-dessous." : "Le soir venu, vous donnerez une note de 1 à 10 à chaque manade, dès la fin de son passage."
		] }), /* @__PURE__ */ jsxs("p", {
			className: "mt-3 flex flex-wrap gap-x-5 gap-y-1",
			children: [!session && !chargement ? INSCRIPTION_OUVERTE ? /* @__PURE__ */ jsx(Link, {
				to: "/inscription",
				className: LIEN,
				children: "Inscrivez-vous dès maintenant, vous serez prêt le soir venu"
			}) : /* @__PURE__ */ jsx("span", {
				className: "font-semibold text-encre",
				children: TEXTE_INSCRIPTIONS_FERMEES
			}) : null, /* @__PURE__ */ jsx(Link, {
				to: "/dates",
				className: LIEN,
				children: "Voir les dates"
			})]
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
		verrou.current = true;
		setEnvoi("en-cours");
		setEchec(null);
		const prenom = champs.prenom.trim();
		const email = normaliserEmail(champs.email);
		try {
			await demanderCode(prenom, email);
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
	meta: () => meta$4
});
var meta$4 = () => [
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
		verrou.current = true;
		setEtat("renvoi");
		setErreur(null);
		setInfo(null);
		try {
			await demanderCode(demande.prenom, demande.email);
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
				children: [/* @__PURE__ */ jsxs("div", {
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
				}), /* @__PURE__ */ jsx("p", {
					className: "text-encre-2",
					children: "Le lien de connexion du même email marche aussi."
				})]
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
	meta: () => meta$3
});
var meta$3 = () => [{ title: "Code reçu · Olympiade des Manades" }, {
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
	meta: () => meta$2
});
var meta$2 = () => [{ title: "Administration · Olympiade des Manades" }, {
	name: "robots",
	content: "noindex"
}];
var admin_default = UNSAFE_withComponentProps(function Admin() {
	const { acces } = useAccesAdmin();
	const [erreur, setErreur] = useState(null);
	const [enCours, setEnCours] = useState(false);
	async function connecter(evenement) {
		evenement.preventDefault();
		if (enCours) return;
		const champs = new FormData(evenement.currentTarget);
		setEnCours(true);
		setErreur(null);
		try {
			const { error } = await (await supabase()).auth.signInWithPassword({
				email: String(champs.get("email") ?? "").trim(),
				password: String(champs.get("mot-de-passe") ?? "")
			});
			if (error) setErreur(error.status === 429 ? "Trop de tentatives. Réessayez dans quelques minutes." : "Connexion refusée. Vérifiez vos identifiants.");
		} catch {
			setErreur("Connexion impossible. Vérifiez votre réseau et réessayez.");
		} finally {
			setEnCours(false);
		}
	}
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TitrePage, {
		surtitre: "Espace organisateur",
		titre: "Administration",
		children: /* @__PURE__ */ jsx("p", { children: "Connectez-vous avec votre compte administrateur pour suivre l’activité et la charge du service." })
	}), /* @__PURE__ */ jsx("div", {
		className: "px-4 tablette:px-7 paysage:px-10 bureau:px-14",
		children: acces === "chargement" ? /* @__PURE__ */ jsx("p", {
			role: "status",
			children: "Vérification de l’accès…"
		}) : acces === "autorise" ? /* @__PURE__ */ jsx(Link, {
			to: "/admin/statistiques",
			className: "inline-flex min-h-12 items-center rounded-xl bg-encre px-5 font-semibold text-sable",
			children: "Statistiques et charge →"
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
	meta: () => meta$1
});
var meta$1 = () => [{ title: "Statistiques et charge · Administration" }, {
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
					children: acces === "anonyme" ? "Connectez-vous pour consulter les statistiques." : acces === "refuse" ? "Ces statistiques sont réservées aux administrateurs." : "Impossible de vérifier vos droits. Réessayez depuis l’administration."
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
		"module": "/assets/entry.client-C9mKYTjm.js",
		"imports": ["/assets/rolldown-runtime-CbXtAM7H.js", "/assets/react-yYLCgfRJ.js"],
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
			"module": "/assets/root-LWRCakvR.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js"
			],
			"css": [],
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
			"module": "/assets/accueil-C03GBRFU.js",
			"imports": [
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": [],
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
			"module": "/assets/classements-CQigaLZK.js",
			"imports": [
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": [],
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
			"module": "/assets/dates-C5AxwdO1.js",
			"imports": [
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": [],
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
			"module": "/assets/contact-D7R5sWSc.js",
			"imports": [
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": [],
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
			"module": "/assets/mentions-legales-CktYPcME.js",
			"imports": [
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": [],
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
			"module": "/assets/confidentialite-C6y1Cy5g.js",
			"imports": [
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": [],
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
			"module": "/assets/noter-DtuCPt1H.js",
			"imports": [
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": [],
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
			"module": "/assets/inscription-CSdObHPp.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js",
				"/assets/FormulaireInscription-BVv9bCgc.js"
			],
			"css": [],
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
			"module": "/assets/inscription-code-CTc0XVr0.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js",
				"/assets/FormulaireInscription-BVv9bCgc.js"
			],
			"css": [],
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
			"module": "/assets/admin-CYhnaZtd.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js"
			],
			"css": [],
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
			"module": "/assets/admin-statistiques-BZekVJzv.js",
			"imports": [
				"/assets/rolldown-runtime-CbXtAM7H.js",
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js"
			],
			"css": [],
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
			"module": "/assets/introuvable-DOOfnjaJ.js",
			"imports": [
				"/assets/react-yYLCgfRJ.js",
				"/assets/app-VmZ4LFUM.js",
				"/assets/rolldown-runtime-CbXtAM7H.js"
			],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		}
	},
	"url": "/assets/manifest-cc45cf13.js",
	"version": "cc45cf13",
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
