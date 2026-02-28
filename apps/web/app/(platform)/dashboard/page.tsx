// @route apps/web/app/(platform)/dashboard/page.tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import { listSessions } from '@/lib/db/queries/sessions'
import Link from 'next/link'
import { SessionList } from './session-list'
import { ExtensionBanner } from './ExtensionBanner'

export const dynamic = 'force-dynamic'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function todayFmt() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function DashboardPage() {
  const { userId } = await auth()
  const user       = await currentUser()
  const allSessions = await listSessions(userId!).catch(() => [])

  const sessions = allSessions.slice(0, 20)

  const displayName = user?.firstName ?? 'Dra.'
  const total     = allSessions.length
  const done      = allSessions.filter(s => s.status === 'done').length
  const thisMonth = allSessions.filter(s => {
    const d = new Date(s.created_at), n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).length

  return (
    <div className="fade-up">

      {/* Banner extensão */}
      <ExtensionBanner />

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
        <StatCard num={total}     label="Total de consultas"  trend={thisMonth > 0 ? `+${thisMonth} este mês` : undefined} />
        <StatCard num={done}      label="Relatórios gerados"  trend={total > 0 ? `${Math.round(done / total * 100)}% concluídas` : undefined} />
        <StatCard num={thisMonth} label="Consultas este mês" />
      </div>

      {/* Lista vazia */}
      {allSessions.length === 0 ? (
        <div className="card empty-state" style={{ padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
          <h3>Nenhuma consulta ainda</h3>
          <p style={{ marginBottom: '1.25rem' }}>Crie sua primeira consulta ou grave uma via extensão Chrome.</p>
          <Link href="/session/new" className="btn-primary" style={{ display: 'inline-flex' }}>
            + Nova Consulta
          </Link>
        </div>
      ) : (
        <SessionList sessions={sessions} />
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