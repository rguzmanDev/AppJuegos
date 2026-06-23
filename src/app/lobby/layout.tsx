import { Suspense } from "react";
import { NapSplash } from "@/components/NapSplash";
import { SocketWakeGuard } from "@/components/SocketWakeGuard";

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return (
    <SocketWakeGuard>
      <Suspense fallback={<NapSplash variant="overlay" />}>{children}</Suspense>
    </SocketWakeGuard>
  );
}
