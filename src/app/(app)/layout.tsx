import { AppShell } from "@/components/layout/app-shell";

/**
 * Layout síncrono (shell inmediato). force-dynamic evita prerender estático
 * de páginas con cookies — sin bloquear el layout en auth/DB.
 */
export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
