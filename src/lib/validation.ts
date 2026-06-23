/** Solo letras sin tildes, números y espacios. Ñ permitida. */
const PLAIN_TEXT_REGEX = /^[A-Za-zÑñ0-9 ]*$/;

/** Elimina tildes y caracteres no permitidos. */
export function filterPlainText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .filter((ch) => PLAIN_TEXT_REGEX.test(ch))
    .join("");
}

export function isPlainTextValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && PLAIN_TEXT_REGEX.test(trimmed);
}

/** Para palabras secretas: solo letras y números, sin espacios. */
const WORD_REGEX = /^[A-Za-zÑñ0-9]*$/;

export function filterWordText(value: string): string {
  return filterPlainText(value).replace(/ /g, "").toUpperCase();
}

export function isWordValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && WORD_REGEX.test(trimmed);
}
