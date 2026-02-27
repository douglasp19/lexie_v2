// @route apps/web/app/(platform)/session/[id]/TranscriptionModal.tsx
// Componente isolado — substitui o TranscriptionModal inline do session page
'use client'

interface Segment {
  start: number
  end:   number
  text:  string
}

interface Props {
  text:      string
  segments?: Segment[] | null
  onClose:   () => void
}

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function TranscriptionModal({ text, segments, onClose }: Props) {
  const hasSegments = segments && segments.length > 0

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: 'var(--radius)', width: '100%', maxWidth: 700, maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>🎙 Transcrição da Consulta</span>
            {hasSegments && (
              <span style={{ marginLeft: '0.75rem', fontSize: '0.7rem', color: 'var(--text3)', background: 'var(--surface2)', padding: '0.15rem 0.5rem', borderRadius: '99px' }}>
                {segments!.length} segmentos
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem' }}>
          {hasSegments ? (
            // ── Modo com timestamps ──────────────────────────────────────────
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {segments!.map((seg, i) => (
                <div
                  key={i}
                  style={{
                    display:    'grid',
                    gridTemplateColumns: '60px 1fr',
                    gap:        '0.75rem',
                    padding:    '0.55rem 0',
                    borderBottom: i < segments!.length - 1 ? '1px solid var(--border)' : 'none',
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{
                    fontSize:   '0.7rem',
                    fontFamily: 'monospace',
                    color:      'var(--green-dark)',
                    fontWeight: 600,
                    background: 'var(--green-light)',
                    padding:    '0.1rem 0.35rem',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    textAlign:  'right',
                  }}>
                    {fmtTime(seg.start)}
                  </span>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>
                    {seg.text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            // ── Modo texto puro (transcrições antigas sem segmentos) ─────────
            <p style={{ fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {text}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            onClick={() => navigator.clipboard.writeText(
              hasSegments
                ? segments!.map(s => `[${fmtTime(s.start)}] ${s.text}`).join('\n')
                : text
            )}
            style={{ padding: '0.42rem 0.875rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'none', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--text2)' }}
          >
            📋 Copiar
          </button>
          <button onClick={onClose} className="btn-primary" style={{ fontSize: '0.78rem' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}