/** A short buzz on phones that allow it (Android). iOS Safari has no vibration API, so this is a no-op there. */
export function haptic(pattern: number | number[] = 12): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}
