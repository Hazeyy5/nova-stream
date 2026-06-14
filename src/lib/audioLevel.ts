/** Convertit une amplitude linéaire (0–1) en niveau d'affichage perceptuel (0–1). */
export function linearToDisplayLevel(linear: number): number {
  if (linear <= 0.000001) return 0
  const db = 20 * Math.log10(linear)
  const normalized = (db + 42) / 42
  return Math.pow(Math.max(0, Math.min(1, normalized)), 0.65)
}

export function linearToDb(linear: number): number {
  if (linear < 0.00001) return -60
  return Math.max(-60, Math.min(0, 20 * Math.log10(linear)))
}
