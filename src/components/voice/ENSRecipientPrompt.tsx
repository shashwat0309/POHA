'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { useEnsResolve } from './useEnsResolve'

export function shortenAddress(address?: string | null) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

type ENSRecipientPromptProps = {
  visible?: boolean
  onCancel?: () => void
  onConfirm?: (address: string, name?: string | null) => void
  onSpell?: (setter: (value: string) => void) => Promise<void>
}

export const ENSRecipientPrompt: React.FC<ENSRecipientPromptProps> = ({
  visible = false,
  onCancel,
  onConfirm,
  onSpell,
}) => {
  const [ensInput, setEnsInput] = useState('')
  const { loading, error, address, name, resolve, reset } = useEnsResolve()

  const canConfirm = useMemo(() => Boolean(address), [address])

  const handleCancel = useCallback(() => {
    setEnsInput('')
    reset()
    onCancel?.()
  }, [onCancel, reset])

  const handleResolve = useCallback(async () => {
    await resolve(ensInput)
  }, [ensInput, resolve])

  const handleConfirm = useCallback(() => {
    if (!address) return
    onConfirm?.(address, name)
    setEnsInput('')
    reset()
  }, [address, name, onConfirm, reset])

  if (!visible) return null

  return (
    <div className="ens-card">
      <div className="ens-row">
        <div className="ens-title">Send to ENS?</div>
        <div className="ens-sub">Optionally set an ENS name as recipient.</div>
      </div>
      <div className="ens-controls">
        <input
          className="ens-input"
          placeholder="yourname.eth"
          value={ensInput}
          onChange={(e) => setEnsInput(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className="ens-btn" onClick={handleResolve} disabled={loading || !ensInput.trim()}>
          {loading ? 'Resolving…' : 'Resolve'}
        </button>
        {onSpell ? (
          <button className="ens-btn ghost" onClick={() => onSpell?.(setEnsInput)}>
            Spell by Voice
          </button>
        ) : null}
      </div>
      {error ? <div className="ens-error">{error}</div> : null}
      {address ? (
        <div className="ens-result">
          Resolved {name || ensInput} → {shortenAddress(address)}
        </div>
      ) : null}
      <div className="ens-actions">
        <button className="ens-btn ghost" onClick={handleCancel}>Skip</button>
        <button className="ens-btn primary" disabled={!canConfirm} onClick={handleConfirm}>
          Confirm & Execute
        </button>
      </div>
      <style jsx>{`
        .ens-card { pointer-events: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 14px; background: rgba(18,18,20,0.6); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #e7e7ea; }
        .ens-row { display: flex; flex-direction: column; gap: 4px; }
        .ens-title { font-size: 13px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; opacity: .95; }
        .ens-sub { font-size: 12px; opacity: .8; }
        .ens-controls { display: flex; gap: 8px; align-items: center; }
        .ens-input { flex: 1; min-width: 0; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); color: #fff; outline: none; }
        .ens-input::placeholder { color: rgba(255,255,255,0.55); }
        .ens-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .ens-result { font-size: 12px; opacity: .9; }
        .ens-error { font-size: 12px; color: #fca5a5; }
        .ens-btn { pointer-events: auto; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); color: #fff; cursor: pointer; font-size: 13px; background: rgba(255,255,255,0.1); }
        .ens-btn.primary { background: linear-gradient(135deg, #4F46E5 0%, #0EA5E9 100%); border-color: transparent; }
        .ens-btn.ghost { background: rgba(255,255,255,0.06); }
        .ens-btn[disabled] { opacity: .6; cursor: not-allowed; }
      `}</style>
    </div>
  )
}

