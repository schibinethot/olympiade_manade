import { matriceQr } from '../lib/pdf';

export function CodeQr({ valeur, libelle, taille = 180 }: { valeur: string; libelle: string; taille?: number }) {
  const matrice = matriceQr(valeur);
  const n = matrice.length || 1;
  return (
    <svg role="img" aria-label={libelle} viewBox={`0 0 ${n} ${n}`} width={taille} height={taille} shapeRendering="crispEdges" className="bg-white">
      <rect width={n} height={n} fill="#fff" />
      {matrice.flatMap((ligne, y) => ligne.flatMap((noir, x) => (noir ? [<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#1a120c" />] : [])))}
    </svg>
  );
}
