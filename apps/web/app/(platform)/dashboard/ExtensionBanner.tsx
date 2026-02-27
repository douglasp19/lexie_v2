// @route apps/web/app/(platform)/dashboard/ExtensionBanner.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export function ExtensionBanner() {
  const [visible,  setVisible]  = useState(false)
  const [detected, setDetected] = useState(false)

  useEffect(() => {
    // Só mostra se o usuário ainda não dispensou
    const dismissed = localStorage.getItem('lexie_ext_banner_dismissed')
    if (dismissed) return

    // Aguarda 1s para checar se extensão responde
    const timeout = setTimeout(() => {
      if (!detected) setVisible(true)
    }, 1000)

    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'LEXIE_EXTENSION_READY') {
        setDetected(true)
        setVisible(false)
        clearTimeout(timeout)
      }
    }
    window.addEventListener('message', handler)
    window.postMessage({ type: 'LEXIE_PING' }, '*')

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('message', handler)
    }
  }, [detected])

  function dismiss() {
    localStorage.setItem('lexie_ext_banner_dismissed', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.875rem',
      padding: '0.875rem 1.1rem',
      background: 'linear-gradient(135deg, var(--green-light) 0%, #f0f7f0 100%)',
      border: '1px solid rgba(76,175,80,0.25)',
      borderRadius: 'var(--radius)',
      marginBottom: '1.25rem',
    }}>
      <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🧩</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.15rem' }}>
          Instale a extensão para gravar consultas
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)', lineHeight: 1.5 }}>
          Grave o áudio direto do seu navegador durante videochamadas.
        </div>
      </div>
      <Link href="/onboarding" className="btn-primary" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
        Instalar agora
      </Link>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '1.1rem', lineHeight: 1, flexShrink: 0, padding: '0.2rem' }}>
        ×
      </button>
    </div>
  )
}