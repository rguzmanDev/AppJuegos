"use client";

import type { GameId } from "@/lib/types";
import { BRAND_ICON, getGameMeta } from "@/lib/gameMeta";
import { clsx } from "clsx";

interface GameIconProps {
  gameId?: GameId;
  brand?: boolean;
  className?: string;
  size?: number;
}

export function GameIcon({ gameId, brand, className, size = 32 }: GameIconProps) {
  const Icon = brand ? BRAND_ICON : gameId ? getGameMeta(gameId).icon : BRAND_ICON;
  return <Icon className={clsx("shrink-0", className)} size={size} aria-hidden />;
}
