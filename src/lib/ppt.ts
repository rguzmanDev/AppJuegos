import type { EmojiKey } from "@/components/ui/EmojiIcon";

export type PPTChoice = "piedra" | "papel" | "tijera";

export const PPT_CHOICE_EMOJI: Record<PPTChoice, EmojiKey> = {
  piedra: "piedra",
  papel: "papel",
  tijera: "tijera",
};

export const PPT_CHOICES: PPTChoice[] = ["piedra", "papel", "tijera"];
