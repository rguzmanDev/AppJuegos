"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GameNavLink, LobbyExitLink } from "@/components/GameNavLink";
import { GameIcon } from "@/components/GameIcon";
import { RematchPanel, useRematch } from "@/components/RematchPanel";
import { Button } from "@/components/ui/Button";
import { EmojiIcon } from "@/components/ui/EmojiIcon";
import { GameTitle } from "@/components/ui/GameTitle";
import { TrophyIcon } from "@/components/icons/GameIcons";
import { useRoom } from "@/lib/useRoom";
import { PPT_CHOICE_EMOJI, PPT_CHOICES, type PPTChoice } from "@/lib/ppt";
import type { GameEvent } from "@/lib/types";

function beats(a: PPTChoice, b: PPTChoice) {
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

  const myIdRef = useRef(myId);
  useEffect(() => { myIdRef.current = myId; }, [myId]);
  const myChoiceRef = useRef<PPTChoice | null>(null);
  const oppChoiceRef = useRef<PPTChoice | null>(null);

  const [myChoice, setMyChoice] = useState<PPTChoice | null>(null);
  const [oppChoice, setOppChoice] = useState<PPTChoice | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(5);
  const [phase, setPhase] = useState<"config" | "choosing" | "revealed">("config");
  const [resultLabel, setResultLabel] = useState("");

  const resetRematch = useCallback(() => {
    myChoiceRef.current = null;
    oppChoiceRef.current = null;
    setMyScore(0);
    setOppScore(0);
    setRound(1);
    setMyChoice(null);
    setOppChoice(null);
    setPhase("config");
  }, []);

  useEffect(() => {
    const errorHandler = () => router.push("/");
    socket.on("error", errorHandler);
    return () => { socket.off("error", errorHandler); };
  }, [socket, router]);

  useEffect(() => {
    const handler = (event: GameEvent) => {
      const { type, payload, _from } = event;

      if (type === "ppt:config") {
        const p = payload as { maxRounds: number };
        setMaxRounds(p.maxRounds);
        setPhase("choosing");
      }

      if (type === "ppt:choice" && _from !== myIdRef.current) {
        const { choice } = payload as { choice: PPTChoice };
        oppChoiceRef.current = choice;
        setOppChoice(choice);
        if (myChoiceRef.current) {
          resolve(myChoiceRef.current, choice);
        }
      }

      if (type === "ppt:next") {
        setPhase((prev) => {
          if (prev !== "revealed") return prev;
          myChoiceRef.current = null;
          oppChoiceRef.current = null;
          setMyChoice(null);
          setOppChoice(null);
          setRound((r) => r + 1);
          return "choosing";
        });
      }

      if (type === "game:end") {
        router.push("/");
      }
    };

    socket.on("game:event", handler);
    return () => { socket.off("game:event", handler); };
  }, [socket, router]);

  function resolve(mine: PPTChoice, theirs: PPTChoice) {
    let label = "Empate!";
    if (beats(mine, theirs)) { setMyScore((s) => s + 1); label = "Ganaste!"; }
    else if (beats(theirs, mine)) { setOppScore((s) => s + 1); label = "Perdiste"; }
    setResultLabel(label);
    setPhase("revealed");
  }

  function startGame(rounds: number) {
    setMaxRounds(rounds);
    socket.emit("game:action", { type: "ppt:config", payload: { maxRounds: rounds } });
    setPhase("choosing");
  }

  function choose(c: PPTChoice) {
    if (myChoice || phase !== "choosing") return;
    myChoiceRef.current = c;
    setMyChoice(c);
    socket.emit("game:action", { type: "ppt:choice", payload: { choice: c } });
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

  const myName = me?.nickname ?? "Yo";
  const oppName = opponent?.nickname ?? "Ellos";
  const totalWins = Math.ceil(maxRounds / 2);
  const gameOver = myScore >= totalWins || oppScore >= totalWins;
  const iWon = myScore >= totalWins;

  const rematch = useRematch({
    socket,
    isLoser: !iWon,
    isWinner: iWon,
    enabled: gameOver,
    onAccept: resetRematch,
  });

  const Scores = () => (
    <div className="flex gap-12 text-3xl font-bold my-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[var(--color-accent)]">{myScore}</span>
        <span className="text-xs text-muted">{myName}</span>
      </div>
      <span className="text-muted self-center">–</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[var(--color-secondary)]">{oppScore}</span>
        <span className="text-xs text-muted">{oppName}</span>
      </div>
    </div>
  );

  if (phase === "config") {
    if (!isHost) return (
      <main className="app-main flex flex-col items-center justify-center p-6 text-center">
        <GameTitle gameId="ppt" title="Piedra Papel Tijera" />
        <p className="text-sm text-muted mb-4 mt-2">Partida: {code}</p>
        <p className="text-muted animate-pulse">Esperando configuración del anfitrión...</p>
        <LobbyExitLink className="mt-8 btn-ghost text-sm">Salir</LobbyExitLink>
      </main>
    );
    return (
      <main className="app-main flex flex-col items-center justify-center p-6 text-center">
        <GameTitle gameId="ppt" title="Piedra Papel Tijera" />
        <p className="text-sm text-muted mb-8 mt-2">Partida: {code}</p>
        <p className="font-medium mb-4">¿Cuántas rondas?</p>
        <div className="flex gap-3 mb-4">
          {[3, 5, 7].map((n) => (
            <Button key={n} onClick={() => startGame(n)} className="text-lg px-8">
              {n}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted mt-2">Gana quien llegue primero a la mitad de victorias.</p>
        <LobbyExitLink className="mt-8 btn-ghost text-sm">Salir</LobbyExitLink>
      </main>
    );
  }

  if (gameOver) {
    return (
      <main className="app-main flex flex-col items-center justify-center p-6 text-center">
        <GameTitle gameId="ppt" title="Piedra Papel Tijera" />
        <p className="text-3xl font-bold mb-2 mt-4 flex items-center justify-center gap-2">
          <TrophyIcon size={32} />
          {iWon ? myName : oppName} gana!
        </p>
        <Scores />
        <RematchPanel oppName={oppName} isWinner={iWon} isLoser={!iWon} rematch={rematch} />
      </main>
    );
  }

  return (
    <main className="app-main flex flex-col items-center justify-center p-6 text-center">
      <div className="flex w-full max-w-sm justify-between items-center mb-6">
        <GameNavLink className="btn-ghost text-sm py-1 px-2">Inicio</GameNavLink>
        <span className="text-sm text-muted">Ronda {round}/{maxRounds}</span>
        <button type="button" onClick={endGame} className="btn-ghost text-sm py-1 px-2">Salir</button>
      </div>

      <Scores />

      {phase === "choosing" && (
        <>
          <p className="mb-4 text-muted">
            {myChoice ? `Elegiste. Esperando a ${oppName}...` : "¿Qué eliges?"}
          </p>
          <div className="flex gap-4">
            {PPT_CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => choose(c)}
                disabled={!!myChoice}
                className={`p-3 rounded-xl border-2 transition-colors disabled:cursor-default ${
                  myChoice === c
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
                }`}
              >
                <EmojiIcon name={PPT_CHOICE_EMOJI[c]} size={52} label={c} />
              </button>
            ))}
          </div>
        </>
      )}

      {phase === "revealed" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-8 items-center">
            <div className="flex flex-col items-center gap-1">
              {myChoice && <EmojiIcon name={PPT_CHOICE_EMOJI[myChoice]} size={56} />}
              <span className="text-xs text-muted">{myName}</span>
            </div>
            <span className="text-muted text-lg">vs</span>
            <div className="flex flex-col items-center gap-1">
              {oppChoice && <EmojiIcon name={PPT_CHOICE_EMOJI[oppChoice]} size={56} />}
              <span className="text-xs text-muted">{oppName}</span>
            </div>
          </div>
          <p className="text-2xl font-bold">{resultLabel}</p>
          {isHost ? (
            <Button onClick={nextRound} className="mt-2">Siguiente ronda</Button>
          ) : (
            <p className="mt-2 text-sm text-muted animate-pulse">Esperando al anfitrión...</p>
          )}
        </div>
      )}
    </main>
  );
}
