import { clsx } from "clsx";

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "code" | "inset";
}

export function Panel({ children, className, variant = "default" }: PanelProps) {
  return (
    <div className={clsx(
      variant === "code" && "panel-code",
      variant === "inset" && "panel-inset",
      variant === "default" && "panel",
      className,
    )}>
      {children}
    </div>
  );
}

/** @deprecated Prefer Panel or GameList for new UI */
export function Card({ children, className, interactive }: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div className={clsx(interactive ? "panel panel-tap" : "panel", className)}>
      {children}
    </div>
  );
}
