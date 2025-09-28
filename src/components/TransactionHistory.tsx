'use client'

import { useEffect, useMemo, useState } from 'react'

export type TxRecord = {
  id: string
  ts: number
  status: 'completed' | 'failed'
  fromChainId?: number
  toChainId?: number
  fromSymbol?: string
  toSymbol?: string
  amount?: number
  dex?: string
  routeId?: string
}

const STORAGE_KEY = 'poha_tx_history'

export function appendTx(record: TxRecord) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list: TxRecord[] = raw ? JSON.parse(raw) : []
    list.unshift(record)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(list.slice(0, 50)) }))
  } catch { }
}

export default function TransactionHistory() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<TxRecord[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      setItems(raw ? JSON.parse(raw) : [])
    } catch { }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          setItems(e.newValue ? JSON.parse(e.newValue) : [])
        } catch { }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const formatted = useMemo(() => items.map((r) => ({
    ...r,
    when: new Date(r.ts).toLocaleString(),
  })), [items])

  return (
    <>
      <div style={{ position: 'fixed', left: 16, top: 20, zIndex: 1000 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            background: 'rgba(18,18,24,0.55)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {open ? 'Close History' : 'Tx History'}
        </button>
      </div>
      {open && (
        <div style={{
          position: 'fixed',
          top: 70,
          left: 16,
          width: 320,
          maxHeight: '70vh',
          overflow: 'auto',
          padding: 12,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(18,18,24,0.65)',
          color: '#e7e7ea',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Transactions</div>
          {formatted.length === 0 ? (
            <div style={{ opacity: .8, fontSize: 13 }}>No transactions yet.</div>
          ) : (
            formatted.map((r, idx) => (
              <div key={r.id} style={{
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: 10,
                marginBottom: 8,
                background: 'rgba(255,255,255,0.03)',
                // Make the most recent (first) card appear on the right side visually
                alignSelf: idx === 0 ? 'flex-end' : 'stretch',
                maxWidth: idx === 0 ? '92%' : '100%'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, opacity: .8 }}>{r.when}</span>
                  <span style={{ fontSize: 12, color: r.status === 'completed' ? '#34d399' : '#f87171' }}>
                    {r.status}
                  </span>
                </div>
                {(r.amount && r.fromSymbol) ? (
                  <div style={{ fontSize: 13 }}>
                    {r.amount} {r.fromSymbol}
                    {r.toSymbol ? ` → ${r.toSymbol}` : ''}
                  </div>
                ) : null}
                {(r.fromChainId || r.toChainId) ? (
                  <div style={{ fontSize: 12, opacity: .85 }}>
                    {r.fromChainId ? `from #${r.fromChainId}` : ''} {r.toChainId ? `to #${r.toChainId}` : ''}
                  </div>
                ) : null}
                {r.dex ? (
                  <div style={{ fontSize: 12, opacity: .85 }}>via {r.dex}</div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </>
  )
}
