// @route apps/web/app/(platform)/session/[id]/report/report-editor.tsx
'use client'

import { useState } from 'react'

const SECTIONS = [
  { key: 'queixa',          label: 'Queixa Principal',    icon: '💬' },
  { key: 'historico',       label: 'Histórico',           icon: '📋' },
  { key: 'dados',           label: 'Dados Objetivos',     icon: '📊' },
  { key: 'metas',           label: 'Metas Terapêuticas',  icon: '🎯' },
  { key: 'proximos_passos', label: 'Próximos Passos',     icon: '▶' },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

interface Props {
  sessionId: string
  initial:   Record<string, string>
}

export function ReportEditor({ sessionId, initial }: Props) {
  const [content,  setContent]  = useState<Record<string, string>>(initial)
  const [editing,  setEditing]  = useState<SectionKey | null>(null)
  const [draft,    setDraft]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState<SectionKey | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  function startEdit(key: SectionKey) {
    setEditing(key)
    setDraft(content[key] ?? '')
    setError(null)
  }

  function cancelEdit() {
    setEditing(null)
    setDraft('')
    setError(null)
  }

  async function saveEdit(key: SectionKey) {
    if (draft.trim() === content[key]) { cancelEdit(); return }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/report/${sessionId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [key]: draft.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao salvar')
      }

      setContent(prev => ({ ...prev, [key]: draft.trim() }))
      setEditing(null)
      setSaved(key)
      setTimeout(() => setSaved(null), 2500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {SECTIONS.map((sec, i) => {
        const isEditing = editing === sec.key
        const wasSaved  = saved   === sec.key

        return (
          <div
            key={sec.key}
            style={{
              padding:      '0.925rem 0',
              borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            {/* Header da seção */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.9rem' }}>{sec.icon}</span>
              <span className="section-label" style={{ flex: 1 }}>{sec.label}</span>

              {!isEditing && (
                <button
                  onClick={() => startEdit(sec.key)}
                  style={{
                    fontSize:     '0.68rem',
                    fontWeight:   600,
                    padding:      '0.15rem 0.55rem',
                    borderRadius: '4px',
                    border:       '1px solid var(--border)',
                    background:   'none',
                    color:        wasSaved ? 'var(--green-dark)' : 'var(--text3)',
                    cursor:       'pointer',
                    transition:   'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    ;(e.target as HTMLButtonElement).style.color        = 'var(--green)'
                    ;(e.target as HTMLButtonElement).style.borderColor  = 'var(--green)'
                  }}
                  onMouseLeave={e => {
                    ;(e.target as HTMLButtonElement).style.color        = wasSaved ? 'var(--green-dark)' : 'var(--text3)'
                    ;(e.target as HTMLButtonElement).style.borderColor  = 'var(--border)'
                  }}
                >
                  {wasSaved ? '✓ Salvo' : 'Editar'}
                </button>
              )}
            </div>

            {/* Conteúdo ou editor */}
            {isEditing ? (
              <div>
                <textarea
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={4}
                  style={{
                    width:        '100%',
                    padding:      '0.75rem',
                    border:       '1.5px solid var(--green)',
                    borderRadius: '8px',
                    fontSize:     '0.875rem',
                    color:        'var(--text)',
                    lineHeight:   1.7,
                    resize:       'vertical',
                    fontFamily:   'var(--font-sans, DM Sans, sans-serif)',
                    background:   'var(--bg)',
                    outline:      'none',
                    marginBottom: '0.5rem',
                  }}
                />

                {error && (
                  <p style={{ fontSize: '0.75rem', color: '#E53E3E', marginBottom: '0.5rem' }}>
                    ⚠ {error}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    style={{
                      padding:    '0.4rem 0.875rem',
                      borderRadius: '6px',
                      border:     '1px solid var(--border)',
                      background: 'none',
                      fontSize:   '0.8rem',
                      color:      'var(--text2)',
                      cursor:     'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => saveEdit(sec.key)}
                    disabled={saving || draft.trim() === ''}
                    style={{
                      padding:    '0.4rem 0.875rem',
                      borderRadius: '6px',
                      border:     'none',
                      background: saving ? 'var(--border)' : 'var(--green)',
                      color:      saving ? 'var(--text3)' : 'white',
                      fontSize:   '0.8rem',
                      fontWeight: 600,
                      cursor:     saving ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.7 }}>
                {content[sec.key] || (
                  <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Não registrado</span>
                )}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}