export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-stone-200/80" />
        <div className="h-8 w-40 rounded-lg bg-stone-200/80" />
        <div className="h-4 w-56 rounded bg-stone-100" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-36 rounded-2xl bg-white/70 ring-1 ring-stone-200/60" />
        <div className="h-36 rounded-2xl bg-white/70 ring-1 ring-stone-200/60" />
      </div>
      <div className="h-48 rounded-2xl bg-white/70 ring-1 ring-stone-200/60" />
    </div>
  );
}
