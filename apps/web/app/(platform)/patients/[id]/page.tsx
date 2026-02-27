// @route apps/web/app/(platform)/patients/[id]/page.tsx
'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Patient {
  id: string; name: string; email: string | null; phone: string | null
  birth_date: string | null; anamnesis: string | null; goals: string | null
  notes: string | null; created_at: string
}
interface Session {
  id: string; patient_name: string; session_type: string; status: string; created_at: string
}
interface ReportContent {
  queixa?: string; historico?: string; dados?: string; metas?: string; proximos_passos?: string
}
interface SessionWithReport extends Session {
  report?: ReportContent
}

const STATUS_LABEL: Record<string, string> = {
  done: 'Concluída', processing: 'Processando', draft: 'Rascunho', error: 'Erro'
}

const REPORT_SECTIONS = [
  { key: 'queixa',          label: 'Queixa Principal',   icon: '💬' },
  { key: 'historico',       label: 'Histórico',          icon: '📋' },
  { key: 'dados',           label: 'Dados Objetivos',    icon: '📊' },
  { key: 'metas',           label: 'Metas Terapêuticas', icon: '🎯' },
  { key: 'proximos_passos', label: 'Próximos Passos',    icon: '▶' },
] as const

function age(birthDate: string) {
  const [y, m, d] = birthDate.split('-').map(Number)
  const birth = new Date(y, m - 1, d) // sem UTC — evita erro de timezone
  return Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

// Formata datas vindas do banco (YYYY-MM-DD) sem conversão UTC→local
function fmtDate(iso: string) {
  return iso.split('-').reverse().join('/')
}

// ── Modal de resumo da consulta ───────────────────────────────────────────────
function SessionReportModal({ session, onClose }: { session: SessionWithReport; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 'var(--radius)', width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
              Resumo — {new Date(session.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '0.1rem' }}>
              {session.session_type === 'online' ? '🌐 Online' : '🏥 Presencial'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.25rem' }}>
          {session.report ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {REPORT_SECTIONS.map((sec, i) => {
                const text = session.report?.[sec.key as keyof ReportContent]
                if (!text) return null
                return (
                  <div key={sec.key} style={{ padding: '0.75rem 0', borderBottom: i < REPORT_SECTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>{sec.icon}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{sec.label}</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.7 }}>{text}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)', fontSize: '0.83rem' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📄</div>
              Relatório ainda não gerado para esta consulta.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href={`/session/${session.id}`} style={{ fontSize: '0.78rem', color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>
            Abrir consulta →
          </Link>
          {session.status === 'done' && (
            <Link href={`/session/${session.id}/report`} style={{ fontSize: '0.78rem', color: 'var(--text2)', fontWeight: 500, textDecoration: 'none' }}>
              Ver relatório completo →
            </Link>
          )}
          <button onClick={onClose} className="btn-secondary" style={{ fontSize: '0.78rem' }}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()

  const [patient,       setPatient]       = useState<Patient | null>(null)
  const [sessions,      setSessions]      = useState<SessionWithReport[]>([])
  const [editing,       setEditing]       = useState(false)
  const [form,          setForm]          = useState<Partial<Patient>>({})
  const [saving,        setSaving]        = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [selectedSess,  setSelectedSess]  = useState<SessionWithReport | null>(null)
  const [loadingReport, setLoadingReport] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.patient) { setPatient(d.patient); setForm(d.patient) }
        if (d.sessions) setSessions(d.sessions)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function openSessionModal(session: SessionWithReport) {
    // Se já tem relatório carregado, abre direto
    if (session.report !== undefined) { setSelectedSess(session); return }

    // Busca relatório da sessão
    setLoadingReport(session.id)
    try {
      const res  = await fetch(`/api/report/${session.id}`)
      const data = await res.json()
      const updated = { ...session, report: data.report?.content ?? null }
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s))
      setSelectedSess(updated)
    } catch {
      setSelectedSess({ ...session, report: undefined })
    } finally {
      setLoadingReport(null)
    }
  }

  async function handleSave() {
    setSaving(true)
    const res  = await fetch(`/api/patients/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.patient) { setPatient(data.patient); setEditing(false) }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`Deletar ${patient?.name}? Essa ação não pode ser desfeita.`)) return
    await fetch(`/api/patients/${id}`, { method: 'DELETE' })
    router.push('/patients')
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text3)' }}>Carregando…</div>
  if (!patient) return (
    <div className="empty-state">
      <p>Paciente não encontrado.</p>
      <Link href="/patients" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>← Voltar</Link>
    </div>
  )

  return (
    <div className="fade-up">
      {/* Modal de resumo */}
      {selectedSess && <SessionReportModal session={selectedSess} onClose={() => setSelectedSess(null)} />}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text3)', marginBottom: '1.25rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>Dashboard</Link>
        <span>›</span>
        <Link href="/patients" style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>Pacientes</Link>
        <span>›</span>
        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{patient.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, var(--green-light), var(--olive-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700, color: 'var(--green-dark)' }}>
            {patient.name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: '1.45rem' }}>{patient.name}</h1>
            <div style={{ fontSize: '0.76rem', color: 'var(--text3)', marginTop: '0.15rem' }}>
              {patient.birth_date && `${age(patient.birth_date)} anos · `}
              {patient.email && `${patient.email} · `}
              {patient.phone}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href={`/session/new?patientId=${id}&patientName=${encodeURIComponent(patient.name)}`} className="btn-primary">
            + Nova Consulta
          </Link>
          <button className="btn-secondary" onClick={() => setEditing(e => !e)}>
            {editing ? 'Cancelar' : '✏ Editar'}
          </button>
          <button onClick={handleDelete} style={{ padding: '0.52rem 0.75rem', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text3)' }}>🗑</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Dados do paciente */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <span className="section-label" style={{ display: 'block', marginBottom: '1rem' }}>👤 Dados do Paciente</span>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <Field label="Nome" value={form.name ?? ''} onChange={v => setForm(f => ({...f, name: v}))} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Field label="Email" value={form.email ?? ''} onChange={v => setForm(f => ({...f, email: v}))} type="email" />
                  <Field label="Telefone" value={form.phone ?? ''} onChange={v => setForm(f => ({...f, phone: v}))} />
                </div>
                <Field label="Data de nascimento" value={form.birth_date ?? ''} onChange={v => setForm(f => ({...f, birth_date: v}))} type="date" />
                <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-end' }}>
                  {saving ? 'Salvando…' : '✓ Salvar alterações'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem' }}>
                {[
                  { k: 'Email',        v: patient.email },
                  { k: 'Telefone',     v: patient.phone },
                  { k: 'Nascimento',   v: patient.birth_date ? fmtDate(patient.birth_date) : null },
                  { k: 'Cadastrado em',v: new Date(patient.created_at).toLocaleDateString('pt-BR') },
                ].map(row => (
                  <div key={row.k} style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '0.15rem' }}>{row.k}</div>
                    <div style={{ fontSize: '0.85rem', color: row.v ? 'var(--text)' : 'var(--text3)', fontStyle: row.v ? 'normal' : 'italic' }}>{row.v ?? 'Não informado'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Anamnese — resumos das consultas */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <span className="section-label">📋 Anamnese</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>Resumos das consultas realizadas</span>
            </div>

            {sessions.filter(s => s.status === 'done').length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text3)', fontStyle: 'italic' }}>
                Nenhuma consulta concluída ainda. Os resumos gerados pela IA aparecerão aqui.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sessions.filter(s => s.status === 'done').map(s => (
                  <button key={s.id} onClick={() => openSessionModal(s)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)', background: 'var(--surface2)',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    transition: 'all 0.15s', width: '100%',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--green-light)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <span style={{ fontSize: '1rem' }}>📄</span>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                          {new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: '0.1rem' }}>
                          {s.session_type === 'online' ? '🌐 Online' : '🏥 Presencial'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {loadingReport === s.id && <span className="spinner" style={{ width: 14, height: 14 }} />}
                      <span style={{ fontSize: '0.72rem', color: 'var(--green)', fontWeight: 600 }}>Ver resumo →</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Objetivos */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <span className="section-label" style={{ display: 'block', marginBottom: '0.75rem' }}>🎯 Objetivos Gerais</span>
            {editing ? (
              <textarea className="textarea" style={{ height: 100 }} placeholder="Emagrecimento, ganho de massa, controle de diabetes…" value={form.goals ?? ''} onChange={e => setForm(f => ({...f, goals: e.target.value}))} />
            ) : (
              <p style={{ fontSize: '0.875rem', color: patient.goals ? 'var(--text)' : 'var(--text3)', lineHeight: 1.7, fontStyle: patient.goals ? 'normal' : 'italic' }}>{patient.goals ?? 'Nenhum objetivo registrado.'}</p>
            )}
          </div>

          {/* Anotações fixas */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <span className="section-label" style={{ display: 'block', marginBottom: '0.75rem' }}>📝 Anotações Fixas</span>
            {editing ? (
              <textarea className="textarea" style={{ height: 100 }} placeholder="Observações gerais sobre o paciente…" value={form.notes ?? ''} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
            ) : (
              <p style={{ fontSize: '0.875rem', color: patient.notes ? 'var(--text)' : 'var(--text3)', lineHeight: 1.7, fontStyle: patient.notes ? 'normal' : 'italic' }}>{patient.notes ?? 'Nenhuma anotação.'}</p>
            )}
          </div>
        </div>

        {/* Right — Consultas */}
        <div className="card" style={{ padding: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <span className="section-label">📅 Consultas ({sessions.length})</span>
          </div>

          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📋</div>
              <p style={{ fontSize: '0.78rem' }}>Nenhuma consulta ainda</p>
              <Link href={`/session/new?patientId=${id}&patientName=${encodeURIComponent(patient.name)}`}
                style={{ fontSize: '0.78rem', color: 'var(--green)', fontWeight: 500, textDecoration: 'none', display: 'inline-block', marginTop: '0.5rem' }}>
                + Iniciar primeira consulta
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {sessions.map(s => (
                <Link key={s.id} href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '0.65rem 0.875rem', borderRadius: 'var(--radius-sm)', border: `1px solid ${s.status === 'done' ? 'rgba(76,175,80,0.25)' : 'var(--border)'}`, background: s.status === 'done' ? 'var(--green-light)' : 'var(--surface2)', cursor: 'pointer' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.2rem' }}>
                      {new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{s.session_type === 'online' ? '🌐 Online' : '🏥 Presencial'}</span>
                      <span className={`pill pill-${s.status === 'processing' ? 'processing' : s.status}`}>{STATUS_LABEL[s.status] ?? s.status}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="section-label" style={{ display: 'block', marginBottom: '0.35rem' }}>{label}</label>
      <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}