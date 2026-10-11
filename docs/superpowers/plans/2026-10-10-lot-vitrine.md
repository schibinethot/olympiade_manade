# Lot Vitrine : socle front, site vitrine et inscription par code. Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** livrer le site public de l'Olympiade des manades. Il comprend l'accueil mobile, dont le premier bloc est « Notez les Olympiades », les classements 2025, 2026 et 2027, les dates, le contact et les mentions légales. Il comprend aussi l'inscription par prénom, email et code à 6 chiffres. Tout est testé dans un navigateur.

**Architecture :**
- React Router v8 en mode framework sur Vite, en application monopage (`ssr: false`). Les pages vitrine sont pré-rendues au build.
- Les données vivantes (palmarès, calendrier) viennent de Supabase avec la clé publishable. Elles sont lues au build pour le pré-rendu, puis relues côté client.
- L'inscription utilise Supabase Auth en OTP email.
- Les photos sont des fichiers statiques optimisés, avec leurs crédits.

**Tech Stack :** React 19, React Router 8, Vite 8, Tailwind CSS 4, `@supabase/supabase-js` 2, TypeScript, Vitest 5, Playwright, sharp (script photos).

**Spec :** `docs/CDC-MASTER.md` v0.5, sections 2.0, 2.2, 2.3 bis, 2.3 ter, 3.1, 4.0, 4.4 (inscription), 6 et 8 (critères 1, 12, 13).

**Design, qui fait foi pour le rendu :** maquette v1, validée par l'utilisateur le 10/10/2026. Elle se trouve sur la branche `design/maquette-v1`, à lire seulement dans le worktree `/Users/tpmge/Dev/olympiade_manade-maquette` :

- `docs/charte-graphique.md` : règles, jetons, polices, mentions obligatoires.
- `docs/maquette/src.html` : les écrans `public:accueil`, `public:classements`, `public:dates` et `spect:inscription`. Pour les voir en local, lancer `python3 docs/maquette/build.py` puis ouvrir `dist/maquette.html`.
- `docs/maquette/img/` : les photos en niveaux de gris et le logotype Atch.

En cas d'écart entre les sources :

- pour le rendu et les libellés, la maquette l'emporte ;
- pour les règles, la charte l'emporte ;
- pour le fonctionnel, le CDC l'emporte.

## Global Constraints

