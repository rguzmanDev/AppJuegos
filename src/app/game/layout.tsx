import { Suspense } from "react";
import { NapSplash } from "@/components/NapSplash";
import { SocketWakeGuard } from "@/components/SocketWakeGuard";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <SocketWakeGuard>
      <Suspense fallback={<NapSplash variant="overlay" />}>{children}</Suspense>
    </SocketWakeGuard>
  );
}
