import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/contact';

export const meta: Route.MetaFunction = () => [
  { title: 'Contact · Olympiade des Manades' },
  { name: 'description', content: 'Une question, une manade à inscrire, une photo à proposer : écrivez à l’organisation.' },
];

// Formulaire de contact en Task 5.
export default function Contact() {
  return (
    <TitrePage surtitre="Une question ?" titre="Contact">
      <p>Une manade à inscrire, une photo à proposer&nbsp;: l’organisation vous répond.</p>
    </TitrePage>
  );
}
