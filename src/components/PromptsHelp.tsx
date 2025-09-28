'use client'

import { useState } from 'react'

const PROMPTS = `POHA Voice/Chat Prompt Cheatsheet

Basic actions
- "Swap 25 USDC to ETH on Base"
- "Swap 0.5 ETH to USDC on Ethereum"
- "Bridge DAI from Polygon to Arbitrum"
- "Send 0.01 USDT to vaibhavrajput.eth"
- "Show my wallet holdings"
- "What is my USDT balance?"

Execute quickly
- "Do the swap"
- "Execute"
- "Go ahead"

Bridge + Swap (combined)
- "Bridge 100 USDC from Polygon to Arbitrum and swap to ETH"
- "Bridge USDT from Base to Ethereum then swap to DAI"
- "Bridge 50 DAI from Optimism to Base and convert to USDC"
- "Move my ETH from Arbitrum to Polygon and swap to USDT"

Tips
- Include amount, tokens, and chains when possible (e.g., "on base", "from polygon to arbitrum").
- If something is missing, the assistant will ask a short follow‑up.
- Direct send opens MetaMask and charges a 0.01 PYUSD governance/agent fee first.`

export default function PromptsHelp() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div style={{ position: 'fixed', left: 16, top: 60, zIndex: 999 }}>
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            background: 'rgba(18,18,24,0.55)',
            backdropFilter: 'blur(10px)'
          }}
        >{open ? 'Close Prompts' : 'Prompts'}</button>
      </div>
      {open && (
        <div style={{
          position: 'fixed',
          left: 16,
          top: 110,
          width: 380,
          maxHeight: '70vh',
          overflow: 'auto',
          padding: 14,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(18,18,24,0.75)',
          color: '#e7e7ea',
          backdropFilter: 'blur(10px)',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.35,
          fontSize: 13.5
        }}>
          {PROMPTS}
        </div>
      )}
    </>
  )
}

