import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { BrandLogo } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 20% -5%, #08a08033 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 100% 100%, #10203822 0%, transparent 45%), #f4f7f6",
        }}
      />
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <BrandLogo href={null} size="xl" />
        <p className="mt-6 max-w-sm text-lg text-stone-600 text-balance">
          El hogar, en orden. Gastos, menús e hipoteca para tu familia.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-navy px-6 text-sm font-medium text-white transition hover:bg-navy-800"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-teal/30 bg-white/80 px-6 text-sm font-medium text-navy backdrop-blur transition hover:border-teal hover:bg-white"
          >
            Crear cuenta
          </Link>
        </div>
      </main>
    </div>
  );
}
