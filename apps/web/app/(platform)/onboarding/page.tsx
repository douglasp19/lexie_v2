// @route apps/web/app/(platform)/onboarding/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Step = 'download' | 'extract' | 'enable' | 'load' | 'done'

const STEPS: { id: Step; title: string; desc: string }[] = [
  { id: 'download', title: 'Baixar a extensão',      desc: 'Faça o download do arquivo .zip da extensão Lexie.' },
  { id: 'extract',  title: 'Extrair o arquivo',      desc: 'Descompacte o .zip em uma pasta permanente no seu computador.' },
  { id: 'enable',   title: 'Ativar modo desenvolvedor', desc: 'No Chrome, acesse chrome://extensions e ative o modo desenvolvedor.' },
  { id: 'load',     title: 'Carregar a extensão',    desc: 'Clique em "Carregar sem compactação" e selecione a pasta extraída.' },
  { id: 'done',     title: 'Pronto!',                desc: 'A extensão está instalada. Use o ID da consulta para gravar.' },
]

export default function OnboardingPage() {
  const [current, setCurrent] = useState<Step>('download')
  const [extensionDetected, setExtensionDetected] = useState(false)

  const currentIndex = STEPS.findIndex(s => s.id === current)

  // Tenta detectar se a extensão está instalada via postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'LEXIE_EXTENSION_READY') setExtensionDetected(true)
    }
    window.addEventListener('message', handler)
    window.postMessage({ type: 'LEXIE_PING' }, '*')
    return () => window.removeEventListener('message', handler)
  }, [])

  function next() {
    const idx = STEPS.findIndex(s => s.id === current)
    if (idx < STEPS.length - 1) setCurrent(STEPS[idx + 1].id)
  }

  return (
    <div className="fade-up" style={{ maxWidth: 640, margin: '0 auto', padding: '1rem 0 4rem' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text3)', marginBottom: '1rem' }}>
          <Link href="/dashboard" style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>Dashboard</Link>
          <span>›</span>
          <span style={{ color: 'var(--text2)', fontWeight: 600 }}>Instalar Extensão</span>
        </div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>🧩 Instalar extensão Lexie</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text3)', lineHeight: 1.6 }}>
          A extensão captura o áudio direto do seu navegador durante a teleconsulta.
          Siga os passos abaixo para instalar no Chrome.
        </p>
      </div>

      {/* Extensão detectada */}
      {extensionDetected && (
        <div style={{ padding: '0.875rem 1rem', background: 'var(--green-light)', border: '1px solid rgba(76,175,80,0.25)', borderRadius: 'var(--radius)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.3rem' }}>✅</span>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--green-dark)' }}>Extensão detectada!</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--green-dark)', opacity: 0.8 }}>A extensão Lexie já está instalada no seu Chrome.</div>
          </div>
          <Link href="/dashboard" className="btn-primary" style={{ marginLeft: 'auto', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>Ir para o Dashboard →</Link>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1.75rem' }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{
            flex: 1, height: 4, borderRadius: 99,
            background: i <= currentIndex ? 'var(--green)' : 'var(--border)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
        {STEPS.map((step, i) => {
          const isDone    = i < currentIndex
          const isActive  = step.id === current
          const isPending = i > currentIndex

          return (
            <div key={step.id} className="card" style={{
              padding: '1rem 1.25rem',
              border: isActive ? '1.5px solid var(--green)' : '1px solid var(--border)',
              background: isActive ? 'var(--green-light)' : isDone ? 'var(--surface2)' : 'white',
              opacity: isPending ? 0.5 : 1,
              transition: 'all 0.25s',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                {/* Número / check */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isDone ? '0.9rem' : '0.75rem', fontWeight: 700,
                  background: isDone ? 'var(--green)' : isActive ? 'white' : 'var(--border)',
                  color: isDone ? 'white' : isActive ? 'var(--green)' : 'var(--text3)',
                  border: isActive ? '2px solid var(--green)' : 'none',
                  boxShadow: isActive ? '0 0 0 3px rgba(76,175,80,0.15)' : 'none',
                }}>
                  {isDone ? '✓' : i + 1}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: isDone ? 'var(--text2)' : 'var(--text)', marginBottom: '0.2rem' }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text3)', lineHeight: 1.5 }}>{step.desc}</div>

                  {/* Conteúdo específico de cada passo */}
                  {isActive && (
                    <div style={{ marginTop: '1rem' }}>
                      {step.id === 'download' && (
                        <a
                          href="/extension/extensao_lexie.zip"
                          download="extensao_lexie.zip"
                          className="btn-primary"
                          style={{ display: 'inline-flex', gap: '0.4rem', fontSize: '0.85rem' }}
                          onClick={() => setTimeout(next, 1500)}
                        >
                          ⬇ Baixar extensão (.zip)
                        </a>
                      )}

                      {step.id === 'extract' && (
                        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.875rem', fontSize: '0.8rem', lineHeight: 1.7, color: 'var(--text2)' }}>
                          <strong>Windows:</strong> Clique com botão direito no .zip → <em>"Extrair tudo..."</em><br />
                          <strong>Mac:</strong> Duplo clique no .zip<br />
                          <br />
                          ⚠️ Guarde a pasta em um local permanente — se mover depois, a extensão para de funcionar.
                        </div>
                      )}

                      {step.id === 'enable' && (
                        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.875rem', fontSize: '0.8rem', lineHeight: 1.7, color: 'var(--text2)' }}>
                          <ol style={{ margin: 0, paddingLeft: '1.1rem' }}>
                            <li>Abra uma nova aba no Chrome</li>
                            <li>Digite <code style={{ background: 'var(--surface2)', padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.78rem' }}>chrome://extensions</code> na barra de endereço</li>
                            <li>No canto superior direito, ative o <strong>Modo do desenvolvedor</strong></li>
                          </ol>
                          <a
                            href="chrome://extensions"
                            target="_blank"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.75rem', color: 'var(--green)', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}
                          >
                            Abrir chrome://extensions ↗
                          </a>
                        </div>
                      )}

                      {step.id === 'load' && (
                        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.875rem', fontSize: '0.8rem', lineHeight: 1.7, color: 'var(--text2)' }}>
                          <ol style={{ margin: 0, paddingLeft: '1.1rem' }}>
                            <li>Na página de extensões, clique em <strong>"Carregar sem compactação"</strong></li>
                            <li>Navegue até a pasta que você extraiu no passo anterior</li>
                            <li>Selecione a pasta (não o arquivo .zip)</li>
                            <li>A extensão Lexie aparecerá na lista ✅</li>
                          </ol>
                        </div>
                      )}

                      {step.id === 'done' && (
                        <div style={{ background: 'white', border: '1px solid rgba(76,175,80,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.875rem', fontSize: '0.8rem', lineHeight: 1.7, color: 'var(--text2)' }}>
                          <strong>Como usar:</strong>
                          <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
                            <li>Crie uma consulta na plataforma e copie o <strong>ID da Consulta</strong></li>
                            <li>Cole o ID na extensão antes de iniciar a gravação</li>
                            <li>Clique em <strong>Gravar</strong> na extensão durante a videochamada</li>
                            <li>Ao terminar, clique em <strong>Parar</strong> — o áudio será enviado automaticamente</li>
                          </ol>
                        </div>
                      )}

                      {step.id !== 'download' && step.id !== 'done' && (
                        <button onClick={next} className="btn-primary" style={{ marginTop: '0.875rem', fontSize: '0.82rem' }}>
                          Feito, próximo passo →
                        </button>
                      )}

                      {step.id === 'done' && (
                        <Link href="/dashboard" className="btn-primary" style={{ display: 'inline-flex', marginTop: '0.875rem', fontSize: '0.82rem' }}>
                          Ir para o Dashboard →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Suporte */}
      <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text3)' }}>
        Dúvidas? Entre em contato pelo suporte ou{' '}
        <a href="mailto:suporte@lexie.app" style={{ color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}>
          suporte@lexie.app
        </a>
      </div>
    </div>
  )
}