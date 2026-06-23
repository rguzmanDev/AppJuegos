interface MascotProps {
  size?: number;
  className?: string;
  mood?: "happy" | "nervous" | "sad" | "dizzy";
}

export function Pollito({ size = 48, className, mood = "happy" }: MascotProps) {
  const eyeY = mood === "sad" ? 27 : 25;
  const mouth =
    mood === "happy" ? (
      <path d="M26 34 Q32 40 38 34" fill="none" stroke="#E8872B" strokeWidth="2" strokeLinecap="round" />
    ) : mood === "nervous" ? (
      <ellipse cx="32" cy="36" rx="4" ry="3" fill="#E8872B" />
    ) : mood === "sad" ? (
      <path d="M26 38 Q32 32 38 38" fill="none" stroke="#E8872B" strokeWidth="2" strokeLinecap="round" />
    ) : (
      <path d="M26 36 Q32 32 38 36" fill="none" stroke="#E8872B" strokeWidth="2" strokeLinecap="round" />
    );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
    >
      <ellipse cx="32" cy="58" rx="18" ry="4" fill="#F9A8D4" opacity="0.35" />
      <ellipse cx="32" cy="36" rx="22" ry="20" fill="#FFE566" />
      <ellipse cx="32" cy="40" rx="14" ry="12" fill="#FFF3A8" />
      <ellipse cx="18" cy="34" rx="7" ry="9" fill="#FFE566" />
      <ellipse cx="46" cy="34" rx="7" ry="9" fill="#FFE566" />
      <polygon points="32,30 28,36 36,36" fill="#FF9F43" />
      {mood === "dizzy" ? (
        <>
          <text x="20" y="28" fontSize="9" fill="#E8872B" fontWeight="bold">
            x
          </text>
          <text x="38" y="28" fontSize="9" fill="#E8872B" fontWeight="bold">
            x
          </text>
        </>
      ) : (
        <>
          <circle cx="24" cy={eyeY} r="4.5" fill="#3D2C1E" />
          <circle cx="40" cy={eyeY} r="4.5" fill="#3D2C1E" />
          <circle cx="25.5" cy={eyeY - 1.5} r="1.5" fill="white" />
          <circle cx="41.5" cy={eyeY - 1.5} r="1.5" fill="white" />
          <circle cx="18" cy="33" r="3" fill="#FFB4C8" opacity="0.7" />
          <circle cx="46" cy="33" r="3" fill="#FFB4C8" opacity="0.7" />
        </>
      )}
      {mouth}
      {mood === "dizzy" && (
        <path
          d="M48 14 Q52 10 56 14 Q52 18 48 14"
          fill="none"
          stroke="#F9A8D4"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
