type LogoProps = {
  className?: string
}

/** Geometric lettermark for a personal iOS / product brand. */
export function Logo({ className }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 80 80" role="img" aria-label="Ravi Ranjan mark">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7CFF6B" />
          <stop offset="100%" stopColor="#3EE0C4" />
        </linearGradient>
      </defs>
      <rect width="80" height="80" rx="22" fill="#0E131A" />
      <rect x="1.5" y="1.5" width="77" height="77" rx="20.5" fill="none" stroke="url(#g)" strokeWidth="2" />
      <path
        d="M22 58V22h20.5c10.4 0 17.2 5.6 17.2 14.3 0 6.4-3.5 11.1-9.4 13.1L60 58h-10.2L41.2 47.2H32.4V58H22zm10.4-24.8h9.4c4.5 0 7.2-2.3 7.2-5.8s-2.7-5.8-7.2-5.8h-9.4v11.6z"
        fill="url(#g)"
      />
      <circle cx="58" cy="22" r="3.2" fill="#7CFF6B" />
    </svg>
  )
}
