import Link from "next/link";

const GAMES = [
  {
    id: "ppt",
    name: "Piedra Papel Tijera",
    emoji: "✂️",
    desc: "Clásico de siempre. 3 rondas gana.",
  },
  {
    id: "ahorcado",
    name: "Ahorcado",
    emoji: "🐧",
    desc: "Adivina la palabra antes de que sea tarde.",
  },
  {
    id: "stop",
    name: "Bachillerato / Stop",
    emoji: "🐣",
    desc: "Llena las categorías antes que tu pareja.",
  },
  {
    id: "dibuja",
    name: "Dibuja y Adivina",
    emoji: "🐥",
    desc: "Uno dibuja, el otro adivina.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold mb-2">🐥 CuddleArcade</h1>
        <p className="text-lg opacity-70">Solo tú y yo 🐥</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
        {GAMES.map((game) => (
          <Link
            key={game.id}
            href={`/lobby/new?game=${game.id}`}
            className="bg-white border border-pink-200 rounded-2xl p-5 shadow hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer"
          >
            <div className="text-3xl mb-2">{game.emoji}</div>
            <h2 className="font-bold text-lg">{game.name}</h2>
            <p className="text-sm opacity-60 mt-1">{game.desc}</p>
          </Link>
        ))}
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
