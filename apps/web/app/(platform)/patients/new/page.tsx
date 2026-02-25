// @route apps/web/app/(platform)/patients/new/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewPatientPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', email: '', phone: '', birth_date: '',
    anamnesis: '', goals: '', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({...f, [k]: v}))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return }
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/patients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/patients/${data.patient.id}`)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fade-up" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text3)', marginBottom: '1.5rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>Dashboard</Link>
        <span>›</span>
        <Link href="/patients" style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>Pacientes</Link>
        <span>›</span>
        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>Novo Paciente</span>
      </div>

      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Novo Paciente</h1>
      <p style={{ fontSize: '0.83rem', color: 'var(--text3)', marginBottom: '1.75rem' }}>
        Cadastre o paciente para organizar todas as consultas em um só lugar.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Dados básicos */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <span className="section-label" style={{ display: 'block', marginBottom: '1rem' }}>👤 Dados Básicos</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Nome *</label>
                <input className="input" placeholder="Nome completo" value={form.name} onChange={e => set('name')(e.target.value)} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Email</label>
                  <input className="input" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => set('email')(e.target.value)} />
                </div>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Telefone</label>
                  <input className="input" placeholder="(11) 99999-9999" value={form.phone} onChange={e => set('phone')(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="section-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Data de Nascimento</label>
                <input className="input" type="date" value={form.birth_date} onChange={e => set('birth_date')(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Clínico */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <span className="section-label" style={{ display: 'block', marginBottom: '1rem' }}>📋 Histórico Clínico</span>
            <textarea className="textarea" style={{ height: 110 }}
              placeholder="Doenças pré-existentes, medicamentos em uso, alergias, cirurgias…"
              value={form.anamnesis} onChange={e => set('anamnesis')(e.target.value)}
            />
          </div>

          {/* Objetivos */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <span className="section-label" style={{ display: 'block', marginBottom: '1rem' }}>🎯 Objetivos Gerais</span>
            <textarea className="textarea" style={{ height: 90 }}
              placeholder="Emagrecimento, ganho de massa, reeducação alimentar, controle de exames…"
              value={form.goals} onChange={e => set('goals')(e.target.value)}
            />
          </div>

          {/* Notas */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <span className="section-label" style={{ display: 'block', marginBottom: '1rem' }}>📝 Anotações</span>
            <textarea className="textarea" style={{ height: 80 }}
              placeholder="Observações livres sobre o paciente…"
              value={form.notes} onChange={e => set('notes')(e.target.value)}
            />
          </div>

          {error && (
            <div style={{ padding: '0.65rem 0.875rem', background: 'var(--red-light)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Link href="/patients" className="btn-secondary">Cancelar</Link>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Salvando…</> : 'Cadastrar Paciente →'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}