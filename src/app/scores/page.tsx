import { getTop10 } from "@/lib/db";
import { GAMES } from "@/lib/gameMeta";
import { TrophyIcon } from "@/components/icons/GameIcons";

export default function ScoresPage() {
  return (
    <main className="app-main px-5 py-10 max-w-lg mx-auto">
      <header className="mb-10">
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <TrophyIcon size={28} />
          Top 10
        </h1>
        <p className="text-muted text-sm mt-1">Mejores puntuaciones por juego</p>
      </header>

      <div className="flex flex-col gap-10">
        {GAMES.map((game) => {
          const scores = getTop10(game.id);
          const Icon = game.icon;
          return (
            <section key={game.id}>
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Icon size={22} />
                {game.name}
              </h2>
              {scores.length === 0 ? (
                <p className="text-muted text-sm pl-0.5">Sin puntuaciones aún.</p>
              ) : (
                <ol className="game-list !max-w-none">
                  {scores.map((s, i) => (
                    <li key={i} className="score-row px-4">
                      <span className="font-mono text-sm text-muted w-5">{i + 1}</span>
                      <span className="flex-1 font-medium ml-3">{s.nickname}</span>
                      <span className="font-semibold tabular-nums">{s.score}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
