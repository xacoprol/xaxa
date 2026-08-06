import { cache } from "react";
import { prisma } from "@/lib/prisma";

const MAX_USERS_WHEN_LIMITED = 2;

export const getAppConfig = cache(async () => {
  return prisma.appConfig.upsert({
    where: { id: "default" },
    create: { id: "default", limitTwoUsers: true },
    update: {},
  });
});

export async function canRegisterNewUser() {
  const config = await getAppConfig();
  if (!config.limitTwoUsers) {
    return { allowed: true as const, config, userCount: await prisma.user.count() };
  }

  const userCount = await prisma.user.count();
  if (userCount >= MAX_USERS_WHEN_LIMITED) {
    return {
      allowed: false as const,
      config,
      userCount,
      reason: `El registro está limitado a ${MAX_USERS_WHEN_LIMITED} usuarios.`,
    };
  }

  return { allowed: true as const, config, userCount };
}

export { MAX_USERS_WHEN_LIMITED };
