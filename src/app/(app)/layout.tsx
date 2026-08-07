import { AppShell } from "@/components/layout/app-shell";

/**
 * Layout síncrono: no espera a Supabase/Prisma.
 * Así loading.tsx aparece al instante al cambiar de sección.
 * La protección de rutas la hace el middleware; cada page valida datos.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
