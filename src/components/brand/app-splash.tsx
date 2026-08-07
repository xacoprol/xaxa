"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SPLASH_KEY = "xaxa-splash-done";

/** Posición de la X dentro del icono original (569×554). */
const X_SLOT = {
  left: "57.47%",
  top: "56.32%",
  width: "42.53%",
  height: "43.68%",
} as const;

/** Splash solo en la primera apertura de la sesión. */
export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY)) return;
    } catch {
      // private mode
    }

    let cancelled = false;
    setVisible(true);
    const minMs = 700;
    const started = Date.now();

    function hide() {
      if (cancelled) return;
      const wait = Math.max(0, minMs - (Date.now() - started));
      window.setTimeout(() => {
        if (cancelled) return;
        setFading(true);
        try {
          sessionStorage.setItem(SPLASH_KEY, "1");
        } catch {
          // ignore
        }
        window.setTimeout(() => {
          if (!cancelled) setVisible(false);
        }, 320);
      }, wait);
    }

    if (document.readyState === "complete") {
      hide();
    } else {
      window.addEventListener("load", hide, { once: true });
    }

    const safety = window.setTimeout(hide, 1800);
    return () => {
      cancelled = true;
      window.clearTimeout(safety);
      window.removeEventListener("load", hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_#eef7f4_0%,_#f4f7f6_45%,_#e2ebe8_100%)] transition-opacity duration-300 ease-out",
        fading && "pointer-events-none opacity-0"
      )}
      aria-hidden={fading}
      role="presentation"
    >
      <div
        className="relative w-28 sm:w-32"
        style={{ aspectRatio: "569 / 554" }}
        aria-label="X"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/icon-house.png"
          alt=""
          className="absolute inset-0 h-full w-full object-fill"
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/icon-x.png"
          alt=""
          className="splash-x-spin absolute object-fill"
          style={{
            left: X_SLOT.left,
            top: X_SLOT.top,
            width: X_SLOT.width,
            height: X_SLOT.height,
            transformOrigin: "50% 50%",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
