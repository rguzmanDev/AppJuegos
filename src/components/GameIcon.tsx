"use client";

import type { GameId } from "@/lib/types";
import { getGameMeta } from "@/lib/gameMeta";
import { CoupleMascots, Pollito, Pinguinito } from "@/components/mascots/Mascots";
import { clsx } from "clsx";

interface GameIconProps {
  gameId?: GameId;
  brand?: boolean;
  couple?: boolean;
  className?: string;
  size?: number;
}

export function GameIcon({ gameId, brand, couple, className, size = 32 }: GameIconProps) {
  if (couple || brand) {
    return <CoupleMascots size={size} className={className} />;
  }

  if (gameId) {
    const Icon = getGameMeta(gameId).icon;
    return <Icon className={clsx("shrink-0", className)} size={size} />;
  }

  return <CoupleMascots size={size} className={className} />;
}

interface MascotIconProps {
  variant: "pollito" | "pinguinito";
  size?: number;
  className?: string;
}

export function MascotIcon({ variant, size = 32, className }: MascotIconProps) {
  if (variant === "pollito") {
    return <Pollito size={size} className={className} />;
  }
  return <Pinguinito size={size} className={className} />;
}
