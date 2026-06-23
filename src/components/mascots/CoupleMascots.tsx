import { Pollito } from "./Pollito";
import { Pinguinito } from "./Pinguinito";

interface CoupleMascotsProps {
  size?: number;
  className?: string;
}

export function CoupleMascots({ size = 48, className }: CoupleMascotsProps) {
  const half = Math.round(size * 0.55);
  return (
    <span className={`inline-flex items-end gap-0.5 ${className ?? ""}`} aria-hidden>
      <Pollito size={half} className="-mr-1" />
      <span className="text-pink-400 text-xs leading-none mb-1" style={{ fontSize: size * 0.22 }}>
        ♥
      </span>
      <Pinguinito size={half} className="-ml-1" />
    </span>
  );
}
