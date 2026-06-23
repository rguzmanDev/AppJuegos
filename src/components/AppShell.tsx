"use client";

import { useEffect, useState } from "react";
import { NapSplash } from "@/components/NapSplash";

const MIN_SPLASH_MS = 650;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    const finish = () => {
      const elapsed = Date.now() - started;
      const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
      setTimeout(() => {
        if (cancelled) return;
        setFadeOut(true);
        setTimeout(() => {
          if (!cancelled) setBooting(false);
        }, 320);
      }, wait);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish, { once: true });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {booting && (
        <div className={fadeOut ? "nap-splash-exit" : undefined}>
          <NapSplash variant="fullscreen" />
        </div>
      )}
      <div className="app-shell flex flex-1 flex-col w-full">{children}</div>
    </>
  );
}
