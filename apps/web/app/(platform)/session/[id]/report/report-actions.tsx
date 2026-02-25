// @route apps/web/app/(platform)/session/[id]/report/report-actions.tsx
'use client'

interface Props {
  sessionId:   string
  patientName: string
  content:     Record<string, string>
}

const SECTION_LABELS: Record<string, string> = {
  queixa:          'QUEIXA PRINCIPAL',
  historico:       'HISTÓRICO',
  dados:           'DADOS OBJETIVOS',
  metas:           'METAS TERAPÊUTICAS',
  proximos_passos: 'PRÓXIMOS PASSOS',
}

export function ReportActions({ sessionId, patientName, content }: Props) {
  function handleCopy() {
    const text = Object.entries(SECTION_LABELS)
      .map(([key, label]) => `${label}\n${content[key] ?? '—'}`)
      .join('\n\n')
    const full = `RELATÓRIO DE CONSULTA NUTRICIONAL\nPaciente: ${patientName}\n\n${text}`
    navigator.clipboard.writeText(full)
      .then(() => alert('Relatório copiado para a área de transferência!'))
      .catch(() => alert('Erro ao copiar.'))
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button
        className="btn-secondary"
        onClick={handleCopy}
        title="Copiar texto"
        style={{ fontSize: '0.78rem' }}
      >
        📋 Copiar
      </button>
      <button
        className="btn-primary"
        onClick={handlePrint}
        title="Imprimir / salvar como PDF"
        style={{ fontSize: '0.78rem' }}
      >
        🖨 Imprimir
      </button>
    </div>
  )
}
