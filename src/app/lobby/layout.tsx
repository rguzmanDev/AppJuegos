import { Suspense } from "react";

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>{children}</Suspense>;
}
