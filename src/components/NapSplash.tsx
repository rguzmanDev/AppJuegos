"use client";

import { CoupleMascots } from "@/components/mascots/Mascots";
import { clsx } from "clsx";

interface NapSplashProps {
  /** Pantalla completa inicial vs overlay al reconectar */
  variant?: "fullscreen" | "overlay";
}

export function NapSplash({ variant = "fullscreen" }: NapSplashProps) {
  return (
    <div
      className={clsx(
        "nap-splash",
        variant === "fullscreen" && "nap-splash-full",
        variant === "overlay" && "nap-splash-overlay",
      )}
      role="status"
      aria-live="polite"
      aria-label="Cargando CuddleArcade"
    >
      <div className="nap-splash-inner">
        <div className="nap-splash-mascots">
          <CoupleMascots size={72} />
        </div>
        <p className="nap-splash-title font-display">¡Nos despertaste!</p>
        <p className="nap-splash-sub">Estábamos tomando una siestita…</p>
        <div className="nap-splash-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
