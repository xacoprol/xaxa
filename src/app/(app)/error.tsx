"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <BrandLogo href="/dashboard" size="md" />
      <h1 className="font-display mt-6 text-2xl font-semibold text-navy">
        Algo ha fallado
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        {error.message || "Error inesperado en el servidor."}
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-stone-400">Digest: {error.digest}</p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white"
        >
          Reintentar
        </button>
        <Link
          href="/login"
          className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-navy"
        >
          Ir al login
        </Link>
      </div>
    </div>
  );
}
