import type { ComponentType } from "react";
import { EmojiIcon } from "@/components/ui/EmojiIcon";

export interface IconProps {
  size?: number;
  className?: string;
}

export function PPTIcon({ size = 32, className }: IconProps) {
  const s = Math.round(size * 0.55);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className ?? ""}`} aria-hidden>
      <EmojiIcon name="piedra" size={s} />
      <EmojiIcon name="papel" size={s} />
      <EmojiIcon name="tijera" size={s} />
    </span>
  );
}

export function AhorcadoIcon({ size = 32, className }: IconProps) {
  return <EmojiIcon name="ahorcado" size={size} className={className} />;
}

export function StopIcon({ size = 32, className }: IconProps) {
  return <EmojiIcon name="stop" size={size} className={className} />;
}

export function DibujaIcon({ size = 32, className }: IconProps) {
  return <EmojiIcon name="dibuja" size={size} className={className} />;
}

export function TrophyIcon({ size = 32, className }: IconProps) {
  return <EmojiIcon name="trophy" size={size} className={className} />;
}

export type GameIconComponent = ComponentType<IconProps>;

export { EmojiIcon };