- Textes de l'interface en français, avec accents. Code en français (noms de fichiers, de composants, de fonctions), sauf les conventions imposées par les outils (`root.tsx`, `routes.ts`)
- Mobile d'abord. Sur un écran de 390 × 844, le bloc « Notez les Olympiades » et son bouton sont visibles sans faire défiler
- Boutons et cibles tactiles de 48 px minimum, contrastes AA, lisible de nuit sous l'éclairage des arènes
- Pages vitrine pré-rendues : `/`, `/classements`, `/dates`, `/contact`, `/mentions-legales`, `/confidentialite`
- Seule la clé **publishable** Supabase dans le front (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`), lue dans `.env.local` (ignoré par git)
- Photos : uniquement celles de `docs/photos-libres.md`, chacune avec son crédit visible (auteur, licence, lien). Aucune photo de presse
- Pied de page (charte, section 8), dans cet ordre :
  - bloc « Partenaire officiel » avec le logotype Atch, copié depuis `docs/maquette/img/atch-*.svg`, jamais redessiné ;
  - la ligne « Conçue en collaboration avec Atch Élevage et TPMGE » ;
  - la signature « Signé TPMGE », adaptée au fond du pied de page, avec le lien `https://tpmge.com/#olympiade-des-manades`. Spec et CSS dans `/Users/tpmge/.claude/projects/-Users-tpmge-Dev/memory/reference_tpmge_signature.md`
- Ambiance **Jour** de la charte sur tout ce lot : fond `sable`, texte `encre`, accents couchant.
- Jetons Tailwind v4 : exactement ceux de la section 3 de la charte.
- Polices, toutes hébergées avec le site :
  - Kaushan Script : logo et titres manuscrits courts ;
  - Playfair Display : titres, ainsi que les notes et les classements en italique ;
  - Inter : interface.
- Points de rupture en container queries (charte, section 6).
- Photos : stockées en niveaux de gris, passées en duotone par le CSS (charte, section 5). Le crédit mentionne la retouche.
- Aucun traceur tiers, aucune police chargée depuis un CDN tiers à l'exécution : polices auto-hébergées
- Lighthouse mobile ≥ 90 en performance et en accessibilité sur `/`
- Nouvelles tables : RLS active, `revoke` puis grants explicites, y compris pour `service_role` (suivi lot 0, point 3). Fonctions dans `prive` uniquement
- Les tests e2e n'écrivent jamais dans le projet Supabase réel : contact et Auth interceptés avec `page.route`
- Aucun tiret cadratin. Commits en français sans `Co-Authored-By`, fichiers ajoutés nommément, aucun `git push` sans GO
- Worktree `/Users/tpmge/Dev/olympiade_manade-vitrine`, branche `feat/lot-vitrine`, créée depuis `feat/lot0a-socle` (PR #1 non fusionnée)

**Rendu imposé par la maquette :** les composants visuels (Tasks 3 à 7) reproduisent en React les écrans correspondants de la maquette v1 : structure, libellés, jetons, ambiance, disposition mobile et ordinateur. Ce plan les décrit par leur contenu, leurs états et leurs tests e2e. Il donne en code complet la logique (données, Auth, dates).

Les données de la maquette sont fictives : le site affiche les vraies données de Supabase.

**Les règles suivantes priment sur toute mention contraire dans les tâches :**
1. Accueil :
   - Le bouton du bloc « Notez les Olympiades » s'intitule **« Je note les manades »**. C'est un lien : vers `/inscription` si le visiteur n'est pas inscrit, vers `/noter` s'il l'est.
   - Le bloc lui-même est la carte en dégradé couchant de la maquette.
   - Sur téléphone, l'affiche duotone (« ARÈNES DE NÎMES », date, titre au pinceau, manades) vient en second. Sur ordinateur, elle vient en premier.
2. L'affiche n'utilise **pas** `hero.webp` de la maquette, qui montre un visage reconnaissable. Elle utilise la photo n° 13 de `photos-libres.md` (silhouette à contre-jour), en niveaux de gris. Avant la Task 7, `arenes.webp` de la maquette sert d'affiche provisoire.
3. Dates : onglets **« Saison 2027 »** (par défaut), **« Archives 2026 »** et **« Archives 2025 »**. L'onglet 2025 n'est pas dans la maquette : il est ajouté parce que le CDC demande les archives 2025.
4. Photos (Task 7) :
   - Le script produit des WebP **en niveaux de gris** de 800 et 1 600 px de large, sans AVIF. Le CSS `.duo` de la charte les colore.
   - Les photos `arenes.webp`, `manade.webp` et `chevaux.webp` de la maquette peuvent être reprises telles quelles, avec les crédits de son README.

## Review Focus

1. **Aucune soirée à venir dans le calendrier** (toutes passées ou annulées) : l'accueil affiche « Prochaines dates bientôt annoncées » au lieu d'un compte à rebours vide ou négatif. Test dans la Task 2 (`prochaineSoiree`)
2. **Code à 6 chiffres collé depuis l'email** (avec espaces ou tirets, ou tout le code collé dans la première case) : il est accepté et normalisé. Test dans la Task 6
3. **Supabase injoignable au chargement** (réseau des arènes) : les pages vitrine restent lisibles (contenu pré-rendu) et la zone de données affiche un message de repli, pas un écran blanc. Test e2e dans la Task 4
4. **Email déjà inscrit qui repasse par l'inscription** : même parcours (un code est envoyé), sans message révélant que le compte existe. Test dans la Task 6
5. **Formulaire de contact soumis deux fois rapidement** : un seul envoi, bouton désactivé pendant l'envoi. Test e2e dans la Task 5

## Hors de ce plan

- Notation (lot 2) : la route `/noter` affiche seulement « Les votes ouvriront le soir de l'Olympiade », avec le prénom du spectateur connecté
- Turnstile et SMTP Brevo (porte) : avant toute mise en production publique
- Gestion par l'admin des textes et des photos (lot admin) : textes et photos sont des fichiers du dépôt dans ce lot
- Déploiement Vercel (porte) : tout est vérifié en local (`build` + `preview`)
- Suppression de compte depuis l'app : elle demande une Edge Function `service_role`, prévue au lot 2

## Structure des fichiers

```
supabase/migrations/20261011090000_vitrine.sql         tables calendrier, palmares, messages_contact (Task 1)
supabase/migrations/20261011090100_donnees_vitrine.sql annuaire, calendrier 2025-2027, palmarès (Task 1)
tests/db/rls-vitrine.test.ts                           RLS et contraintes des 3 tables (Task 1)
tests/db/catalogue.test.ts                             matrice des droits étendue (Task 1)
react-router.config.ts, vite.config.ts                 config front (Task 2)
app/root.tsx, app/routes.ts, app/app.css               coque, routes, jetons de design (Task 2)
app/lib/supabase.ts                                    client Supabase (Task 2)
app/lib/dates.ts                                       prochaine soirée, compte à rebours, formats FR (Task 2)
app/lib/donnees.ts                                     lecture palmarès et calendrier (Task 2)
app/lib/auth.ts                                        demande et vérification du code, session (Task 6)
app/donnees/epreuves.ts, app/donnees/photos.ts         contenus statiques (Tasks 3, 7)
app/composants/                                        Entete, PiedDePage, SignatureTpmge, ... (Tasks 2 à 6)
app/routes/*.tsx                                       une page par fichier (Tasks 3 à 6)
public/photos/                                         photos optimisées (Task 7)
scripts/photos.mjs                                     téléchargement et optimisation (Task 7)
tests/unit/*.test.ts                                   logique (Tasks 2, 6)
tests/e2e/*.spec.ts, playwright.config.ts              parcours navigateur (Tasks 2 à 8)
```

---

### Task 1 : tables de la vitrine et données de référence

**Files :**
- Create : `supabase/migrations/20261011090000_vitrine.sql`, `supabase/migrations/20261011090100_donnees_vitrine.sql`
- Create : `tests/db/rls-vitrine.test.ts`
- Modify : `tests/db/catalogue.test.ts` (liste `DROITS_ATTENDUS` et droits de colonne)

**Interfaces :**
- Consumes : `prive.est_admin()` (lot 0), harnais `tests/db/aide.ts` et `graine.ts`
- Produces :
  - table `public.calendrier` (`id`, `annee`, `nom`, `ville`, `arenes`, `date_soiree date`, `heure time`, `statut` de type `public.statut_date` : `previsionnelle`, `confirmee` ou `annulee`, `lien_billetterie`, `soiree_id`)
  - table `public.palmares` (`id`, `annee`, `evenement`, `ville`, `date_soiree`, `vainqueur`, `detail`, `statut` de type `public.statut_resultat` : `confirme` ou `a_confirmer`, `source_url`)
  - table `public.messages_contact` (`id`, `prenom`, `email`, `message`, `cree_le`, `traite`)

- [ ] **Step 1 : écrire les tests**

Créer `tests/db/rls-vitrine.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { commeUtilisateur, commeVisiteur, dansUneTransaction, doitEtreRefuse } from './aide';
import { IDS, modifier, semerSoiree } from './graine';

const DEPOSER = `insert into public.messages_contact (prenom, email, message) values ($1, $2, $3)`;

describe('vitrine : calendrier et palmarès', () => {
  it('un visiteur lit le calendrier et le palmarès de référence', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      const cal = await db.query(
        `select count(*)::int as n from public.calendrier where annee = 2027 and statut = 'previsionnelle'`,
      );
      expect(cal.rows[0].n).toBe(10);
      const nimes = await db.query(
        `select date_soiree::text as d from public.calendrier where annee = 2027 and ville = 'Nîmes'`,
      );
      expect(nimes.rows).toEqual([{ d: '2027-08-20' }]);
      const pal = await db.query(
        `select annee, vainqueur, statut::text from public.palmares where evenement like 'Grandes Olympiades%' order by annee`,
      );
      expect(pal.rows).toEqual([
        { annee: 2023, vainqueur: 'Vinuesa', statut: 'confirme' },
        { annee: 2024, vainqueur: 'Vinuesa', statut: 'confirme' },
        { annee: 2025, vainqueur: 'Vinuesa', statut: 'a_confirmer' },
      ]);
    }));

  it('un visiteur et un spectateur ne modifient ni le calendrier ni le palmarès', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, `delete from public.palmares`)).toBe('42501');
      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query(`update public.calendrier set ville = 'X'`)).rowCount).toBe(0);
      expect(
        await doitEtreRefuse(
          db,
          `insert into public.palmares (annee, evenement, ville, vainqueur) values (2027, 'Faux', 'X', 'Y')`,
        ),
      ).toBe('42501');
    }));

  it('l’admin met à jour le palmarès et le calendrier', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.admin);
      const r = await db.query(
        `update public.palmares set statut = 'confirme' where annee = 2025 and evenement like 'Grandes Olympiades%'`,
      );
      expect(r.rowCount).toBe(1);
      const c = await db.query(
        `update public.calendrier set statut = 'confirmee' where annee = 2027 and ville = 'Nîmes'`,
      );
      expect(c.rowCount).toBe(1);
    }));
});

describe('vitrine : messages de contact', () => {
  it('un visiteur dépose un message mais ne peut pas le relire', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      await db.query(DEPOSER, ['Léa', 'lea@exemple.fr', 'Bonjour, quelle est la date 2027 ?']);
      expect(await doitEtreRefuse(db, `select * from public.messages_contact`)).toBe('42501');
    }));

  it('un visiteur ne choisit ni la date ni le statut traité', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      expect(
        await doitEtreRefuse(
          db,
          `insert into public.messages_contact (prenom, email, message, traite) values ('A', 'a@b.fr', 'Message assez long', true)`,
        ),
      ).toBe('42501');
    }));

  it('refuse un email invalide et un message trop court ou trop long', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, DEPOSER, ['A', 'pas-un-email', 'Message assez long'])).toBe('23514');
      expect(await doitEtreRefuse(db, DEPOSER, ['A', 'a@b.fr', 'court'])).toBe('23514');
      expect(await doitEtreRefuse(db, DEPOSER, ['A', 'a@b.fr', 'x'.repeat(2001)])).toBe('23514');
    }));

  it('l’admin lit les messages et les marque traités, un spectateur non', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeVisiteur(db);
      await db.query(DEPOSER, ['Léa', 'lea@exemple.fr', 'Bonjour, quelle est la date 2027 ?']);
      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query(`select * from public.messages_contact`)).rowCount).toBe(0);
      await commeUtilisateur(db, IDS.admin);
      expect((await db.query(`select * from public.messages_contact`)).rowCount).toBe(1);
      expect((await db.query(`update public.messages_contact set traite = true`)).rowCount).toBe(1);
      expect(await doitEtreRefuse(db, `update public.messages_contact set message = 'modifié par admin'`)).toBe(
        '42501',
      );
    }));
});
```

Mettre à jour `tests/db/catalogue.test.ts`. Ajouter à `DROITS_ATTENDUS` :
- `anon` et `authenticated` : `SELECT` sur `calendrier` et `palmares` ;
- `authenticated` : `INSERT`, `UPDATE` et `DELETE` sur `calendrier` et `palmares`, et `SELECT` sur `messages_contact`.

Ajouter aux droits de colonne attendus :
- `anon` et `authenticated` : `INSERT` sur `messages_contact (prenom, email, message)` ;
- `authenticated` : `UPDATE` sur `messages_contact (traite)`.

Ajouter enfin une assertion : `service_role` a `SELECT`, `INSERT`, `UPDATE` et `DELETE` sur les 3 nouvelles tables.

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `pnpm test tests/db/rls-vitrine.test.ts`
Expected : FAIL, `relation "public.calendrier" does not exist`.

- [ ] **Step 3 : écrire la migration des tables**

Créer `supabase/migrations/20261011090000_vitrine.sql` :

```sql
-- Lot vitrine : calendrier des soirées, palmarès des éditions passées, messages de contact (CDC 4.0).

create type public.statut_date as enum ('previsionnelle', 'confirmee', 'annulee');
create type public.statut_resultat as enum ('confirme', 'a_confirmer');

create table public.calendrier (
  id uuid primary key default gen_random_uuid(),
  annee smallint not null check (annee between 2000 and 2100),
  nom text not null check (length(btrim(nom)) > 0),
  ville text not null check (length(btrim(ville)) > 0),
  arenes text,
  date_soiree date not null,
  heure time,
  statut public.statut_date not null default 'previsionnelle',
  lien_billetterie text check (lien_billetterie is null or lien_billetterie ~ '^https://'),
  soiree_id uuid references public.soirees (id) on delete set null,
  check (extract(year from date_soiree) = annee)
);
create index calendrier_date_idx on public.calendrier (date_soiree);

create table public.palmares (
  id uuid primary key default gen_random_uuid(),
  annee smallint not null check (annee between 2000 and 2100),
  evenement text not null check (length(btrim(evenement)) > 0),
  ville text not null,
  date_soiree date,
  vainqueur text not null check (length(btrim(vainqueur)) > 0),
  detail text,
  statut public.statut_resultat not null default 'a_confirmer',
  source_url text check (source_url is null or source_url ~ '^https://')
);
create index palmares_annee_idx on public.palmares (annee);

create table public.messages_contact (
  id uuid primary key default gen_random_uuid(),
  prenom text not null check (length(btrim(prenom)) between 1 and 60),
  email text not null check (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  message text not null check (length(btrim(message)) between 10 and 2000),
  cree_le timestamptz not null default now(),
  traite boolean not null default false
);

alter table public.calendrier enable row level security;
alter table public.palmares enable row level security;
alter table public.messages_contact enable row level security;

revoke all on public.calendrier, public.palmares, public.messages_contact from anon, authenticated;
grant select on public.calendrier, public.palmares to anon, authenticated;
grant insert, update, delete on public.calendrier, public.palmares to authenticated;
grant insert (prenom, email, message) on public.messages_contact to anon, authenticated;
grant select on public.messages_contact to authenticated;
grant update (traite) on public.messages_contact to authenticated;
grant select, insert, update, delete on public.calendrier, public.palmares, public.messages_contact to service_role;

create policy calendrier_lecture on public.calendrier for select to anon, authenticated using (true);
create policy calendrier_admin on public.calendrier for all to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));

create policy palmares_lecture on public.palmares for select to anon, authenticated using (true);
create policy palmares_admin on public.palmares for all to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));

-- Dépôt ouvert à tous : les colonnes autorisées sont limitées par les droits de colonne.
-- L'anti-robot (Turnstile) est prévu avant la mise en production publique (suivi lot 0, point 9).
create policy messages_contact_depot on public.messages_contact for insert to anon, authenticated
  with check (true);
create policy messages_contact_lecture_admin on public.messages_contact for select to authenticated
  using ((select prive.est_admin()));
create policy messages_contact_traitement_admin on public.messages_contact for update to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));
```

- [ ] **Step 4 : écrire la migration de données**

Créer `supabase/migrations/20261011090100_donnees_vitrine.sql` :

```sql
-- Lot vitrine : données de référence (CDC 2.3, 2.3 bis et 2.3 ter, recherche du 2026-10-10).

insert into public.manades (nom) values
  ('Agu'), ('Arlatenco'), ('Aubanel'), ('Clément'), ('Colombet'), ('Conti'), ('Des Chanoines'),
  ('Devaux'), ('Du Soleil'), ('Gillet'), ('Grand Salan'), ('La Comtesse'), ('La Galère'),
  ('La Lauze'), ('Lafon'), ('Lescot'), ('Robert Michel'), ('Roumanille'), ('Saint Léonard'),
  ('Vellas'), ('Vinuesa')
on conflict (nom) do nothing;

insert into public.calendrier (annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie) values
  (2025, 'Olympiades melgoriennes', 'Mauguio', 'Arènes de Mauguio', '2025-08-13', '22:30', 'confirmee', null),
  (2025, 'Olympiades camarguaises', 'Saint-Rémy-de-Provence', 'Arènes Chomel-Coinon', '2025-08-15', '22:00', 'confirmee', null),
  (2025, 'Olympiades camarguaises', 'Mouriès', 'Arènes André Blanc', '2025-08-21', '21:00', 'confirmee', null),
  (2025, 'Les Grandes Olympiades des Gardians', 'Nîmes', 'Arènes de Nîmes', '2025-08-22', '21:00', 'confirmee', 'https://billetterie.arenesdenimes.com'),
  (2026, 'Soirée alésienne des gardians', 'Alès', 'Arènes du Tempéras', '2026-05-15', '21:30', 'confirmee', null),
  (2026, 'Olympiades d''Aimargues', 'Aimargues', 'Arènes d''Aimargues', '2026-07-16', '21:00', 'confirmee', null),
  (2026, 'Olympiades beaucairoises', 'Beaucaire', 'Arènes Paul-Laurent', '2026-07-20', null, 'confirmee', null),
  (2026, 'La Nuit des Gardians', 'Pérols', 'Arènes de Pérols', '2026-08-03', '21:30', 'confirmee', null),
  (2026, 'Soirée jeux de gardians', 'Fontvieille', 'Arènes de Fontvieille', '2026-08-05', '21:30', 'confirmee', null),
  (2026, 'Olympiades melgoriennes', 'Mauguio', 'Arènes de Mauguio', '2026-08-12', '22:30', 'confirmee', null),
  (2026, 'Olympiades camarguaises', 'Saint-Rémy-de-Provence', 'Arènes Chomel-Coinon', '2026-08-14', '22:00', 'confirmee', null),
  (2026, 'Olympiades de Beauvoisin', 'Beauvoisin', 'Arènes de Beauvoisin', '2026-08-17', '21:30', 'confirmee', null),
  (2026, 'Olympiades camarguaises', 'Mouriès', 'Arènes André Blanc', '2026-08-20', '21:30', 'confirmee', null),
  (2026, 'Les Grandes Olympiades des Gardians', 'Nîmes', 'Arènes de Nîmes', '2026-08-21', '21:00', 'confirmee', 'https://billetterie.arenesdenimes.com'),
  (2027, 'Soirée alésienne des gardians', 'Alès', 'Arènes du Tempéras', '2027-05-07', '21:30', 'previsionnelle', null),
  (2027, 'Olympiades d''Aimargues', 'Aimargues', 'Arènes d''Aimargues', '2027-07-15', '21:00', 'previsionnelle', null),
  (2027, 'Olympiades beaucairoises', 'Beaucaire', 'Arènes Paul-Laurent', '2027-07-19', null, 'previsionnelle', null),
  (2027, 'La Nuit des Gardians', 'Pérols', 'Arènes de Pérols', '2027-08-02', '21:30', 'previsionnelle', null),
  (2027, 'Soirée jeux de gardians', 'Fontvieille', 'Arènes de Fontvieille', '2027-08-04', '21:30', 'previsionnelle', null),
  (2027, 'Olympiades melgoriennes', 'Mauguio', 'Arènes de Mauguio', '2027-08-11', '22:30', 'previsionnelle', null),
  (2027, 'Olympiades camarguaises', 'Saint-Rémy-de-Provence', 'Arènes Chomel-Coinon', '2027-08-13', '22:00', 'previsionnelle', null),
  (2027, 'Olympiades de Beauvoisin', 'Beauvoisin', 'Arènes de Beauvoisin', '2027-08-16', '21:30', 'previsionnelle', null),
  (2027, 'Olympiades camarguaises', 'Mouriès', 'Arènes André Blanc', '2027-08-19', '21:30', 'previsionnelle', null),
  (2027, 'Les Grandes Olympiades des Gardians', 'Nîmes', 'Arènes de Nîmes', '2027-08-20', '21:00', 'previsionnelle', 'https://billetterie.arenesdenimes.com');

insert into public.palmares (annee, evenement, ville, date_soiree, vainqueur, detail, statut, source_url) values
  (2023, 'Les Grandes Olympiades des Gardians', 'Nîmes', '2023-08-18', 'Vinuesa',
   'Face à Lescot, Clément et Robert Michel. Plus de 3 500 spectateurs.', 'confirme',
   'https://www.arenesdenimes.com/actu/2023/temporada-grand-succès-populaire-des-spectacles-camarguais-aux-arènes.html'),
  (2024, 'Les Grandes Olympiades des Gardians', 'Nîmes', '2024-08-23', 'Vinuesa',
   'Ferrade et attente au fer : Vinuesa. Saut de cheval à cheval : Baptiste Benabent (Grand Salan).', 'confirme',
   'https://www.arenesdenimes.com/actu/2024/iie-grandes-olympiades-des-gardians-un-nouveau-sacre-pour-la-manade-vinuesa.html'),
  (2025, 'Les Grandes Olympiades des Gardians', 'Nîmes', '2025-08-22', 'Vinuesa',
   'Face à Lescot, Vellas, Robert Michel et Lafon. Présentée comme tenante du titre en 2026.', 'a_confirmer', null),
  (2026, 'Soirée alésienne des gardians', 'Alès', '2026-05-15', 'Vinuesa',
   'Trophée de la régularité : 2e de toutes les épreuves, face à Devaux et Robert Michel.', 'confirme',
   'https://www.objectifsud.fr/actualites/ales-en-feria-les-gardians-rendent-hommage-a-leur-tradition-dans-une-soiree-de-concours-164007.php'),
  (2026, 'Olympiades de Beauvoisin', 'Beauvoisin', '2026-08-17', 'Devaux',
   'Face à Clément et La Lauze. Saut de cheval à cheval : Simon Lestevin. Rodéo : Anthony Da Silva. Saut de cheval à taureau : Bastien Fernandez. Attente au fer : Dylan Guyon et Yoan Visin. Capture de la vache : manade Clément.',
   'confirme', 'https://voir-plus.com/2026/08/19/la-fete-votive-de-beauvoisin-incontournable-et-festive/');
```

- [ ] **Step 5 : lancer les tests pour les voir passer**

Run : `pnpm test && pnpm typecheck`
Expected : tous les tests passent, dont les 7 nouveaux et le catalogue étendu.

- [ ] **Step 6 : commiter**

```bash
git add supabase/migrations/20261011090000_vitrine.sql supabase/migrations/20261011090100_donnees_vitrine.sql \
  tests/db/rls-vitrine.test.ts tests/db/catalogue.test.ts
git commit -m "Vitrine : tables calendrier, palmarès et messages de contact, données de référence"
```

---

### Task 2 : socle front, jetons de design, logique de dates et de données

**Files :**
- Create : `react-router.config.ts`, `vite.config.ts`, `app/root.tsx`, `app/routes.ts`, `app/app.css`
- Create : `app/lib/supabase.ts`, `app/lib/dates.ts`, `app/lib/donnees.ts`
- Create : `app/composants/Entete.tsx`, `app/composants/PiedDePage.tsx`, `app/composants/SignatureTpmge.tsx`
- Create : `app/routes/accueil.tsx` (version minimale, enrichie en Task 3), `app/routes/noter.tsx`
- Create : `tests/unit/dates.test.ts`, `playwright.config.ts`, `tests/e2e/socle.spec.ts`
- Modify : `package.json` (scripts `dev`, `build`, `preview`, `test:unit`, `test:e2e`), `tsconfig.json`, `vitest.config.ts` (séparer `tests/unit` sans préparation de base, et `tests/db` avec préparation)

**Interfaces :**
- Produces :
  - `supabase` (instance unique de `SupabaseClient`) dans `app/lib/supabase.ts`
  - dans `app/lib/dates.ts` :
    - `type DateCalendrier = { date_soiree: string; heure: string | null; statut: 'previsionnelle' | 'confirmee' | 'annulee' }`
    - `prochaineSoiree<T extends DateCalendrier>(dates: T[], maintenant: Date): T | null`
    - `compteARebours(cible: Date, maintenant: Date): { jours: number; heures: number; minutes: number } | null`
    - `formaterDateLongue(dateIso: string): string`, qui renvoie par exemple « vendredi 20 août 2027 »
    - `formaterHeure(heure: string | null): string | null`, qui renvoie par exemple « 21h » ou « 21h30 »
  - dans `app/lib/donnees.ts` :
    - `lireCalendrier(): Promise<Calendrier[]>`
    - `lirePalmares(): Promise<Palmares[]>`
    - Les deux lèvent une `ErreurDonnees` en cas d'échec, pour que l'appelant affiche un repli.
  - jetons de design dans `app/app.css` : le bloc `@theme` de la charte (section 3), avec les polices `brush`, `display` et `sans`

- [ ] **Step 1 : initialiser le front**

- Ajouter les dépendances aux versions actuelles :
  - production : `react`, `react-dom`, `react-router`, `@supabase/supabase-js` ;
  - développement : `@react-router/dev`, `vite`, `tailwindcss`, `@tailwindcss/vite`, `@playwright/test`, `@types/react`, `@types/react-dom`.
- Lire la documentation de React Router 8 (mode framework, `ssr: false`, `prerender`, `loader` exécuté au pré-rendu, `clientLoader`). Ne pas deviner l'API.
- `react-router.config.ts` : `ssr: false`, `prerender` sur les 6 pages vitrine listées dans les Global Constraints.
- Polices hébergées avec le site, dans `public/polices/` : licence OFL, woff2, sous-ensemble latin. Il s'agit de Kaushan Script, Playfair Display (normal et italique) et Inter.

- [ ] **Step 2 : tests de la logique de dates**

Créer `tests/unit/dates.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { compteARebours, formaterDateLongue, formaterHeure, prochaineSoiree } from '../../app/lib/dates';

const d = (date_soiree: string, statut: 'previsionnelle' | 'confirmee' | 'annulee' = 'previsionnelle', heure: string | null = '21:00') =>
  ({ date_soiree, heure, statut });

describe('prochaineSoiree', () => {
  it('renvoie la plus proche soirée non annulée à venir, en comptant le jour même', () => {
    const maintenant = new Date('2027-08-13T10:00:00+02:00');
    const dates = [d('2027-08-20'), d('2027-08-11'), d('2027-08-13'), d('2027-08-12', 'annulee')];
    expect(prochaineSoiree(dates, maintenant)?.date_soiree).toBe('2027-08-13');
  });

  it('ignore les soirées annulées', () => {
    const maintenant = new Date('2027-08-12T10:00:00+02:00');
    expect(prochaineSoiree([d('2027-08-12', 'annulee'), d('2027-08-20')], maintenant)?.date_soiree).toBe('2027-08-20');
  });

  it('renvoie null quand rien n’est à venir', () => {
    const maintenant = new Date('2027-09-01T10:00:00+02:00');
    expect(prochaineSoiree([d('2027-08-20'), d('2027-08-21', 'annulee')], maintenant)).toBeNull();
    expect(prochaineSoiree([], maintenant)).toBeNull();
  });
});

describe('compteARebours', () => {
  it('découpe la durée restante en jours, heures et minutes', () => {
    expect(compteARebours(new Date('2027-08-20T21:00:00+02:00'), new Date('2027-08-18T19:30:00+02:00'))).toEqual({
      jours: 2,
      heures: 1,
      minutes: 30,
    });
  });

  it('renvoie null quand la cible est passée', () => {
    expect(compteARebours(new Date('2027-08-20T21:00:00+02:00'), new Date('2027-08-20T21:00:01+02:00'))).toBeNull();
  });
});

describe('formats français', () => {
  it('formate la date longue', () => {
    expect(formaterDateLongue('2027-08-20')).toBe('vendredi 20 août 2027');
  });

  it('formate l’heure à la française', () => {
    expect(formaterHeure('21:00')).toBe('21h');
    expect(formaterHeure('21:30:00')).toBe('21h30');
    expect(formaterHeure(null)).toBeNull();
  });
});
```

Run : `pnpm test:unit`. Expected : FAIL (module introuvable).

- [ ] **Step 3 : écrire `app/lib/dates.ts`**

```ts
export type DateCalendrier = {
  date_soiree: string;
  heure: string | null;
  statut: 'previsionnelle' | 'confirmee' | 'annulee';
};

const FUSEAU = 'Europe/Paris';

function jourParis(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function prochaineSoiree<T extends DateCalendrier>(dates: T[], maintenant: Date): T | null {
  const aujourdhui = jourParis(maintenant);
  const aVenir = dates
    .filter((x) => x.statut !== 'annulee' && x.date_soiree >= aujourdhui)
    .sort((a, b) => a.date_soiree.localeCompare(b.date_soiree));
  return aVenir[0] ?? null;
}

export function compteARebours(cible: Date, maintenant: Date): { jours: number; heures: number; minutes: number } | null {
  const ms = cible.getTime() - maintenant.getTime();
  if (ms <= 0) return null;
  const minutesTotales = Math.floor(ms / 60_000);
  return {
    jours: Math.floor(minutesTotales / 1440),
    heures: Math.floor((minutesTotales % 1440) / 60),
    minutes: minutesTotales % 60,
  };
}

export function formaterDateLongue(dateIso: string): string {
  const [a, m, j] = dateIso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(a, m - 1, j)));
}

export function formaterHeure(heure: string | null): string | null {
  if (!heure) return null;
  const [h, min] = heure.split(':');
  return min === '00' ? `${Number(h)}h` : `${Number(h)}h${min}`;
}
```

Run : `pnpm test:unit`. Expected : PASS.

- [ ] **Step 4 : client Supabase et lecture des données**

`app/lib/supabase.ts` :

```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !cle) {
  throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY doivent être définies dans .env.local');
}

export const supabase = createClient(url, cle, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});
```

`app/lib/donnees.ts` :

```ts
import { supabase } from './supabase';
import type { DateCalendrier } from './dates';

export type Calendrier = DateCalendrier & {
  id: string;
  annee: number;
  nom: string;
  ville: string;
  arenes: string | null;
  lien_billetterie: string | null;
};

export type Palmares = {
  id: string;
  annee: number;
  evenement: string;
  ville: string;
  date_soiree: string | null;
  vainqueur: string;
  detail: string | null;
  statut: 'confirme' | 'a_confirmer';
  source_url: string | null;
};

export class ErreurDonnees extends Error {}

export async function lireCalendrier(): Promise<Calendrier[]> {
  const { data, error } = await supabase
    .from('calendrier')
    .select('id, annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie')
    .order('date_soiree');
  if (error) throw new ErreurDonnees(`Calendrier indisponible : ${error.message}`);
  return data as Calendrier[];
}

export async function lirePalmares(): Promise<Palmares[]> {
  const { data, error } = await supabase
    .from('palmares')
    .select('id, annee, evenement, ville, date_soiree, vainqueur, detail, statut, source_url')
    .order('annee', { ascending: false })
    .order('date_soiree', { ascending: false });
  if (error) throw new ErreurDonnees(`Palmarès indisponible : ${error.message}`);
  return data as Palmares[];
}
```

- [ ] **Step 5 : coque, jetons, en-tête et pied de page**

- **`app/app.css`** :
  - Tailwind 4 (`@import "tailwindcss";`), avec le bloc `@theme` copié de la charte (section 3) ;
  - le dégradé couchant, et la classe `.duo` pour les photos en duotone (charte, section 5) ;
  - un focus clavier : contour ambre de 3 px ;
  - `prefers-reduced-motion`, qui coupe toutes les animations ;
  - l'ambiance Jour : fond `sable`, texte `encre`.
- **`Entete`** : logo de la charte, avec « Olympiade » en Kaushan Script et dégradé couchant, puis « DES MANADES » en capitales Inter de couleur or. Navigation Accueil, Classements, Dates, Contact. Sur mobile, un menu repliable accessible au clavier. Prévoir un emplacement pour le prénom du spectateur connecté, branché en Task 6.
- **`PiedDePage`** : contient, dans cet ordre :
  - le bloc « Partenaire officiel », avec le logotype Atch ;
  - la mention « Conçue en collaboration avec Atch Élevage et TPMGE » ;
  - les liens Mentions légales, Confidentialité et Contact ;
  - la `SignatureTpmge`, conforme à la spec de la mémoire `reference_tpmge_signature.md` et adaptée au fond.
- **`app/routes/noter.tsx`** : affiche « Les votes ouvriront le soir de l'Olympiade » (contenu du lot 2).

- [ ] **Step 6 : configuration Playwright et test e2e du socle**

`playwright.config.ts` :
- `webServer` : `pnpm build && pnpm preview --port 4173` ;
- deux projets : `mobile` (appareil `Pixel 7`) et `ordinateur` (1280 × 800).

Créer `tests/e2e/socle.spec.ts` :

```ts
import { expect, test } from '@playwright/test';

test('la navigation mène aux pages vitrine et le pied de page porte la signature', async ({ page }) => {
  await page.goto('/');
  for (const [lien, titre] of [
    ['Classements', /Classements/],
    ['Dates', /Dates/],
    ['Contact', /Contact/],
  ] as const) {
    await page.getByRole('navigation').getByRole('link', { name: lien }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titre);
    await page.goto('/');
  }
  const signature = page.getByRole('link', { name: 'Site conçu et développé par TPMGE' });
  await expect(signature).toHaveAttribute('href', 'https://tpmge.com/#olympiade-des-manades');
  await expect(signature).toHaveAttribute('target', '_blank');
});

test('les pages vitrine sont pré-rendues (contenu présent sans JavaScript)', async ({ browser }) => {
  const contexte = await browser.newContext({ javaScriptEnabled: false });
  const page = await contexte.newPage();
  for (const chemin of ['/', '/classements', '/dates', '/contact', '/mentions-legales', '/confidentialite']) {
    await page.goto(chemin);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await contexte.close();
});
```

À ce stade, `classements`, `dates`, `contact`, `mentions-legales` et `confidentialite` peuvent ne contenir que leur titre `h1`. Elles sont enrichies dans les Tasks 4 et 5.

- [ ] **Step 7 : lancer tous les tests et commiter**

Run : `pnpm test && pnpm typecheck && pnpm test:e2e`
Expected : PASS.

Commit : « Front : socle React Router en pré-rendu, jetons de design, en-tête, pied de page signé TPMGE ».

---

### Task 3 : page d'accueil

**Files :**
- Modify : `app/routes/accueil.tsx`
- Create : `app/donnees/epreuves.ts`, `app/composants/BlocNoter.tsx`, `app/composants/ProchaineSoiree.tsx`, `app/composants/Epreuves.tsx`, `app/composants/DernierVainqueur.tsx`
- Create : `tests/e2e/accueil.spec.ts`

**Contenu (CDC 4.0) :**
1. **`BlocNoter`**, en tête de page : titre « Notez les Olympiades », une phrase d'accroche, un bouton principal.
   - Visiteur non connecté : le bouton « Je note les manades » mène à `/inscription`.
   - Spectateur connecté (Task 6) : le même bouton « Je note les manades » mène à `/noter`.
   - Une photo de fond ou d'ambiance est permise si le texte reste lisible, et elle ne doit pas retarder l'affichage du bloc.
2. **`ProchaineSoiree`** : la prochaine date du calendrier d'après `prochaineSoiree`, avec nom, ville, arènes, date longue et heure.
   - Mention « Date prévisionnelle » si le statut est `previsionnelle`.
   - Compte à rebours mis à jour chaque minute.
   - Lien billetterie s'il existe.
   - Sans soirée à venir : « Prochaines dates bientôt annoncées » et un lien vers `/dates`.
3. **Galerie des éditions passées** : photos de la Task 7, chacune avec son crédit. Avant la Task 7, une zone vide est acceptée sans casser la page.
4. **`Epreuves`** : les 4 épreuves de référence du CDC 2.2 (nom et description), tirées de `app/donnees/epreuves.ts`.
5. **`DernierVainqueur`** : la ligne la plus récente du palmarès au statut `confirme` (aujourd'hui : Devaux, Beauvoisin 2026), avec un lien vers `/classements`.

**Données :** `loader` au pré-rendu et `clientLoader` au chargement (calendrier et palmarès). Si les données échouent, les blocs 2 et 5 affichent un message de repli : « Informations momentanément indisponibles ». Le reste de la page s'affiche normalement.

- [ ] **Step 1 : écrire `tests/e2e/accueil.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('sur mobile, « Notez les Olympiades » et son bouton sont visibles sans défiler', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'critère mobile');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const titre = page.getByRole('heading', { name: 'Notez les Olympiades' });
  const bouton = page.getByRole('link', { name: /Je note les manades/ });
  await expect(titre).toBeInViewport();
  await expect(bouton).toBeInViewport();
  await bouton.click();
  await expect(page).toHaveURL(/\/inscription$/);
});

test('l’accueil présente la prochaine soirée, les 4 épreuves et le dernier vainqueur', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-08-15T12:00:00+02:00'));
  await page.goto('/');
  await expect(page.getByText('Mouriès')).toBeVisible();
  await expect(page.getByText('jeudi 19 août 2027')).toBeVisible();
  await expect(page.getByText('Date prévisionnelle')).toBeVisible();
  for (const epreuve of ['Ferrade en piste', 'Saut de cheval à cheval', 'Saut de cheval à taureau', 'Attente au fer']) {
    await expect(page.getByRole('heading', { name: epreuve })).toBeVisible();
  }
  await expect(page.getByText('Devaux')).toBeVisible();
});

test('sans soirée à venir, l’accueil annonce de prochaines dates', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-12-01T12:00:00+01:00'));
  await page.goto('/');
  await expect(page.getByText('Prochaines dates bientôt annoncées')).toBeVisible();
});
```

Le bouton est un lien (`<a>`) présenté comme un bouton, puisqu'il navigue.

- [ ] **Step 2 :** voir les tests échouer, implémenter avec le skill `frontend-design:frontend-design`, puis faire passer les tests. Vérifier sur capture d'écran mobile et ordinateur.
- [ ] **Step 3 : commit** « Accueil : Notez les Olympiades en premier écran, prochaine soirée, épreuves, dernier vainqueur ».

---

### Task 4 : pages Classements et Dates

**Files :**
- Create : `app/routes/classements.tsx`, `app/routes/dates.tsx`, `app/composants/OngletsAnnee.tsx`, `app/composants/CarteResultat.tsx`, `app/composants/CarteDate.tsx`
- Create : `tests/e2e/classements-dates.spec.ts`

**Contenu :**
- **Classements**
  - Onglets **2025**, **2026** et **2027**. 2026 est l'onglet par défaut tant que 2027 n'a aucun résultat. L'année choisie est conservée dans l'URL (`?annee=2025`).
  - 2025 et 2026 : une carte par ligne du palmarès, avec événement, ville, date, vainqueur, détail, lien « Source » et badge « À confirmer » si `a_confirmer`.
  - 2027 : « Les classements 2027 s'afficheront en direct pendant les soirées : jury et prix du public. »
  - Une section repliée « Éditions précédentes » liste 2023 et 2024.
- **Dates**
  - Section « 2027 » d'abord : une carte par soirée (nom, ville, arènes, date longue, heure, badge « Date prévisionnelle » ou « Confirmée », lien billetterie).
  - Puis « Archives 2026 » et « Archives 2025 ».
  - Ligne d'information : « Les dates 2027 sont des projections, à confirmer par chaque organisateur. »

- [ ] **Step 1 : écrire `tests/e2e/classements-dates.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('les onglets d’années affichent le palmarès et gardent l’année dans l’URL', async ({ page }) => {
  await page.goto('/classements');
  await page.getByRole('tab', { name: '2025' }).click();
  await expect(page).toHaveURL(/annee=2025/);
  await expect(page.getByText('Vinuesa')).toBeVisible();
  await expect(page.getByText('À confirmer')).toBeVisible();
  await page.getByRole('tab', { name: '2026' }).click();
  await expect(page.getByText('Devaux')).toBeVisible();
  await page.getByRole('tab', { name: '2027' }).click();
  await expect(page.getByText(/en direct pendant les soirées/)).toBeVisible();
});

test('la page Dates liste 2027 en prévisionnel puis les archives', async ({ page }) => {
  await page.goto('/dates');
  const nimes = page.getByRole('article').filter({ hasText: 'Nîmes' }).first();
  await expect(nimes).toContainText('vendredi 20 août 2027');
  await expect(nimes).toContainText('Date prévisionnelle');
  await page.getByRole('tab', { name: 'Archives 2026' }).click();
  await expect(page.getByRole('article').filter({ hasText: 'Beauvoisin' }).first()).toContainText('lundi 17 août 2026');
});

test('si Supabase est injoignable, les pages restent lisibles avec un message de repli', async ({ page }) => {
  await page.route('**/rest/v1/**', (route) => route.abort());
  await page.goto('/dates');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/momentanément indisponibles/)).toBeVisible();
});
```

Les données pré-rendues au build peuvent rendre le dernier test vert sans repli. Dans ce cas, le test doit charger une page qui relit les données côté client en navigation, par exemple aller sur `/` puis cliquer sur « Dates ». Il vérifie ainsi le comportement réel du `clientLoader`. L'implémenteur adapte la mise en place du test, jamais son assertion.

- [ ] **Step 2 :** voir les tests échouer, implémenter, faire passer les tests, puis faire une capture mobile et ordinateur.
- [ ] **Step 3 : commit** « Classements 2025 à 2027 et calendrier des dates, avec repli hors ligne ».

---

### Task 5 : Contact, Mentions légales, Confidentialité

**Files :**
- Create : `app/routes/contact.tsx`, `app/routes/mentions-legales.tsx`, `app/routes/confidentialite.tsx`, `app/composants/FormulaireContact.tsx`
- Create : `tests/e2e/contact.spec.ts`

**Contenu :**
- **Contact**
  - Formulaire : prénom, email, message (10 à 2 000 caractères, compteur visible).
  - Champ piège invisible `site_web`, ignoré par les humains. S'il est rempli, le message n'est pas envoyé, mais le succès est affiché.
  - Validation côté client, avec les mêmes règles que la base.
  - Envoi par `supabase.from('messages_contact').insert(...)` : la base n'expose ni `select` ni la ligne créée.
  - Le bouton est désactivé pendant l'envoi. Après succès, afficher « Merci, votre message est bien parti. » et vider le formulaire.
  - Après une erreur : « L'envoi a échoué, réessayez dans un instant. »
- **Mentions légales** : éditeur du site, hébergeurs (Vercel, Supabase), conception par TPMGE (lien), crédits photos (renvoi vers la galerie).
  - Les informations de l'éditeur, encore inconnues (question 6 du CDC), apparaissent comme un encadré « À compléter par l'organisateur » bien visible.
  - Ce n'est pas un texte inventé.
- **Confidentialité** : texte issu du CDC section 6.
  - Données collectées (prénom, email) et finalité (accès au vote, notifications).
  - Pas de traceur tiers. Sous-traitants : Supabase, Brevo, Vercel.
  - Durée : suppression des comptes inactifs après 24 mois. Droits RGPD, contact.

- [ ] **Step 1 : écrire `tests/e2e/contact.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('le formulaire de contact envoie une seule fois et confirme', async ({ page }) => {
  let appels = 0;
  await page.route('**/rest/v1/messages_contact*', async (route) => {
    appels += 1;
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({ status: 201, body: '' });
  });
  await page.goto('/contact');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Bonjour, quelle sera la date à Nîmes en 2027 ?');
  const bouton = page.getByRole('button', { name: 'Envoyer' });
  await bouton.click();
  await bouton.click({ force: true }).catch(() => {});
  await expect(page.getByText('Merci, votre message est bien parti.')).toBeVisible();
  expect(appels).toBe(1);
});

test('le formulaire refuse un message trop court sans appeler le serveur', async ({ page }) => {
  let appels = 0;
  await page.route('**/rest/v1/messages_contact*', (route) => {
    appels += 1;
    return route.fulfill({ status: 201, body: '' });
  });
  await page.goto('/contact');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Court');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText(/au moins 10 caractères/)).toBeVisible();
  expect(appels).toBe(0);
});

test('les mentions légales signalent les informations éditeur à compléter', async ({ page }) => {
  await page.goto('/mentions-legales');
  await expect(page.getByText('À compléter par l’organisateur')).toBeVisible();
  await expect(page.getByRole('link', { name: /TPMGE/ }).first()).toBeVisible();
});
```

- [ ] **Step 2 :** voir les tests échouer, implémenter, faire passer les tests, puis faire une capture.
- [ ] **Step 3 : commit** « Contact avec anti-doublon, mentions légales et politique de confidentialité ».

---

### Task 6 : inscription par prénom, email et code à 6 chiffres

**Files :**
- Create : `app/lib/auth.ts`, `app/routes/inscription.tsx`, `app/routes/inscription-code.tsx`, `app/composants/SaisieCode.tsx`, `app/lib/useSession.ts`
- Modify : `app/composants/Entete.tsx` (prénom et déconnexion), `app/composants/BlocNoter.tsx` (bouton selon la session), `app/routes.ts`
- Create : `tests/unit/auth.test.ts`, `tests/e2e/inscription.spec.ts`

**Interfaces :**
- Produces, dans `app/lib/auth.ts` :
  - `normaliserCode(saisie: string): string | null` : renvoie les 6 chiffres, ou `null` si la saisie ne contient pas exactement 6 chiffres
  - `normaliserEmail(saisie: string): string` : supprime les espaces en trop et passe en minuscules
  - `demanderCode(prenom: string, email: string): Promise<void>` : appelle `signInWithOtp` avec `shouldCreateUser: true` et les données `prenom` et `consentement: true`. Toute erreur Supabase est transformée en `ErreurAuth` portant un message français.
  - `verifierCode(email: string, code: string): Promise<void>` : appelle `verifyOtp` avec le type `email`
  - `seDeconnecter(): Promise<void>`
- `useSession()` (hook) : `{ session, prenom, chargement }`. Le prénom est lu dans `profils` par l'utilisateur lui-même (politique `profils_lecture`).

- [ ] **Step 1 : tests unitaires**

`tests/unit/auth.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { normaliserCode, normaliserEmail } from '../../app/lib/auth';

describe('normaliserCode', () => {
  it('accepte 6 chiffres collés avec espaces, tirets ou texte autour', () => {
    expect(normaliserCode('123456')).toBe('123456');
    expect(normaliserCode(' 123 456 ')).toBe('123456');
    expect(normaliserCode('123-456')).toBe('123456');
    expect(normaliserCode('Votre code : 123456')).toBe('123456');
  });

  it('refuse moins ou plus de 6 chiffres', () => {
    expect(normaliserCode('12345')).toBeNull();
    expect(normaliserCode('1234567')).toBeNull();
    expect(normaliserCode('')).toBeNull();
  });
});

describe('normaliserEmail', () => {
  it('supprime les espaces et met en minuscules', () => {
    expect(normaliserEmail('  Lea@Exemple.FR ')).toBe('lea@exemple.fr');
  });
});
```

Le module `auth.ts` importe le client Supabase, qui exige les variables d'environnement. La configuration Vitest des tests unitaires doit donc soit définir des valeurs factices pour `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`, soit isoler les fonctions pures dans un module sans import Supabase. Les deux options sont acceptables : choisir la plus simple et la documenter.

- [ ] **Step 2 : parcours**
- **`/inscription`** : champs prénom et email, plus une case obligatoire « J'accepte la politique de confidentialité », avec un lien vers la page.
  - Au clic sur « Recevoir mon code » : appel de `demanderCode`, puis redirection vers `/inscription/code`, l'email étant conservé dans `sessionStorage`.
  - Même parcours pour un email déjà inscrit, avec le même message, sans révéler que le compte existe.
- **`/inscription/code`** : texte « Nous avons envoyé un code à 6 chiffres à <email> ».
  - Saisie du code : 6 cases, ou une case unique avec `inputmode="numeric"` et `autocomplete="one-time-code"`. Le collage du code entier est accepté.
  - Bouton « Valider », lien « Renvoyer le code » (actif après 60 s, compte à rebours visible) et lien « Changer d'email ».
  - Code faux ou expiré : « Code incorrect ou expiré. Vérifiez vos emails ou demandez un nouveau code. »
  - Code juste : redirection vers `/noter`.
- **Une fois connecté** : l'en-tête affiche le prénom et un bouton « Se déconnecter », et le bouton « Je note les manades » de l'accueil mène à `/noter`.

- [ ] **Step 3 : écrire `tests/e2e/inscription.spec.ts`**

Les appels Auth sont simulés : aucun email réel n'est envoyé.

```ts
import { expect, test } from '@playwright/test';

const SESSION = {
  access_token: 'jeton-factice',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'rafraichissement-factice',
  user: {
    id: '00000000-0000-4000-8000-0000000000aa',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'lea@exemple.fr',
    email_confirmed_at: new Date().toISOString(),
    user_metadata: { prenom: 'Léa' },
    app_metadata: {},
    created_at: new Date().toISOString(),
  },
};

test('inscription complète : prénom, email, consentement, code collé, arrivée sur /noter', async ({ page }) => {
  let demandeOtp: Record<string, unknown> | null = null;
  await page.route('**/auth/v1/otp*', async (route) => {
    demandeOtp = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/auth/v1/verify*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) }),
  );
  await page.route('**/rest/v1/profils*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ prenom: 'Léa' }]) }),
  );

  await page.goto('/inscription');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('  Lea@Exemple.FR ');
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(page.getByText(/accepter la politique de confidentialité/)).toBeVisible();
  await page.getByLabel(/J’accepte la politique de confidentialité/).check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();

  await expect(page).toHaveURL(/\/inscription\/code$/);
  await expect(page.getByText('lea@exemple.fr')).toBeVisible();
  expect(demandeOtp).toMatchObject({ email: 'lea@exemple.fr', data: { prenom: 'Léa', consentement: true } });

  await page.getByLabel(/Code/).first().focus();
  await page.keyboard.insertText('123 456');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page).toHaveURL(/\/noter$/);
  await expect(page.getByText('Léa')).toBeVisible();
});

test('un code refusé affiche un message clair et laisse réessayer', async ({ page }) => {
  await page.route('**/auth/v1/otp*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/auth/v1/verify*', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }),
    }),
  );
  await page.goto('/inscription');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel(/J’accepte la politique de confidentialité/).check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await page.getByLabel(/Code/).first().focus();
  await page.keyboard.insertText('000000');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Code incorrect ou expiré. Vérifiez vos emails ou demandez un nouveau code.')).toBeVisible();
  await expect(page).toHaveURL(/\/inscription\/code$/);
});
```

L'implémenteur vérifie dans la doc de supabase-js la forme exacte des requêtes et des réponses `otp` et `verify` (chemins, champs `data` et `code_challenge`). Il adapte les simulations aux vraies formes, sans changer les attentes visibles des tests. Le flux PKCE peut ajouter un `code_challenge` : l'assertion `toMatchObject` le tolère.

- [ ] **Step 4 :** voir les tests échouer, implémenter, faire passer les tests unitaires et e2e, puis faire des captures.
- [ ] **Step 5 : commit** « Inscription par prénom, email et code à 6 chiffres, session et prénom dans l'en-tête ».

---

### Task 7 : photos libres, optimisées et créditées

**Files :**
- Create : `scripts/photos.mjs`, `app/donnees/photos.ts`, `public/photos/*`, `app/composants/Galerie.tsx`
- Modify : `app/routes/accueil.tsx` (galerie), `app/routes/mentions-legales.tsx` (crédits)
- Create : `tests/e2e/photos.spec.ts`

**Contenu :**
- **`scripts/photos.mjs`** télécharge les photos 13 (affiche d'accueil), 2, 3, 7, 8, 11, 14, 15 et 16 de `docs/photos-libres.md`, d'après les URL de fichier des fiches Commons.
  - Il produit pour chacune des versions WebP **en niveaux de gris** de 800 et 1 600 px de large (sharp), dans `public/photos/`.
  - Les photos `arenes.webp`, `manade.webp` et `chevaux.webp` de la maquette sont reprises telles quelles, avec les crédits de son README.
  - Il échoue si un téléchargement échoue.
  - Il écrit `app/donnees/photos.ts` : nom de fichier, légende française, auteur, licence, lien de licence, lien de la fiche, mention de la retouche.
  - Les fichiers téléchargés sont placés dans un dossier vide dédié (`/private/tmp/.../photos-sources`), hors du dépôt. Seules les versions optimisées sont commitées.
- **`Galerie`** : photos en duotone, avec la classe `.duo` de la charte.
  - Chaque visuel est une `<img>` avec `alt`, ou un élément `role="img"` avec `aria-label`, le tout en français.
  - Dimensions explicites, chargement différé (lazy) pour tout ce qui sort du premier écran.
  - Crédit lisible sous chaque photo : « Auteur, licence, via Wikimedia Commons, retouchée (niveaux de gris, duotone) », avec les liens.
- **Affiche d'accueil** : photo n° 13 en duotone, en 800 px sur mobile. Si elle est préchargée, elle ne doit pas faire passer Lighthouse sous 90.
- Les photos 12, 17 et 20 (droit à l'image) sont **exclues**.

- [ ] **Step 1 : écrire `tests/e2e/photos.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('chaque photo de la galerie a un texte alternatif et un crédit avec licence', async ({ page }) => {
  await page.goto('/');
  const figures = page.locator('figure:has(img, [role="img"])');
  const n = await figures.count();
  expect(n).toBeGreaterThanOrEqual(6);
  for (let i = 0; i < n; i++) {
    const figure = figures.nth(i);
    const visuel = figure.locator('img, [role="img"]').first();
    const texte = (await visuel.getAttribute('alt')) ?? (await visuel.getAttribute('aria-label')) ?? '';
    expect(texte.length).toBeGreaterThanOrEqual(10);
    await expect(figure.locator('figcaption')).toContainText(/CC BY|domaine public/i);
    await expect(figure.locator('figcaption a').first()).toHaveAttribute('href', /commons\.wikimedia\.org/);
  }
});
```

- [ ] **Step 2 :** lancer le script, implémenter la galerie, faire passer les tests, puis faire une capture.
- [ ] **Step 3 : commit** « Photos libres en niveaux de gris et duotone, galerie créditée ».

---

### Task 8 : qualité et vérification finale

- [ ] **Step 1 :** `pnpm test`, `pnpm typecheck` et `pnpm test:e2e` (mobile et ordinateur) sont tous verts.
- [ ] **Step 2 :** Lighthouse mobile sur `/` du build (`pnpm preview`) : performance ≥ 90 et accessibilité ≥ 90. Enregistrer le rapport JSON dans le scratchpad et noter les scores.
- [ ] **Step 3 :** contrôle d'accessibilité avec `@axe-core/playwright` sur les 6 pages vitrine, plus `/inscription` et `/inscription/code`. Aucune violation `serious` ni `critical`.
- [ ] **Step 4 :** captures mobile (390 × 844) et ordinateur (1 280 × 800) de chaque page, relues une à une : textes, accents, débordements, contrastes.
- [ ] **Step 5 :** `grep` sans aucun tiret cadratin. Aucune clé secrète dans le dépôt : seule la clé publishable vient de `.env.local`.
- [ ] **Step 6 :** `git fetch`, rebase sur `feat/lot0a-socle` (ou sur `main` si la PR #1 a été fusionnée), puis rejouer les tests.

---

### Task 9 : hébergement Railway (ajoutée le 10/10 à la demande de l'utilisateur)

Côté Railway, tout est déjà en place :
- projet `olympiade-manade`, espace de travail TPMGE ;
- service unique `olympiade_manade` (f3df98c1-2705-4def-86e6-4869f8a4c2ab), environnement `production`, source GitHub `schibinethot/olympiade_manade` ;
- variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `PORT=8080`, `NODE_ENV=production` ;
- domaine `https://olympiademanade-production.up.railway.app`, qui pointe sur le port 8080.

Le worktree est lié au projet par `railway status`. Cette tâche ajoute la configuration côté dépôt et prépare le premier déploiement. Elle **ne déploie pas** : `railway up` et le push des migrations de la vitrine vers Supabase sont des portes, soumises au GO de l'utilisateur.

**Files :**
- Create : `serveur/statique.mjs`, `railway.json`, `tests/e2e/serveur.spec.ts`, `scripts/supabase-config-diff.exp`, `scripts/supabase-config-push-auth.exp`
- Modify : `package.json` (script `start`), `playwright.config.ts` (le `webServer` lance le vrai serveur de production), `supabase/config.toml` (URL du site)

**Contenu :**
- **`serveur/statique.mjs`** : serveur Node minimal. Pas de dépendance, ou seulement `sirv`.
  - Sert `build/client`, avec les pages pré-rendues.
  - Pour les routes non pré-rendues (`/inscription`, `/inscription/code`, `/noter`) : repli d'application monopage, vers le fichier de repli produit par React Router 8. Vérifier le nom exact de ce fichier dans la sortie du build.
  - Une route inconnue reçoit un statut 404 et la page 404 de l'app.
  - Écoute `process.env.PORT`, 8080 par défaut.
  - En-têtes :
    - cache long et `immutable` sur les fichiers fingerprintés (`/assets/*`) ;
    - `no-cache` sur le HTML ;
    - `X-Content-Type-Options: nosniff` ;
    - `Referrer-Policy: strict-origin-when-cross-origin` ;
    - `Permissions-Policy` restrictive ;
    - une `Content-Security-Policy` qui autorise seulement le site lui-même et le projet Supabase (`https://khwlwpzydlrfocfpvywv.supabase.co`, `wss://khwlwpzydlrfocfpvywv.supabase.co`).
- **`package.json`** : `"start": "node serveur/statique.mjs"`.
- **`railway.json`** :
  - build : `pnpm install --frozen-lockfile && pnpm build` ;
  - démarrage : `pnpm start` ;
  - healthcheck : `/` ;
  - région européenne, si Railway la règle par fichier.

  Vérifier les clés exactes dans la doc Railway, ne pas les deviner. Les variables `VITE_*` doivent être disponibles au build.
- **`supabase/config.toml`** :
  - `site_url = "https://olympiademanade-production.up.railway.app"` ;
  - `additional_redirect_urls` : le domaine Railway et `http://localhost:5173`, avec des chemins précis (`/inscription/code`, `/auth/confirm`), pas `/**`.
- **Scripts versionnés** (suivi lot 0, point 1) :
  - `scripts/supabase-config-diff.exp` affiche le diff de `supabase config push` en répondant « n » à toutes les questions ;
  - `scripts/supabase-config-push-auth.exp` ne pousse que la partie Auth.
  - Ne **pas** lancer le push dans cette tâche, seulement le diff, et joindre la sortie au rapport.

- [ ] **Step 1 : écrire `tests/e2e/serveur.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('le serveur de production sert les pages pré-rendues, le repli et les en-têtes', async ({ request }) => {
  const accueil = await request.get('/');
  expect(accueil.status()).toBe(200);
  expect(accueil.headers()['cache-control']).toContain('no-cache');
  expect(accueil.headers()['x-content-type-options']).toBe('nosniff');
  expect(accueil.headers()['content-security-policy']).toContain('khwlwpzydlrfocfpvywv.supabase.co');

  const inscription = await request.get('/inscription');
  expect(inscription.status()).toBe(200);
  expect(await inscription.text()).toContain('<div');

  const inconnue = await request.get('/page-qui-n-existe-pas');
  expect(inconnue.status()).toBe(404);
});

test('une page non pré-rendue s’ouvre directement par son URL', async ({ page }) => {
  await page.goto('/inscription');
  await expect(page.getByRole('button', { name: /Recevoir mon code/ })).toBeVisible();
});
```

- [ ] **Step 2 :** voir les tests échouer, implémenter, puis lancer `pnpm build && pnpm test:e2e` contre le vrai serveur.
- [ ] **Step 3 :** lancer `railway up --dry-run` si la CLI le propose. Sinon, vérifier avec `railway status` et relire `railway.json`. **Ne pas déployer.**
- [ ] **Step 4 : commit** « Hébergement Railway : serveur statique, en-têtes de sécurité, configuration et scripts de push Auth ».
