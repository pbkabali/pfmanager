/** Full-screen fallback used while a lazy route chunk or auth state loads. */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <span className="animate-pulse text-sm tracking-widest text-accent-text uppercase">
        {label}
      </span>
    </div>
  )
}
