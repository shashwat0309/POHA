'use client'

import { useEffect, useMemo, useState } from 'react'

// These come from the Self SDK. Install with: npm i @selfxyz/qrcode
// Using type any to avoid build breaks if package not yet installed locally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SelfQRcodeWrapper: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SelfAppBuilder: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let countries: any = null

try {
  // Lazy require to avoid SSR issues during build if deps not installed yet
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@selfxyz/qrcode')
  SelfQRcodeWrapper = mod.SelfQRcodeWrapper
  SelfAppBuilder = mod.SelfAppBuilder
  countries = mod.countries
} catch { }

export default function VerifyIdentity() {
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

    if (!SelfAppBuilder) return
    try {
      const app = new SelfAppBuilder({
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
          excludedCountries: countries ? [countries.CUBA, countries.IRAN, countries.NORTH_KOREA, countries.RUSSIA] : [],
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
  }, [userId])

  const handleSuccess = () => {
    setStatus('success')
    try {
      localStorage.setItem('poha_verified', 'true')
    } catch { }
  }
  const handleError = () => setStatus('error')
  const openSelfApp = () => {
    if (universalLink) window.open(universalLink, '_blank')
  }

  return (
    <div style={{ maxWidth: 840, margin: '24px auto', padding: 16, color: 'black' }}>
      <h1>Authenticate with Self Protocol</h1>
      <p>Verify identity to unlock voice swap and bridge features.</p>

      {!SelfQRcodeWrapper || !SelfAppBuilder ? (
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
            <SelfQRcodeWrapper selfApp={selfApp} onSuccess={handleSuccess} onError={handleError} />
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
