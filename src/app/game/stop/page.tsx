"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, Dices, Hand, Trophy } from "lucide-react";
import { GameNavLink, LobbyExitLink } from "@/components/GameNavLink";
import { GameIcon } from "@/components/GameIcon";
import { RematchPanel, useRematch } from "@/components/RematchPanel";
import { useRoom } from "@/lib/useRoom";
import {
  STOP_CATEGORIES,
  calcStopScore,
  getAnswerStatus,
  pickNextLetter,
  startsWithLetter,
  type StopAnswers,
} from "@/lib/stopScoring";
import { filterPlainText } from "@/lib/validation";
import type { GameEvent } from "@/lib/types";

function answerCellClass(status: ReturnType<typeof getAnswerStatus>, tie: boolean): string {
  if (status === "empty") return "text-gray-400";
  if (tie) return "text-yellow-600";
  if (status === "valid") return "text-green-600";
  return "text-red-500 line-through";
}

export default function StopPage() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") ?? "";
  const { me, opponent, socket } = useRoom();
  const isHost = me?.isHost ?? false;

  const [phase, setPhase] = useState<
    "config" | "waiting" | "playing" | "reviewing" | "scoring"
  >("config");
  const [letter, setLetter] = useState("");
  const [answers, setAnswers] = useState<StopAnswers>({});
  const [myAnswers, setMyAnswers] = useState<StopAnswers>({});
  const [theirAnswers, setTheirAnswers] = useState<StopAnswers>({});
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(4);
  const [timeLimit, setTimeLimit] = useState(60);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [theySubmitted, setTheySubmitted] = useState(false);
  const [disputedTheirs, setDisputedTheirs] = useState<Set<string>>(new Set());
  const [disputedMine, setDisputedMine] = useState<Set<string>>(new Set());
  const [iReviewDone, setIReviewDone] = useState(false);
  const [theyReviewDone, setTheyReviewDone] = useState(false);
  const [roundScore, setRoundScore] = useState<{ myPts: number; oppPts: number } | null>(null);

  const answersRef = useRef<StopAnswers>({});
  const submittedRef = useRef(false);
  const scoringAppliedRef = useRef(false);
  const doSubmitRef = useRef<() => void>(() => {});
  const usedLettersRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  const resetRematch = useCallback(() => {
    setMyScore(0);
    setOppScore(0);
    setRound(1);
    usedLettersRef.current = [];
    setPhase("config");
  }, []);

  function clearTimers() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  function resetRoundState() {
    setAnswers({});
    answersRef.current = {};
    setMyAnswers({});
    setTheirAnswers({});
    setSubmitted(false);
    submittedRef.current = false;
    setTheySubmitted(false);
    setDisputedTheirs(new Set());
    setDisputedMine(new Set());
    setIReviewDone(false);
    setTheyReviewDone(false);
    setRoundScore(null);
    scoringAppliedRef.current = false;
  }

  useEffect(() => {
    const errorHandler = () => router.push("/");
    socket.on("error", errorHandler);
    return () => { socket.off("error", errorHandler); };
  }, [socket, router]);

  useEffect(() => {
    const handler = (event: GameEvent) => {
      const { type, payload, _from } = event;

      if (type === "stop:config") {
        const p = payload as { maxRounds: number; timeLimit: number };
        usedLettersRef.current = [];
        setMaxRounds(p.maxRounds);
        setTimeLimit(p.timeLimit);
        setPhase("waiting");
      }

      if (type === "stop:start") {
        const p = payload as { letter: string; timeLimit: number };
        resetRoundState();
        setLetter(p.letter);
        setPhase("playing");
        setTimeLeft(p.timeLimit);

        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = setInterval(() => {
          setTimeLeft((t) => {
            if (t <= 1) {
              if (tickRef.current) clearInterval(tickRef.current);
              return 0;
            }
            return t - 1;
          });
        }, 1000);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          doSubmitRef.current();
        }, p.timeLimit * 1000);
      }

      if (type === "stop:submit" && _from !== socket.id) {
        const p = payload as { answers: StopAnswers };
        setTheirAnswers(p.answers);
        setTheySubmitted(true);
      }

      if (type === "stop:dispute" && _from !== socket.id) {
        const p = payload as { category: string; disputed: boolean };
        setDisputedMine((prev) => {
          const next = new Set(prev);
          if (p.disputed) next.add(p.category);
          else next.delete(p.category);
          return next;
        });
      }

      if (type === "stop:review-done" && _from !== socket.id) {
        setTheyReviewDone(true);
      }

      if (type === "stop:next") {
        clearTimers();
        setPhase("waiting");
        setRound((r) => r + 1);
        resetRoundState();
      }

      if (type === "game:end") {
        router.push("/");
      }
    };

    socket.on("game:event", handler);
    return () => {
      socket.off("game:event", handler);
      clearTimers();
    };
  }, [socket, router]);

  // Ambos enviaron → revisión
  useEffect(() => {
    if (phase === "playing" && submitted && theySubmitted) {
      clearTimers();
      setPhase("reviewing");
    }
  }, [phase, submitted, theySubmitted]);

  // Ambos confirmaron revisión → puntaje
  useEffect(() => {
    if (phase !== "reviewing" || !iReviewDone || !theyReviewDone || scoringAppliedRef.current) return;
    scoringAppliedRef.current = true;
    const score = calcStopScore(myAnswers, theirAnswers, letter, disputedMine, disputedTheirs);
    setRoundScore(score);
    setMyScore((s) => s + score.myPts);
    setOppScore((s) => s + score.oppPts);
    setPhase("scoring");
  }, [phase, iReviewDone, theyReviewDone, myAnswers, theirAnswers, disputedMine, disputedTheirs, letter]);

  function configGame(rounds: number, time: number) {
    setMaxRounds(rounds);
    setTimeLimit(time);
    socket.emit("game:action", { type: "stop:config", payload: { maxRounds: rounds, timeLimit: time } });
    setPhase("waiting");
  }

  function startRound() {
    if (!isHost) return;
    const next = pickNextLetter(usedLettersRef.current);
    if (!next) return;
    usedLettersRef.current = next.used;
    socket.emit("game:action", {
      type: "stop:start",
      payload: { letter: next.letter, timeLimit: timeLimit },
    });
  }

  function doSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    clearTimers();
    const current = { ...answersRef.current };
    setMyAnswers(current);
    socket.emit("game:action", { type: "stop:submit", payload: { answers: current } });
  }

  doSubmitRef.current = doSubmit;

  function updateAnswer(cat: string, val: string) {
    const next = { ...answersRef.current, [cat]: filterPlainText(val) };
    answersRef.current = next;
    setAnswers(next);
  }

  function toggleDispute(category: string) {
    if (phase !== "reviewing" || iReviewDone) return;
    const answer = theirAnswers[category] ?? "";
    if (!answer.trim() || !startsWithLetter(answer, letter)) return;

    setDisputedTheirs((prev) => {
      const next = new Set(prev);
      const disputed = !next.has(category);
      if (disputed) next.add(category);
      else next.delete(category);
      socket.emit("game:action", {
        type: "stop:dispute",
        payload: { category, disputed },
      });
      return next;
    });
  }

  function confirmReview() {
    if (iReviewDone) return;
    setIReviewDone(true);
    socket.emit("game:action", { type: "stop:review-done", payload: {} });
  }

  function nextRound() {
    socket.emit("game:action", { type: "stop:next", payload: {} });
  }

  function endGame() {
    socket.emit("game:action", { type: "game:end", payload: {} });
    router.push("/");
  }

  const myName = me?.nickname ?? "Yo";
  const oppName = opponent?.nickname ?? "Pareja";
  const gameOver = round > maxRounds;
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

  const HeaderBar = () => (
    <div className="flex w-full max-w-md justify-between items-center mb-4">
      <GameNavLink className="text-sm opacity-40 hover:opacity-70">← Inicio</GameNavLink>
      <span className="text-sm font-medium opacity-60 flex items-center gap-1">
        <GameIcon gameId="stop" size={14} className="text-[var(--color-accent)]" />
        Stop · R {round}/{maxRounds}
      </span>
      <button onClick={endGame} className="text-sm opacity-40 hover:opacity-70">Salir</button>
    </div>
  );

  const ScoreBar = () => (
    <div className="flex gap-12 text-3xl font-bold mb-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[var(--color-accent)]">{myScore}</span>
        <span className="text-xs opacity-50">{myName}</span>
      </div>
      <span className="opacity-30 self-center">–</span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[var(--color-secondary)]">{oppScore}</span>
        <span className="text-xs opacity-50">{oppName}</span>
      </div>
    </div>
  );

  if (phase === "config") {
    if (!isHost) return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1 flex items-center justify-center gap-2">
          <GameIcon gameId="stop" size={24} className="text-[var(--color-accent)]" />
          Bachillerato / Stop
        </h2>
        <p className="text-sm opacity-50 mb-4">Partida: {code}</p>
        <p className="animate-pulse opacity-60">Esperando configuración del anfitrión...</p>
        <LobbyExitLink className="mt-8 text-sm opacity-40 hover:opacity-70 underline">← Salir</LobbyExitLink>
      </main>
    );
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-1 flex items-center justify-center gap-2">
          <GameIcon gameId="stop" size={24} className="text-[var(--color-accent)]" />
          Bachillerato / Stop
        </h2>
        <p className="text-sm opacity-50 mb-8">Partida: {code}</p>
        <p className="font-medium mb-4">¿Cuántas rondas?</p>
        <div className="flex gap-3 mb-6">
          {[4, 6, 8].map((n) => (
            <button key={n} onClick={() => setMaxRounds(n)}
              className={`font-bold py-3 px-6 rounded-xl text-lg border-2 transition-all ${
                maxRounds === n ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]" : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
              }`}>{n}</button>
          ))}
        </div>
        <p className="font-medium mb-4">Tiempo por ronda:</p>
        <div className="flex gap-3 mb-8">
          {[30, 60, 90].map((s) => (
            <button key={s} onClick={() => setTimeLimit(s)}
              className={`font-bold py-3 px-6 rounded-xl text-lg border-2 transition-all ${
                timeLimit === s ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]" : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
              }`}>{s}s</button>
          ))}
        </div>
        <button onClick={() => configGame(maxRounds, timeLimit)}
          className="btn-primary">
          Listo!
        </button>
        <LobbyExitLink className="mt-6 text-sm opacity-40 hover:opacity-70 underline">← Salir</LobbyExitLink>
      </main>
    );
  }

  if (gameOver) {
    const winner = myScore > oppScore ? myName : myScore < oppScore ? oppName : null;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
          <GameIcon gameId="stop" size={24} className="text-[var(--color-accent)]" />
          Fin del juego
        </h2>
        <p className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          {winner ? (
            <>
              <Trophy className="text-yellow-500" size={32} aria-hidden />
              {winner} gana!
            </>
          ) : (
            "Empate!"
          )}
        </p>
        <ScoreBar />
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

  if (phase === "waiting") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <HeaderBar />
        <ScoreBar />
        {isHost ? (
          <button onClick={startRound}
            className="btn-primary py-4 px-10 text-xl flex items-center gap-2 mx-auto">
            <Dices size={24} aria-hidden />
            Iniciar ronda
          </button>
        ) : (
          <p className="animate-pulse opacity-60">Esperando al anfitrión...</p>
        )}
      </main>
    );
  }

  if (phase === "playing") {
    return (
      <main className="min-h-screen flex flex-col items-center p-6">
        <HeaderBar />
        <div className="flex items-center gap-4 mb-4">
          <div className="text-6xl font-bold text-[var(--color-accent)]">{letter}</div>
          <div className={`text-2xl font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "opacity-60"}`}>
            {timeLeft}s
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm mb-6">
          {STOP_CATEGORIES.map((cat) => {
            const value = answers[cat] ?? "";
            const invalid = value.trim() && !startsWithLetter(value, letter);
            return (
              <div key={cat} className="flex items-center gap-2">
                <label className="w-32 text-sm font-medium opacity-70">{cat}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateAnswer(cat, e.target.value)}
                  disabled={submitted}
                  className={`flex-1 border-2 rounded-lg px-3 py-2 outline-none disabled:opacity-50 ${
                    invalid
                      ? "border-red-300 focus:border-red-400"
                      : "border-[var(--color-border)] focus:border-pink-400"
                  }`}
                  placeholder={`Con ${letter}...`}
                />
              </div>
            );
          })}
        </div>

        {!submitted ? (
          <button onClick={doSubmit}
            className="btn-primary text-lg flex items-center gap-2">
            <Hand size={20} aria-hidden />
            STOP!
          </button>
        ) : (
          <p className="opacity-50 animate-pulse">Esperando a {oppName}...</p>
        )}
      </main>
    );
  }

  if (phase === "reviewing") {
    return (
      <main className="min-h-screen flex flex-col items-center p-6">
        <HeaderBar />
        <p className="text-lg font-bold mb-1">Letra: {letter} — Revisión</p>
        <p className="text-sm opacity-60 mb-4 text-center max-w-md">
          Toca las respuestas de {oppName} que no sean válidas. Las que no empiecen con {letter} no puntúan.
        </p>

        <div className="w-full max-w-md overflow-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[var(--color-border)]">
                <th className="pb-2 opacity-60">Categoría</th>
                <th className="pb-2 text-[var(--color-accent)]">{myName}</th>
                <th className="pb-2 text-[var(--color-secondary)]">{oppName}</th>
              </tr>
            </thead>
            <tbody>
              {STOP_CATEGORIES.map((cat) => {
                const m = (myAnswers[cat] ?? "").trim();
                const t = (theirAnswers[cat] ?? "").trim();
                const myStatus = getAnswerStatus(m, letter, disputedMine.has(cat));
                const theirStatus = getAnswerStatus(t, letter, disputedTheirs.has(cat));
                const canDispute = theirStatus === "valid" && !iReviewDone;

                return (
                  <tr key={cat} className="border-b border-gray-100">
                    <td className="py-2 opacity-60">{cat}</td>
                    <td className={`py-2 font-medium ${answerCellClass(myStatus, false)}`}>
                      {m || "—"}
                      {myStatus === "invalid-letter" && (
                        <span className="block text-xs">No empieza con {letter}</span>
                      )}
                      {myStatus === "disputed" && (
                        <span className="block text-xs">Invalidada por {oppName}</span>
                      )}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        disabled={!canDispute}
                        onClick={() => toggleDispute(cat)}
                        className={`font-medium text-left w-full rounded px-1 ${
                          answerCellClass(theirStatus, false)
                        } ${canDispute ? "hover:bg-pink-50 cursor-pointer" : ""}`}
                      >
                        {t || "—"}
                        {theirStatus === "invalid-letter" && (
                          <span className="block text-xs">No empieza con {letter}</span>
                        )}
                        {theirStatus === "disputed" && (
                          <span className="block text-xs">Invalidada por ti</span>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!iReviewDone ? (
          <button onClick={confirmReview}
            className="btn-primary flex items-center gap-2">
            <Check size={18} aria-hidden />
            Confirmar revisión
          </button>
        ) : (
          <p className="opacity-50 animate-pulse">Esperando a {oppName}...</p>
        )}
      </main>
    );
  }

  // scoring
  return (
    <main className="min-h-screen flex flex-col items-center p-6">
      <HeaderBar />
      <p className="text-lg font-bold mb-1">Letra: {letter}</p>
      <ScoreBar />

      {roundScore && (
        <p className="text-sm mb-3 font-medium">
          Esta ronda: <span className="text-[var(--color-accent)]">+{roundScore.myPts} pts</span> vs{" "}
          <span className="text-[var(--color-secondary)]">+{roundScore.oppPts} pts</span>
        </p>
      )}

      <div className="w-full max-w-md overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--color-border)]">
              <th className="pb-2 opacity-60">Categoría</th>
              <th className="pb-2 text-[var(--color-accent)]">{myName}</th>
              <th className="pb-2 text-[var(--color-secondary)]">{oppName}</th>
            </tr>
          </thead>
          <tbody>
            {STOP_CATEGORIES.map((cat) => {
              const m = (myAnswers[cat] ?? "").trim();
              const t = (theirAnswers[cat] ?? "").trim();
              const myStatus = getAnswerStatus(m, letter, disputedMine.has(cat));
              const theirStatus = getAnswerStatus(t, letter, disputedTheirs.has(cat));
              const mValid = myStatus === "valid";
              const tValid = theirStatus === "valid";
              const tie = mValid && tValid && m.toLowerCase() === t.toLowerCase();

              return (
                <tr key={cat} className="border-b border-gray-100">
                  <td className="py-2 opacity-60">{cat}</td>
                  <td className={`py-2 font-medium ${answerCellClass(myStatus, tie)}`}>
                    {m || "—"}
                  </td>
                  <td className={`py-2 font-medium ${answerCellClass(theirStatus, tie)}`}>
                    {t || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs opacity-40 mt-2">
          Válida con {letter} = puntos. Misma respuesta = 50pts. Única = 100pts.
        </p>
      </div>

      {isHost ? (
        <button onClick={nextRound}
          className="mt-6 btn-primary">
          Siguiente ronda →
        </button>
      ) : (
        <p className="mt-6 text-sm animate-pulse opacity-50">Esperando al anfitrión...</p>
      )}
    </main>
  );
}
