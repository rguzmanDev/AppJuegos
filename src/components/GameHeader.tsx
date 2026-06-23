"use client";

import { GameIcon, MascotIcon } from "@/components/GameIcon";
import type { GameId } from "@/lib/types";

interface GameHeaderBarProps {
  gameId?: GameId;
  title?: string;
  left?: React.ReactNode;
  center?: React.ReactNode;
  onExit: () => void;
}

export function GameHeaderBar({ gameId, title, left, center, onExit }: GameHeaderBarProps) {
  return (
    <div className="flex w-full max-w-lg justify-between items-center mb-3">
      {left ?? (
        <button type="button" onClick={onExit} className="btn-ghost text-sm py-1 px-2">
          Inicio
        </button>
      )}
      <span className="text-sm text-muted flex items-center gap-1.5">
        {gameId && <GameIcon gameId={gameId} size={16} />}
        {center ?? title}
      </span>
      <button type="button" onClick={onExit} className="btn-ghost text-sm py-1 px-2">
        Salir
      </button>
    </div>
  );
}

export function PlayerBadge({ nickname, isHost }: { nickname: string; isHost: boolean }) {
  return (
    <div
      className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
        isHost ? "badge-host" : "badge-guest"
      }`}
    >
      <MascotIcon variant={isHost ? "pollito" : "pinguinito"} size={20} />
      <span>{nickname}</span>
    </div>
  );
}
