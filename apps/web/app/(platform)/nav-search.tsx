// @route apps/web/app/(platform)/nav-search.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NavSearch() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && query.trim()) {
      router.push(`/patients?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      background: 'white', border: '1.5px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '0.42rem 0.875rem',
      width: 240, transition: 'border-color 0.2s',
    }}>
      <span style={{ fontSize: '0.85rem' }}>🔍</span>
      <input
        placeholder="Buscar paciente…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          border: 'none', background: 'none', outline: 'none',
          fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem',
          color: 'var(--text)', width: '100%',
        }}
      />
    </div>
  )
}