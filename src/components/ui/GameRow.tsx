import Link from "next/link";
import type { GameId } from "@/lib/types";
import { getGameMeta } from "@/lib/gameMeta";

interface GameRowProps {
  gameId: GameId;
  href: string;
}

export function GameRow({ gameId, href }: GameRowProps) {
  const meta = getGameMeta(gameId);
  const Icon = meta.icon;

  return (
    <Link href={href} className="game-row group">
      <span className="game-row-icon" aria-hidden>
        <Icon size={32} />
      </span>
      <span className="game-row-body">
        <span className="game-row-title">{meta.name}</span>
        <span className="game-row-desc">{meta.desc}</span>
      </span>
      <span className="game-row-chevron" aria-hidden>
        →
      </span>
    </Link>
  );
}

interface GameListProps {
  children: React.ReactNode;
  className?: string;
}

export function GameList({ children, className }: GameListProps) {
  return <div className={`game-list ${className ?? ""}`}>{children}</div>;
}
