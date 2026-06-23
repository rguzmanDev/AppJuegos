import { getTop10 } from "@/lib/db";
import { GAMES } from "@/lib/gameMeta";
import { TrophyIcon } from "@/components/icons/GameIcons";

export default function ScoresPage() {
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-1 text-center flex items-center justify-center gap-2">
        <TrophyIcon size={32} />
        Top 10
      </h1>
      <p className="text-center opacity-50 mb-8 text-sm">Mejores puntuaciones por juego</p>

      <div className="flex flex-col gap-8">
        {GAMES.map((game) => {
          const scores = getTop10(game.id);
          const Icon = game.icon;
          return (
            <div key={game.id}>
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Icon size={24} aria-hidden />
                {game.name}
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
