/**
 * Signature « Signé TPMGE » (spec agence). Le style, adapté au fond nuit du
 * pied de page, est dans app/app.css (section Signature).
 */
export function SignatureTpmge() {
  return (
    <a
      className="tpmge-badge"
      href="https://tpmge.com/#olympiade-des-manades"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Site conçu et développé par TPMGE"
    >
      <span className="tpmge-badge__shine" aria-hidden="true" />
      <span className="tpmge-badge__label">Signé</span>
      <span className="tpmge-mark">TPMGE</span>
    </a>
  );
}
