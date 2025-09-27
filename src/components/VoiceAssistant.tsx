'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { recordAudio } from '../utils/recorder'
import type { Route } from '@lifi/sdk'
import { ChainId, getWalletBalances } from '@lifi/sdk'
import { useWidgetEvents, WidgetEvent } from '@lifi/widget'
// Wallet management will be handled through browser wallet detection
import {
  CHAIN_IDS,
  normalizeChainAlias,
  normalizeTokenSymbol,
  extractLocalIntent,
  resolveToken,
  formatAmountDisplay,
  type Intent,
} from './voice/intentUtils'
import { BestRouteCard } from './voice/BestRouteCard'
import { DebugPanel } from './voice/DebugPanel'
import { getBestDexInfo } from './voice/intentUtils'
import { useRouteExecution } from './voice/useRouteExecution'
import { ENSRecipientPrompt } from './voice/ENSRecipientPrompt'
import { SolanaPrompt } from './voice/SolanaPrompt'
import { WalletHoldings } from './voice/WalletHoldings'

// token resolution now provided by intentUtils.resolveToken

type WidgetFormRefLike = { setFieldValue: (name: string, value: unknown) => void }

export default function VoiceAssistant({
  formRef,
}: {
  formRef: React.MutableRefObject<WidgetFormRefLike | null>
}) {
  type EIP1193Provider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  }

  // We'll check wallet connection through browser wallet detection
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing'>(
    'idle'
  )
  const [transcript, setTranscript] = useState('')
  const [intent, setIntent] = useState<Intent>({
    source_token: null,
    target_token: null,
    amount: null,
    source_chain: null,
    target_chain: null,
  })
  const [proposal, setProposal] = useState<{
    fromChainId: number
    toChainId: number
    fromSymbol: string
    toSymbol: string
    amount: number
    sourceChainName: string
    targetChainName: string
    fromTokenAddress: string
    toTokenAddress: string
  } | null>(null)
  const [lastApplied, setLastApplied] = useState<{
    fromChainId: number
    toChainId: number
    fromSymbol: string
    toSymbol: string
    amount: number
    sourceChainName: string
    targetChainName: string
  } | null>(null)
  // English-only assistant; use 'en' transcription and en-IN voice
  const transcribeLang = 'en'
  const recorderRef = useRef<Awaited<ReturnType<typeof recordAudio>> | null>(null)
  const keyDownRef = useRef(false)
  const widgetEvents = useWidgetEvents()
  const [bestRoute, setBestRoute] = useState<Route | null>(null)
  const [execProposal, setExecProposal] = useState<Route | null>(null)
  const [execAsking, setExecAsking] = useState(false)
  const lastPromptedRouteIdRef = useRef<string | null>(null)
  const [ensPromptVisible, setEnsPromptVisible] = useState(false)
  const lastEnsPromptedRouteIdRef = useRef<string | null>(null)
  const [solPromptVisible, setSolPromptVisible] = useState(false)
  const [solPromptMode, setSolPromptMode] = useState<'dest' | 'source'>('dest')
  const [solRecipientSet, setSolRecipientSet] = useState(false)
  const [showWalletHoldings, setShowWalletHoldings] = useState(false)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const { status: execStatus, execute, reset: resetExec } =
    useRouteExecution({
      onUpdate: () => {
        // No-op for now; widget UI handles progress if user navigates there.
      },
    })

  // best route rendering handled by BestRouteCard

  // formatting moved to utils and BestRouteCard

  // Check if the transcript is asking for wallet holdings
  const isWalletHoldingsQuery = useCallback((text: string) => {
    const t = text.toLowerCase()
    return /\b(show|display|what|check|view|see|tell me|list|what are)\b.*\b(wallet|balance|balances|holdings|portfolio|tokens|assets|funds)\b/.test(t) ||
      /\b(my|current|wallet)\b.*\b(balance|balances|holdings|portfolio|tokens|assets)\b/.test(t) ||
      /\b(what do i have|what tokens do i have|show my tokens|my tokens|my assets|my holdings|my portfolio)\b/.test(t) ||
      /\b(wallet balance|current balance|token balance|account balance)\b/.test(t)
  }, [])

  // Check if asking for specific token balance
  const isSpecificTokenQuery = useCallback((text: string) => {
    const t = text.toLowerCase()
    return /\b(how many|how much|what is my|what's my|check my)\b.*\b(usdt|usdc|eth|btc|matic|dai|weth|tokens?|balance)\b/.test(t) ||
      /\b(balance of|amount of)\b.*\b(usdt|usdc|eth|btc|matic|dai|weth)\b/.test(t)
  }, [])

  // Extract token symbol from query
  const extractTokenFromQuery = useCallback((text: string) => {
    const t = text.toLowerCase()
    const tokenMatch = t.match(/\b(usdt|usdc|eth|btc|matic|dai|weth|bitcoin|ethereum|tether|usd coin)\b/)
    if (!tokenMatch) return null

    const token = tokenMatch[1]
    // Normalize token names
    if (token === 'bitcoin') return 'BTC'
    if (token === 'ethereum') return 'ETH'
    if (token === 'tether') return 'USDT'
    if (token === 'usd coin') return 'USDC'
    return token.toUpperCase()
  }, [])

  // English-only speech (prefer en-IN voice), cancel previous
  const speak = useCallback((text: string, lang: string = 'en-IN') => {
    try {
      if (!text) return
      // Cancel any queued utterances to avoid piling up
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang
      const pickVoice = () => {
        const list = window.speechSynthesis.getVoices() || []
        const preferred =
          list.find((v) => v.lang?.toLowerCase() === 'en-in') ||
          list.find((v) => /en[-_]/i.test(v.lang || '')) ||
          list[0]
        if (preferred) utter.voice = preferred
      }
      // Voices can be async-loaded on some browsers
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
  }, [])

  // English-only: no language switching

  // Derived completeness not used in UI currently

  // next question computed per-merge to avoid stale reads

  const startRecording = useCallback(async () => {
    if (status !== 'idle') return
    try {
      setStatus('listening')
      setLiveTranscript('')

      // Start live transcription
      const recognition = startLiveTranscription()
      if (recognition) {
        recognition.start()
          // Store recognition instance for cleanup
          ; (recorderRef as any).recognition = recognition
      }

      const rec = await recordAudio()
      recorderRef.current = rec
      rec.start()
    } catch (e) {
      console.error(e)
      setStatus('idle')
      setIsTranscribing(false)
    }
  }, [status, startLiveTranscription])

  const stopAndProcess = useCallback(async () => {
    const rec = recorderRef.current
    if (!rec) return
    try {
      setStatus('processing')

      // Stop live transcription
      const recognition = (recorderRef as any).recognition
      if (recognition) {
        recognition.stop()
          ; (recorderRef as any).recognition = null
      }
      setIsTranscribing(false)

      const audioBlob = await rec.stop()
      recorderRef.current = null

      // Use live transcript if available, otherwise fall back to API transcription
      let finalText = liveTranscript.trim()

      if (!finalText) {
        const formData = new FormData()
        formData.append('file', audioBlob, 'recording.webm')
        formData.append('lang', transcribeLang)

        const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
        const { text } = await res.json()
        finalText = text
      }

      setTranscript(finalText)
      setLiveTranscript('')

      // Check if user is asking for specific token balance
      if (isSpecificTokenQuery(finalText)) {
        const tokenSymbol = extractTokenFromQuery(finalText)
        if (tokenSymbol) {
          await getSpecificTokenBalance(tokenSymbol)
        } else {
          speak('Which token balance would you like to check?')
        }
        setStatus('idle')
        return
      }

      // Check if user is asking for wallet holdings
      if (isWalletHoldingsQuery(finalText)) {
        // Check if wallet is connected via browser
        const eth = typeof window !== 'undefined' ? (window as any).ethereum : null
        if (!eth) {
          speak('Please connect your wallet first to view your holdings.')
        } else {
          try {
            const accounts = await eth.request({ method: 'eth_accounts' })
            if (!accounts || accounts.length === 0) {
              speak('Please connect your wallet first to view your holdings.')
            } else {
              setShowWalletHoldings(true)
              speak('Here are your current wallet holdings.')
            }
          } catch (error) {
            speak('Please connect your wallet first to view your holdings.')
          }
        }
        setStatus('idle')
        return
      }

      const local = extractLocalIntent(finalText)

      const intentRes = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: finalText }),
      })
      const { intent: intentStr } = await intentRes.json()
      const newIntent: Intent = JSON.parse(intentStr)

      const merged: Intent = {
        source_token: newIntent.source_token || local.source_token || intent.source_token,
        target_token: newIntent.target_token || local.target_token || intent.target_token,
        amount:
          typeof newIntent.amount === 'number'
            ? newIntent.amount
            : typeof local.amount === 'number'
              ? local.amount
              : intent.amount,
        source_chain: newIntent.source_chain || local.source_chain || intent.source_chain,
        target_chain: newIntent.target_chain || local.target_chain || intent.target_chain,
      }
      setIntent(merged)

      if (
        merged.source_token &&
        merged.target_token &&
        merged.amount &&
        merged.source_chain &&
        merged.target_chain
      ) {
        try {
          const sourceChainName = normalizeChainAlias(merged.source_chain)
          const targetChainName = normalizeChainAlias(merged.target_chain)
          const fromChainId = CHAIN_IDS[sourceChainName]
          const toChainId = CHAIN_IDS[targetChainName] ?? fromChainId

          const fromSymbol = normalizeTokenSymbol(merged.source_token)
          const toSymbol = normalizeTokenSymbol(merged.target_token)

          if (!fromChainId) {
            speak('On which source chain should I look?')
            setStatus('idle')
            return
          }
          const [fromToken, toToken] = await Promise.all([
            resolveToken(fromChainId, fromSymbol),
            toChainId ? resolveToken(toChainId, toSymbol) : Promise.resolve(undefined),
          ])

          if (!fromToken || !toToken) {
            const offline = typeof navigator !== 'undefined' && navigator && navigator.onLine === false
            speak(
              offline
                ? 'Network looks offline. Please check your connection and try again.'
                : 'I could not resolve the tokens. Please try again.'
            )
            setStatus('idle')
            return
          }

          if (!toChainId) {
            speak('On which destination chain should I send it?')
            setStatus('idle')
            return
          }
          const msg =
            'You want to ' +
            (fromSymbol === toSymbol && fromChainId !== toChainId ? 'bridge ' : 'swap ') +
            merged.amount +
            ' ' +
            fromSymbol +
            ' on ' +
            (sourceChainName || '') +
            ' to ' +
            toSymbol +
            (toChainId !== fromChainId ? ' on ' + (targetChainName || '') : '') +
            '. Should I proceed to find the best route?'
          setProposal({
            fromChainId,
            toChainId,
            fromSymbol,
            toSymbol,
            amount: merged.amount,
            sourceChainName,
            targetChainName,
            fromTokenAddress: fromToken.address,
            toTokenAddress: toToken.address,
          })
          speak(msg)
          await listenForYesNo()
        } catch (e) {
          console.error(e)
          speak('Something went wrong understanding your request.')
        }
      } else {
        const nextQ = !merged.source_token
          ? 'Which token do you want to swap from?'
          : !merged.target_token
            ? 'Which token do you want to receive?'
            : !merged.amount
              ? 'How much do you want to swap?'
              : !merged.source_chain
                ? 'On which source chain?'
                : !merged.target_chain
                  ? 'On which destination chain?'
                  : ''
        if (nextQ) speak(nextQ)
      }
    } finally {
      setStatus('idle')
    }
  }, [transcribeLang, intent, speak, liveTranscript, isSpecificTokenQuery, extractTokenFromQuery, getSpecificTokenBalance, isWalletHoldingsQuery, extractLocalIntent])

  const processTextInput = useCallback(async () => {
    if (!textInput.trim()) return

    setStatus('processing')
    const text = textInput.trim()
    setTranscript(text)
    setTextInput('')
    setShowTextInput(false)

    try {
      // Check if user is asking for specific token balance
      if (isSpecificTokenQuery(text)) {
        const tokenSymbol = extractTokenFromQuery(text)
        if (tokenSymbol) {
          await getSpecificTokenBalance(tokenSymbol)
        } else {
          speak('Which token balance would you like to check?')
        }
        setStatus('idle')
        return
      }

      // Check if user is asking for wallet holdings
      if (isWalletHoldingsQuery(text)) {
        // Check if wallet is connected via browser
        const eth = typeof window !== 'undefined' ? (window as any).ethereum : null
        if (!eth) {
          speak('Please connect your wallet first to view your holdings.')
        } else {
          try {
            const accounts = await eth.request({ method: 'eth_accounts' })
            if (!accounts || accounts.length === 0) {
              speak('Please connect your wallet first to view your holdings.')
            } else {
              setShowWalletHoldings(true)
              speak('Here are your current wallet holdings.')
            }
          } catch (error) {
            speak('Please connect your wallet first to view your holdings.')
          }
        }
        setStatus('idle')
        return
      }

      const local = extractLocalIntent(text)

      const intentRes = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const { intent: intentStr } = await intentRes.json()
      const newIntent: Intent = JSON.parse(intentStr)

      const merged: Intent = {
        source_token: newIntent.source_token || local.source_token || intent.source_token,
        target_token: newIntent.target_token || local.target_token || intent.target_token,
        amount:
          typeof newIntent.amount === 'number'
            ? newIntent.amount
            : typeof local.amount === 'number'
              ? local.amount
              : intent.amount,
        source_chain: newIntent.source_chain || local.source_chain || intent.source_chain,
        target_chain: newIntent.target_chain || local.target_chain || intent.target_chain,
      }
      setIntent(merged)

      if (
        merged.source_token &&
        merged.target_token &&
        merged.amount &&
        merged.source_chain &&
        merged.target_chain
      ) {
        try {
          const sourceChainName = normalizeChainAlias(merged.source_chain)
          const targetChainName = normalizeChainAlias(merged.target_chain)
          const fromChainId = CHAIN_IDS[sourceChainName]
          const toChainId = CHAIN_IDS[targetChainName] ?? fromChainId

          const fromSymbol = normalizeTokenSymbol(merged.source_token)
          const toSymbol = normalizeTokenSymbol(merged.target_token)

          if (!fromChainId) {
            speak('On which source chain should I look?')
            setStatus('idle')
            return
          }
          const [fromToken, toToken] = await Promise.all([
            resolveToken(fromChainId, fromSymbol),
            toChainId ? resolveToken(toChainId, toSymbol) : Promise.resolve(undefined),
          ])

          if (!fromToken || !toToken) {
            const offline = typeof navigator !== 'undefined' && navigator && navigator.onLine === false
            speak(
              offline
                ? 'Network looks offline. Please check your connection and try again.'
                : 'I could not resolve the tokens. Please try again.'
            )
            setStatus('idle')
            return
          }

          if (!toChainId) {
            speak('On which destination chain should I send it?')
            setStatus('idle')
            return
          }
          const msg =
            'You want to ' +
            (fromSymbol === toSymbol && fromChainId !== toChainId ? 'bridge ' : 'swap ') +
            merged.amount +
            ' ' +
            fromSymbol +
            ' on ' +
            (sourceChainName || '') +
            ' to ' +
            toSymbol +
            (toChainId !== fromChainId ? ' on ' + (targetChainName || '') : '') +
            '. Should I proceed to find the best route?'
          setProposal({
            fromChainId,
            toChainId,
            fromSymbol,
            toSymbol,
            amount: merged.amount,
            sourceChainName,
            targetChainName,
            fromTokenAddress: fromToken.address,
            toTokenAddress: toToken.address,
          })
          speak(msg)
          // Voice confirmation will be handled by the existing system
        } catch (e) {
          console.error(e)
          speak('Something went wrong understanding your request.')
        }
      } else {
        const nextQ = !merged.source_token
          ? 'Which token do you want to swap from?'
          : !merged.target_token
            ? 'Which token do you want to receive?'
            : !merged.amount
              ? 'How much do you want to swap?'
              : !merged.source_chain
                ? 'On which source chain?'
                : !merged.target_chain
                  ? 'On which destination chain?'
                  : ''
        if (nextQ) speak(nextQ)
      }
    } catch (error) {
      console.error('Text processing failed:', error)
      speak('Something went wrong processing your request.')
    } finally {
      setStatus('idle')
    }
  }, [textInput, isWalletHoldingsQuery, speak, extractLocalIntent, intent, normalizeChainAlias, CHAIN_IDS, normalizeTokenSymbol, resolveToken])

  const getSpecificTokenBalance = useCallback(async (tokenSymbol: string) => {
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null
    if (!eth) {
      speak('Please connect your wallet first to check your token balance.')
      return
    }

    try {
      const accounts = await eth.request({ method: 'eth_accounts' })
      if (!accounts || accounts.length === 0) {
        speak('Please connect your wallet first to check your token balance.')
        return
      }

      setStatus('processing')
      speak(`Checking your ${tokenSymbol} balance...`)

      const walletBalances = await getWalletBalances(accounts[0])
      let totalBalance = 0
      let totalUsdValue = 0
      let foundToken = false

      // Search across all chains for the token
      Object.entries(walletBalances).forEach(([chainId, tokens]) => {
        tokens.forEach((token: any) => {
          if (token.symbol?.toUpperCase() === tokenSymbol.toUpperCase()) {
            foundToken = true
            const amount = Number(formatAmountDisplay(token.amount, token.decimals))
            totalBalance += amount
            if (token.priceUSD) {
              totalUsdValue += amount * Number(token.priceUSD)
            }
          }
        })
      })

      if (!foundToken) {
        speak(`You don't have any ${tokenSymbol} tokens in your wallet.`)
      } else {
        let response = `You have ${totalBalance.toLocaleString()} ${tokenSymbol}`
        if (totalUsdValue > 0) {
          response += ` worth approximately $${totalUsdValue.toFixed(2)}`
        }
        response += ' in your wallet.'
        speak(response)
      }
    } catch (error) {
      console.error('Failed to get token balance:', error)
      speak(`Sorry, I couldn't check your ${tokenSymbol} balance. Please try again.`)
    } finally {
      setStatus('idle')
    }
  }, [speak])

  // Real-time speech recognition for live transcription
  const startLiveTranscription = useCallback(() => {
    if (typeof window === 'undefined' || (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window))) {
      console.warn('Speech recognition not supported in this browser')
      return null
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsTranscribing(true)
      setLiveTranscript('')
    }

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      setLiveTranscript(finalTranscript + interimTranscript)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsTranscribing(false)
    }

    recognition.onend = () => {
      setIsTranscribing(false)
    }

    return recognition
  }, [])

  // Listen for available routes and selection to show a small best route card
  useEffect(() => {
    const onAvailable = (routes: Route[]) => {
      if (routes && routes.length > 0) setBestRoute(routes[0])
    }
    const onSelected = ({ route }: { route: Route }) => {
      setBestRoute(route)
    }
    widgetEvents.on(WidgetEvent.AvailableRoutes, onAvailable)
    widgetEvents.on(WidgetEvent.RouteSelected, onSelected)
    return () => {
      widgetEvents.off(WidgetEvent.AvailableRoutes, onAvailable)
      widgetEvents.off(WidgetEvent.RouteSelected, onSelected)
    }
  }, [widgetEvents])

  // Passive voice confirmation for execution (declare before effect to avoid TDZ)
  const listenForExecYesNo = useCallback(async () => {
    if (!execProposal) return
    setStatus('listening')
    const rec = await recordAudio()
    rec.start()
    await new Promise((r) => setTimeout(r, 3000))
    const blob = await rec.stop()
    setStatus('processing')
    const fd = new FormData()
    fd.append('file', blob, 'confirm-exec.webm')
    fd.append('lang', transcribeLang)
    const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
    const { text } = await res.json()
    const t = (text || '').toLowerCase().trim()
    const yes = /^(yes|yeah|yup|ok|okay|sure|confirm|do it|execute|go ahead)\b/.test(t)
    const no = /^(no|nah|nope|cancel|stop|not now)\b/.test(t)
    if (yes) {
      handleExecConfirm()
    } else if (no) {
      handleExecCancel()
    } else {
      speak('Please say yes or no.')
    }
    setStatus('idle')
  }, [execProposal, transcribeLang, speak])

  // When best route becomes available, offer chain-specific recipient/connect prompts, then propose execution
  useEffect(() => {
    if (!bestRoute || execAsking || execStatus === 'executing') return
    if (lastPromptedRouteIdRef.current === bestRoute.id) return
    // Only prompt when we have just applied a search (i.e., after proposal confirm)
    // Heuristic: when lastApplied matches current intent summary, we can offer execution
    const info = getBestDexInfo(bestRoute)
    const dex = info?.name || 'the best available route'
    const fromSym = bestRoute.fromToken?.symbol || 'token'
    const toSym = bestRoute.toToken?.symbol || 'token'
    const msg = `I found the best route via ${dex}. Swap ${fromSym} to ${toSym}.`
    setExecProposal(bestRoute)
    setExecAsking(true)
    lastPromptedRouteIdRef.current = bestRoute.id
    speak(msg)
    const toIsSol = bestRoute.toChainId === ChainId.SOL
    const fromIsSol = bestRoute.fromChainId === ChainId.SOL
    if (fromIsSol) {
      setSolPromptMode('source')
      setSolPromptVisible(true)
      speak('Please connect a Solana wallet to proceed.')
      return
    }
    if (toIsSol) {
      setSolPromptMode('dest')
      setSolPromptVisible(true)
      speak('Destination is Solana. Connect a wallet or paste a Solana address.')
      return
    }
    // EVM-only: offer ENS once per route
    if (lastEnsPromptedRouteIdRef.current !== bestRoute.id) {
      lastEnsPromptedRouteIdRef.current = bestRoute.id
      setEnsPromptVisible(true)
      speak('Do you want to send to an ENS name? You can type or spell it.')
      return
    }
    // Otherwise, proceed to confirmation
    listenForExecYesNo()
    // We do not auto-listen here to avoid interrupting user; provide quick confirm UI and allow voice confirm via space again
    // Users can press Space to answer; but we also provide a small confirm bar below.
  }, [bestRoute, execAsking, execStatus, speak, listenForExecYesNo])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Handle spacebar for voice recording (only when not in text input mode)
      if (e.code === 'Space' || e.key === ' ') {
        if (showTextInput || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        if (keyDownRef.current) return
        keyDownRef.current = true
        e.preventDefault()
        startRecording()
      }

      // Handle 'T' key to toggle text input
      if (e.key === 't' || e.key === 'T') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        if (status !== 'idle') return
        e.preventDefault()
        setShowTextInput(!showTextInput)
      }

      // Handle Enter key to process text input
      if (e.key === 'Enter' && showTextInput) {
        e.preventDefault()
        processTextInput()
      }

      // Handle Escape key to close text input
      if (e.key === 'Escape' && showTextInput) {
        e.preventDefault()
        setShowTextInput(false)
        setTextInput('')
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        if (showTextInput || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        if (!keyDownRef.current) return
        keyDownRef.current = false
        e.preventDefault()
        stopAndProcess()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [startRecording, stopAndProcess, showTextInput, status, processTextInput])

  const listenForYesNo = useCallback(async () => {
    if (!proposal) return
    setStatus('listening')
    const rec = await recordAudio()
    rec.start()
    await new Promise((r) => setTimeout(r, 3000))
    const blob = await rec.stop()
    setStatus('processing')
    const fd = new FormData()
    fd.append('file', blob, 'confirm.webm')
    fd.append('lang', transcribeLang)
    const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
    const { text } = await res.json()
    const t = (text || '').toLowerCase().trim()
    const yes = /^(yes|yeah|yup|ok|okay|sure|confirm|do it|go ahead)\b/.test(t)
    const no = /^(no|nah|nope|cancel|stop|not now)\b/.test(t)
    if (yes) {
      handleConfirm()
    } else if (no) {
      handleCancel()
    } else {
      speak('Please say yes or no.')
    }
    setStatus('idle')
  }, [proposal, transcribeLang, speak])

  // moved listenForExecYesNo above

  const handleConfirm = () => {
    if (!proposal) return
    // Avoid invalid same-token same-chain combination which yields no route
    if (
      proposal.fromChainId === proposal.toChainId &&
      proposal.fromTokenAddress.toLowerCase() ===
      proposal.toTokenAddress.toLowerCase()
    ) {
      speak('That is the same token on the same chain. Please change the token or destination chain.')
      return
    }
    formRef.current?.setFieldValue('fromChain', proposal.fromChainId)
    formRef.current?.setFieldValue('fromToken', proposal.fromTokenAddress)
    formRef.current?.setFieldValue('fromAmount', String(proposal.amount))
    formRef.current?.setFieldValue('toChain', proposal.toChainId)
    formRef.current?.setFieldValue('toToken', proposal.toTokenAddress)
    setLastApplied({
      fromChainId: proposal.fromChainId,
      toChainId: proposal.toChainId,
      fromSymbol: proposal.fromSymbol,
      toSymbol: proposal.toSymbol,
      amount: proposal.amount,
      sourceChainName: proposal.sourceChainName,
      targetChainName: proposal.targetChainName,
    })
    speak('Confirmed. Finding the best route for your swap now.')
    setProposal(null)
  }

  const handleCancel = () => {
    setProposal(null)
    speak('Okay. What would you like to change?')
  }

  const handleExecConfirm = async () => {
    if (!execProposal) return
    try {
      const info = getBestDexInfo(execProposal)
      const dex = info?.name || 'the selected route'

      // Basic wallet presence + connection + chain checks
      const eth: EIP1193Provider | null =
        typeof window !== 'undefined'
          ? ((window as unknown as { ethereum?: EIP1193Provider }).ethereum || null)
          : null
      const fromIsSol = execProposal.fromChainId === ChainId.SOL
      const toIsSol = execProposal.toChainId === ChainId.SOL
      if (fromIsSol) {
        const sol = (typeof window !== 'undefined' && (window as any).solana) || null
        if (!sol) {
          speak('No Solana wallet detected. Please install Phantom or connect in the widget.')
          setSolPromptMode('source')
          setSolPromptVisible(true)
          return
        }
        try {
          const resp = await sol.connect?.()
          if (!resp?.publicKey) {
            speak('Please connect your Solana wallet to continue.')
            setSolPromptMode('source')
            setSolPromptVisible(true)
            return
          }
        } catch {
          speak('Solana wallet connection was cancelled.')
          setSolPromptMode('source')
          setSolPromptVisible(true)
          return
        }
      }
      if (!fromIsSol) {
        if (!eth) {
          speak('No EVM wallet detected. Please use the widget to connect your wallet and try again.')
          return
        }
      }
      try {
        if (!fromIsSol && eth) {
          const accounts = ((await eth.request({ method: 'eth_accounts' })) || []) as string[]
          if (!accounts.length) {
            speak('Please connect your wallet using the widget and try again.')
            return
          }
        }

        const ensureChain = async (targetChainId: number) => {
          const readChainId = async () => {
            const hex = (await eth!.request({ method: 'eth_chainId' })) as string
            return parseInt(hex, 16)
          }
          const current = await readChainId()
          if (current === targetChainId) return true
          try {
            await eth!.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x' + targetChainId.toString(16) }],
            })
          } catch (switchErr) {
            console.warn('wallet_switchEthereumChain failed:', switchErr)
            return false
          }
          // Wait until provider and wagmi observers sync chain
          const ok = await new Promise<boolean>((resolve) => {
            let settled = false
            const timeout = setTimeout(async () => {
              if (settled) return
              const c = await readChainId()
              settled = true
              resolve(c === targetChainId)
            }, 1200)
            // Some providers emit chainChanged; listen once
            const handler = (chainIdHex: string | number) => {
              if (settled) return
              const id = typeof chainIdHex === 'string' ? parseInt(chainIdHex, 16) : Number(chainIdHex)
              if (id === targetChainId) {
                settled = true
                clearTimeout(timeout)
                resolve(true)
              }
            }
            // Try to subscribe to provider events if available
            // Attach listener if provider supports events
            const prov = eth as unknown as {
              on?: (event: string, cb: (arg: unknown) => void) => void
            }
            prov.on?.('chainChanged', (cid) => handler(cid as string | number))
          })
          return ok
        }

        if (!fromIsSol) {
          const aligned = await ensureChain(execProposal.fromChainId)
          if (!aligned) {
            speak('Please switch your wallet network to the source chain and try again.')
            return
          }
        }
      } catch (preErr) {
        console.warn('Wallet pre-check failed:', preErr)
      }

      if (toIsSol && !solRecipientSet) {
        // If Phantom is connected, use its public key as recipient by default
        const sol = (typeof window !== 'undefined' && (window as any).solana) || null
        const pub = sol?.publicKey?.toString?.()
        if (pub) {
          formRef.current?.setFieldValue('toAddress', pub)
          setSolRecipientSet(true)
        } else {
          speak('Please provide a Solana address to receive funds.')
          setSolPromptMode('dest')
          setSolPromptVisible(true)
          return
        }
      }

      speak(`Starting the swap via ${dex}. Please confirm the transaction in your wallet.`)
      await execute(execProposal)
      speak('Swap executed successfully.')
      // Clear execution state after success
      setExecProposal(null)
      setExecAsking(false)
      resetExec()
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e)
      console.error('Route execution failed:', e)
      const ml = m.toLowerCase()
      const msg = ml.includes('not connected') || ml.includes('account is not connected')
        ? 'Please connect your wallet to execute the swap.'
        : ml.includes('user rejected') || ml.includes('user rejected the request')
          ? 'Transaction rejected in wallet.'
          : 'Execution failed. Please try again.'
      speak(msg)
    }
  }

  const handleExecCancel = () => {
    setExecAsking(false)
    setExecProposal(null)
    if (execStatus === 'executing') {
      speak('Execution is already in progress.')
    } else {
      speak('Okay, I will not execute the swap.')
    }
  }

  // Voice spelling helper for ENS input
  const spellEnsByVoice = useCallback(async (setter: (value: string) => void) => {
    try {
      setStatus('listening')
      const rec = await recordAudio()
      rec.start()
      await new Promise((r) => setTimeout(r, 3000))
      const blob = await rec.stop()
      setStatus('processing')
      const fd = new FormData()
      fd.append('file', blob, 'ens-spell.webm')
      fd.append('lang', transcribeLang)
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const { text } = await res.json()
      const normalized = (() => {
        const raw = (text || '').toLowerCase()
        // convert common words to symbols and remove spaces
        let s = raw
          .replace(/\bdot\b/g, '.')
          .replace(/\bdash\b/g, '-')
          .replace(/\bminus\b/g, '-')
          .replace(/\s+/g, '')
        // ensure .eth suffix if user said 'eth'
        if (!/\.eth$/.test(s)) {
          const idx = s.indexOf('eth')
          if (idx !== -1) s = s.slice(0, idx) + '.eth'
        }
        // strip illegal characters
        s = s.replace(/[^a-z0-9.-]/g, '')
        return s
      })()
      if (normalized) setter(normalized)
    } finally {
      setStatus('idle')
    }
  }, [transcribeLang])

  return (
    <div className="va-root" aria-live="polite">
      <div className="va-container">
        <div className="va-left">
          <div className={
            'va-orb' +
            (status === 'listening' ? ' listening' : '') +
            (status === 'processing' ? ' processing' : '')
          }>
            <span className="ring r1" />
            <span className="ring r2" />
            <span className="ring r3" />
            <span className="core" />
          </div>
          <div className="va-text">
            <div className="va-title">
              {status === 'idle' ? 'POHA 🥘 ' : status === 'listening' ? 'Listening…' : 'Thinking…'}
            </div>
            <div className="va-subtitle">
              {status === 'listening' ? (
                liveTranscript ? (
                  <span className="va-live-transcript">
                    {liveTranscript}
                    <span className="va-cursor">|</span>
                  </span>
                ) : (
                  <span className="va-dots"><span />
                    <span />
                    <span />
                  </span>
                )
              ) : status === 'processing' ? (
                <span className="va-dots"><span />
                  <span />
                  <span />
                </span>
              ) : (
                transcript ? 'You said: ' + transcript : 'Press Space to talk or T to type'
              )}
            </div>
          </div>
        </div>
        <div className="va-actions">
          <button
            className={"va-mic" + (status === 'listening' ? ' active' : '')}
            onMouseDown={startRecording}
            onMouseUp={stopAndProcess}
            onTouchStart={startRecording}
            onTouchEnd={stopAndProcess}
            aria-label="Push to talk (hold Space)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 18v3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            className={"va-keyboard" + (showTextInput ? ' active' : '')}
            onClick={() => setShowTextInput(!showTextInput)}
            aria-label="Type text (press T)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h.01M14 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {showTextInput && (
        <div className="va-text-input">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                processTextInput()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setShowTextInput(false)
                setTextInput('')
              }
            }}
            placeholder="Type your message here... (Enter to send, Esc to close)"
            autoFocus
            className="va-text-field"
          />
          <div className="va-text-actions">
            <button
              onClick={processTextInput}
              disabled={!textInput.trim()}
              className="va-btn primary small"
            >
              Send
            </button>
            <button
              onClick={() => {
                setShowTextInput(false)
                setTextInput('')
              }}
              className="va-btn secondary small"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {proposal ? (
        <div className="va-confirm">
          <div className="va-confirm-text">
            Confirm swap {proposal.amount} {proposal.fromSymbol} on {proposal.sourceChainName || 'ethereum'} to {proposal.toSymbol}
            {proposal.toChainId !== proposal.fromChainId ? ' on ' + (proposal.targetChainName || '') : ''}?
          </div>
          <div className="va-confirm-actions">
            <button className="va-btn secondary" onClick={handleCancel}>Change</button>
            <button className="va-btn primary" onClick={handleConfirm}>Confirm</button>
          </div>
        </div>
      ) : null}

      {execProposal && !ensPromptVisible && !solPromptVisible ? (
        <div className="va-confirm" style={{ marginTop: 10 }}>
          <div className="va-confirm-text">
            Execute best route via {getBestDexInfo(execProposal)?.name || 'selected route'}?
          </div>
          <div className="va-confirm-actions">
            <button className="va-btn secondary" onClick={handleExecCancel}>Later</button>
            <button className="va-btn primary" onClick={handleExecConfirm} disabled={execStatus === 'executing'}>
              {execStatus === 'executing' ? 'Executing…' : 'Execute'}
            </button>
          </div>
        </div>
      ) : null}

      {/* ENS recipient flow card */}
      <ENSRecipientPrompt
        visible={ensPromptVisible}
        onCancel={() => {
          setEnsPromptVisible(false)
          // After skipping ENS, proceed to ask for execution
          listenForExecYesNo()
        }}
        onConfirm={(address) => {
          // Set widget recipient and execute
          formRef.current?.setFieldValue('toAddress', address)
          setEnsPromptVisible(false)
          speak('ENS recipient set. Proceeding to execute.')
          handleExecConfirm()
        }}
        onSpell={spellEnsByVoice}
      />

      {/* Solana requirements prompt */}
      <SolanaPrompt
        visible={solPromptVisible}
        mode={solPromptMode}
        onCancel={() => {
          setSolPromptVisible(false)
          if (solPromptMode === 'dest') {
            speak('You can add a Solana address later in the widget. I will not execute now.')
          } else {
            speak('Connect a Solana wallet in the widget to continue.')
          }
        }}
        onConfirm={(address) => {
          if (solPromptMode === 'dest' && address) {
            formRef.current?.setFieldValue('toAddress', address)
            setSolRecipientSet(true)
            setSolPromptVisible(false)
            speak('Solana recipient set. Proceeding to execute.')
            handleExecConfirm()
          } else {
            setSolPromptVisible(false)
            speak('Solana wallet connected. You can proceed.')
            listenForExecYesNo()
          }
        }}
      />

      <BestRouteCard route={bestRoute} />

      <WalletHoldings
        visible={showWalletHoldings}
        onClose={() => setShowWalletHoldings(false)}
      />

      <DebugPanel intent={intent} proposal={proposal} lastApplied={lastApplied} />

      <style jsx>{`
        .va-root { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); width: min(820px, calc(100% - 24px)); z-index: 50; pointer-events: none; }
        .va-container { pointer-events: auto; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; border-radius: 16px; background: rgba(18,18,20,0.55); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 6px 24px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.02); backdrop-filter: blur(12px) saturate(1.2); -webkit-backdrop-filter: blur(12px) saturate(1.2); color: #e7e7ea; font-family: inherit; }
        .va-left { display: flex; gap: 12px; align-items: center; min-width: 0; }
        .va-text { overflow: hidden; }
        .va-title { font-weight: 600; font-size: 14px; letter-spacing: .02em; text-transform: uppercase; opacity: .95; }
        .va-subtitle { font-size: 13px; opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .va-actions { display: flex; gap: 8px; }
        .va-mic, .va-stop { width: 44px; height: 44px; border-radius: 999px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,0.12); color: #fff; cursor: pointer; transition: transform .12s ease, background .2s ease, box-shadow .2s ease; }
        .va-mic { background: radial-gradient(100% 100% at 0% 0%, #4F46E5 0%, #0EA5E9 100%); box-shadow: 0 6px 16px rgba(14,165,233,0.35); }
        .va-mic:hover { transform: translateY(-1px); }
        .va-stop { background: rgba(244,63,94,0.85); box-shadow: 0 6px 16px rgba(244,63,94,0.35); }
        .va-stop:hover { transform: translateY(-1px); }
        .va-keyboard { width: 44px; height: 44px; border-radius: 999px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,0.12); color: #fff; cursor: pointer; transition: transform .12s ease, background .2s ease, box-shadow .2s ease; background: rgba(255,255,255,0.08); }
        .va-keyboard:hover { transform: translateY(-1px); background: rgba(255,255,255,0.12); }
        .va-keyboard.active { background: radial-gradient(100% 100% at 0% 0%, #10b981 0%, #059669 100%); box-shadow: 0 6px 16px rgba(16,185,129,0.35); }
        .va-orb { position: relative; width: 40px; height: 40px; }
        .va-orb .core { position: absolute; inset: 8px; border-radius: 999px; background: radial-gradient(100% 100% at 30% 30%, #89f 0%, #59f 30%, #3b82f6 70%, #0ea5e9 100%); box-shadow: inset 0 0 20px rgba(255,255,255,0.5), 0 2px 10px rgba(59,130,246,0.35); animation: orb-breathe 2.4s ease-in-out infinite; }
        .va-orb.listening .core { animation-duration: 1.6s; }
        .va-orb.processing .core { filter: saturate(1.2) brightness(1.1); }
        .va-orb .ring { position: absolute; inset: 0; border-radius: 999px; border: 2px solid rgba(99,102,241,0.35); }
        .va-orb .r1 { animation: ring-pulse 2.2s ease-in-out infinite; }
        .va-orb .r2 { animation: ring-pulse 2.2s ease-in-out .4s infinite; }
        .va-orb .r3 { animation: ring-pulse 2.2s ease-in-out .8s infinite; }
        .va-dots { display: inline-flex; gap: 4px; }
        .va-dots span { width: 6px; height: 6px; background: #cbd5e1; opacity: .8; border-radius: 999px; display: inline-block; animation: dot 1.2s infinite ease-in-out; }
        .va-dots span:nth-child(2) { animation-delay: .15s; }
        .va-dots span:nth-child(3) { animation-delay: .3s; }
        .va-confirm { pointer-events: auto; margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(18,18,20,0.6); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
        .va-confirm-text { font-size: 13px; opacity: .9; }
        .va-confirm-actions { display: flex; gap: 8px; }
        .va-btn { pointer-events: auto; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); color: #fff; cursor: pointer; font-size: 13px; }
        .va-btn.primary { background: linear-gradient(135deg, #4F46E5 0%, #0EA5E9 100%); }
        .va-btn.secondary { background: rgba(255,255,255,0.08); }
        .va-btn[disabled] { opacity: .6; cursor: not-allowed; }
        .va-btn.small { padding: 6px 12px; font-size: 12px; }
        .va-text-input { pointer-events: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 14px; background: rgba(18,18,20,0.6); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
        .va-text-field { width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; background: rgba(255,255,255,0.05); color: #fff; font-size: 14px; font-family: inherit; }
        .va-text-field:focus { outline: none; border-color: #4F46E5; box-shadow: 0 0 0 2px rgba(79,70,229,0.2); }
        .va-text-field::placeholder { color: rgba(255,255,255,0.5); }
        .va-text-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .va-live-transcript { color: #10b981; font-weight: 500; }
        .va-cursor { animation: blink 1s infinite; color: #10b981; }
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        /* debug panel styles live in DebugPanel */
        @keyframes orb-breathe { 0%,100% { transform: scale(.96) } 50% { transform: scale(1.08) } }
        @keyframes ring-pulse { 0% { transform: scale(1); opacity: .35 } 70% { transform: scale(1.6); opacity: 0 } 100% { opacity: 0 } }
        @keyframes dot { 0%, 60%, 100% { transform: translateY(0); opacity: .8 } 30% { transform: translateY(-3px); opacity: 1 } }
      `}</style>
      <style jsx>{`
        .va-mic.active { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 8px 18px rgba(14,165,233,0.45); }
      `}</style>
    </div>
  )
}
