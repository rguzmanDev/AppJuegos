"use client";

import { GameIcon } from "@/components/GameIcon";
import type { GameId } from "@/lib/types";

interface GameTitleProps {
  gameId: GameId;
  title: string;
  iconSize?: number;
}

export function GameTitle({ gameId, title, iconSize = 28 }: GameTitleProps) {
  return (
    <h2 className="font-display text-2xl font-bold flex items-center justify-center gap-2">
      <GameIcon gameId={gameId} size={iconSize} />
      {title}
    </h2>
  );
}
