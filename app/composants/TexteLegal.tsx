import type { ReactNode } from 'react';

export const LIEN_TEXTE = 'font-semibold text-rouge underline underline-offset-2 hover:text-encre';

/** Colonne de lecture des pages juridiques, avec les mêmes marges que TitrePage. */
export function CorpsLegal({ children }: { children: ReactNode }) {
  return (
    <div className="grid max-w-[72ch] gap-8 px-4 pt-6 tablette:px-7 paysage:px-10 bureau:px-14">
      {children}
    </div>
  );
}

export function SectionLegale({ id, titre, children }: { id: string; titre: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-2.5 text-[15px] leading-relaxed text-encre-2 [&_ul]:grid [&_ul]:gap-1.5 [&_ul]:pl-5 [&_ul]:list-disc">
      <h2 id={id} className="font-display text-[22px] leading-[1.2] font-bold text-encre tablette:text-[26px]">
        {titre}
      </h2>
      {children}
    </section>
  );
}

/**
 * Encadré des informations que l'organisateur doit encore fournir (question 6 du CDC).
 * Jamais de texte inventé à la place : le trou reste visible.
 */
export function EncadreOrganisateur({ children }: { children: ReactNode }) {
  return (
    <div
      role="group"
      aria-labelledby="encadre-organisateur"
      className="rounded-[18px] border-2 border-dashed border-rouge bg-creme p-4 text-[15px] leading-relaxed text-encre-2"
    >
      <p id="encadre-organisateur" className="font-display text-[19px] leading-tight font-bold text-encre">
        À compléter par l’organisateur
      </p>
      <div className="mt-2 grid gap-2">{children}</div>
    </div>
  );
}
