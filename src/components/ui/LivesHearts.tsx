import { EmojiIcon } from "./EmojiIcon";

interface LivesHeartsProps {
  total?: number;
  remaining: number;
  size?: number;
}

export function LivesHearts({ total = 6, remaining, size = 28 }: LivesHeartsProps) {
  return (
    <div className="flex gap-1.5 justify-center mb-4" aria-label={`${remaining} de ${total} intentos`}>
      {Array.from({ length: total }, (_, i) => (
        <EmojiIcon
          key={i}
          name={i < remaining ? "heartFull" : "heartEmpty"}
          size={size}
        />
      ))}
    </div>
  );
}
