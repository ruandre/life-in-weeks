export function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError'
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error)
    return err.message || err.name
  return String(err)
}
