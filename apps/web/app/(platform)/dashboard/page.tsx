// @route apps/web/app/(platform)/dashboard/page.tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import { listSessions } from '@/lib/db/queries/sessions'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function todayFmt() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  done:       'Concluída',
  processing: 'Processando',
  draft:      'Rascunho',
  error:      'Erro',
}

export default async function DashboardPage() {
  const { userId } = await auth()
  const user       = await currentUser()
  const sessions   = await listSessions(userId!).catch(() => [])

  const displayName = user?.firstName ?? 'Dra.'
  const total     = sessions.length
  const done      = sessions.filter(s => s.status === 'done').length
  const thisMonth = sessions.filter(s => {
    const d = new Date(s.created_at), n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).length

  return (
    <div className="fade-up">
      {/* Greeting */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.65rem', marginBottom: '0.2rem' }}>
          {greeting()}, {displayName} 🌿
        </h1>
        <p style={{ fontSize: '0.83rem', color: 'var(--text3)', textTransform: 'capitalize' }}>
          {todayFmt()}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem', marginBottom: '1.75rem' }}>
        <StatCard num={total}     label="Total de consultas"   trend={thisMonth > 0 ? `+${thisMonth} este mês` : undefined} />
        <StatCard num={done}      label="Relatórios gerados"   trend={total > 0 ? `${Math.round(done / total * 100)}% concluídas` : undefined} />
        <StatCard num={thisMonth} label="Consultas este mês" />
      </div>

      {/* List header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>Consultas recentes</span>
        {sessions.length > 0 && (
          <Link href="/session/new" style={{ fontSize: '0.78rem', color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>
            + Nova consulta
          </Link>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="card empty-state" style={{ padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
          <h3>Nenhuma consulta ainda</h3>
          <p style={{ marginBottom: '1.25rem' }}>Crie sua primeira consulta ou grave uma via extensão Chrome.</p>
          <Link href="/session/new" className="btn-primary" style={{ display: 'inline-flex' }}>
            + Nova Consulta
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {sessions.map(s => (
            <Link key={s.id} href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
              <div className="card sess-row" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.875rem 1.1rem', cursor: 'pointer',
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
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>{s.patient_name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text3)', marginTop: '0.1rem' }}>{fmtDate(s.created_at)}</div>
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
        </div>
      )}
    </div>
  )
}

function StatCard({ num, label, trend }: { num: number; label: string; trend?: string }) {
  return (
    <div className="card" style={{ padding: '1.1rem 1.25rem', overflow: 'hidden', position: 'relative' }}>
      <div style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.9rem', fontWeight: 700, color: 'var(--green)', lineHeight: 1 }}>
        {num}
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text3)', marginTop: '0.3rem' }}>{label}</div>
      {trend && <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--olive)', marginTop: '0.5rem' }}>{trend}</div>}
    </div>
  )
}