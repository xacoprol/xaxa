import { BrandLogo } from "@/components/brand/logo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_#c5efe6_0%,_#f4f7f6_55%)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
        </div>
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-soft">
          {children}
        </div>
      </div>
    </div>
  );
}
