import type { GameId } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import { Bird, BookOpen, Pencil, Scissors } from "lucide-react";

export interface GameMeta {
  id: GameId;
  name: string;
  desc: string;
  icon: LucideIcon;
}

export const GAMES: GameMeta[] = [
  {
    id: "ppt",
    name: "Piedra Papel Tijera",
    desc: "Clásico de siempre. 3 rondas gana.",
    icon: Scissors,
  },
  {
    id: "ahorcado",
    name: "Ahorcado",
    desc: "Adivina la palabra antes de que sea tarde.",
    icon: Bird,
  },
  {
    id: "stop",
    name: "Bachillerato / Stop",
    desc: "Llena las categorías antes que tu pareja.",
    icon: BookOpen,
  },
  {
    id: "dibuja",
    name: "Dibuja y Adivina",
    desc: "Uno dibuja, el otro adivina.",
    icon: Pencil,
  },
];

export const BRAND_ICON = Bird;

export function getGameMeta(id: GameId): GameMeta {
  return GAMES.find((g) => g.id === id) ?? GAMES[0];
}
