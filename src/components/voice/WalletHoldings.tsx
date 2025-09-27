'use client'

import { getWalletBalances, type WalletTokenExtended } from '@lifi/sdk'
import { useMemo, useState, useEffect } from 'react'
import { formatAmountDisplay } from './intentUtils'

interface WalletHoldingsProps {
  visible: boolean
  onClose: () => void
}

export function WalletHoldings({ visible, onClose }: WalletHoldingsProps) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [balances, setBalances] = useState<Record<string, WalletTokenExtended[]> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSpoken, setHasSpoken] = useState(false)

  // Speech function
  const speak = (text: string) => {
    try {
      if (!text) return
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'en-IN'
      const pickVoice = () => {
        const list = window.speechSynthesis.getVoices() || []
        const preferred =
          list.find((v) => v.lang?.toLowerCase() === 'en-in') ||
          list.find((v) => /en[-_]/i.test(v.lang || '')) ||
          list[0]
        if (preferred) utter.voice = preferred
      }
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          pickVoice()
          window.speechSynthesis.speak(utter)
        }
      } else {
        pickVoice()
        window.speechSynthesis.speak(utter)
      }
    } catch (e) {
      console.warn('speak failed', e)
    }
  }

  // Get wallet address from browser
  useEffect(() => {
    const getWalletAddress = async () => {
      if (!visible) return

      const eth = typeof window !== 'undefined' ? (window as any).ethereum : null
      if (!eth) return

      try {
        const accounts = await eth.request({ method: 'eth_accounts' })
        if (accounts && accounts.length > 0) {
          setWalletAddress(accounts[0])
        }
      } catch (error) {
        console.error('Failed to get wallet address:', error)
      }
    }

    getWalletAddress()
  }, [visible])

  // Fetch wallet balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!walletAddress || !visible) return

      setIsLoading(true)
      try {
        const walletBalances = await getWalletBalances(walletAddress)
        setBalances(walletBalances)
      } catch (error) {
        console.error('Failed to fetch wallet balances:', error)
        setBalances(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBalances()
  }, [walletAddress, visible])

  const formattedBalances = useMemo(() => {
    if (!balances) return []

    return Object.entries(balances)
      .flatMap(([chainId, tokens]) =>
        tokens.map((token: WalletTokenExtended) => ({
          ...token,
          chainId: Number(chainId),
          formattedAmount: formatAmountDisplay(token.amount, token.decimals),
        }))
      )
      .filter(token => Number(token.amount) > 0)
      .sort((a, b) => {
        // Sort by USD value if available, otherwise by amount
        const aValue = Number(a.priceUSD || 0) * Number(formatAmountDisplay(a.amount, a.decimals))
        const bValue = Number(b.priceUSD || 0) * Number(formatAmountDisplay(b.amount, b.decimals))
        return bValue - aValue
      })
      .slice(0, 10) // Show top 10 holdings
  }, [balances])

  // Speak holdings when they're loaded
  useEffect(() => {
    if (!visible || !formattedBalances.length || hasSpoken || isLoading) return

    setHasSpoken(true)

    if (formattedBalances.length === 0) {
      speak('No token balances found in your wallet.')
      return
    }

    let speechText = `You have ${formattedBalances.length} tokens in your wallet. `

    formattedBalances.slice(0, 5).forEach((token, index) => {
      const usdValue = token.priceUSD
        ? (Number(token.formattedAmount) * Number(token.priceUSD)).toFixed(2)
        : null

      speechText += `${index + 1}. ${token.formattedAmount} ${token.symbol}`
      if (usdValue && Number(usdValue) > 0) {
        speechText += ` worth $${usdValue}`
      }
      speechText += '. '
    })

    if (formattedBalances.length > 5) {
      speechText += `And ${formattedBalances.length - 5} more tokens.`
    }

    speak(speechText)
  }, [formattedBalances, visible, hasSpoken, isLoading, speak])

  // Reset hasSpoken when modal is closed and reopened
  useEffect(() => {
    if (!visible) {
      setHasSpoken(false)
    }
  }, [visible])

  // Handle keyboard events for closing
  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div className="wallet-holdings-overlay" onClick={onClose}>
      <div className="wallet-holdings-card" onClick={(e) => e.stopPropagation()}>
        <div className="holdings-header">
          <h3>Your Wallet Holdings</h3>
          <div className="header-actions">
            {formattedBalances.length > 0 && (
              <button
                className="speak-btn"
                onClick={() => {
                  setHasSpoken(false)
                  setTimeout(() => setHasSpoken(true), 100)
                }}
                title="Speak holdings"
              >
                🔊
              </button>
            )}
            <button className="close-btn" onClick={onClose} title="Close">×</button>
          </div>
        </div>

        {isLoading ? (
          <div className="holdings-loading">Loading your holdings...</div>
        ) : !walletAddress ? (
          <div className="holdings-empty">Please connect your wallet to view holdings</div>
        ) : formattedBalances.length === 0 ? (
          <div className="holdings-empty">No token balances found</div>
        ) : (
          <div className="holdings-list">
            {formattedBalances.map((token, index) => {
              const usdValue = token.priceUSD
                ? (Number(token.formattedAmount) * Number(token.priceUSD)).toFixed(2)
                : null

              return (
                <div key={`${token.chainId}-${token.address}-${index}`} className="holding-item">
                  <div className="token-info">
                    {token.logoURI && (
                      <img src={token.logoURI} alt={token.symbol} className="token-logo" />
                    )}
                    <div className="token-details">
                      <div className="token-symbol">{token.symbol}</div>
                      <div className="token-name">{token.name}</div>
                    </div>
                  </div>
                  <div className="token-balance">
                    <div className="balance-amount">{token.formattedAmount}</div>
                    {usdValue && <div className="balance-usd">${usdValue}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .wallet-holdings-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        
        .wallet-holdings-card {
          background: rgba(18, 18, 20, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 24px;
          max-width: 480px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        
        .holdings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        
        .holdings-header h3 {
          color: #fff;
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        
        .close-btn {
          background: none;
          border: none;
          color: #999;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s ease;
        }
        
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        
        .speak-btn {
          background: none;
          border: none;
          color: #999;
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        
        .speak-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        
        .holdings-loading,
        .holdings-empty {
          text-align: center;
          color: #999;
          padding: 40px 20px;
          font-size: 14px;
        }
        
        .holdings-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .holding-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        .token-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .token-logo {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
        }
        
        .token-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .token-symbol {
          color: #fff;
          font-weight: 600;
          font-size: 14px;
        }
        
        .token-name {
          color: #999;
          font-size: 12px;
        }
        
        .token-balance {
          text-align: right;
        }
        
        .balance-amount {
          color: #fff;
          font-weight: 600;
          font-size: 14px;
        }
        
        .balance-usd {
          color: #999;
          font-size: 12px;
          margin-top: 2px;
        }
      `}</style>
    </div>
  )
}