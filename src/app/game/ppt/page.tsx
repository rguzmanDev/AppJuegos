"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import type { GameEvent } from "@/lib/types";

type Choice = "piedra" | "papel" | "tijera";
const ICONS: Record<Choice, string> = { piedra: "🪨", papel: "📄", tijera: "✂️" };
const CHOICES: Choice[] = ["piedra", "papel", "tijera"];

function beats(a: Choice, b: Choice) {
  return (
    (a === "piedra" && b === "tijera") ||
    (a === "papel" && b === "piedra") ||
    (a === "tijera" && b === "papel")
  );
}

export default function PPTPage() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") ?? "";
  const { me, opponent, myId, socket, amHostRef } = useRoom();
  const isHost = me?.isHost ?? false;

  // Refs for values needed inside event handler (avoid stale closures)
  const myIdRef = useRef(myId);
  useEffect(() => { myIdRef.current = myId; }, [myId]);
  const myChoiceRef = useRef<Choice | null>(null);
  const oppChoiceRef = useRef<Choice | null>(null);

  const [myChoice, setMyChoice] = useState<Choice | null>(null);
  const [oppChoice, setOppChoice] = useState<Choice | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(5);
  const [phase, setPhase] = useState<"config" | "choosing" | "revealed">("config");
  const [resultLabel, setResultLabel] = useState("");
  const [iRequested, setIRequested] = useState(false);
  const [theyRequested, setTheyRequested] = useState(false);

  useEffect(() => {
    const handler = (event: GameEvent) => {
      const { type, payload, _from } = event;

      if (type === "ppt:config") {
        const p = payload as { maxRounds: number };
        setMaxRounds(p.maxRounds);
        setPhase("choosing");
      }

      if (type === "ppt:choice" && _from !== myIdRef.current) {
        const { choice } = payload as { choice: Choice };
        oppChoiceRef.current = choice;
        setOppChoice(choice);
        // opp chose after me → resolve
        if (myChoiceRef.current) {
          resolve(myChoiceRef.current, choice);
        }
      }

      if (type === "ppt:next") {
        setPhase(prev => {
          if (prev !== "revealed") return prev; // prevent double-trigger
          myChoiceRef.current = null;
          oppChoiceRef.current = null;
          setMyChoice(null);
          setOppChoice(null);
          setRound(r => r + 1);
          return "choosing";
        });
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
          myChoiceRef.current = null; oppChoiceRef.current = null;
          setMyScore(0); setOppScore(0); setRound(1);
          setMyChoice(null); setOppChoice(null);
          setPhase("config");
        }
      }
    };

    socket.on("game:event", handler);
    return () => { socket.off("game:event", handler); };
  }, [socket, router]);

  function resolve(mine: Choice, theirs: Choice) {
    let label = "¡Empate! 🤝";
    if (beats(mine, theirs)) { setMyScore(s => s + 1); label = "¡Ganaste! 🎉"; }
    else if (beats(theirs, mine)) { setOppScore(s => s + 1); label = "Perdiste 😅"; }
    setResultLabel(label);
    setPhase("revealed");
  }

  function startGame(rounds: number) {
    setMaxRounds(rounds);
    socket.emit("game:action", { type: "ppt:config", payload: { maxRounds: rounds } });
    setPhase("choosing");
  }

  function choose(c: Choice) {
    if (myChoice || phase !== "choosing") return;
    myChoiceRef.current = c;
    setMyChoice(c);
    socket.emit("game:action", { type: "ppt:choice", payload: { choice: c } });
    // opp chose before me → resolve now
    if (oppChoiceRef.current) {
      resolve(c, oppChoiceRef.current);
    }
  }

  function nextRound() {
    socket.emit("game:action", { type: "ppt:next", payload: {} });
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
  const totalWins = Math.ceil(maxRounds / 2);
  const gameOver = myScore >= totalWins || oppScore >= totalWins;

  if (phase === "config") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">✂️ Piedra Papel Tijera</h2>
        <p className="text-sm opacity-50 mb-4">Partida: {code}</p>
        <p className="animate-pulse opacity-60">Esperando configuración del anfitrión...</p>
        <Link href="/" className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1">✂️ Piedra Papel Tijera</h2>
        <p className="text-sm opacity-50 mb-8">Partida: {code}</p>
        <p className="font-medium mb-4">¿Cuántas rondas?</p>
        <div className="flex gap-3 mb-4">
          {[3, 5, 7].map((n) => (
            <button key={n} onClick={() => startGame(n)}
              className="bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-6 rounded-xl text-lg">
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs opacity-40 mt-2">Gana quien llegue primero a la mitad de victorias.</p>
        <Link href="/" className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</Link>
      </main>
    );
  }

  if (gameOver) {
    const iWon = myScore >= totalWins;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-6">✂️ Piedra Papel Tijera</h2>
        <p className="text-4xl font-bold mb-2">🎉 {iWon ? myName : oppName} gana!</p>
        <div className="flex gap-12 text-3xl font-bold my-6">
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
        <div className="flex flex-col items-center gap-3">
          {theyRequested && iWon ? (
            <button onClick={acceptRematch}
              className="bg-green-400 text-white font-bold py-3 px-8 rounded-xl hover:bg-green-500">
              🔥 ¡{oppName} quiere revancha! Aceptar
            </button>
          ) : !iRequested && !iWon ? (
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="flex w-full max-w-sm justify-between items-center mb-6">
        <Link href="/" className="text-sm opacity-40 hover:opacity-70">← Inicio</Link>
        <span className="text-sm font-medium opacity-60">Ronda {round}/{maxRounds}</span>
        <button onClick={endGame} className="text-sm opacity-40 hover:opacity-70">Salir</button>
      </div>

      <div className="flex gap-12 text-4xl font-bold mb-10">
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

      {phase === "choosing" && (
        <>
          <p className="mb-4 opacity-60">
            {myChoice ? `Elegiste ${ICONS[myChoice]}. Esperando a ${oppName}...` : "¿Qué eliges?"}
          </p>
          <div className="flex gap-4">
            {CHOICES.map((c) => (
              <button key={c} onClick={() => choose(c)} disabled={!!myChoice}
                className={`text-5xl p-4 rounded-2xl border-2 transition-all ${
                  myChoice === c
                    ? "border-pink-400 bg-pink-50 scale-110"
                    : "border-gray-200 hover:border-pink-300 hover:bg-pink-50"
                } disabled:cursor-default`}>
                {ICONS[c]}
              </button>
            ))}
          </div>
        </>
      )}

      {phase === "revealed" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-8 text-6xl items-center">
            <div className="flex flex-col items-center gap-1">
              <span>{ICONS[myChoice!]}</span>
              <span className="text-xs opacity-50">{myName}</span>
            </div>
            <span className="opacity-30 text-2xl">vs</span>
            <div className="flex flex-col items-center gap-1">
              <span>{ICONS[oppChoice!]}</span>
              <span className="text-xs opacity-50">{oppName}</span>
            </div>
          </div>
          <p className="text-2xl font-bold">{resultLabel}</p>
          {isHost ? (
            <button onClick={nextRound}
              className="mt-2 bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 px-8 rounded-xl">
              Siguiente ronda →
            </button>
          ) : (
            <p className="mt-2 text-sm animate-pulse opacity-50">Esperando al anfitrión...</p>
          )}
        </div>
      )}
    </main>
  );
}
