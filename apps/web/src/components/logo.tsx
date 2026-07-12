/**
 * SanGit mark: a beamed double eighth-note drawn as a commit graph —
 * circles for nodes, line segments for edges, one accent node on the beam.
 * SVG recreation of src/app/logo/logo.png (transparent background so it
 * sits on the dark canvas). White parts inherit currentColor; only the
 * accent node references the brand red.
 */
export function LogoMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 110 110"
      fill="none"
      aria-hidden
      className={className}
    >
      <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
        {/* beam band */}
        <path d="M26 19L98 6" />
        <path d="M26 19L61 33" />
        <path d="M61 33L89 28" />
        <path d="M89 28L98 6" />
        <path d="M70 21L61 33" />
        <path d="M70 21L89 28" />
        {/* left stem + kink chain */}
        <path d="M26 19L26 79" />
        <path d="M35 38L61 33" />
        <path d="M35 38L35 57" />
        <path d="M35 57L26 71" />
        {/* right stem + kink chain */}
        <path d="M98 6L97 76" />
        <path d="M89 28L90 43" />
        <path d="M90 43L97 52" />
      </g>
      <g fill="currentColor">
        {/* noteheads */}
        <circle cx="19" cy="91" r="15" />
        <circle cx="83" cy="88" r="14" />
        {/* graph nodes */}
        <circle cx="26" cy="19" r="4.5" />
        <circle cx="98" cy="6" r="4.5" />
        <circle cx="61" cy="33" r="4" />
        <circle cx="89" cy="28" r="4" />
        <circle cx="35" cy="38" r="3.5" />
        <circle cx="35" cy="57" r="3" />
        <circle cx="26" cy="71" r="3" />
        <circle cx="90" cy="43" r="3" />
        <circle cx="97" cy="52" r="3" />
      </g>
      {/* accent node on the beam */}
      <circle cx="70" cy="21" r="5.5" fill="var(--primary)" />
    </svg>
  );
}
