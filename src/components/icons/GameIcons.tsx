import type { ComponentType } from "react";
import { Pollito } from "@/components/mascots/Pollito";

export interface IconProps {
  size?: number;
  className?: string;
}

export function PPTIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="10" y="14" width="16" height="20" rx="6" fill="#FDA4AF" />
      <rect x="24" y="10" width="16" height="24" rx="4" fill="#F9A8D4" />
      <path
        d="M44 18 L52 14 L52 34 L44 30 Z"
        fill="#C4B5FD"
        stroke="#A78BFA"
        strokeWidth="1"
      />
      <circle cx="18" cy="26" r="2" fill="#BE185D" opacity="0.4" />
    </svg>
  );
}

export function AhorcadoIcon({ size = 32, className }: IconProps) {
  return <Pollito size={size} className={className} mood="nervous" />;
}

export function StopIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="14" y="10" width="36" height="44" rx="6" fill="#FBCFE8" stroke="#F9A8D4" strokeWidth="2" />
      <rect x="20" y="18" width="24" height="4" rx="2" fill="#F472B6" opacity="0.5" />
      <rect x="20" y="26" width="18" height="3" rx="1.5" fill="#F472B6" opacity="0.35" />
      <rect x="20" y="33" width="20" height="3" rx="1.5" fill="#F472B6" opacity="0.35" />
      <path
        d="M38 42 C38 38 42 36 44 40 C46 44 40 48 38 42"
        fill="#F472B6"
      />
    </svg>
  );
}

export function DibujaIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        d="M14 46 L42 18 L48 24 L20 52 Z"
        fill="#FDE68A"
        stroke="#F59E0B"
        strokeWidth="1.5"
      />
      <path d="M42 18 L48 12 L52 16 L46 22 Z" fill="#F472B6" />
      <circle cx="48" cy="10" r="3" fill="#A78BFA" />
      <circle cx="54" cy="16" r="2" fill="#60A5FA" />
      <circle cx="10" cy="50" r="2" fill="#F472B6" />
    </svg>
  );
}

export function TrophyIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        d="M22 14 H42 V24 C42 30 37 34 32 34 C27 34 22 30 22 24 Z"
        fill="#FDE047"
        stroke="#EAB308"
        strokeWidth="1.5"
      />
      <path d="M18 18 H22 V22 C22 24 20 26 18 26 Z" fill="#FDE047" />
      <path d="M46 18 H42 V22 C42 24 44 26 46 26 Z" fill="#FDE047" />
      <rect x="28" y="34" width="8" height="8" fill="#EAB308" />
      <rect x="22" y="42" width="20" height="6" rx="2" fill="#CA8A04" />
      <path
        d="M30 20 L32 24 L34 20"
        fill="none"
        stroke="#F472B6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type GameIconComponent = ComponentType<IconProps>;
