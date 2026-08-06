import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, #d6d3d1 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, #a8a29e33 0%, transparent 50%), #f5f5f4",
        }}
      />
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <p className="font-display text-7xl font-semibold tracking-tight text-stone-900 sm:text-8xl">
          X
        </p>
        <p className="mt-3 max-w-sm text-lg text-stone-600 text-balance">
          El hogar, en orden. Gastos, menús e hipoteca para tu familia.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-stone-900 px-6 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-stone-300 bg-white/70 px-6 text-sm font-medium text-stone-800 backdrop-blur transition hover:bg-white"
          >
            Crear cuenta
          </Link>
        </div>
      </main>
    </div>
  );
}
