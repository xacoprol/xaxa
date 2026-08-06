import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  href?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  className?: string;
  /** "icon" = house+X, "mark" = teal symbol */
  variant?: "icon" | "mark";
};

const sizes = {
  sm: 28,
  md: 36,
  lg: 56,
  xl: 96,
} as const;

export function BrandLogo({
  href = "/",
  size = "md",
  showWordmark = false,
  className,
  variant = "icon",
}: BrandLogoProps) {
  const px = sizes[size];
  const src = variant === "mark" ? "/brand/mark.png" : "/brand/icon.png";

  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src={src}
        alt="X"
        width={px}
        height={px}
        className="object-contain"
        priority
      />
      {showWordmark && (
        <span className="font-display text-2xl font-semibold tracking-tight text-navy">
          X
        </span>
      )}
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href} className="inline-flex" aria-label="X — inicio">
      {content}
    </Link>
  );
}
