"use client";

import Link from "next/link";
import { CoupleMascots } from "@/components/mascots/Mascots";
import { GAMES } from "@/lib/gameMeta";

export function HomeContent() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-3">
          <CoupleMascots size={72} />
        </div>
        <h1 className="text-5xl font-extrabold mb-2 bg-gradient-to-r from-pink-500 to-rose-400 bg-clip-text text-transparent">
          CuddleArcade
        </h1>
        <p className="text-lg text-pink-400/80 font-semibold">
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
              className="card-cute p-5 cursor-pointer"
            >
              <div className="mb-3">
                <Icon size={40} />
              </div>
              <h2 className="font-bold text-lg text-pink-900">{game.name}</h2>
              <p className="text-sm text-pink-400/70 mt-1 font-medium">{game.desc}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 text-sm text-pink-300 font-medium">
        ¿Ya tienes código de partida?{" "}
        <Link href="/lobby/join" className="underline text-pink-500 hover:text-pink-600">
          Únete aquí
        </Link>
      </div>
    </main>
  );
}
