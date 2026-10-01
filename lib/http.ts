/**
 * fetch() with a hard timeout and a labeled error.
 *
 * Server-to-server calls (payment gateways, Nova Poshta, scrapers) can hang
 * indefinitely on a sick upstream; without a timeout the hang propagates to
 * the caller — a stuck gateway would hang the whole checkout server action.
 * Always prefer this over a bare fetch() for outbound API calls.
 *
 * On timeout throws `Error("<label> timed out after <n>ms")` so logs say
 * which integration died instead of a bare "The operation was aborted".
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit & { timeoutMs: number; label?: string },
): Promise<Response> {
  const { timeoutMs, label, ...rest } = init
  try {
    return await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) })
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error(`${label ?? 'fetch'} timed out after ${timeoutMs}ms`)
    }
    throw e
  }
}
