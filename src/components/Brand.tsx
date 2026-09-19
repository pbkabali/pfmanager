/**
 * The pfmanager wordmark. One component rather than markup repeated in the
 * shell and the login page, which is how the two quietly drift apart.
 */
export function Brand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`flex-none rounded-sm bg-accent ${size === 'lg' ? 'h-7 w-2' : 'h-5 w-1.5'}`}
        aria-hidden
      />
      <span
        className={`font-bold tracking-tight text-fg ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}
      >
        pf<span className="text-accent-text">manager</span>
      </span>
    </span>
  )
}
