'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { recordAudio } from '../utils/recorder'

export default function VoiceTest() {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing'>('idle')
  const [transcript, setTranscript] = useState('')
  const [allTranscripts, setAllTranscripts] = useState<string[]>([])
  const recorderRef = useRef<Awaited<ReturnType<typeof recordAudio>> | null>(null)
  const keyDownRef = useRef(false)

  const startRecording = useCallback(async () => {
    if (status !== 'idle') return
    try {
      setStatus('listening')
      const rec = await recordAudio()
      recorderRef.current = rec
      rec.start()
    } catch (e) {
      console.error('Recording failed:', e)
      setStatus('idle')
    }
  }, [status])

  const stopAndProcess = useCallback(async () => {
    const rec = recorderRef.current
    if (!rec) return

    try {
      setStatus('processing')
      const audioBlob = await rec.stop()
      recorderRef.current = null

      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')
      formData.append('lang', 'en')

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const { text } = await res.json()

      setTranscript(text)
      if (text.trim()) {
        setAllTranscripts(prev => [...prev, text])
      }
    } catch (error) {
      console.error('Transcription failed:', error)
      setTranscript('Error: Failed to transcribe audio')
    } finally {
      setStatus('idle')
    }
  }, [])

  // Handle spacebar press and release
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Handle spacebar for voice recording
      if (e.code === 'Space' || e.key === ' ') {
        // Don't interfere if user is typing in textarea
        if (e.target instanceof HTMLTextAreaElement) return
        if (keyDownRef.current) return
        keyDownRef.current = true
        e.preventDefault()
        startRecording()
      }

      // Handle Enter key for adding text (Ctrl+Enter or Cmd+Enter)
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (transcript.trim()) {
          setAllTranscripts(prev => [...prev, transcript])
          setTranscript('')
        }
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        // Don't interfere if user is typing in textarea
        if (e.target instanceof HTMLTextAreaElement) return
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
  }, [startRecording, stopAndProcess, transcript])

  const clearTranscripts = () => {
    setAllTranscripts([])
    setTranscript('')
  }

  return (
    <div className="voice-test-container">
      <div className="voice-test-card">
        <h2>Voice to Text Test</h2>

        <div className="status-indicator">
          <div className={`status-orb ${status}`}>
            <span className="orb-core" />
            {status === 'listening' && (
              <>
                <span className="pulse-ring ring-1" />
                <span className="pulse-ring ring-2" />
                <span className="pulse-ring ring-3" />
              </>
            )}
          </div>
          <div className="status-text">
            {status === 'idle' && 'Press and hold Space to talk, or type text below'}
            {status === 'listening' && 'Listening... (release Space to stop)'}
            {status === 'processing' && 'Processing...'}
          </div>
        </div>

        <div className="transcript-section">
          <label htmlFor="current-transcript">
            Current Transcript:
            <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'normal', marginLeft: '8px' }}>
              (Ctrl+Enter to add to history)
            </span>
          </label>
          <textarea
            id="current-transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Your speech will appear here, or type your own text..."
            rows={3}
          />
        </div>

        <div className="controls">
          <button
            className={`talk-button ${status === 'listening' ? 'active' : ''}`}
            onMouseDown={startRecording}
            onMouseUp={stopAndProcess}
            onTouchStart={startRecording}
            onTouchEnd={stopAndProcess}
            disabled={status === 'processing'}
          >
            {status === 'listening' ? '🎤 Recording...' : '🎤 Hold to Talk'}
          </button>

          <button
            onClick={() => {
              if (transcript.trim()) {
                setAllTranscripts(prev => [...prev, transcript])
                setTranscript('')
              }
            }}
            className="add-text-button"
            disabled={!transcript.trim()}
          >
            ✏️ Add Text
          </button>

          <button onClick={clearTranscripts} className="clear-button">
            Clear All
          </button>
        </div>

        {allTranscripts.length > 0 && (
          <div className="history-section">
            <h3>Speech History:</h3>
            <div className="transcript-history">
              {allTranscripts.map((text, index) => (
                <div key={index} className="transcript-item">
                  <span className="transcript-number">{index + 1}.</span>
                  <span className="transcript-text">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .voice-test-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
          background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
        }

        .voice-test-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 30px;
          max-width: 600px;
          width: 100%;
          backdrop-filter: blur(10px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .voice-test-card h2 {
          color: #fff;
          text-align: center;
          margin-bottom: 30px;
          font-size: 24px;
          font-weight: 600;
        }

        .status-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 30px;
        }

        .status-orb {
          position: relative;
          width: 80px;
          height: 80px;
          margin-bottom: 15px;
        }

        .orb-core {
          position: absolute;
          inset: 20px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #4f46e5, #0ea5e9);
          transition: all 0.3s ease;
        }

        .status-orb.listening .orb-core {
          background: radial-gradient(circle at 30% 30%, #ef4444, #f97316);
          animation: pulse 1s ease-in-out infinite;
        }

        .status-orb.processing .orb-core {
          background: radial-gradient(circle at 30% 30%, #eab308, #f59e0b);
          animation: spin 1s linear infinite;
        }

        .pulse-ring {
          position: absolute;
          inset: 0;
          border: 2px solid rgba(239, 68, 68, 0.3);
          border-radius: 50%;
          animation: pulse-ring 2s ease-out infinite;
        }

        .ring-1 { animation-delay: 0s; }
        .ring-2 { animation-delay: 0.5s; }
        .ring-3 { animation-delay: 1s; }

        .status-text {
          color: #e5e7eb;
          font-size: 16px;
          text-align: center;
          font-weight: 500;
        }

        .transcript-section {
          margin-bottom: 25px;
        }

        .transcript-section label {
          display: block;
          color: #d1d5db;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .transcript-section textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          font-size: 14px;
          resize: vertical;
          min-height: 80px;
        }

        .transcript-section textarea:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
        }

        .controls {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin-bottom: 30px;
        }

        .talk-button {
          padding: 12px 24px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #4f46e5, #0ea5e9);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        }

        .talk-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(79, 70, 229, 0.3);
        }

        .talk-button.active {
          background: linear-gradient(135deg, #ef4444, #f97316);
          animation: pulse 1s ease-in-out infinite;
        }

        .talk-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .clear-button {
          padding: 12px 20px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.1);
          color: #e5e7eb;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .clear-button:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .add-text-button {
          padding: 12px 20px;
          border: 1px solid rgba(34, 197, 94, 0.5);
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2));
          color: #10b981;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .add-text-button:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(16, 185, 129, 0.3));
          border-color: rgba(34, 197, 94, 0.7);
          transform: translateY(-1px);
        }

        .add-text-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none;
        }

        .history-section {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 25px;
        }

        .history-section h3 {
          color: #d1d5db;
          margin-bottom: 15px;
          font-size: 18px;
          font-weight: 600;
        }

        .transcript-history {
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.2);
        }

        .transcript-item {
          display: flex;
          padding: 12px 15px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .transcript-item:last-child {
          border-bottom: none;
        }

        .transcript-number {
          color: #9ca3af;
          margin-right: 10px;
          font-weight: 600;
          min-width: 25px;
        }

        .transcript-text {
          color: #e5e7eb;
          flex: 1;
          line-height: 1.4;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }

        /* Scrollbar styling */
        .transcript-history::-webkit-scrollbar {
          width: 6px;
        }

        .transcript-history::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }

        .transcript-history::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        .transcript-history::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  )
}