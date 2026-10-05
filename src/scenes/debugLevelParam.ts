export const MAX_GENERATED_LEVEL = 500;

/** URL'de ?level=N varsa (1..500) döner, yoksa null. Yalnızca manuel test/inceleme içindir. */
export function getDebugLevelParam(): number | null {
  const n = Number.parseInt(new URLSearchParams(window.location.search).get('level') ?? '', 10);
  return Number.isInteger(n) && n >= 1 && n <= MAX_GENERATED_LEVEL ? n : null;
}
