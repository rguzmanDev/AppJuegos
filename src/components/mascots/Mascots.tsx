"use client";

import Image from "next/image";
import { clsx } from "clsx";

interface MascotProps {
  size?: number;
  className?: string;
}

export function Pollito({ size = 48, className }: MascotProps) {
  return (
    <Image
      src="/mascots/pollito.svg"
      alt=""
      width={size}
      height={size}
      className={clsx("shrink-0", className)}
      aria-hidden
      draggable={false}
    />
  );
}

export function Pinguinito({ size = 48, className }: MascotProps) {
  return (
    <Image
      src="/mascots/pinguinito.svg"
      alt=""
      width={size}
      height={size}
      className={clsx("shrink-0", className)}
      aria-hidden
      draggable={false}
    />
  );
}

interface CoupleMascotsProps {
  size?: number;
  className?: string;
}

export function CoupleMascots({ size = 48, className }: CoupleMascotsProps) {
  const half = Math.round(size * 0.72);
  return (
    <span className={clsx("inline-flex items-end gap-2", className)} aria-hidden>
      <Pollito size={half} />
      <Pinguinito size={half} />
    </span>
  );
}
