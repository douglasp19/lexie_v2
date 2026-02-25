// @route apps/web/app/(platform)/session/new/page.tsx
'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Patient { id: string; name: string; email: string | null; birth_date: string | null }

function NewSessionForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const prefillId   = searchParams.get('patientId')
  const prefillName = searchParams.get('patientName')

  const [sessionType,    setSessionType]    = useState<'online' | 'presencial'>('online')
  const [patientId,      setPatientId]      = useState(prefillId ?? '')
  const [patientName,    setPatientName]    = useState(prefillName ?? '')
  const [query,          setQuery]          = useState(prefillName ?? '')
  const [suggestions,    setSuggestions]    = useState<Patient[]>([])
  const [showSuggestions,setShowSuggestions]= useState(false)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const dropRef = useRef<HTMLDivElement>(null)

  // Search patients as user types
  useEffect(() => {
    if (query.length < 2 || patientId) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      const res  = await fetch(`/api/patients?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setSuggestions(data.patients ?? [])
      setShowSuggestions(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, patientId])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selectPatient(p: Patient) {
    setPatientId(p.id); setPatientName(p.name); setQuery(p.name); setShowSuggestions(false)
  }

  function clearPatient() {
    setPatientId(''); setPatientName(''); setQuery('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = patientId ? patientName : query.trim()
    if (!name) { setError('Informe o nome do paciente.'); return }
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name: name,
          session_type: sessionType,
          patient_id:   patientId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/session/${data.session.id}`)
    } catch (err: any) {
      setError(err.message); setLoading(false)
    }
  }

  return (
    <div className="fade-up" style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text3)', marginBottom: '1.5rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>Dashboard</Link>
        <span>›</span>
        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>Nova Consulta</span>
      </div>

      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Nova Consulta</h1>
      <p style={{ fontSize: '0.83rem', color: 'var(--text3)', marginBottom: '1.75rem' }}>
        Busque um paciente cadastrado ou digite um nome para criar uma consulta avulsa.
      </p>

      <div className="card" style={{ padding: '1.75rem' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Patient search */}
            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: '0.45rem' }}>Paciente</label>
              <div ref={dropRef} style={{ position: 'relative' }}>
                {patientId ? (
                  /* Selected patient chip */
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.55rem 0.875rem',
                    background: 'var(--green-light)', border: '1.5px solid rgba(76,175,80,0.3)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: 'var(--green)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'white',
                      }}>
                        {patientName.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}
                      </div>
                      <span style={{ fontSize: '0.87rem', fontWeight: 600, color: 'var(--green-dark)' }}>{patientName}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--green-dark)', opacity: 0.7 }}>Cadastrado</span>
                    </div>
                    <button type="button" onClick={clearPatient} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green-dark)', fontSize: '0.8rem', opacity: 0.6 }}>×</button>
                  </div>
                ) : (
                  <input
                    className="input"
                    placeholder="Buscar por nome ou digitar novo…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    autoFocus
                  />
                )}

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99,
                    background: 'white', border: '1.5px solid var(--border)',
                    borderTop: 'none', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                    boxShadow: 'var(--shadow-md)', maxHeight: 200, overflowY: 'auto',
                  }}>
                    {suggestions.map(p => (
                      <div key={p.id} onClick={() => selectPatient(p)} style={{
                        padding: '0.65rem 0.875rem', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', gap: '0.625rem',
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-light)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--green-light)', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--green-dark)',
                        }}>
                          {p.name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.87rem', fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                          {p.email && <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{p.email}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '0.35rem' }}>
                Digite para buscar pacientes cadastrados, ou continue com um nome avulso.{' '}
                <Link href="/patients/new" style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>
                  Cadastrar novo →
                </Link>
              </p>
            </div>

            {/* Session type */}
            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: '0.45rem' }}>Tipo de Consulta</label>
              <select className="input" value={sessionType} onChange={e => setSessionType(e.target.value as any)}>
                <option value="online">🌐 Online (Google Meet, Zoom, Teams…)</option>
                <option value="presencial">🏥 Presencial</option>
              </select>
            </div>

            {error && (
              <div style={{ padding: '0.65rem', background: 'var(--red-light)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
              <Link href="/dashboard" className="btn-secondary">Cancelar</Link>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <><span className="spinner" /> Criando…</> : 'Criar Consulta →'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div style={{ marginTop: '1.25rem', padding: '0.875rem 1rem', background: 'var(--gold-light)', border: '1px solid rgba(233,196,106,0.3)', borderRadius: 'var(--radius)', fontSize: '0.78rem', color: '#8B6914', lineHeight: 1.55 }}>
        💡 <strong>Dica:</strong> Use a extensão Lexie no Chrome para gravar o áudio da consulta automaticamente.
      </div>
    </div>
  )
}

export default function NewSessionPage() {
  return (
    <Suspense>
      <NewSessionForm />
    </Suspense>
  )
}