export const STOP_CATEGORIES = [
  "Nombre",
  "Animal",
  "Fruta/Verdura",
  "País",
  "Color",
  "Cosa",
] as const;

export const STOP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Elige una letra que no se haya usado en la partida. */
export function pickNextLetter(used: string[]): { letter: string; used: string[] } | null {
  const available = STOP_LETTERS.filter((l) => !used.includes(l));
  if (available.length === 0) return null;
  const letter = available[Math.floor(Math.random() * available.length)]!;
  return { letter, used: [...used, letter] };
}

export type StopCategory = (typeof STOP_CATEGORIES)[number];
export type StopAnswers = Record<string, string>;

export function startsWithLetter(answer: string, letter: string): boolean {
  const trimmed = answer.trim();
  if (!trimmed || !letter) return false;
  return trimmed.charAt(0).toUpperCase() === letter.toUpperCase();
}

/** Respuesta válida: no vacía, empieza con la letra y sin disputa del oponente. */
export function isStopAnswerValid(
  answer: string,
  letter: string,
  disputed = false,
): boolean {
  if (disputed) return false;
  return startsWithLetter(answer, letter);
}

export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

export function calcStopScore(
  mine: StopAnswers,
  theirs: StopAnswers,
  letter: string,
  disputedMine: Set<string>,
  disputedTheirs: Set<string>,
): { myPts: number; oppPts: number } {
  let myPts = 0;
  let oppPts = 0;

  for (const cat of STOP_CATEGORIES) {
    const rawMine = mine[cat] ?? "";
    const rawTheirs = theirs[cat] ?? "";

    const m = isStopAnswerValid(rawMine, letter, disputedMine.has(cat))
      ? normalizeAnswer(rawMine)
      : "";
    const t = isStopAnswerValid(rawTheirs, letter, disputedTheirs.has(cat))
      ? normalizeAnswer(rawTheirs)
      : "";

    if (!m && !t) continue;
    if (m && t && m === t) {
      myPts += 50;
      oppPts += 50;
    } else {
      if (m) myPts += 100;
      if (t) oppPts += 100;
    }
  }

  return { myPts, oppPts };
}

export type StopAnswerStatus = "empty" | "invalid-letter" | "disputed" | "valid";

export function getAnswerStatus(
  answer: string,
  letter: string,
  disputed: boolean,
): StopAnswerStatus {
  const trimmed = answer.trim();
  if (!trimmed) return "empty";
  if (!startsWithLetter(trimmed, letter)) return "invalid-letter";
  if (disputed) return "disputed";
  return "valid";
}
