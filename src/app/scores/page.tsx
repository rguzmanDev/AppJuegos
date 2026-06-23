import { getTop10 } from "@/lib/db";
import { GAMES } from "@/lib/gameMeta";
import { TrophyIcon } from "@/components/icons/GameIcons";

export default function ScoresPage() {
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold mb-1 text-center flex items-center justify-center gap-2">
        <TrophyIcon size={32} />
        Top 10
      </h1>
      <p className="text-center text-muted mb-8 text-sm">Mejores puntuaciones por juego</p>

      <div className="flex flex-col gap-8">
        {GAMES.map((game) => {
          const scores = getTop10(game.id);
          const Icon = game.icon;
          return (
            <div key={game.id}>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Icon size={24} />
                {game.name}
              </h2>
              {scores.length === 0 ? (
                <p className="text-muted text-sm">Sin puntuaciones aún.</p>
              ) : (
                <ol className="space-y-2">
                  {scores.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between card py-2"
                    >
                      <span className="font-mono text-sm text-muted w-6">{i + 1}.</span>
                      <span className="flex-1 font-medium ml-2">{s.nickname}</span>
                      <span className="font-bold text-[var(--color-accent)]">{s.score}</span>
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
