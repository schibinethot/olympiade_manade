import type { ReactNode } from 'react';

type Props = {
  surtitre: string;
  /** Contenu du h1. Un <em> y passe en Playfair italique rouge, comme dans la maquette. */
  titre: ReactNode;
  children?: ReactNode;
};

/** En-tête de page du site public (maquette : bloc .pg-h). */
export function TitrePage({ surtitre, titre, children }: Props) {
  return (
    <div className="px-4 pt-6 pb-1 tablette:px-7 tablette:pt-9 tablette:pb-1.5 paysage:px-10 paysage:pt-[46px] bureau:px-14">
      <p className="text-[10.5px] leading-tight font-bold tracking-[0.2em] text-or-ink uppercase">{surtitre}</p>
      <h1 className="mt-2 font-display text-[36px] leading-[1.04] font-bold tracking-[-0.01em] tablette:text-[46px] paysage:text-[58px] [&_em]:text-rouge">
        {titre}
      </h1>
      {children ? <div className="mt-2 max-w-[58ch] text-encre-2">{children}</div> : null}
    </div>
  );
}
