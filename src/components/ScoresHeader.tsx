"use client";

import { GameIcon } from "@/components/GameIcon";
import { GAMES } from "@/lib/gameMeta";
import { TrophyIcon } from "@/components/icons/GameIcons";
import type { GameId } from "@/lib/types";

export function ScoresGameTitle({ id, label }: { id: GameId; label: string }) {
  return (
    <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
      <GameIcon gameId={id} size={22} className="text-pink-500" />
      {label}
    </h2>
  );
}

export function ScoresPageHeader() {
  return (
    <h1 className="text-3xl font-bold mb-1 text-center flex items-center justify-center gap-2">
      <TrophyIcon size={32} className="shrink-0" />
      Top 10
    </h1>
  );
}

export { GAMES };
