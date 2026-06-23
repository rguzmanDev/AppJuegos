"use client";

import { useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { clsx } from "clsx";

interface CopyableTextProps {
  text: string;
  className?: string;
  label?: string;
}

export function CopyableText({ text, className, label }: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Clic para copiar"
      className={clsx(
        "cursor-pointer transition-opacity duration-100 hover:opacity-90 active:opacity-80",
        className,
      )}
    >
      {text}
      {copied && (
        <span className="block text-xs font-normal opacity-70 mt-1">
          {label ?? "Copiado!"}
        </span>
      )}
    </button>
  );
}
