interface MascotProps {
  size?: number;
  className?: string;
}

export function Pinguinito({ size = 48, className }: MascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
    >
      <ellipse cx="32" cy="58" rx="18" ry="4" fill="#93C5FD" opacity="0.35" />
      <ellipse cx="32" cy="38" rx="20" ry="22" fill="#2D3A4A" />
      <ellipse cx="32" cy="42" rx="12" ry="14" fill="#F8FAFC" />
      <ellipse cx="20" cy="36" rx="6" ry="10" fill="#2D3A4A" />
      <ellipse cx="44" cy="36" rx="6" ry="10" fill="#2D3A4A" />
      <ellipse cx="20" cy="38" rx="3" ry="5" fill="#F8FAFC" opacity="0.9" />
      <ellipse cx="44" cy="38" rx="3" ry="5" fill="#F8FAFC" opacity="0.9" />
      <circle cx="26" cy="30" r="4.5" fill="#1E293B" />
      <circle cx="38" cy="30" r="4.5" fill="#1E293B" />
      <circle cx="27.5" cy="28.5" r="1.5" fill="white" />
      <circle cx="39.5" cy="28.5" r="1.5" fill="white" />
      <polygon points="32,34 28,40 36,40" fill="#FB923C" />
      <circle cx="20" cy="36" r="3" fill="#FFB4C8" opacity="0.65" />
      <circle cx="44" cy="36" r="3" fill="#FFB4C8" opacity="0.65" />
      <path
        d="M26 42 Q32 47 38 42"
        fill="none"
        stroke="#FB923C"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="24" cy="56" rx="5" ry="3" fill="#FB923C" />
      <ellipse cx="40" cy="56" rx="5" ry="3" fill="#FB923C" />
      <path
        d="M30 18 Q32 14 34 18"
        fill="#F472B6"
        stroke="#EC4899"
        strokeWidth="0.5"
      />
    </svg>
  );
}
