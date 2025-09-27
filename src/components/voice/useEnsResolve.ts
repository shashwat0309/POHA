import { useCallback, useMemo, useRef, useState } from 'react'

export type EnsResolution = {
  name?: string | null
  address?: string | null
}

export function useEnsResolve() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EnsResolution | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    setError(null)
    setResult(null)
  }, [])

  const resolve = useCallback(async (input: string) => {
    const ens = (input || '').trim().toLowerCase()
    if (!ens) {
      setError('Please enter an ENS name.')
      setResult(null)
      return null
    }
    // Basic ENS heuristic for UX; resolver will validate too
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(ens)) {
      setError('Please enter a valid .eth name.')
      setResult(null)
      return null
    }
    abortRef.current?.abort()
    const ctl = new AbortController()
    abortRef.current = ctl
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(
        `https://api.ensideas.com/ens/resolve/${encodeURIComponent(ens)}`,
        { signal: ctl.signal }
      )
      if (!res.ok) {
        throw new Error(`Resolver error: ${res.status}`)
      }
      const data = (await res.json()) as {
        name?: string | null
        address?: string | null
      }
      const out: EnsResolution = {
        name: data.name ?? ens,
        address: data.address ?? null,
      }
      setResult(out)
      if (!out.address) {
        setError('ENS name not found or has no address.')
      }
      return out
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to resolve ENS.'
      if (msg.includes('AbortError')) return null
      setError(msg)
      setResult(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const address = useMemo(() => result?.address ?? null, [result])
  const name = useMemo(() => result?.name ?? null, [result])

  return { loading, error, result, address, name, resolve, reset }
}

