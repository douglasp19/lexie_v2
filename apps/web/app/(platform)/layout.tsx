// @route apps/web/app/(platform)/layout.tsx
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { NavSearch } from './nav-search'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  const name = user?.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : 'Profissional'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{`
        .nav-link {
          padding: 0.35rem 0.75rem;
          border-radius: var(--radius-sm);
          font-size: 0.84rem;
          font-weight: 500;
          color: var(--text2);
          text-decoration: none;
          transition: color 0.15s, background 0.15s;
        }
        .nav-link:hover { color: var(--green); background: var(--green-light); }
        .nav-link-guide {
          padding: 0.35rem 0.75rem;
          border-radius: var(--radius-sm);
          font-size: 0.84rem;
          font-weight: 500;
          color: var(--text3);
          text-decoration: none;
          transition: color 0.15s, background 0.15s;
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        .nav-link-guide:hover { color: var(--green); background: var(--green-light); }
      `}</style>

      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'white',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem',
          height: '52px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '1rem',
        }}>
          {/* Logo */}
          <Link href="/dashboard" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.35rem', fontWeight: 700, color: 'var(--green)' }}>
              Lexi<span style={{ color: 'var(--olive)', fontStyle: 'italic' }}>e</span>
            </span>
          </Link>

          {/* Search */}
          <NavSearch />

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexShrink: 0 }}>
            <Link href="/patients"    className="nav-link">Pacientes</Link>
            <Link href="/session/new" className="nav-link">Nova Consulta</Link>
            <Link href="/guia"        className="nav-link-guide" title="Guia de uso">📖</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text2)', fontWeight: 500 }}>
              <UserButton afterSignOutUrl="/sign-in" />
              <span>{name}</span>
            </div>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.75rem 1.5rem 4rem' }}>
        {children}
      </main>
    </div>
  )
}