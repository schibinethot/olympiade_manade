import { Link } from 'react-router';
import { FormulaireContact } from '../composants/FormulaireContact';
import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/contact';

export const meta: Route.MetaFunction = () => [
  { title: 'Contact · Olympiade des Manades' },
  { name: 'description', content: 'Infos, dates, une manade à inscrire, une photo à proposer : écrivez à l’organisation.' },
];

export default function Contact() {
  return (
    <>
      <TitrePage surtitre="Infos & dates" titre="Contact">
        <p>Infos, dates, une manade à inscrire, une photo à proposer&nbsp;: écrivez à l’organisation, elle vous répond.</p>
      </TitrePage>
      <div className="px-4 pt-5 tablette:px-7 paysage:px-10 bureau:px-14">
        <section aria-labelledby="titre-formulaire" className="max-w-[720px] rounded-[22px] border border-trait bg-creme p-5">
          <h2 id="titre-formulaire" className="font-display text-[21px] leading-[1.2] font-bold">
            Écrire à l’organisation
          </h2>
          <FormulaireContact />
          <p className="mt-4 text-[12.5px] text-encre-2">
            Vos données (prénom, email, message) servent uniquement à vous répondre. Vous pouvez en demander l’effacement à tout moment. Détails et droits&nbsp;:{' '}
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
