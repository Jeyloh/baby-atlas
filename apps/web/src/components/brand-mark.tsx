/**
 * Baby Atlas mark: a four-point compass star (the "atlas") on a fjord disc,
 * with a cloudberry dot for the child at the centre of the map.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#2a5b6e" />
      <path
        d="M16 5.5 18.4 13.6 26.5 16 18.4 18.4 16 26.5 13.6 18.4 5.5 16 13.6 13.6Z"
        fill="#f6f7f4"
      />
      <circle cx="16" cy="16" r="2.6" fill="#e9a23b" />
    </svg>
  );
}
