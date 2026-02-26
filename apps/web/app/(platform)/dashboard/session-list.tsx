// @route apps/web/app/(platform)/dashboard/session-list.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Session {
  id:           string
  patient_name: string
  session_type: string
  status:       string
  created_at:   string
}

interface Props {
  sessions: Session[]
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  done:       'Concluída',
  processing: 'Processando',
  draft:      'Rascunho',
  error:      'Erro',
}

export function SessionList({ sessions }: Props) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? sessions.filter(s =>
        s.patient_name.toLowerCase().includes(query.toLowerCase())
      )
    : sessions

  return (
    <div>
      {/* Header com busca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          Consultas recentes
        </span>

        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{
            position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)',
            fontSize: '0.82rem', color: 'var(--text3)', pointerEvents: 'none',
          }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por paciente…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width:        '100%',
              padding:      '0.42rem 0.75rem 0.42rem 2rem',
              border:       '1.5px solid var(--border)',
              borderRadius: '8px',
              fontSize:     '0.82rem',
              color:        'var(--text)',
              background:   'white',
              fontFamily:   'inherit',
              outline:      'none',
              transition:   'border-color 0.15s',
            }}
            onFocus={e  => (e.target.style.borderColor = 'var(--green)')}
            onBlur={e   => (e.target.style.borderColor = 'var(--border)')}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.8rem', color: 'var(--text3)', lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text3)', fontSize: '0.83rem' }}>
          {query ? `Nenhuma consulta encontrada para "${query}"` : 'Nenhuma consulta ainda'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {filtered.map(s => (
            <Link key={s.id} href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
              <div className="card sess-row" style={{
                display:    'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding:    '0.875rem 1.1rem',
                cursor:     'pointer',
                borderLeft: s.status === 'done' ? '3px solid var(--green)' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--green-light)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.74rem', fontWeight: 700, color: 'var(--green-dark)', flexShrink: 0,
                  }}>
                    {initials(s.patient_name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>
                      {s.patient_name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text3)', marginTop: '0.1rem' }}>
                      {fmtDate(s.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                  <span className={`pill pill-${s.status === 'processing' ? 'processing' : s.status}`}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                    {s.session_type === 'online' ? '🌐 Online' : '🏥 Presencial'}
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {/* Rodapé com total */}
          {!query && sessions.length > 0 && (
            <div style={{ textAlign: 'center', padding: '0.6rem 0', fontSize: '0.72rem', color: 'var(--text3)' }}>
              Exibindo as {sessions.length} consultas mais recentes
            </div>
          )}
        </div>
      )}
    </div>
  )
}