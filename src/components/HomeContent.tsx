"use client";

import Link from "next/link";
import { CoupleMascots } from "@/components/mascots/Mascots";
import { GAMES } from "@/lib/gameMeta";
import { GameList, GameRow } from "@/components/ui/GameRow";

export function HomeContent() {
  return (
    <main className="app-main flex flex-col items-center justify-center px-5 py-6 sm:py-8">
      <header className="text-center mb-10 w-full max-w-md">
        <CoupleMascots size={56} className="mb-4 justify-center" />
        <h1 className="font-display text-[2.75rem] leading-tight font-bold tracking-tight">
          CuddleArcade
        </h1>
        <p className="text-muted mt-1 italic">Solo tú y yo</p>
      </header>

      <section className="w-full max-w-md" aria-label="Juegos">
        <p className="text-xs font-medium uppercase tracking-widest text-muted mb-2 px-1">
          Elige un juego
        </p>
        <GameList>
          {GAMES.map((game) => (
            <GameRow
              key={game.id}
              gameId={game.id}
              href={`/lobby/new?game=${game.id}`}
            />
          ))}
        </GameList>
      </section>

      <p className="mt-8 text-sm text-muted">
        ¿Ya tienes código?{" "}
        <Link href="/lobby/join" className="link-subtle">
          Únete aquí
        </Link>
      </p>
    </main>
  );
}
