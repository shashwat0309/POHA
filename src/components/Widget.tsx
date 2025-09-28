'use client'

import type { WidgetConfig } from '@lifi/widget'
import { ChainId } from '@lifi/sdk'
import { LiFiWidget } from '@lifi/widget'
import { ClientOnly } from './ClientOnly'
import { useRef } from 'react'
import VoiceAssistant from './VoiceAssistant'

export function Widget() {
  type WidgetFormRefLike = { setFieldValue: (name: string, value: unknown) => void }
  const formRef = useRef<WidgetFormRefLike | null>(null)
  const config = {
    appearance: 'light',
    theme: {
      container: {
        border: '1px solid rgb(234, 234, 234)',
        borderRadius: '16px',
      },
    },
    // Prefer stable chains, avoid flaky RPCs
    chains: {
      allow: [1, 10, 137, 42161, 8453, 43114, ChainId.SOL],
    },
    // Route options and tool restrictions
    sdkConfig: {
      routeOptions: {
        allowSwitchChain: true,
      },
    },
    exchanges: {
      // Cautiously deny known-problematic aggregator key if present
      deny: ['relay'],
    },
  } as Partial<WidgetConfig>

  return (
    <ClientOnly fallback={null}>
      <div style={{ display: 'grid', gap: 16 }}>
        <VoiceAssistant formRef={formRef} />
        {/* Keep the LiFi widget mounted but hidden, so voice assistant can drive it */}
        <div style={{ position: 'absolute', left: -99999, top: 0, width: 1, height: 1, overflow: 'hidden' }} aria-hidden>
          <LiFiWidget config={config} integrator="nextjs-example" formRef={formRef} />
        </div>
      </div>
    </ClientOnly>
  )
}
