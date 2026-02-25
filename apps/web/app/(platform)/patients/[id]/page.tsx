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

const STATUS_LABEL: Record<string, string> = {
  done: 'Concluída', processing: 'Processando', draft: 'Rascunho', error: 'Erro'
}

function age(birthDate: string) {
  const diff = Date.now() - new Date(birthDate).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()

  const [patient,  setPatient]  = useState<Patient | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [editing,  setEditing]  = useState(false)
  const [form,     setForm]     = useState<Partial<Patient>>({})
  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.patient) { setPatient(d.patient); setForm(d.patient) }
        if (d.sessions) setSessions(d.sessions)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    setSaving(true)
    const res  = await fetch(`/api/patients/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    })
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
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--green-light), var(--olive-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', fontWeight: 700, color: 'var(--green-dark)',
          }}>
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
          <button onClick={handleDelete} style={{
            padding: '0.52rem 0.75rem', background: 'none',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text3)',
          }}>🗑</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left - edit form or view */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Info card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span className="section-label">👤 Dados do Paciente</span>
            </div>

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
                  { k: 'Email', v: patient.email },
                  { k: 'Telefone', v: patient.phone },
                  { k: 'Nascimento', v: patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('pt-BR') : null },
                  { k: 'Cadastrado em', v: new Date(patient.created_at).toLocaleDateString('pt-BR') },
                ].map(row => (
                  <div key={row.k} style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '0.15rem' }}>{row.k}</div>
                    <div style={{ fontSize: '0.85rem', color: row.v ? 'var(--text)' : 'var(--text3)', fontStyle: row.v ? 'normal' : 'italic' }}>
                      {row.v ?? 'Não informado'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Anamnesis */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <span className="section-label" style={{ display: 'block', marginBottom: '0.75rem' }}>📋 Histórico Clínico / Anamnese</span>
            {editing ? (
              <textarea className="textarea" style={{ height: 120 }}
                placeholder="Histórico clínico, doenças pré-existentes, medicamentos em uso…"
                value={form.anamnesis ?? ''}
                onChange={e => setForm(f => ({...f, anamnesis: e.target.value}))}
              />
            ) : (
              <p style={{ fontSize: '0.875rem', color: patient.anamnesis ? 'var(--text)' : 'var(--text3)', lineHeight: 1.7, fontStyle: patient.anamnesis ? 'normal' : 'italic' }}>
                {patient.anamnesis ?? 'Nenhum histórico registrado.'}
              </p>
            )}
          </div>

          {/* Goals */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <span className="section-label" style={{ display: 'block', marginBottom: '0.75rem' }}>🎯 Objetivos Gerais</span>
            {editing ? (
              <textarea className="textarea" style={{ height: 100 }}
                placeholder="Emagrecimento, ganho de massa, controle de diabetes…"
                value={form.goals ?? ''}
                onChange={e => setForm(f => ({...f, goals: e.target.value}))}
              />
            ) : (
              <p style={{ fontSize: '0.875rem', color: patient.goals ? 'var(--text)' : 'var(--text3)', lineHeight: 1.7, fontStyle: patient.goals ? 'normal' : 'italic' }}>
                {patient.goals ?? 'Nenhum objetivo registrado.'}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <span className="section-label" style={{ display: 'block', marginBottom: '0.75rem' }}>📝 Anotações Fixas</span>
            {editing ? (
              <textarea className="textarea" style={{ height: 100 }}
                placeholder="Observações gerais sobre o paciente…"
                value={form.notes ?? ''}
                onChange={e => setForm(f => ({...f, notes: e.target.value}))}
              />
            ) : (
              <p style={{ fontSize: '0.875rem', color: patient.notes ? 'var(--text)' : 'var(--text3)', lineHeight: 1.7, fontStyle: patient.notes ? 'normal' : 'italic' }}>
                {patient.notes ?? 'Nenhuma anotação.'}
              </p>
            )}
          </div>
        </div>

        {/* Right - sessions */}
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
                  <div style={{
                    padding: '0.65rem 0.875rem', borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${s.status === 'done' ? 'rgba(76,175,80,0.25)' : 'var(--border)'}`,
                    background: s.status === 'done' ? 'var(--green-light)' : 'var(--surface2)',
                    cursor: 'pointer',
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.2rem' }}>
                      {new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>
                        {s.session_type === 'online' ? '🌐 Online' : '🏥 Presencial'}
                      </span>
                      <span className={`pill pill-${s.status === 'processing' ? 'processing' : s.status}`}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
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