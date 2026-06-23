"use client";

import type { GameId } from "@/lib/types";
import { getGameMeta } from "@/lib/gameMeta";
import { CoupleMascots } from "@/components/mascots/CoupleMascots";
import { Pollito } from "@/components/mascots/Pollito";
import { Pinguinito } from "@/components/mascots/Pinguinito";
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
  mood?: "happy" | "nervous" | "sad" | "dizzy";
}

export function MascotIcon({ variant, size = 32, className, mood }: MascotIconProps) {
  if (variant === "pollito") {
    return <Pollito size={size} className={className} mood={mood} />;
  }
  return <Pinguinito size={size} className={className} />;
}
