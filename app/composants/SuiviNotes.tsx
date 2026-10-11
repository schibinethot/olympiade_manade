import { Link, useLocation } from 'react-router';
import { configurerFileNotesNavigateur } from '../lib/file-notes-browser';
import { useFileNotes } from '../lib/file-notes';
import { useSession } from '../lib/useSession';

if (typeof window !== 'undefined') configurerFileNotesNavigateur();

/** La reprise continue après une navigation dans le site, sans transmettre les notes d'un autre compte. */
export function SuiviNotes() {
  const { session } = useSession();
  const file = useFileNotes(session?.user.id ?? null);
  const { pathname } = useLocation();
  const nombre = file.items.filter((i) => ['pending', 'sending', 'queued'].includes(i.statut)).length;
  if (!nombre || pathname === '/noter') return null;
  return <p role="status" className="mx-auto my-4 max-w-5xl rounded-xl border border-trait bg-lin px-5 py-3 text-sm">
    {nombre} {nombre > 1 ? 'notes en attente d’enregistrement' : 'note en attente d’enregistrement'}.{' '}
    <Link to="/noter" className="font-semibold text-rouge underline underline-offset-2">Voir mes envois</Link>
  </p>;
}
