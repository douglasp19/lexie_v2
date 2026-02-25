import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg)', gap:'1.5rem' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'"Playfair Display",serif', fontSize:'2rem', fontWeight:700, color:'var(--green)' }}>
          Lexi<span style={{ color:'var(--olive)', fontStyle:'italic' }}>e</span>
        </div>
        <p style={{ fontSize:'0.85rem', color:'var(--text3)', marginTop:'0.25rem' }}>Crie sua conta gratuitamente</p>
      </div>
      <SignUp routing="hash" />
    </main>
  )
}
