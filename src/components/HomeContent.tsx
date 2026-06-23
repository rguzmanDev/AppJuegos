"use client";

import Link from "next/link";
import { CoupleMascots } from "@/components/mascots/Mascots";
import { GAMES } from "@/lib/gameMeta";
import { Card } from "@/components/ui/Card";

export function HomeContent() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <CoupleMascots size={64} />
        </div>
        <h1 className="font-display text-5xl font-bold text-[var(--color-text)] mb-2">
          CuddleArcade
        </h1>
        <p className="text-muted text-lg italic">Solo tú y yo</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {GAMES.map((game) => {
          const Icon = game.icon;
          return (
            <Link key={game.id} href={`/lobby/new?game=${game.id}`} className="block">
              <Card interactive className="h-full">
                <div className="mb-3">
                  <Icon size={36} />
                </div>
                <h2 className="font-semibold text-lg">{game.name}</h2>
                <p className="text-muted text-sm mt-1">{game.desc}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <p className="mt-10 text-sm text-muted">
        ¿Ya tienes código?{" "}
        <Link href="/lobby/join" className="text-[var(--color-accent)] underline underline-offset-2">
          Únete aquí
        </Link>
      </p>
    </main>
  );
}
