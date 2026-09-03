// Elegant, self-contained brand mark for the app: a rounded gradient badge with a white
// "growth" glyph (ascending bars + trend line and arrow). Scales crisply at any size.
export default function BrandLogo({ size = 38, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Finances"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="finLogoBg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f5c4d" />
          <stop offset="1" stopColor="#b8943e" />
        </linearGradient>
        <linearGradient id="finLogoGlass" x1="24" y1="2" x2="24" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#finLogoBg)" />
      <rect x="2" y="2" width="44" height="22" rx="13" fill="url(#finLogoGlass)" />

      {/* Ascending bars */}
      <g fill="#ffffff">
        <rect x="11" y="28" width="5" height="9" rx="2" fillOpacity="0.55" />
        <rect x="21.5" y="24" width="5" height="13" rx="2" fillOpacity="0.75" />
        <rect x="32" y="19" width="5" height="18" rx="2" fillOpacity="0.95" />
      </g>

      {/* Trend line with arrow head */}
      <path
        d="M12 23.5 L21 18.5 L28 21.5 L36 13"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30.5 12.5 L36 13 L36.5 18.5"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
