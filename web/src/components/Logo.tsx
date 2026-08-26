/**
 * Marca de Talaia: una "T" que es a la vez atalaya (almenas + plataforma de vigía) y regla
 * de aforo (la muesca del mástil y el agua que sube). Hereda el color con `currentColor`.
 */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className ? `mark ${className}` : "mark"}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Talaia"
      fill="currentColor"
    >
      {/* almenas */}
      <rect x="10" y="6" width="5.5" height="5" rx="1" />
      <rect x="21.25" y="6" width="5.5" height="5" rx="1" />
      <rect x="32.5" y="6" width="5.5" height="5" rx="1" />
      {/* corona / dintel de la T */}
      <rect x="8" y="10.5" width="32" height="6" rx="2" />
      {/* mástil-torre */}
      <rect x="20.5" y="16.5" width="7" height="16.5" rx="2" opacity="0.85" />
      {/* muesca de aforo */}
      <rect x="20.5" y="23" width="7" height="2.4" fill="var(--surface, #fff)" />
      {/* agua que sube */}
      <path
        d="M6 37 q 6 -4 12 0 t 12 0 t 12 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M6 43 q 6 -4 12 0 t 12 0 t 12 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}
