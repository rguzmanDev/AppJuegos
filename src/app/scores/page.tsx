import { getTop10 } from "@/lib/db";
import type { GameId } from "@/lib/types";

const GAMES: { id: GameId; label: string; emoji: string }[] = [
  { id: "ppt", label: "Piedra Papel Tijera", emoji: "✂️" },
  { id: "ahorcado", label: "Ahorcado", emoji: "🐧" },
  { id: "stop", label: "Bachillerato / Stop", emoji: "🐣" },
  { id: "dibuja", label: "Dibuja y Adivina", emoji: "🐥" },
];

export default function ScoresPage() {
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-1 text-center">🏆 Top 10</h1>
      <p className="text-center opacity-50 mb-8 text-sm">Mejores puntuaciones por juego</p>

      <div className="flex flex-col gap-8">
        {GAMES.map((game) => {
          const scores = getTop10(game.id);
          return (
            <div key={game.id}>
              <h2 className="text-xl font-bold mb-3">
                {game.emoji} {game.label}
              </h2>
              {scores.length === 0 ? (
                <p className="opacity-40 text-sm">Sin puntuaciones aún.</p>
              ) : (
                <ol className="space-y-2">
                  {scores.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between bg-white border border-pink-100 rounded-xl px-4 py-2 shadow-sm"
                    >
                      <span className="font-mono text-sm opacity-40 w-6">{i + 1}.</span>
                      <span className="flex-1 font-medium ml-2">{s.nickname}</span>
                      <span className="font-bold text-pink-500">{s.score}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
