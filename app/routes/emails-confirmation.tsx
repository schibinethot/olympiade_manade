import { LienEmail } from '../composants/LienEmail';
import type { Route } from './+types/emails-confirmation';

export const meta: Route.MetaFunction = () => [
  { title: 'Confirmer mon adresse · Olympiade des Manades' },
  // Page monopage sans contenu à indexer : le serveur envoie aussi X-Robots-Tag: noindex.
  { name: 'robots', content: 'noindex' },
];

// Route sans pré-rendu (repli monopage) : le jeton du lien (?j=) n'est lu que dans le navigateur.
export default function EmailsConfirmation() {
  return <LienEmail type="confirmation" />;
}
