'use client'

import { useCallback, useEffect, useState } from 'react'

export default function ConnectWalletButton() {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)

  const readConnection = useCallback(async () => {
    try {
      const eth = (typeof window !== 'undefined' ? (window as any).ethereum : null)
      if (!eth) return
      const accs = (await eth.request({ method: 'eth_accounts' })) as string[]
      const cid = (await eth.request({ method: 'eth_chainId' })) as string
      setAccount(accs?.[0] || null)
      setChainId(cid || null)
    } catch { }
  }, [])

  useEffect(() => {
    readConnection()
    const eth = (typeof window !== 'undefined' ? (window as any).ethereum : null)
    if (!eth?.on) return
    const onAccountsChanged = (accs: string[]) => setAccount(accs?.[0] || null)
    const onChainChanged = (cid: string) => setChainId(cid || null)
    eth.on('accountsChanged', onAccountsChanged)
    eth.on('chainChanged', onChainChanged)
    return () => {
      eth.removeListener?.('accountsChanged', onAccountsChanged)
      eth.removeListener?.('chainChanged', onChainChanged)
    }
  }, [readConnection])

  const connect = useCallback(async () => {
    try {
      const eth = (typeof window !== 'undefined' ? (window as any).ethereum : null)
      if (!eth) {
        alert('No EVM wallet detected. Please install MetaMask.')
        return
      }
      const accs = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      setAccount(accs?.[0] || null)
      const cid = (await eth.request({ method: 'eth_chainId' })) as string
      setChainId(cid || null)
    } catch (e) {
      console.warn('Wallet connect failed', e)
    }
  }, [])

  const short = (addr: string) => addr.slice(0, 6) + '...' + addr.slice(-4)
  const net = chainId ? parseInt(chainId, 16) : null

  return (
    <div style={{ position: 'fixed', right: 16, top: 55, zIndex: 1001 }}>
      <button
        onClick={connect}
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff',
          background: account ? 'rgba(16,185,129,0.35)' : 'rgba(18,18,24,0.55)',
          backdropFilter: 'blur(10px)'
        }}
        aria-label={account ? 'Wallet connected' : 'Connect wallet'}
      >
        {account ? `Connected: ${short(account)}${net ? ' · #' + net : ''}` : 'Connect Wallet'}
      </button>
    </div>
  )
}

