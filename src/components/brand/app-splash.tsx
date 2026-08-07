"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Posición de la X dentro del icono original (569×554). */
const X_SLOT = {
  left: "57.47%",
  top: "56.32%",
  width: "42.53%",
  height: "43.68%",
} as const;

/** Splash al abrir la app: icono real; solo la X verde gira. */
export function AppSplash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const minMs = 1100;
    const started = Date.now();

    function hide() {
      if (cancelled) return;
      const wait = Math.max(0, minMs - (Date.now() - started));
      window.setTimeout(() => {
        if (cancelled) return;
        setFading(true);
        window.setTimeout(() => {
          if (!cancelled) setVisible(false);
        }, 420);
      }, wait);
    }

    if (document.readyState === "complete") {
      hide();
    } else {
      window.addEventListener("load", hide, { once: true });
    }

    const safety = window.setTimeout(hide, 2800);
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
        "fixed inset-0 z-[200] flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_#eef7f4_0%,_#f4f7f6_45%,_#e2ebe8_100%)] transition-opacity duration-[420ms] ease-out",
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
