"use client";

import Image from "next/image";
import { clsx } from "clsx";

export const EMOJI_SRC = {
  piedra: "/emojis/piedra.svg",
  papel: "/emojis/papel.svg",
  tijera: "/emojis/tijera.svg",
  ppt: "/emojis/piedra.svg",
  stop: "/emojis/stop.svg",
  dibuja: "/emojis/dibuja.svg",
  ahorcado: "/emojis/ahorcado.svg",
  trophy: "/emojis/trophy.svg",
  heartFull: "/emojis/heart-full.svg",
  heartEmpty: "/emojis/heart-empty.svg",
  pollito: "/mascots/pollito.svg",
  pinguinito: "/mascots/pinguinito.svg",
} as const;

export type EmojiKey = keyof typeof EMOJI_SRC;

interface EmojiIconProps {
  name: EmojiKey;
  size?: number;
  className?: string;
  label?: string;
}

export function EmojiIcon({ name, size = 32, className, label }: EmojiIconProps) {
  return (
    <Image
      src={EMOJI_SRC[name]}
      alt={label ?? ""}
      width={size}
      height={size}
      className={clsx("shrink-0 inline-block", className)}
      aria-hidden={!label}
      draggable={false}
    />
  );
}
