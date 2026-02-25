// @route apps/web/app/(platform)/session/[id]/page.tsx
'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Session {
  id: string; patient_name: string; session_type: string
  notes: string | null; anchor_words: string[]; status: string; created_at: string
}
interface AudioUpload { status: string; transcription: string | null }
type PageParams = { params: Promise<{ id: string }> }

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB

export default function SessionPage({ params }: PageParams) {
  const { id } = use(params)
  const router  = useRouter()

  const [session,      setSession]      = useState<Session | null>(null)
  const [audioUpload,  setAudioUpload]  = useState<AudioUpload | null>(null)
  const [notes,        setNotes]        = useState('')
  const [anchorInput,  setAnchorInput]  = useState('')
  const [anchorWords,  setAnchorWords]  = useState<string[]>([])
  const [saveStatus,   setSaveStatus]   = useState<'saved' | 'saving' | 'idle'>('idle')
  const [generating,   setGenerating]   = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(true)
  // Upload manual
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [retrying,       setRetrying]       = useState(false)
  const [uploadError,    setUploadError]    = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Load session ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/session/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.session) { setSession(d.session); setNotes(d.session.notes ?? ''); setAnchorWords(d.session.anchor_words ?? []) }
      })
      .finally(() => setLoading(false))
  }, [id])

  // ─── Poll audio status ─────────────────────────────────────────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout
    const poll = () => fetch(`/api/audio/status/${id}`).then(r => r.json()).then(d => { if (d.upload) setAudioUpload(d.upload) })
    poll()
    if (session?.status === 'processing' || uploadProgress !== null) {
      interval = setInterval(() => { poll(); if (audioUpload?.status === 'transcribed') clearInterval(interval) }, 4000)
    }
    return () => clearInterval(interval)
  }, [id, session?.status, audioUpload?.status, uploadProgress])

  // ─── Auto-save notes ───────────────────────────────────────────────────────
  const saveNotes = useCallback(async (value: string) => {
    setSaveStatus('saving')
    await fetch(`/api/session/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: value }) })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [id])

  useEffect(() => {
    if (!session) return
    const t = setTimeout(() => saveNotes(notes), 900)
    return () => clearTimeout(t)
  }, [notes, session, saveNotes])

  // ─── Anchor words ──────────────────────────────────────────────────────────
  async function addAnchor() {
    const word = anchorInput.trim()
    if (!word || anchorWords.includes(word)) return
    const updated = [...anchorWords, word]
    setAnchorWords(updated); setAnchorInput('')
    await fetch(`/api/session/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anchor_words: updated }) })
  }

  async function removeAnchor(word: string) {
    const updated = anchorWords.filter(w => w !== word)
    setAnchorWords(updated)
    await fetch(`/api/session/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anchor_words: updated }) })
  }

  // ─── Copy session ID ───────────────────────────────────────────────────────
  function copyId() {
    navigator.clipboard.writeText(id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  // ─── Retry transcription ──────────────────────────────────────────────────
  async function handleRetry() {
    setRetrying(true)
    setUploadError('')
    try {
      const res = await fetch(`/api/audio/retry/${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Poll vai pegar o novo status
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setRetrying(false)
    }
  }

  // ─── Manual file upload ────────────────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploadProgress(0)

    try {
      // 1. Init
      const initRes = await fetch('/api/audio/upload-init', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, mimeType: file.type || 'audio/webm', totalBytes: file.size }),
      })
      if (!initRes.ok) throw new Error('Falha ao iniciar upload')
      const { uploadId } = await initRes.json()

      // 2. Chunks
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
      for (let i = 0; i < totalChunks; i++) {
        const chunk   = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        const form    = new FormData()
        form.append('chunk', chunk)
        const res = await fetch('/api/audio/upload-chunk', {
          method: 'POST',
          headers: { 'x-upload-id': uploadId, 'x-chunk-index': String(i), 'x-total-chunks': String(totalChunks), 'x-session-id': id },
          body: form,
        })
        if (!res.ok) throw new Error(`Falha no chunk ${i + 1}`)
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 80))
      }

      // 3. Finalize
      setUploadProgress(85)
      const finalRes = await fetch('/api/audio/upload-finalize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, sessionId: id, mimeType: file.type || 'audio/webm' }),
      })
      if (!finalRes.ok) {
        const err = await finalRes.json()
        throw new Error(err.error || 'Falha ao finalizar')
      }

      setUploadProgress(100)
      setTimeout(() => setUploadProgress(null), 1500)

      // Refresh audio status
      const statusRes = await fetch(`/api/audio/status/${id}`)
      const statusData = await statusRes.json()
      if (statusData.upload) setAudioUpload(statusData.upload)

    } catch (err: any) {
      setUploadError(err.message)
      setUploadProgress(null)
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Generate report ───────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true); setError('')
    try {
      const res  = await fetch(`/api/report/${id}/generate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/session/${id}/report`)
    } catch (err: any) { setError(err.message); setGenerating(false) }
  }

  if (loading) return <SessionSkeleton />
  if (!session) return (
    <div className="empty-state">
      <p>Consulta não encontrada.</p>
      <Link href="/dashboard" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>← Voltar</Link>
    </div>
  )

  const canGenerate  = audioUpload?.status === 'transcribed'
  const isProcessing = session.status === 'processing' || audioUpload?.status === 'uploading'
  const isUploading  = uploadProgress !== null && uploadProgress < 100

  return (
    <div className="fade-up">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text3)', marginBottom: '1.25rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>Dashboard</Link>
        <span>›</span>
        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{session.patient_name}</span>
      </div>

      {/* Patient header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--green-light), var(--olive-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9rem', fontWeight: 700, color: 'var(--green-dark)',
          }}>
            {session.patient_name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem' }}>{session.patient_name}</h1>
            <div style={{ fontSize: '0.76rem', color: 'var(--text3)', marginTop: '0.15rem' }}>
              {session.session_type === 'online' ? '🌐 Online' : '🏥 Presencial'} · {new Date(session.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {session.status === 'done' && <Link href={`/session/${id}/report`} className="btn-secondary">Ver Relatório</Link>}
          <span className={`pill pill-${session.status === 'processing' ? 'processing' : session.status}`}>
            {{ done: 'Concluída', processing: 'Processando', draft: 'Rascunho', error: 'Erro' }[session.status] ?? session.status}
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Main editor */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <label className="section-label">📝 Anotações da Consulta</label>
              <span style={{ fontSize: '0.68rem', color: saveStatus === 'saving' ? 'var(--olive)' : 'var(--text3)' }}>
                {saveStatus === 'saving' ? '⏳ Salvando…' : saveStatus === 'saved' ? '✓ Salvo' : ''}
              </span>
            </div>
            <textarea className="textarea" style={{ height: '180px' }}
              placeholder="Digite aqui suas observações durante a consulta: queixas, histórico, dados objetivos, conduta…"
              value={notes} onChange={e => setNotes(e.target.value)} />
            <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textAlign: 'right', marginTop: '0.3rem' }}>{notes.length} caracteres</div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: '0.45rem' }}>🏷 Palavras-âncora</label>
            <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              Termos importantes da consulta que a IA deve destacar no relatório.
            </p>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input className="input" placeholder="Ex: hipertensão, proteína, perda de peso…"
                value={anchorInput} onChange={e => setAnchorInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAnchor())} />
              <button className="btn-primary" onClick={addAnchor} style={{ whiteSpace: 'nowrap' }}>+ Adicionar</button>
            </div>
            {anchorWords.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.75rem' }}>
                {anchorWords.map(w => (
                  <span key={w} onClick={() => removeAnchor(w)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.25rem 0.65rem', background: 'var(--green-light)',
                    border: '1px solid rgba(76,175,80,0.2)', borderRadius: '99px',
                    fontSize: '0.74rem', color: 'var(--green-dark)', fontWeight: 500, cursor: 'pointer',
                  }}>
                    {w}<span style={{ opacity: 0.5, fontSize: '0.7rem' }}>×</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Audio card */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.875rem', color: 'var(--text)' }}>
              🎙 Áudio da Consulta
            </h4>

            {/* Session ID copy */}
            <div style={{ marginBottom: '0.875rem' }}>
              <div className="section-label" style={{ display: 'block', marginBottom: '0.35rem' }}>ID da Consulta</div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <div style={{
                  flex: 1, padding: '0.38rem 0.6rem', background: 'var(--surface2)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  fontFamily: '"DM Mono", monospace', fontSize: '0.65rem', color: 'var(--text2)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{id}</div>
                <button onClick={copyId} style={{
                  padding: '0.38rem 0.65rem',
                  background: copied ? 'var(--green-light)' : 'var(--surface2)',
                  border: `1px solid ${copied ? 'rgba(76,175,80,0.3)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  fontSize: '0.78rem', color: copied ? 'var(--green-dark)' : 'var(--text2)',
                  whiteSpace: 'nowrap', transition: 'all 0.2s', fontFamily: '"DM Sans", sans-serif',
                }}>{copied ? '✓ Copiado' : '📋 Copiar'}</button>
              </div>
              <p style={{ fontSize: '0.67rem', color: 'var(--text3)', marginTop: '0.35rem', lineHeight: 1.45 }}>
                Cole esse ID na extensão antes de iniciar a gravação.
              </p>
            </div>

            <div style={{ height: 1, background: 'var(--border)', marginBottom: '0.875rem' }} />

            {/* Audio status */}
            {!audioUpload && !isUploading && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{
                  border: '2px dashed var(--border2)', borderRadius: 'var(--radius-sm)',
                  padding: '1rem', textAlign: 'center', background: 'var(--surface2)', marginBottom: '0.75rem',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>🎧</div>
                  <div style={{ fontSize: '0.77rem', fontWeight: 600, color: 'var(--text2)' }}>Sem gravação</div>
                  <div style={{ fontSize: '0.67rem', color: 'var(--text3)' }}>Use a extensão Chrome ou envie um arquivo</div>
                </div>
              </div>
            )}

            {/* Manual upload area */}
            {!audioUpload && (
              <>
                <input ref={fileInputRef} type="file"
                  accept="audio/*,video/webm,video/mp4"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }} id="audio-file-input" />

                {isUploading ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text2)', marginBottom: '0.35rem' }}>
                      <span>📤 Enviando áudio…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--green)', borderRadius: 99, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: '0.67rem', color: 'var(--text3)', marginTop: '0.35rem' }}>
                      {uploadProgress! >= 85 ? 'Transcrevendo com Whisper…' : 'Enviando chunks…'}
                    </div>
                  </div>
                ) : (
                  <label htmlFor="audio-file-input" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    padding: '0.52rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    border: '1.5px dashed var(--green)', background: 'var(--green-light)',
                    fontSize: '0.78rem', fontWeight: 600, color: 'var(--green-dark)',
                    transition: 'all 0.15s',
                  }}>
                    📁 Enviar arquivo de áudio
                  </label>
                )}

                {uploadError && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--red)', background: 'var(--red-light)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                    ⚠ {uploadError}
                  </div>
                )}
                <p style={{ fontSize: '0.67rem', color: 'var(--text3)', marginTop: '0.4rem', textAlign: 'center' }}>
                  Aceita .webm, .mp3, .mp4, .m4a, .ogg
                </p>
              </>
            )}

            {/* Status steps */}
            {audioUpload && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <StatusStep
                  done={['assembling','transcribing','transcribed','deleted'].includes(audioUpload.status)}
                  active={audioUpload.status === 'uploading'}
                  label="Upload enviado"
                  icon="📤"
                />
                <StatusStep
                  done={['transcribing','transcribed','deleted'].includes(audioUpload.status)}
                  active={audioUpload.status === 'assembling'}
                  label="Montando arquivo"
                  icon="🔧"
                />
                <StatusStep
                  done={['transcribed','deleted'].includes(audioUpload.status)}
                  active={audioUpload.status === 'transcribing'}
                  label="Transcrevendo com Whisper"
                  icon="🎙"
                  hint={audioUpload.status === 'transcribing' ? 'Pode levar 1-3 min para arquivos grandes' : undefined}
                />
                {audioUpload.status === 'transcribed' && (
                  <div style={{ padding: '0.6rem 0.75rem', background: 'var(--green-light)', border: '1px solid rgba(76,175,80,0.2)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>✅</span>
                    <div>
                      <div style={{ fontSize: '0.77rem', color: 'var(--green-dark)', fontWeight: 600 }}>Transcrição pronta!</div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--green-dark)', opacity: 0.7 }}>{audioUpload.transcription?.length ?? 0} caracteres</div>
                    </div>
                  </div>
                )}
                {audioUpload.status === 'error' && (
                  <div style={{ padding: '0.65rem 0.75rem', background: 'var(--red-light)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.77rem', color: 'var(--red)', marginBottom: '0.5rem' }}>⚠ Erro na transcrição.</div>
                    <button onClick={handleRetry} disabled={retrying} style={{
                      width: '100%', padding: '0.42rem', borderRadius: 'var(--radius-sm)',
                      background: retrying ? 'var(--border)' : 'var(--red)', color: 'white',
                      border: 'none', cursor: retrying ? 'not-allowed' : 'pointer',
                      fontSize: '0.78rem', fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    }}>
                      {retrying ? <><span className="spinner" /> Tentando…</> : '🔄 Tentar novamente'}
                    </button>
                  </div>
                )}
                {audioUpload.status === 'deleted' && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text3)', padding: '0.35rem 0' }}>
                    🗑 Áudio deletado após 24h (transcrição preservada)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Generate button */}
          <button className="btn-primary" style={{
            width: '100%', padding: '0.875rem', fontSize: '0.95rem', fontWeight: 700,
            boxShadow: canGenerate ? '0 4px 16px rgba(76,175,80,0.35)' : 'none',
            opacity: canGenerate && !generating ? 1 : 0.5, justifyContent: 'center',
          }}
            disabled={!canGenerate || generating} onClick={handleGenerate}>
            {generating ? <><span className="spinner" /> Gerando…</> : canGenerate ? '✨ Gerar Relatório' : '⏳ Aguardando transcrição'}
          </button>

          {error && (
            <div style={{ padding: '0.65rem 0.875rem', background: 'var(--red-light)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--red)' }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ padding: '0.6rem 0.75rem', background: 'var(--gold-light)', border: '1px solid rgba(233,196,106,0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', color: '#8B6914', lineHeight: 1.5 }}>
            🔒 O áudio é deletado automaticamente após 24h. Apenas a transcrição é armazenada.
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusStep({ done, active, label, icon, hint }: {
  done: boolean; active: boolean; label: string; icon: string; hint?: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: '0.5rem 0.65rem', borderRadius: 'var(--radius-sm)',
      background: done ? 'var(--green-light)' : active ? 'var(--orange-light)' : 'var(--surface2)',
      border: `1px solid ${done ? 'rgba(76,175,80,0.2)' : active ? 'rgba(242,148,62,0.2)' : 'var(--border)'}`,
      transition: 'all 0.3s',
    }}>
      <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>
        {done ? '✅' : active ? '⏳' : '⬜'}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '0.75rem', fontWeight: 600,
          color: done ? 'var(--green-dark)' : active ? '#C26A2A' : 'var(--text3)',
        }}>{icon} {label}</div>
        {active && hint && (
          <div style={{ fontSize: '0.65rem', color: '#C26A2A', opacity: 0.8, marginTop: '0.1rem' }}>{hint}</div>
        )}
      </div>
      {active && <span className="spinner dark" style={{ borderTopColor: active ? 'var(--orange)' : 'var(--green)', flexShrink: 0 }} />}
    </div>
  )
}

function SessionSkeleton() {
  return (
    <div className="fade-up">
      <div className="skeleton" style={{ width: 200, height: 14, marginBottom: '1.5rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.25rem' }}>
        <div className="card" style={{ padding: '1.25rem', height: 400 }}>
          <div className="skeleton" style={{ height: 14, width: '30%', marginBottom: '0.75rem' }} />
          <div className="skeleton" style={{ height: 180 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="card skeleton" style={{ height: 220 }} />
          <div className="skeleton" style={{ height: 52, borderRadius: 'var(--radius)' }} />
        </div>
      </div>
    </div>
  )
}