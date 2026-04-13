"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import type { GameEvent } from "@/lib/types";

const WORDS = [
  "PINGÜINO", "POLLITO", "OSITO", "MARIPOSA", "ESTRELLA",
  "CHOCOLATE", "AVENTURA", "COCODRILO", "TRAMPOLÍN", "BIBLIOTECA",
  "GIRASOL", "DINOSAURIO", "ARCOÍRIS", "MURCIÉLAGO", "VIDEOJUEGO",
  "MARIPOSA", "CARACOL", "PINGÜINO", "ARDILLA", "FLAMENCO",
];

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

const MAX_ERRORS = 6;
const FACES = ["😢", "😱", "😨", "😰", "😵", "💀", "⭐"];
const LETTERS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

export default function AhorcadoPage() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") ?? "";
  const { me, opponent, myId, socket, amHostRef } = useRoom();
  const isHost = me?.isHost ?? false;

  // Ref for isGuesser - needed in draw handler (avoid stale closure)
  const isGuesserRef = useRef(false);

  const [word, setWord] = useState("");
  const [guessed, setGuessed] = useState<string[]>([]);
  const [isGuesser, setIsGuesser] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(5);
  const [phase, setPhase] = useState<"config" | "role" | "playing" | "won" | "lost">("config");
  const [iRequested, setIRequested] = useState(false);
  const [theyRequested, setTheyRequested] = useState(false);

  useEffect(() => {
    const handler = (event: GameEvent & { _from?: string }) => {
      const { type, payload, _from } = event;

      if (type === "ahorcado:config") {
        const p = payload as { maxRounds: number };
        setMaxRounds(p.maxRounds);
        setPhase("role");
      }

      if (type === "ahorcado:start") {
        const p = payload as { guesserIsHost: boolean; word: string };
        // Determine my role: guesserIsHost=true means host guesses
        const amGuesser = amHostRef.current === p.guesserIsHost;
        isGuesserRef.current = amGuesser;
        setIsGuesser(amGuesser);
        setWord(p.word);
        setGuessed([]);
        setPhase("playing");
      }

      if (type === "ahorcado:letter") {
        const p = payload as { letter: string };
        setGuessed(prev => {
          if (prev.includes(p.letter)) return prev;
          return [...prev, p.letter];
        });
      }

      if (type === "ahorcado:next") {
        setPhase("role");
        setWord("");
        setGuessed([]);
        setRound(r => r + 1);
      }

      if (type === "game:end") {
        router.push("/");
      }

      if (type === "game:rematch") {
        const p = payload as { action: string };
        if (p.action === "request" && _from !== socket.id) {
          setTheyRequested(true);
        }
        if (p.action === "accept") {
          setIRequested(false); setTheyRequested(false);
          setMyScore(0); setOppScore(0); setRound(1);
          setWord(""); setGuessed([]);
          setPhase("config");
        }
      }
    };

    socket.on("game:event", handler);
    return () => { socket.off("game:event", handler); };
  }, [socket, router, amHostRef]);

  function startGame(rounds: number) {
    setMaxRounds(rounds);
    socket.emit("game:action", { type: "ahorcado:config", payload: { maxRounds: rounds } });
    setPhase("role");
  }

  function startRound(iAmGuesser: boolean) {
    const myIsHost = amHostRef.current;
    // guesserIsHost = true means host is guesser
    const guesserIsHost = iAmGuesser ? myIsHost : !myIsHost;
    const w = randomWord();
    socket.emit("game:action", {
      type: "ahorcado:start",
      payload: { guesserIsHost, word: w },
    });
  }

  function guessLetter(letter: string) {
    if (!isGuesserRef.current || guessed.includes(letter)) return;
    socket.emit("game:action", { type: "ahorcado:letter", payload: { letter } });
  }

  function nextRound() {
    socket.emit("game:action", { type: "ahorcado:next", payload: {} });
  }

  function endGame() {
    socket.emit("game:action", { type: "game:end", payload: {} });
    router.push("/");
  }

  function requestRematch() {
    setIRequested(true);
    socket.emit("game:action", { type: "game:rematch", payload: { action: "request" } });
  }

  function acceptRematch() {
    socket.emit("game:action", { type: "game:rematch", payload: { action: "accept" } });
  }

  const myName = me?.nickname ?? "Yo";
  const oppName = opponent?.nickname ?? "Ellos";
  const errors = guessed.filter(l => word && !word.includes(l)).length;
  const won = word && word.split("").every(l => guessed.includes(l));
  const lost = errors >= MAX_ERRORS;
  const gameOver = round > maxRounds;

  // Score updates when round ends
  useEffect(() => {
    if (phase === "playing" && won) {
      if (isGuesser) setMyScore(s => s + 1);
      else setOppScore(s => s + 1);
      setPhase("won");
    }
    if (phase === "playing" && lost) {
      if (!isGuesser) setMyScore(s => s + 1);
      else setOppScore(s => s + 1);
      setPhase("lost");
    }
  }, [won, lost, isGuesser, phase]);

  const Header = () => (
    <div className="flex w-full max-w-sm justify-between items-center mb-4">
      <Link href="/" className="text-sm opacity-40 hover:opacity-70">← Inicio</Link>
      <span className="text-sm font-medium opacity-60">📝 Ahorcado · R {round}/{maxRounds}</span>
      <button onClick={endGame} className="text-sm opacity-40 hover:opacity-70">Salir</button>
    </div>
  );

  const Scores = () => (
    <div className="flex gap-12 text-3xl font-bold mb-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-pink-500">{myScore}</span>
        <span className="text-xs opacity-50">{myName}</span>
      </div>
      <span className="opacity-30 self-center">â€“</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-blue-500">{oppScore}</span>
        <span className="text-xs opacity-50">{oppName}</span>
      </div>
    </div>
  );

  if (phase === "config") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">📝 Ahorcado</h2>
        <p className="text-sm opacity-50 mb-4">Partida: {code}</p>
        <p className="animate-pulse opacity-60">Esperando configuración del anfitrión...</p>
        <Link href="/" className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">📝 Ahorcado</h2>
        <p className="text-sm opacity-50 mb-8">Partida: {code}</p>
        <p className="font-medium mb-4">¿Cuantas rondas?</p>
        <div className="flex gap-3">
          {[4, 6, 8].map((n) => (
            <button key={n} onClick={() => startGame(n)}
              className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-6 rounded-xl text-lg">
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs opacity-40 mt-3">Se alternan roles cada ronda.</p>
        <Link href="/" className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
  }

  if (gameOver) {
    const winner = myScore > oppScore ? myName : myScore < oppScore ? oppName : null;
    const iWon = myScore > oppScore;
    const isTie = myScore === oppScore;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">📝 Fin del juego</h2>
        <p className="text-3xl font-bold mb-2">
          {winner ? `🏆 ${winner} gana!` : "¡Empate! 🤝"}
        </p>
        <Scores />
        <div className="flex flex-col items-center gap-3 mt-4">
          {theyRequested && (iWon || isTie) ? (
            <button onClick={acceptRematch}
              className="bg-green-400 text-white font-bold py-3 px-8 rounded-xl hover:bg-green-500">
              🔥 ¡{oppName} quiere revancha! Aceptar
            </button>
          ) : !iRequested && (!iWon || isTie) ? (
            <button onClick={requestRematch}
              className="bg-pink-400 text-white font-bold py-3 px-8 rounded-xl hover:bg-pink-500">
              Pedir revancha
            </button>
          ) : iRequested ? (
            <p className="text-sm animate-pulse opacity-50">Esperando respuesta de {oppName}...</p>
          ) : (
            <p className="text-sm opacity-40">Espera a que {oppName} pida revancha...</p>
          )}
          <Link href="/" className="bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl hover:bg-gray-300">
            Inicio
          </Link>
        </div>
      </main>
    );
  }

  if (phase === "role") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Header />
        <Scores />
        <p className="animate-pulse opacity-60">El anfitrión está eligiendo roles...</p>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Header />
        <Scores />
        <p className="font-medium mb-5">¿Quién adivina esta ronda?</p>
        <div className="flex gap-4">
          <button onClick={() => startRound(true)}
            className="bg-pink-400 text-white font-bold py-3 px-6 rounded-xl hover:bg-pink-500">
            Yo adivino 🧐
          </button>
          <button onClick={() => startRound(false)}
            className="bg-blue-400 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-500">
            {oppName} adivina 🤔
          </button>
        </div>
        <p className="text-xs opacity-40 mt-4">La palabra se elige al azar.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-6">
      <Header />
      <Scores />

      <div className="text-6xl mb-2">{FACES[Math.min(errors, 6)]}</div>
      <p className="text-sm opacity-40 mb-4">Errores: {errors}/{MAX_ERRORS}</p>

      {/* Role indicator */}
      <p className="text-sm mb-3 font-medium">
        {isGuesser ? "Estás adivinando 🧐" : `${oppName} está adivinando… tú ves la palabra:`}
      </p>
      {!isGuesser && (
        <div className="bg-pink-100 border border-pink-300 rounded-xl px-6 py-2 mb-3 font-bold text-lg">
          {word}
        </div>
      )}

      {/* Word display */}
      <div className="flex gap-2 flex-wrap justify-center text-3xl font-mono mb-6">
        {word.split("").map((l, i) => (
          <span key={i} className="border-b-2 border-gray-400 min-w-[1.5rem] text-center">
            {guessed.includes(l) || phase === "won" || phase === "lost" ? l : "\u00A0"}
          </span>
        ))}
      </div>

      {phase === "won" && (
        <div className="text-center mb-4">
          <p className="text-2xl font-bold text-green-600 mb-3">
            {isGuesser ? "¡Adivinaste! 🏆" : `${oppName} adivinó 🤩`}
          </p>
          {isHost ? (
            <button onClick={nextRound}
              className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl">
              Siguiente ronda →
            </button>
          ) : (
            <p className="text-sm animate-pulse opacity-50">Esperando al anfitrión...</p>
          )}
        </div>
      )}
      {phase === "lost" && (
        <div className="text-center mb-4">
          <p className="text-2xl font-bold text-red-500 mb-1">
            {isGuesser ? "Â¡Se acabaron los intentos! ðŸ’€" : "Â¡No adivinÃ³!"}
          </p>
          <p className="opacity-60 mb-3">La palabra era: <strong>{word}</strong></p>
          {isHost ? (
            <button onClick={nextRound}
              className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl">
              Siguiente ronda →
            </button>
          ) : (
            <p className="text-sm animate-pulse opacity-50">Esperando al anfitrión...</p>
          )}
        </div>
      )}

      {/* Keyboard - only for guesser when playing */}
      {phase === "playing" && isGuesser && (
        <div className="flex flex-wrap justify-center gap-2 max-w-sm">
          {LETTERS.map((l) => (
            <button key={l} onClick={() => guessLetter(l)} disabled={guessed.includes(l)}
              className={`w-9 h-9 rounded-lg font-bold text-sm transition-all ${
                guessed.includes(l)
                  ? word.includes(l) ? "bg-green-200 text-green-700" : "bg-gray-200 text-gray-400"
                  : "bg-pink-100 hover:bg-pink-300 border border-pink-200"
              }`}>
              {l}
            </button>
          ))}
        </div>
      )}

      {phase === "playing" && !isGuesser && (
        <p className="opacity-50 animate-pulse text-sm mt-4">
          Esperando que {oppName} adivine...
        </p>
      )}
    </main>
  );
}
