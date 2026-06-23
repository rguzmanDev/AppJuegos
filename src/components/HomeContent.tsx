"use client";

import Link from "next/link";
import { GAMES, BRAND_ICON } from "@/lib/gameMeta";

export function HomeContent() {
  const BrandIcon = BRAND_ICON;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold mb-2 flex items-center justify-center gap-3">
          <BrandIcon size={48} className="text-pink-500" aria-hidden />
          CuddleArcade
        </h1>
        <p className="text-lg opacity-70 flex items-center justify-center gap-2">
          <BrandIcon size={20} className="text-pink-400" aria-hidden />
          Solo tú y yo
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
        {GAMES.map((game) => {
          const Icon = game.icon;
          return (
            <Link
              key={game.id}
              href={`/lobby/new?game=${game.id}`}
              className="bg-white border border-pink-200 rounded-2xl p-5 shadow hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer"
            >
              <div className="mb-2 text-pink-500">
                <Icon size={36} aria-hidden />
              </div>
              <h2 className="font-bold text-lg">{game.name}</h2>
              <p className="text-sm opacity-60 mt-1">{game.desc}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 text-sm opacity-50">
        ¿Ya tienes código de partida?{" "}
        <Link href="/lobby/join" className="underline font-medium">
          Únete aquí
        </Link>
      </div>
    </main>
  );
}
