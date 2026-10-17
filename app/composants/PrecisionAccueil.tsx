import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** Texte et photos ajoutés par l’admin. Rien n’est affiché tant qu’ils ne sont pas saisis. */
export function PrecisionAccueil() {
  const [texte, setTexte] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; legende: string; auteur: string; licence: string }[]>([]);

  useEffect(() => {
    let actif = true;
    supabase().then(async (client) => {
      const [contenu, images] = await Promise.all([
        client.from('contenus_vitrine').select('valeur').eq('cle', 'accueil_precision').maybeSingle(),
        client.from('photos_vitrine').select('id, url, legende, auteur, licence').order('ordre').limit(12),
      ]);
      if (!actif) return;
      setTexte((contenu.data?.valeur as string | undefined) ?? null);
      setPhotos((images.data ?? []) as { id: string; url: string; legende: string; auteur: string; licence: string }[]);
    }).catch(() => undefined);
    return () => { actif = false; };
  }, []);

  if (!texte && !photos.length) return null;
  return (
    <section aria-label="Précisions de l’organisateur" className="grid gap-3 px-4 pt-6 tablette:px-7 paysage:px-10 bureau:px-14">
      {texte ? <p className="max-w-[62ch] text-[15px] leading-relaxed">{texte}</p> : null}
      {photos.length ? (
        <ul className="grid gap-3 tablette:grid-cols-2">
          {photos.map((photo) => (
            <li key={photo.id}>
              <img src={photo.url} alt={photo.legende} className="aspect-[3/2] w-full rounded-2xl object-cover" />
              <p className="mt-1 text-xs text-encre-2">{photo.legende} — {photo.auteur}, {photo.licence}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
