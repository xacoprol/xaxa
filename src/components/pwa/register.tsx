"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRegister() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [showIosTip, setShowIosTip] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // ignore
      });
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      ("standalone" in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    if (isStandalone) return;

    const dismissedAt = localStorage.getItem("x-pwa-dismissed");
    if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000) {
      setDismissed(true);
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) setShowIosTip(true);

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (dismissed) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  function dismiss() {
    localStorage.setItem("x-pwa-dismissed", String(Date.now()));
    setDismissed(true);
    setDeferred(null);
    setShowIosTip(false);
  }

  if (!deferred && !showIosTip) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 px-4 md:bottom-6">
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
        <div className="mt-0.5 rounded-lg bg-navy p-2 text-white">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy">Instalar X</p>
          <p className="mt-0.5 text-xs text-stone-500">
            {deferred
              ? "Añádela a tu pantalla de inicio y úsala como una app."
              : "En Safari: Compartir → “Añadir a pantalla de inicio”."}
          </p>
          <div className="mt-3 flex gap-2">
            {deferred && (
              <Button size="sm" onClick={install}>
                Instalar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Ahora no
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
