import { requireHousehold } from "@/lib/auth";
import { getAppConfig, MAX_USERS_WHEN_LIMITED } from "@/lib/app-config";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const { household, role } = await requireHousehold();
  const [config, userCount] = await Promise.all([
    getAppConfig(),
    prisma.user.count(),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-teal">
          App
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-navy">
          Configuración
        </h1>
      </header>

      <SettingsForm
        initialLimitTwoUsers={config.limitTwoUsers}
        userCount={userCount}
        maxUsers={MAX_USERS_WHEN_LIMITED}
        inviteCode={household.inviteCode}
        householdName={household.name}
        isAdmin={role === "ADMIN"}
      />
    </div>
  );
}
