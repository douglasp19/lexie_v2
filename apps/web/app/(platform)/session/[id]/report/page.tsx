// @route apps/web/app/(platform)/session/[id]/report/page.tsx
import { auth } from '@clerk/nextjs/server'
import { getSession } from '@/lib/db/queries/sessions'
import { getReport } from '@/lib/db/queries/reports'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReportActions } from './report-actions'
import { ReportEditor } from './report-editor'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export default async function ReportPage({ params }: Params) {
  const { id }     = await params
  const { userId } = await auth()

  const [session, report] = await Promise.all([
    getSession(id, userId!).catch(() => null),
    getReport(id).catch(() => null),
  ])

  if (!session) notFound()

  if (!report) {
    return (
      <div className="fade-up" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="card empty-state" style={{ padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
          <h3>Relatório ainda não gerado</h3>
          <p style={{ marginBottom: '1.25rem' }}>Volte para a consulta e clique em "Gerar Relatório".</p>
          <Link href={`/session/${id}`} className="btn-primary" style={{ display: 'inline-flex' }}>
            ← Voltar à Consulta
          </Link>
        </div>
      </div>
    )
  }

  const content = report.content as Record<string, string>

  return (
    <div className="fade-up">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text3)', marginBottom: '1.25rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>Dashboard</Link>
        <span>›</span>
        <Link href={`/session/${id}`} style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>{session.patient_name}</Link>
        <span>›</span>
        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>Relatório</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Report card */}
        <div className="card" style={{ padding: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
          {/* Header */}
          <div style={{
            display:       'flex',
            alignItems:    'flex-start',
            justifyContent:'space-between',
            paddingBottom: '1rem',
            borderBottom:  '1px solid var(--border)',
            marginBottom:  '1rem',
          }}>
            <div>
              <h1 style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>{session.patient_name}</h1>
              <div style={{ fontSize: '0.77rem', color: 'var(--text3)' }}>
                {new Date(report.generated_at).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })} · Gerado por IA
              </div>
            </div>
            <ReportActions sessionId={id} patientName={session.patient_name} content={content} />
          </div>

          {/* Seções editáveis */}
          <ReportEditor sessionId={id} initial={content} />
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Meta */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h5 className="section-label" style={{ marginBottom: '0.75rem' }}>ℹ Metadados</h5>
            {[
              { k: 'Paciente',  v: session.patient_name },
              { k: 'Tipo',      v: session.session_type === 'online' ? 'Online' : 'Presencial' },
              { k: 'Modelo IA', v: report.ai_model },
              { k: 'Gerado em', v: new Date(report.generated_at).toLocaleDateString('pt-BR') },
            ].map(row => (
              <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text3)' }}>{row.k}</span>
                <span style={{ fontSize: '0.76rem', color: 'var(--text)', fontWeight: 600 }}>{row.v}</span>
              </div>
            ))}
          </div>

          {/* Anchor words */}
          {session.anchor_words.length > 0 && (
            <div style={{ background: 'var(--olive-light)', border: '1px solid rgba(107,142,35,0.2)', borderRadius: 'var(--radius)', padding: '1.1rem' }}>
              <h5 className="section-label" style={{ color: 'var(--olive)', marginBottom: '0.75rem' }}>🏷 Palavras-âncora</h5>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {session.anchor_words.map(w => (
                  <span key={w} style={{
                    padding:      '0.22rem 0.65rem',
                    background:   'white',
                    border:       '1px solid rgba(107,142,35,0.25)',
                    borderRadius: '99px',
                    fontSize:     '0.72rem',
                    color:        'var(--olive)',
                    fontWeight:   600,
                  }}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI notice */}
          <div style={{ background: 'var(--green-light)', border: '1px solid rgba(76,175,80,0.15)', borderRadius: 'var(--radius)', padding: '1rem', fontSize: '0.76rem', color: 'var(--green-dark)', lineHeight: 1.55 }}>
            <strong>Gerado por IA</strong> com base na transcrição da consulta e nas suas anotações. Revise antes de usar no prontuário.
          </div>

          {/* Back */}
          <Link href={`/session/${id}`} className="btn-secondary" style={{ textAlign: 'center', justifyContent: 'center' }}>
            ← Editar Consulta
          </Link>
        </div>
      </div>
    </div>
  )
}