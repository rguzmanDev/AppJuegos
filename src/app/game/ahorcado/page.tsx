"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Pollito } from "@/components/mascots/Mascots";
import { GameNavLink, LobbyExitLink } from "@/components/GameNavLink";
import { GameIcon } from "@/components/GameIcon";
import { LetterKeyboard } from "@/components/LetterKeyboard";
import { RematchPanel, useRematch } from "@/components/RematchPanel";
import { useRoom } from "@/lib/useRoom";
import { filterWordText, isWordValid } from "@/lib/validation";
import type { GameEvent } from "@/lib/types";

const MAX_ERRORS = 6;

export default function AhorcadoPage() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") ?? "";
  const { me, opponent, socket, amHostRef } = useRoom();
  const isHost = me?.isHost ?? false;

  const isGuesserRef = useRef(false);
  const firstGuesserIsHostRef = useRef(false);
  const roundRef = useRef(1);

  const [word, setWord] = useState("");
  const [wordInput, setWordInput] = useState("");
  const [guessed, setGuessed] = useState<string[]>([]);
  const [isGuesser, setIsGuesser] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(4);
  const [phase, setPhase] = useState<"config" | "wordentry" | "playing" | "won" | "lost">("config");

  function calcIsGuesser(r: number): boolean {
    const guesserIsHost = firstGuesserIsHostRef.current === (r % 2 === 1);
    return amHostRef.current === guesserIsHost;
  }

  const resetRematch = useCallback(() => {
    setMyScore(0);
    setOppScore(0);
    setRound(1);
    roundRef.current = 1;
    setWord("");
    setWordInput("");
    setGuessed([]);
    setPhase("config");
  }, []);

  useEffect(() => {
    const errorHandler = () => router.push("/");
    socket.on("error", errorHandler);
    return () => { socket.off("error", errorHandler); };
  }, [socket, router]);

  useEffect(() => {
    const handler = (event: GameEvent & { _from?: string }) => {
      const { type, payload } = event;

      if (type === "ahorcado:config") {
        const p = payload as { maxRounds: number; firstGuesserIsHost: boolean };
        setMaxRounds(p.maxRounds);
        firstGuesserIsHostRef.current = p.firstGuesserIsHost;
        roundRef.current = 1;
        setRound(1);
        const amGuesser = calcIsGuesser(1);
        isGuesserRef.current = amGuesser;
        setIsGuesser(amGuesser);
        setWord("");
        setGuessed([]);
        setPhase("wordentry");
      }

      if (type === "ahorcado:word") {
        const p = payload as { word: string };
        setWord(p.word.toUpperCase());
        setGuessed([]);
        setPhase("playing");
      }

      if (type === "ahorcado:letter") {
        const p = payload as { letter: string };
        setGuessed((prev) => prev.includes(p.letter) ? prev : [...prev, p.letter]);
      }

      if (type === "ahorcado:next") {
        const newRound = roundRef.current + 1;
        roundRef.current = newRound;
        setRound(newRound);
        const amGuesser = calcIsGuesser(newRound);
        isGuesserRef.current = amGuesser;
        setIsGuesser(amGuesser);
        setWord("");
        setWordInput("");
        setGuessed([]);
        setPhase("wordentry");
      }

      if (type === "game:end") router.push("/");
    };

    socket.on("game:event", handler);
    return () => { socket.off("game:event", handler); };
  }, [socket, router, amHostRef]);

  useEffect(() => {
    if (phase !== "playing" || !word) return;
    const errors = guessed.filter((l) => !word.includes(l)).length;
    const won = word.split("").every((l) => guessed.includes(l));
    const lost = errors >= MAX_ERRORS;
    if (won) {
      if (isGuesser) setMyScore((s) => s + 1);
      else setOppScore((s) => s + 1);
      setPhase("won");
    } else if (lost) {
      if (!isGuesser) setMyScore((s) => s + 1);
      else setOppScore((s) => s + 1);
      setPhase("lost");
    }
  }, [guessed, phase, word, isGuesser]);

  function startGame(rounds: number, firstGuesserIsHost: boolean) {
    firstGuesserIsHostRef.current = firstGuesserIsHost;
    socket.emit("game:action", {
      type: "ahorcado:config",
      payload: { maxRounds: rounds, firstGuesserIsHost },
    });
  }

  function submitWord() {
    const w = filterWordText(wordInput);
    if (!isWordValid(w)) return;
    socket.emit("game:action", { type: "ahorcado:word", payload: { word: w } });
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

  const myName = me?.nickname ?? "Yo";
  const oppName = opponent?.nickname ?? "Ellos";
  const errors = guessed.filter((l) => word && !word.includes(l)).length;
  const gameOver = round > maxRounds;
  const pollitoShake = errors >= 4;

  const iWon = myScore > oppScore;
  const isTie = myScore === oppScore;
  const rematch = useRematch({
    socket,
    isLoser: !iWon && !isTie,
    isWinner: iWon,
    isTie,
    enabled: gameOver,
    onAccept: resetRematch,
  });

  const Header = () => (
    <div className="flex w-full max-w-sm justify-between items-center mb-4">
      <GameNavLink className="text-sm opacity-40 hover:opacity-70">← Inicio</GameNavLink>
      <span className="text-sm font-medium opacity-60">Ahorcado · R {round}/{maxRounds}</span>
      <button onClick={endGame} className="text-sm opacity-40 hover:opacity-70">Salir</button>
    </div>
  );

  const Scores = () => (
    <div className="flex gap-12 text-3xl font-bold mb-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-pink-500">{myScore}</span>
        <span className="text-xs opacity-50">{myName}</span>
      </div>
      <span className="opacity-30 self-center">–</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-blue-500">{oppScore}</span>
        <span className="text-xs opacity-50">{oppName}</span>
      </div>
    </div>
  );

  if (phase === "config") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1 flex items-center justify-center gap-2">
          <GameIcon gameId="ahorcado" size={24} className="text-pink-500" />
          Ahorcado
        </h2>
        <p className="text-sm opacity-50 mb-4">Partida: {code}</p>
        <p className="animate-pulse opacity-60">Esperando configuración del anfitrión...</p>
        <LobbyExitLink className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</LobbyExitLink>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1 flex items-center justify-center gap-2">
          <GameIcon gameId="ahorcado" size={24} className="text-pink-500" />
          Ahorcado
        </h2>
        <p className="text-sm opacity-50 mb-6">Partida: {code}</p>
        <ConfigPicker oppName={oppName} onStart={startGame} />
        <LobbyExitLink className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</LobbyExitLink>
      </main>
    );
  }

  if (gameOver) {
    const winner = myScore > oppScore ? myName : myScore < oppScore ? oppName : null;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Fin del juego</h2>
        <p className="text-3xl font-bold mb-2">{winner ? `${winner} gana!` : "Empate!"}</p>
        <Scores />
        <RematchPanel
          oppName={oppName}
          isWinner={iWon}
          isLoser={!iWon && !isTie}
          isTie={isTie}
          rematch={rematch}
        />
      </main>
    );
  }

  if (phase === "wordentry") {
    if (isGuesser) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Header />
        <Scores />
        <p className="text-lg font-medium mb-2">Ronda {round}</p>
        <p className="animate-pulse opacity-60 text-sm">{oppName} está eligiendo la palabra secreta...</p>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Header />
        <Scores />
        <p className="text-lg font-medium mb-1">Ronda {round} — Tu turno de elegir</p>
        <p className="text-sm opacity-50 mb-5">{oppName} va a adivinar tu palabra</p>
        <input
          type="text"
          value={wordInput}
          onChange={(e) => setWordInput(filterWordText(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && submitWord()}
          placeholder="Escribe la palabra secreta"
          maxLength={20}
          className="border-2 border-pink-300 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest outline-none focus:border-pink-500 uppercase mb-4 w-full max-w-xs"
          autoFocus
        />
        <button
          onClick={submitWord}
          disabled={!isWordValid(wordInput)}
          className="btn-primary rounded-xl"
        >
          Listo! Que adivine →
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-6">
      <Header />
      <Scores />

      <div
        className={`mb-2 transition-all duration-300 ${pollitoShake ? "animate-pulse" : ""}`}
        style={{ opacity: Math.max(0.45, 1 - errors * 0.09), transform: `rotate(${errors * -2}deg)` }}
      >
        <Pollito size={72} />
      </div>
      <p className="text-sm opacity-40 mb-4">Errores: {errors}/{MAX_ERRORS}</p>

      <p className="text-sm mb-3 font-medium">
        {isGuesser ? "Estás adivinando" : `${oppName} está adivinando… tú ves la palabra:`}
      </p>

      {!isGuesser && (
        <div className="bg-pink-100 border border-pink-300 rounded-xl px-6 py-2 mb-3 font-bold text-lg">
          {word}
        </div>
      )}

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
            {isGuesser ? "Adivinaste!" : `${oppName} adivinó`}
          </p>
          {isHost ? (
            <button onClick={nextRound} className="btn-primary rounded-xl">
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
            {isGuesser ? "Se acabaron los intentos!" : "No adivinó!"}
          </p>
          <p className="opacity-60 mb-3">La palabra era: <strong>{word}</strong></p>
          {isHost ? (
            <button onClick={nextRound} className="btn-primary rounded-xl">
              Siguiente ronda →
            </button>
          ) : (
            <p className="text-sm animate-pulse opacity-50">Esperando al anfitrión...</p>
          )}
        </div>
      )}

      {phase === "playing" && isGuesser && (
        <LetterKeyboard guessed={guessed} word={word} onLetter={guessLetter} />
      )}

      {phase === "playing" && !isGuesser && (
        <p className="opacity-50 animate-pulse text-sm mt-4">Esperando que {oppName} adivine...</p>
      )}
    </main>
  );
}

function ConfigPicker({
  oppName,
  onStart,
}: {
  oppName: string;
  onStart: (rounds: number, firstGuesserIsHost: boolean) => void;
}) {
  const [rounds, setRounds] = useState<number | null>(null);

  if (!rounds) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="font-medium">¿Cuántas rondas?</p>
        <div className="flex gap-3">
          {[4, 6, 8].map((n) => (
            <button key={n} onClick={() => setRounds(n)}
              className="btn-primary py-3 px-6 rounded-2xl text-lg">
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-medium">¿Quién adivina primero?</p>
      <div className="flex gap-3">
        <button
          onClick={() => onStart(rounds, false)}
          className="btn-primary rounded-xl"
        >
          Yo adivino
        </button>
        <button
          onClick={() => onStart(rounds, true)}
          className="btn-secondary rounded-xl"
        >
          {oppName} adivina
        </button>
      </div>
      <button onClick={() => setRounds(null)} className="text-xs opacity-40 hover:opacity-60 underline">
        ← Cambiar rondas
      </button>
    </div>
  );
}
