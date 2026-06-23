"use client";

import { Crown } from "lucide-react";
import { GameIcon } from "@/components/GameIcon";
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
        <button type="button" onClick={onExit} className="text-sm opacity-40 hover:opacity-70">
          ← Inicio
        </button>
      )}
      <span className="text-sm font-medium opacity-60 flex items-center gap-1.5">
        {gameId && <GameIcon gameId={gameId} size={14} />}
        {center ?? title}
      </span>
      <button type="button" onClick={onExit} className="text-sm opacity-40 hover:opacity-70">
        Salir
      </button>
    </div>
  );
}

export function PlayerBadge({ nickname, isHost }: { nickname: string; isHost: boolean }) {
  return (
    <div className="bg-pink-100 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5">
      {nickname}
      {isHost ? (
        <Crown size={14} className="text-yellow-600" aria-label="Anfitrión" />
      ) : (
        <GameIcon brand size={14} className="text-pink-500" />
      )}
    </div>
  );
}
