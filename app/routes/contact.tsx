import { Link } from 'react-router';
import { FormulaireContact } from '../composants/FormulaireContact';
import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/contact';

export const meta: Route.MetaFunction = () => [
  { title: 'Contact · Olympiade des Manades' },
  { name: 'description', content: 'Une question, une manade à inscrire, une photo à proposer : écrivez à l’organisation.' },
];

export default function Contact() {
  return (
    <>
      <TitrePage surtitre="Une question ?" titre="Contact">
        <p>Une manade à inscrire, une photo à proposer&nbsp;: l’organisation vous répond.</p>
      </TitrePage>
      <div className="px-4 pt-5 tablette:px-7 paysage:px-10 bureau:px-14">
        <section aria-labelledby="titre-formulaire" className="max-w-[720px] rounded-[22px] border border-trait bg-creme p-5">
          <h2 id="titre-formulaire" className="font-display text-[21px] leading-[1.2] font-bold">
            Écrire à l’organisation
          </h2>
          <FormulaireContact />
          <p className="mt-4 text-[12.5px] text-encre-2">
            Vos données ne servent qu’à vous répondre. Détails dans la{' '}
            <Link to="/confidentialite" className="underline underline-offset-2 hover:text-encre">
              politique de confidentialité
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
