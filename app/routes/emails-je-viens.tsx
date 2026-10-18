import { LienEmail } from '../composants/LienEmail';
import type { Route } from './+types/emails-je-viens';

export const meta: Route.MetaFunction = () => [
  { title: 'Je viens · Olympiade des Manades' },
  // Page monopage sans contenu à indexer : le serveur envoie aussi X-Robots-Tag: noindex.
  { name: 'robots', content: 'noindex' },
];

// Route sans pré-rendu (repli monopage) : le jeton du lien (#j=, ou ?j= en repli) n'est lu que dans le navigateur.
export default function EmailsJeViens() {
  return <LienEmail type="je_viens" />;
}
