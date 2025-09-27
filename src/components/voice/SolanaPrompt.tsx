'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { isSVMAddress } from '@lifi/sdk'

type SolanaPromptMode = 'dest' | 'source'

type SolanaPromptProps = {
  visible?: boolean
  mode: SolanaPromptMode
  onCancel?: () => void
  onConfirm?: (address?: string) => void
}

export const SolanaPrompt: React.FC<SolanaPromptProps> = ({
  visible = false,
  mode,
  onCancel,
  onConfirm,
}) => {
  const [addr, setAddr] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const valid = useMemo(() => isSVMAddress(addr), [addr])

  const connectPhantom = useCallback(async () => {
    try {
      setConnecting(true)
      // Minimal Phantom connect flow
      const provider = (typeof window !== 'undefined' && (window as any).solana) || null
      if (!provider || !provider.isPhantom) {
        setError('Phantom wallet not detected. Please install Phantom or use the widget to connect a Solana wallet.')
        return
      }
      const resp = await provider.connect()
      const pub = resp?.publicKey?.toString?.()
      if (pub) {
        if (mode === 'dest') {
          onConfirm?.(pub)
        } else {
          onConfirm?.()
        }
      } else {
        setError('Unable to read public key from wallet.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet connection failed.')
    } finally {
      setConnecting(false)
    }
  }, [mode, onConfirm])

  const confirmTyped = useCallback(() => {
    if (mode !== 'dest') return
    if (!valid) {
      setError('Enter a valid Solana address.')
      return
    }
    onConfirm?.(addr)
  }, [addr, mode, onConfirm, valid])

  if (!visible) return null

  return (
    <div className="sol-card">
      <div className="sol-title">Solana requirements</div>
      <div className="sol-sub">
        {mode === 'dest'
          ? 'Destination is Solana. Connect a Solana wallet or paste a Solana address.'
          : 'Source is Solana. Please connect a Solana wallet to sign the transaction.'}
      </div>
      {mode === 'dest' ? (
        <div className="sol-row">
          <input
            className="sol-input"
            placeholder="Solana address"
            value={addr}
            onChange={(e) => {
              setError(null)
              setAddr(e.target.value.trim())
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="sol-btn" onClick={confirmTyped} disabled={!addr || !valid}>
            Use Address
          </button>
        </div>
      ) : null}
      <div className="sol-actions">
        <button className="sol-btn ghost" onClick={onCancel}>Cancel</button>
        <button className="sol-btn primary" onClick={connectPhantom} disabled={connecting}>
          {connecting ? 'Connecting…' : 'Connect Phantom'}
        </button>
      </div>
      {error ? <div className="sol-error">{error}</div> : null}
      <style jsx>{`
        .sol-card { pointer-events: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 14px; background: rgba(18,18,20,0.6); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #e7e7ea; }
        .sol-title { font-size: 13px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; opacity: .95; }
        .sol-sub { font-size: 12px; opacity: .85; }
        .sol-row { display: flex; gap: 8px; align-items: center; }
        .sol-input { flex: 1; min-width: 0; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); color: #fff; outline: none; }
        .sol-input::placeholder { color: rgba(255,255,255,0.55); }
        .sol-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .sol-error { font-size: 12px; color: #fca5a5; }
        .sol-btn { pointer-events: auto; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); color: #fff; cursor: pointer; font-size: 13px; background: rgba(255,255,255,0.1); }
        .sol-btn.primary { background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); border-color: transparent; }
        .sol-btn.ghost { background: rgba(255,255,255,0.06); }
        .sol-btn[disabled] { opacity: .6; cursor: not-allowed; }
      `}</style>
    </div>
  )
}

