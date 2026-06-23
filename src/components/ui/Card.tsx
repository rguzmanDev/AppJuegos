import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "article";
  interactive?: boolean;
}

export function Card({ children, className, as: Tag = "div", interactive }: CardProps) {
  return (
    <Tag className={clsx(interactive ? "card-interactive" : "card", className)}>
      {children}
    </Tag>
  );
}
