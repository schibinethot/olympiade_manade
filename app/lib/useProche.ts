import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Vrai dès que l'élément arrive à `marge` du bord de l'écran, et le reste ensuite. Faux au
 * pré-rendu et à l'hydratation.
 *
 * Pour différer vraiment des images : le chargement différé natif (loading="lazy") de Chrome
 * commence à 1 250 px de l'écran, et chargeait donc les photos des épreuves dès l'ouverture de
 * l'accueil sur téléphone.
 */
export function useProche<T extends Element>(marge = '400px'): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [proche, setProche] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (proche || !element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setProche(true);
      return;
    }
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((entree) => entree.isIntersecting)) {
          setProche(true);
          observateur.disconnect();
        }
      },
      { rootMargin: marge },
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [marge, proche]);
  return [ref, proche];
}
