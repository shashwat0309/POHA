'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserGreeting } from '@/components/UserGreeting'

// Self SDK types (loaded dynamically on client to avoid bundling heavy deps during build)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
let SelfQRcodeWrapperRef: Any = null
let SelfAppBuilderRef: Any = null
let countriesRef: Any = null

export default function VerifyIdentity() {
  const router = useRouter()
  const [selfApp, setSelfApp] = useState<any | null>(null)
  const [universalLink, setUniversalLink] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle')

  // You likely want to pass a connected EVM address instead
  const userId = useMemo(() => process.env.NEXT_PUBLIC_SELF_DEMO_USER || '0x0000000000000000000000000000000000000000', [])

  useEffect(() => {
    // Detect mobile quickly on client
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase()
    setIsMobile(/mobile|tablet|ip(ad|hone|od)|android/.test(ua))

    // Dynamically load Self SDK only on client
    ;(async () => {
      try {
        if (!SelfAppBuilderRef) {
          const mod = await import('@selfxyz/qrcode')
          SelfQRcodeWrapperRef = mod.SelfQRcodeWrapper
          SelfAppBuilderRef = mod.SelfAppBuilder
          countriesRef = mod.countries
        }
      } catch {
        // SDK not available; surface notice in UI
        return
      }

      if (!SelfAppBuilderRef) return
      try {
        const app = new SelfAppBuilderRef({
          version: 2,
          appName: process.env.NEXT_PUBLIC_SELF_APP_NAME || 'POHA Swap',
          scope: process.env.NEXT_PUBLIC_SELF_SCOPE || 'poha-swap',
          endpoint: process.env.NEXT_PUBLIC_SELF_ENDPOINT || `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/verify`,
          logoBase64: process.env.NEXT_PUBLIC_SELF_LOGO || process.env.NEXT_PUBLIC_SELF_LOGO_URL || '',
          userId,
          endpointType: (process.env.NEXT_PUBLIC_SELF_ENDPOINT_TYPE as 'staging_celo' | 'production') || 'staging_celo',
          userIdType: (process.env.NEXT_PUBLIC_SELF_USER_ID_TYPE as 'hex' | 'uuid') || 'hex',
          userDefinedData: 'User authenticated for token swaps and bridges',
          disclosures: {
            minimumAge: 18,
          excludedCountries: countriesRef ? [countriesRef.CUBA, countriesRef.IRAN, countriesRef.NORTH_KOREA, countriesRef.RUSSIA] : [],
            nationality: true,
            gender: true,
          },
          deeplinkCallback: process.env.NEXT_PUBLIC_SELF_CALLBACK || (process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/verify` : ''),
        }).build()

        setSelfApp(app)
        // getUniversalLink may exist on the built app; guard usage
        const link = typeof app?.getUniversalLink === 'function' ? app.getUniversalLink() : ''
        setUniversalLink(link || '')
      } catch (e) {
        // noop; surface in UI
        console.warn('Failed to build Self app', e)
      }
    })()
  }, [userId])

  const handleSuccess = (payload?: any) => {
    setStatus('success')
    try {
      // Persist verification flag
      localStorage.setItem('poha_verified', 'true')

      // Try to extract user-friendly name from payload
      const data = payload || {}
      const name =
        data?.fullName ||
        data?.name ||
        data?.givenName ||
        data?.firstName ||
        data?.userName ||
        ''
      const identifier = data?.userIdentifier || data?.userId || ''

      const user = { name, identifier, verifiedAt: new Date().toISOString() }
      localStorage.setItem('poha_user', JSON.stringify(user))

      // Voice-only greeting: "Welcome to Poha, {name}"
      try {
        const spokenName = user.name || 'there'
        const utterance = new SpeechSynthesisUtterance(`Welcome to Poha, ${spokenName}`)
        // Prefer a clear, neutral English voice if available
        const voices = window.speechSynthesis?.getVoices?.() || []
        const preferred = voices.find(v => /en[-_](US|GB)/i.test(v.lang))
        if (preferred) utterance.voice = preferred
        window.speechSynthesis?.cancel?.()
        window.speechSynthesis?.speak?.(utterance)
      } catch {}
    } catch { }

    // Small delay to show success then redirect home
    setTimeout(() => router.push('/'), 600)
  }
  const handleError = () => setStatus('error')
  const openSelfApp = () => {
    if (universalLink) window.open(universalLink, '_blank')
  }

  return (
    <div style={{ maxWidth: 840, margin: '24px auto', padding: 16, position: 'relative' }}>
      {/* Top-left user name badge */}
      <UserGreeting />
      <h1>Authenticate with Self Protocol</h1>
      <p>Verify identity to unlock voice swap and bridge features.</p>

      {!SelfQRcodeWrapperRef || !SelfAppBuilderRef ? (
        <div style={{ marginTop: 12, color: '#b91c1c' }}>
          SDK not installed. Run: npm i @selfxyz/qrcode
        </div>
      ) : null}

      {status === 'success' ? (
        <div style={{ marginTop: 12, color: '#059669' }}>
          User verified successfully! You can now use the AI agent.
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        {selfApp ? (
          isMobile ? (
            <button onClick={openSelfApp} disabled={!universalLink} style={{ padding: '10px 16px' }}>
              Open Self App for Verification
            </button>
          ) : (
            SelfQRcodeWrapperRef ? (
              <div
                style={{
                  display: 'inline-block',
                  background: '#ffffff',
                  padding: 16,
                  borderRadius: 12,
                  border: '2px solid #e5e7eb',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                }}
              >
                <SelfQRcodeWrapperRef
                  selfApp={selfApp}
                  onSuccess={handleSuccess}
                  onError={handleError}
                />
              </div>
            ) : (
              <div>Loading QR code…</div>
            )
          )
        ) : (
          <div>Loading verification…</div>
        )}
      </div>

      {status === 'error' ? (
        <div style={{ marginTop: 12, color: '#ef4444' }}>Verification failed. Please try again.</div>
      ) : null}
    </div>
  )
}
