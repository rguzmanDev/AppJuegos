import type { GameId } from "@/lib/types";
import {
  AhorcadoIcon,
  DibujaIcon,
  PPTIcon,
  StopIcon,
  type GameIconComponent,
} from "@/components/icons/GameIcons";

export interface GameMeta {
  id: GameId;
  name: string;
  desc: string;
  icon: GameIconComponent;
}

export const GAMES: GameMeta[] = [
  {
    id: "ppt",
    name: "Piedra Papel Tijera",
    desc: "Clásico de siempre. 3 rondas gana.",
    icon: PPTIcon,
  },
  {
    id: "ahorcado",
    name: "Ahorcado",
    desc: "Adivina la palabra antes de que sea tarde.",
    icon: AhorcadoIcon,
  },
  {
    id: "stop",
    name: "Bachillerato / Stop",
    desc: "Llena las categorías antes que tu pareja.",
    icon: StopIcon,
  },
  {
    id: "dibuja",
    name: "Dibuja y Adivina",
    desc: "Uno dibuja, el otro adivina.",
    icon: DibujaIcon,
  },
];

export function getGameMeta(id: GameId): GameMeta {
  return GAMES.find((g) => g.id === id) ?? GAMES[0];
}
