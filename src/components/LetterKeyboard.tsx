"use client";

import { QWERTY_ROWS } from "@/lib/keyboard";

interface LetterKeyboardProps {
  guessed: string[];
  word: string;
  onLetter: (letter: string) => void;
}

export function LetterKeyboard({ guessed, word, onLetter }: LetterKeyboardProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {QWERTY_ROWS.map((row, rowIdx) => (
        <div key={rowIdx} className="flex justify-center gap-1.5">
          {row.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => onLetter(letter)}
              disabled={guessed.includes(letter)}
              className={`w-9 h-9 rounded-lg font-bold text-sm transition-all ${
                guessed.includes(letter)
                  ? word.includes(letter)
                    ? "bg-green-200 text-green-700"
                    : "bg-gray-200 text-gray-400"
                  : "bg-pink-100 hover:bg-pink-300 border border-pink-200"
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
