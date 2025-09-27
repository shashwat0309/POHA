import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'edge'
import OpenAI from 'openai'

// Create client only if key exists to avoid throwing at import time on edge
const OPENAI_KEY = process.env.OPENAI_API_KEY
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null

// Minimal server-safe intent extractor fallback when OpenAI is unavailable
type Intent = {
  source_token: string | null
  target_token: string | null
  amount: number | null
  source_chain: string | null
  target_chain: string | null
}

function normalizeName(v?: string | null) {
  return (v || '').toLowerCase().trim()
}
function normalizeTokenSymbol(v?: string | null) {
  const t = normalizeName(v).replace(/\b(token|coin)\b/g, '').replace(/s\b$/, '').trim()
  if (t === 'weth') return 'WETH'
  if (t === 'eth') return 'ETH'
  if (t === 'matic' || t === 'polygon') return 'MATIC'
  if (t === 'bnb' || t === 'binance') return 'BNB'
  if (t === 'avax' || t === 'avalanche') return 'AVAX'
  if (t === 'sol' || t === 'solana') return 'SOL'
  if (t === 'usdt' || t === 'tether' || t === 'usdts') return 'USDT'
  if (t === 'usdc') return 'USDC'
  if (t === 'dai') return 'DAI'
  return t.toUpperCase()
}
function normalizeChainAlias(v?: string | null) {
  const raw = normalizeName(v).replace(/\b(chain|network)\b/g, '').trim()
  if (!raw) return ''
  const map: Record<string, string> = {
    eth: 'ethereum', ethereum: 'ethereum', mainnet: 'ethereum', 'ethereum mainnet': 'ethereum', 'eth mainnet': 'ethereum',
    arbitrum: 'arbitrum', 'arbitrum one': 'arbitrum', 'arbitrum 1': 'arbitrum',
    polygon: 'polygon', matic: 'polygon',
    optimism: 'optimism', op: 'optimism',
    base: 'base',
    avalanche: 'avalanche', avax: 'avalanche',
    bsc: 'bsc', binance: 'bsc', 'binance smart chain': 'bsc', bnb: 'bsc', 'bnb chain': 'bsc',
  }
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (map[collapsed]) return map[collapsed]
  const stripped = collapsed.replace(/\b(one|1)\b/g, '').replace(/\s+/g, ' ').trim()
  if (map[stripped]) return map[stripped]
  return raw
}

function localExtractIntent(text: string): Intent {
  const t = (text || '').toLowerCase()
  const out: Partial<Intent> = { source_token: null, target_token: null, amount: null, source_chain: null, target_chain: null }
  const amtToken = t.match(/\b(?:swap|convert|change|exchange|bridge)\s+(\d+(?:[.,]\d+)?)\s*([a-z][a-z0-9]*)/i)
  if (amtToken) {
    const amt = parseFloat(amtToken[1].replace(',', '.'))
    if (!isNaN(amt)) out.amount = amt
    out.source_token = normalizeTokenSymbol(amtToken[2])
  }
  const pair = t.match(/\b(?:swap|convert|change|exchange)\s+([a-z][a-z0-9]*)\s+(?:to|into|for)\s+([a-z][a-z0-9]*)/i)
  if (pair) {
    out.source_token = normalizeTokenSymbol(pair[1])
    out.target_token = normalizeTokenSymbol(pair[2])
  }
  const tgt = t.match(/\b(?:get|receive|want to get|i want to get|i want)\s+([a-z][a-z0-9]*)/i)
  if (tgt) out.target_token = normalizeTokenSymbol(tgt[1])
  const srcOnly = !out.source_token && t.match(/\b(?:swap|sell|bridge|convert|change|exchange)\s+([a-z][a-z0-9]*)/i)
  if (srcOnly) out.source_token = normalizeTokenSymbol(srcOnly[1])
  const onMatches = (() => {
    const re = /\bon\s+([a-z][\w\s-]*?)(?=\s|$|\.|,)/gi
    const arr: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(t)) !== null) arr.push(normalizeChainAlias(m[1]))
    return arr
  })()
  if (onMatches.length === 1) {
    const idxTo = t.indexOf(' to ')
    const idxOn = t.indexOf(' on ')
    if (idxTo !== -1 && idxOn > idxTo) out.target_chain = onMatches[0]
    else out.source_chain = onMatches[0]
  } else if (onMatches.length >= 2) {
    out.source_chain = onMatches[0]
    out.target_chain = onMatches[1]
  }
  const fromChain = t.match(/\bfrom\s+([a-z][\w\s-]*?)(?=\s|$|\.|,)/i)
  if (fromChain) out.source_chain = normalizeChainAlias(fromChain[1])
  const toChain = t.match(/\bto\s+([a-z][\w\s-]*?)(?:\s+chain|\s+network)?\b(?!\s*(?:token|usdt|usdc|eth|dai|weth|bnb|avax|sol|matic)\b)/i)
  if (toChain) out.target_chain = normalizeChainAlias(toChain[1])
  if (!out.source_chain && out.target_token && out.source_token && onMatches.length === 1) out.source_chain = onMatches[0]
  return out as Intent
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!openai) {
      // Fallback local parse
      const local = localExtractIntent(String(text || ''))
      return NextResponse.json({ intent: JSON.stringify(local) })
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: [
            'You are a precise crypto swap intent extractor for a voice assistant named POHA.',
            'Return a single JSON object with keys:',
            '{ "source_token": string|null, "target_token": string|null, "amount": number|null, "source_chain": string|null, "target_chain": string|null }',
            '- If the user mentions only ONE token with verbs like "swap <token>", treat it as source_token.',
            '- If the user says "swap <tokenA> to/into <tokenB>", set source_token=<tokenA>, target_token=<tokenB>.',
            '- Recognize chains and normalize to canonical ids: ethereum, polygon, arbitrum, optimism, base, avalanche, bsc.',
            '  Synonyms: mainnet/eth mainnet/ethereum chain => ethereum; matic => polygon; arbitrum one/arbitrum 1 => arbitrum; binance/binance smart chain/bnb/bnb chain => bsc; avax => avalanche.',
            '- Accept pluralization and synonyms for tokens: usdts/tether => usdt; weth => weth; eth => eth.',
            '- Extract numeric amount if specified (e.g., "2.5 usdt" => amount: 2.5). If not present, set amount to null.',
            '- If chain is not specified, set both source_chain and target_chain to null.',
            '- Do NOT invent values; only extract from the user input.',
            'Examples:',
            'User: "I want to swap USDT" => {"source_token":"usdt","target_token":null,"amount":null,"source_chain":null,"target_chain":null}',
            'User: "swap 100 usdt to eth on base" => {"source_token":"usdt","target_token":"eth","amount":100,"source_chain":"base","target_chain":"base"}',
            'User: "swap eth on arbitrum one to usdt on ethereum" => {"source_token":"eth","target_token":"usdt","amount":null,"source_chain":"arbitrum","target_chain":"ethereum"}',
            'User: "bridge usdc from polygon to arbitrum" => {"source_token":"usdc","target_token":null,"amount":null,"source_chain":"polygon","target_chain":"arbitrum"}',
          ].join('\n'),
        },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
    })

    const parsed = completion.choices[0].message.content
    return NextResponse.json({ intent: parsed })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Intent error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
