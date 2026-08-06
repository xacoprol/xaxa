import { AppShell } from "@/components/layout/app-shell";
import { requireHousehold } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, household } = await requireHousehold();

  return (
    <AppShell userName={user.name} householdName={household.name}>
      {children}
    </AppShell>
  );
}
