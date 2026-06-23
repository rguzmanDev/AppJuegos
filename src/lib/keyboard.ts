/** Teclado QWERTY en español (incluye Ñ). */
export const QWERTY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
  ["Z", "X", "C", "V", "B", "N", "M"],
] as const;

export const QWERTY_LETTERS = QWERTY_ROWS.flat();
