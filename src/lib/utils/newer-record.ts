/**
 * Returns whichever copy of the same record was updated most recently, so a
 * snapshot held in state (e.g. opened from another view, or just saved) and
 * the copy in a freshly loaded list can be reconciled without an effect.
 * ISO timestamps from the API compare correctly as strings.
 */
export function pickNewerRecord<T extends { updatedAt: string }>({
  held,
  listed,
}: {
  held: T;
  listed: T | undefined;
}): T {
  if (!listed) return held;
  return listed.updatedAt > held.updatedAt ? listed : held;
}
