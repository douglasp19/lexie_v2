// @route apps/web/app/(platform)/patients/page.tsx
import { auth } from '@clerk/nextjs/server'
import { listPatients, searchPatients } from '@/lib/db/queries/patients'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function age(birthDate: string) {
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { userId } = await auth()
  const { q }      = await searchParams

  const patients = q
    ? await searchPatients(userId!, q).catch(() => [])
    : await listPatients(userId!).catch(() => [])

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.55rem', marginBottom: '0.25rem' }}>
            {q ? `Resultados para "${q}"` : 'Pacientes'}
          </h1>
          <p style={{ fontSize: '0.83rem', color: 'var(--text3)' }}>
            {patients.length} paciente{patients.length !== 1 ? 's' : ''}
            {q && <Link href="/patients" style={{ color: 'var(--green)', marginLeft: '0.5rem', textDecoration: 'none', fontWeight: 500 }}>Limpar busca ×</Link>}
          </p>
        </div>
        <Link href="/patients/new" className="btn-primary">+ Novo Paciente</Link>
      </div>

      {patients.length === 0 ? (
        <div className="card empty-state" style={{ padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{q ? '🔍' : '👤'}</div>
          <h3>{q ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}</h3>
          <p style={{ marginBottom: '1.25rem' }}>
            {q ? `Nenhum resultado para "${q}".` : 'Cadastre seu primeiro paciente.'}
          </p>
          <Link href="/patients/new" className="btn-primary" style={{ display: 'inline-flex' }}>
            + Novo Paciente
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}>
          {patients.map(p => (
            <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '1.1rem 1.25rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.625rem' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--green-light), var(--olive-light))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.78rem', fontWeight: 700, color: 'var(--green-dark)', flexShrink: 0,
                  }}>
                    {p.name.split(' ').slice(0,2).map((n: string) => n[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{p.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                      {p.birth_date ? `${age(p.birth_date)} anos` : 'Idade não informada'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  {p.email && <span>✉ {p.email}</span>}
                  {p.phone && <span>📞 {p.phone}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}