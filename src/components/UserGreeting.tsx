'use client'

import { useEffect, useState } from 'react'

type User = { name?: string; identifier?: string; verifiedAt?: string }

export function UserGreeting() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('poha_user')
      if (raw) setUser(JSON.parse(raw))
    } catch {}
  }, [])

  if (!user?.name) return null

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 20,
      zIndex: 1000,
      padding: '8px 12px',
      borderRadius: 10,
      color: '#e7e7ea',
      background: 'rgba(18,18,24,0.6)',
      border: '1px solid rgba(255,255,255,0.12)',
      backdropFilter: 'blur(10px)'
    }}>
      Welcome, {user.name}
    </div>
  )
}

