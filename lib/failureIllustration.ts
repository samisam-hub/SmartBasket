/** Network failures get distinct artwork; backend and validation errors do not. */
export function failureIllustration(error: unknown): 'offline' | 'dataError' {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  const message = typeof error === 'string' ? error : error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  return /network request failed|failed to fetch|networkerror|internet.*disconnected/i.test(message) ? 'offline' : 'dataError';
}
