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
interface Template    { id: string; title: string; content: string }
type PageParams = { params: Promise<{ id: string }> }

const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB

// ── Modal de transcrição ──────────────────────────────────────────────────────
function TranscriptionModal({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 'var(--radius)', width: '100%', maxWidth: 680,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>🎙 Transcrição da Consulta</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{text}</p>
        </div>
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={() => navigator.clipboard.writeText(text)} style={{
            padding: '0.42rem 0.875rem', borderRadius: '6px', border: '1px solid var(--border)',
            background: 'none', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--text2)',
          }}>📋 Copiar</button>
          <button onClick={onClose} className="btn-primary" style={{ fontSize: '0.78rem' }}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de criar/editar modelo ──────────────────────────────────────────────
function TemplateModal({ initial, onSave, onClose }: {
  initial?: Template; onSave: (t: Template) => void; onClose: () => void
}) {
  const [title,   setTitle]   = useState(initial?.title   ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleSave() {
    if (!title.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError('')
    try {
      const url    = initial ? `/api/templates/${initial.id}` : '/api/templates'
      const method = initial ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }) })
      const data   = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSave(data.template)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 'var(--radius)', width: '100%', maxWidth: 540, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>{initial ? 'Editar Modelo' : '✦ Novo Modelo de Anamnese'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text3)' }}>×</button>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>Nome do modelo</label>
            <input className="input" placeholder='Ex: "Primeira consulta adulto"' value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>Conteúdo do modelo</label>
            <textarea className="textarea" rows={8}
              placeholder="Queixa principal:&#10;Histórico alimentar:&#10;Dados antropométricos:&#10;Medicamentos em uso:&#10;Alergias:&#10;Objetivos:"
              value={content} onChange={e => setContent(e.target.value)}
              style={{ resize: 'vertical' }} />
          </div>
          {error && <p style={{ fontSize: '0.75rem', color: 'var(--red)' }}>⚠ {error}</p>}
        </div>
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onClose} style={{ padding: '0.42rem 0.875rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'none', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--text2)' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: '0.78rem' }}>
            {saving ? 'Salvando…' : '✓ Salvar modelo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function SessionPage({ params }: PageParams) {
  const { id } = use(params)
  const router  = useRouter()

  const [session,       setSession]       = useState<Session | null>(null)
  const [audioUpload,   setAudioUpload]   = useState<AudioUpload | null>(null)
  const [notes,         setNotes]         = useState('')
  const [anchorInput,   setAnchorInput]   = useState('')
  const [anchorWords,   setAnchorWords]   = useState<string[]>([])
  const [saveStatus,    setSaveStatus]    = useState<'saved' | 'saving' | 'idle'>('idle')
  const [generating,    setGenerating]    = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [error,         setError]         = useState('')
  const [loading,       setLoading]       = useState(true)
  const [uploadProgress,setUploadProgress]= useState<number | null>(null)
  const [retrying,      setRetrying]      = useState(false)
  const [uploadError,   setUploadError]   = useState('')
  const [cancelling,    setCancelling]    = useState(false)

  // Templates
  const [templates,      setTemplates]      = useState<Template[]>([])
  const [showTemplates,  setShowTemplates]  = useState(false)
  const [templateModal,  setTemplateModal]  = useState(false)
  const [editTemplate,   setEditTemplate]   = useState<Template | undefined>()

  // Modais
  const [showTranscription, setShowTranscription] = useState(false)

  const fileInputRef    = useRef<HTMLInputElement>(null)
  const abortController = useRef<AbortController | null>(null)

  // ─── Load session ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/session/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.session) { setSession(d.session); setNotes(d.session.notes ?? ''); setAnchorWords(d.session.anchor_words ?? []) }
      })
      .finally(() => setLoading(false))
  }, [id])

  // ─── Load templates ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(d => setTemplates(d.templates ?? []))
  }, [])

  // ─── Poll audio status ───────────────────────────────────────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout
    const poll = () => fetch(`/api/audio/status/${id}`).then(r => r.json()).then(d => { if (d.upload) setAudioUpload(d.upload) })
    poll()
    if (session?.status === 'processing' || uploadProgress !== null) {
      interval = setInterval(() => { poll(); if (audioUpload?.status === 'transcribed') clearInterval(interval) }, 4000)
    }
    return () => clearInterval(interval)
  }, [id, session?.status, audioUpload?.status, uploadProgress])

  // ─── Auto-save notes ─────────────────────────────────────────────────────
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

  // ─── Anchor words ────────────────────────────────────────────────────────
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

  // ─── Copy session ID ─────────────────────────────────────────────────────
  function copyId() {
    navigator.clipboard.writeText(id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  // ─── Apply template ──────────────────────────────────────────────────────
  function applyTemplate(t: Template) {
    const separator = notes.trim() ? '\n\n---\n\n' : ''
    setNotes(prev => prev.trim() ? prev + separator + t.content : t.content)
    setShowTemplates(false)
  }

  // ─── Delete template ─────────────────────────────────────────────────────
  async function deleteTemplate(t: Template) {
    if (!confirm(`Deletar o modelo "${t.title}"?`)) return
    await fetch(`/api/templates/${t.id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(x => x.id !== t.id))
  }

  // ─── Retry transcription ─────────────────────────────────────────────────
  async function handleRetry() {
    setRetrying(true); setUploadError('')
    try {
      const res = await fetch(`/api/audio/retry/${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setRetrying(false)
    }
  }

  // ─── Cancel upload ──────────────────────────────────────────────────────────
  async function cancelUpload() {
    setCancelling(true)
    // Aborta fetch em andamento
    if (abortController.current) {
      abortController.current.abort()
      abortController.current = null
    }
    try {
      await fetch(`/api/audio/cancel/${id}`, { method: 'POST' })
    } catch {}
    setAudioUpload(null)
    setUploadProgress(null)
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setCancelling(false)
  }

  // ─── Manual file upload ──────────────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(''); setUploadProgress(0)
    abortController.current = new AbortController()
    const signal = abortController.current.signal
    try {
      const initRes = await fetch('/api/audio/upload-init', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, mimeType: file.type || 'audio/webm', totalBytes: file.size }),
      })
      if (!initRes.ok) throw new Error('Falha ao iniciar upload')
      const { uploadId } = await initRes.json()

      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        const form  = new FormData()
        form.append('chunk', chunk)
        const res = await fetch('/api/audio/upload-chunk', {
          method: 'POST',
          headers: { 'x-upload-id': uploadId, 'x-chunk-index': String(i), 'x-total-chunks': String(totalChunks), 'x-session-id': id },
          body: form,
          signal,
        })
        if (!res.ok) throw new Error(`Falha no chunk ${i + 1}`)
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 80))
      }

      setUploadProgress(85)
      const finalRes = await fetch('/api/audio/upload-finalize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, sessionId: id, mimeType: file.type || 'audio/webm' }),
      })
      if (!finalRes.ok) { const err = await finalRes.json(); throw new Error(err.error || 'Falha ao finalizar') }

      setUploadProgress(100)
      setTimeout(() => setUploadProgress(null), 1500)
      const statusData = await fetch(`/api/audio/status/${id}`).then(r => r.json())
      if (statusData.upload) setAudioUpload(statusData.upload)
    } catch (err: any) {
      if (err.name === 'AbortError') return // cancelado pelo usuário
      setUploadError(err.message); setUploadProgress(null)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Generate report ─────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true); setError('')
    try {
      const res  = await fetch(`/api/report/${id}/generate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/session/${id}/report`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <SessionSkeleton />

  if (!session) return (
    <div className="empty-state">
      <p>Sessão não encontrada.</p>
      <Link href="/dashboard" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>← Dashboard</Link>
    </div>
  )

  const isDone       = session.status === 'done'
  const isUploading  = uploadProgress !== null
  const canGenerate  = audioUpload?.status === 'transcribed' && !generating
  const statusLabel: Record<string, string> = { done: 'Concluída', processing: 'Processando', draft: 'Rascunho', error: 'Erro' }

  return (
    <div className="fade-up">
      {/* Modais */}
      {showTranscription && audioUpload?.transcription && (
        <TranscriptionModal text={audioUpload.transcription} onClose={() => setShowTranscription(false)} />
      )}
      {templateModal && (
        <TemplateModal
          initial={editTemplate}
          onSave={t => {
            setTemplates(prev => editTemplate ? prev.map(x => x.id === t.id ? t : x) : [t, ...prev])
            setTemplateModal(false); setEditTemplate(undefined)
          }}
          onClose={() => { setTemplateModal(false); setEditTemplate(undefined) }}
        />
      )}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text3)', marginBottom: '1.25rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>Dashboard</Link>
        <span>›</span>
        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{session.patient_name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, color: 'var(--green-dark)' }}>
            {session.patient_name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem' }}>{session.patient_name}</h1>
            <div style={{ fontSize: '0.74rem', color: 'var(--text3)', marginTop: '0.1rem' }}>
              {session.session_type === 'online' ? '🌐 Online' : '🏥 Presencial'} · {new Date(session.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isDone && (
            <Link href={`/session/${id}/report`} className="btn-secondary" style={{ fontSize: '0.82rem' }}>Ver Relatório</Link>
          )}
          <span className={`pill pill-${session.status === 'processing' ? 'processing' : session.status}`} style={{ fontSize: '0.72rem' }}>
            {statusLabel[session.status] ?? session.status}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.25rem' }}>

        {/* Left — Anamnese */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Campo Anamnese */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span className="section-label">📋 Anamnese</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {saveStatus === 'saving' && <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>Salvando…</span>}
                {saveStatus === 'saved'  && <span style={{ fontSize: '0.7rem', color: 'var(--green)' }}>✓ Salvo</span>}

                {/* Dropdown de modelos */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowTemplates(v => !v)}
                    style={{ padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'none', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }}
                  >
                    📄 Modelos {templates.length > 0 ? `(${templates.length})` : ''}
                  </button>

                  {showTemplates && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, zIndex: 100, marginTop: '0.25rem',
                      background: 'white', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)',
                      boxShadow: 'var(--shadow-md)', minWidth: 260, maxHeight: 320, overflowY: 'auto',
                    }}>
                      <div style={{ padding: '0.6rem 0.875rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text2)' }}>Modelos de Anamnese</span>
                        <button onClick={() => { setShowTemplates(false); setEditTemplate(undefined); setTemplateModal(true) }}
                          style={{ fontSize: '0.7rem', color: 'var(--green)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                          + Novo
                        </button>
                      </div>

                      {templates.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text3)' }}>
                          Nenhum modelo criado ainda.
                          <br />
                          <button onClick={() => { setShowTemplates(false); setTemplateModal(true) }}
                            style={{ marginTop: '0.5rem', color: 'var(--green)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem' }}>
                            Criar primeiro modelo →
                          </button>
                        </div>
                      ) : (
                        templates.map(t => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                            <button onClick={() => applyTemplate(t)} style={{
                              flex: 1, padding: '0.65rem 0.875rem', textAlign: 'left',
                              background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem',
                              color: 'var(--text)', fontFamily: 'inherit',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-light)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                              {t.title}
                            </button>
                            <button onClick={() => { setEditTemplate(t); setShowTemplates(false); setTemplateModal(true) }}
                              title="Editar" style={{ padding: '0.65rem 0.5rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text3)' }}>✏</button>
                            <button onClick={() => deleteTemplate(t)}
                              title="Deletar" style={{ padding: '0.65rem 0.5rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text3)' }}>🗑</button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <textarea
              className="textarea"
              placeholder="Anote aqui as observações da consulta: queixas, histórico alimentar, dados antropométricos, conduta…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ height: 220, resize: 'vertical' }}
            />
            <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textAlign: 'right', marginTop: '0.25rem' }}>
              {notes.length} caracteres
            </div>
          </div>

          {/* Palavras-âncora */}
          <div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span className="section-label">🔖 Palavras-chave</span>
              <p style={{ fontSize: '0.74rem', color: 'var(--text3)', marginTop: '0.2rem' }}>
                Termos importantes da consulta que a IA deve destacar no relatório.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input className="input" placeholder="Ex: hipertensão, proteína, perda de peso…" value={anchorInput}
                onChange={e => setAnchorInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAnchor())}
                style={{ flex: 1 }} />
              <button className="btn-primary" onClick={addAnchor} style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>+ Adicionar</button>
            </div>
            {anchorWords.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {anchorWords.map(w => (
                  <span key={w} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.22rem 0.65rem', background: 'var(--green-light)',
                    border: '1px solid rgba(76,175,80,0.25)', borderRadius: '99px',
                    fontSize: '0.75rem', color: 'var(--green-dark)', fontWeight: 500,
                  }}>
                    {w}
                    <button onClick={() => removeAnchor(w)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--green-dark)', opacity: 0.6, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — Áudio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="card" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <span className="section-label">🎙 Áudio da Consulta</span>

            {/* Session ID */}
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>ID da Consulta</div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input readOnly value={id} style={{ flex: 1, padding: '0.38rem 0.6rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.72rem', fontFamily: 'monospace', background: 'var(--surface2)', color: 'var(--text2)', minWidth: 0 }} />
                <button onClick={copyId} style={{ padding: '0.38rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border)', background: copied ? 'var(--green-light)' : 'white', fontSize: '0.72rem', cursor: 'pointer', color: copied ? 'var(--green-dark)' : 'var(--text2)', whiteSpace: 'nowrap' }}>
                  {copied ? '✓' : '📋'} {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p style={{ fontSize: '0.67rem', color: 'var(--text3)', marginTop: '0.3rem' }}>Cole esse ID na extensão antes de iniciar a gravação.</p>
            </div>

            {/* Upload manual */}
            {!audioUpload && (
              <>
                <input ref={fileInputRef} type="file" accept="audio/*,video/webm,video/mp4" onChange={handleFileUpload} style={{ display: 'none' }} id="audio-file-input" />
                {isUploading ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text2)', marginBottom: '0.35rem' }}>
                      <span>📤 Enviando áudio…</span><span>{uploadProgress}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--green)', borderRadius: 99, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: '0.67rem', color: 'var(--text3)', marginTop: '0.35rem' }}>{uploadProgress! >= 85 ? 'Transcrevendo com Whisper…' : 'Enviando chunks…'}</div>
                  <button onClick={cancelUpload} disabled={cancelling} style={{ marginTop: '0.5rem', width: '100%', padding: '0.35rem', borderRadius: '6px', border: '1px solid rgba(229,62,62,0.3)', background: 'none', fontSize: '0.72rem', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {cancelling ? 'Cancelando…' : '✕ Cancelar upload'}
                  </button>
                  </div>
                ) : (
                  <label htmlFor="audio-file-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.52rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1.5px dashed var(--green)', background: 'var(--green-light)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--green-dark)', transition: 'all 0.15s' }}>
                    📁 Enviar arquivo de áudio
                  </label>
                )}
                {uploadError && <div style={{ fontSize: '0.72rem', color: 'var(--red)', background: 'var(--red-light)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>⚠ {uploadError}</div>}
                <p style={{ fontSize: '0.67rem', color: 'var(--text3)', textAlign: 'center' }}>Aceita .webm, .mp3, .mp4, .m4a, .ogg, .wav</p>
              </>
            )}

            {/* Status steps */}
            {audioUpload && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <StatusStep done={['assembling','transcribing','transcribed','deleted'].includes(audioUpload.status)} active={audioUpload.status === 'uploading'} label="Upload enviado" icon="📤" />
                <StatusStep done={['transcribing','transcribed','deleted'].includes(audioUpload.status)} active={audioUpload.status === 'assembling'} label="Montando arquivo" icon="🔧" />
                <StatusStep done={['transcribed','deleted'].includes(audioUpload.status)} active={audioUpload.status === 'transcribing'} label="Transcrevendo com Whisper" icon="🎙" hint={audioUpload.status === 'transcribing' ? 'Pode levar 1-3 min para arquivos grandes' : undefined} />

                {(audioUpload.status === 'uploading' || audioUpload.status === 'assembling' || audioUpload.status === 'transcribing') && (
                  <button onClick={cancelUpload} disabled={cancelling} style={{ width: '100%', padding: '0.38rem', borderRadius: '6px', border: '1px solid rgba(229,62,62,0.3)', background: 'none', fontSize: '0.73rem', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', marginTop: '0.2rem' }}>
                    {cancelling ? 'Cancelando…' : '✕ Cancelar'}
                  </button>
                )}

                {audioUpload.status === 'transcribed' && (
                  <div style={{ padding: '0.6rem 0.75rem', background: 'var(--green-light)', border: '1px solid rgba(76,175,80,0.2)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span>✅</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.77rem', color: 'var(--green-dark)', fontWeight: 600 }}>Transcrição pronta!</div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--green-dark)', opacity: 0.7 }}>{audioUpload.transcription?.length ?? 0} caracteres</div>
                      </div>
                    </div>
                    <button onClick={() => setShowTranscription(true)} style={{
                      width: '100%', padding: '0.38rem', borderRadius: '6px',
                      border: '1px solid rgba(76,175,80,0.35)', background: 'white',
                      fontSize: '0.75rem', fontWeight: 600, color: 'var(--green-dark)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      👁 Ver transcrição completa
                    </button>
                  </div>
                )}

                {audioUpload.status === 'deleted' && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text3)', padding: '0.35rem 0' }}>
                    🗑 Áudio deletado após 24h (transcrição preservada)
                    {audioUpload.transcription && (
                      <button onClick={() => setShowTranscription(true)} style={{ display: 'block', marginTop: '0.3rem', color: 'var(--green)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.74rem', fontFamily: 'inherit' }}>
                        👁 Ver transcrição
                      </button>
                    )}
                  </div>
                )}

                {audioUpload.status === 'error' && (
                  <div style={{ padding: '0.65rem 0.75rem', background: 'var(--red-light)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.77rem', color: 'var(--red)', marginBottom: '0.5rem' }}>⚠ Erro na transcrição.</div>
                    <button onClick={handleRetry} disabled={retrying} style={{ width: '100%', padding: '0.42rem', borderRadius: 'var(--radius-sm)', background: retrying ? 'var(--border)' : 'var(--red)', color: 'white', border: 'none', cursor: retrying ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                      {retrying ? <><span className="spinner" /> Tentando…</> : '🔄 Tentar novamente'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Gerar relatório */}
          <button className="btn-primary" style={{ width: '100%', padding: '0.875rem', fontSize: '0.95rem', fontWeight: 700, boxShadow: canGenerate ? '0 4px 16px rgba(76,175,80,0.35)' : 'none', opacity: canGenerate && !generating ? 1 : 0.5, justifyContent: 'center' }}
            disabled={!canGenerate || generating} onClick={handleGenerate}>
            {generating ? <><span className="spinner" /> Gerando…</> : canGenerate ? '✨ Gerar Relatório' : '⏳ Aguardando transcrição'}
          </button>

          {error && <div style={{ padding: '0.65rem 0.875rem', background: 'var(--red-light)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--red)' }}>⚠ {error}</div>}

          <div style={{ padding: '0.6rem 0.75rem', background: 'var(--gold-light)', border: '1px solid rgba(233,196,106,0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', color: '#8B6914', lineHeight: 1.5 }}>
            🔒 O áudio é deletado automaticamente após 24h. Apenas a transcrição é armazenada.
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusStep({ done, active, label, icon, hint }: { done: boolean; active: boolean; label: string; icon: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.65rem', borderRadius: 'var(--radius-sm)', background: done ? 'var(--green-light)' : active ? 'var(--orange-light)' : 'var(--surface2)', border: `1px solid ${done ? 'rgba(76,175,80,0.2)' : active ? 'rgba(242,148,62,0.2)' : 'var(--border)'}`, transition: 'all 0.3s' }}>
      <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{done ? '✅' : active ? '⏳' : '⬜'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: done ? 'var(--green-dark)' : active ? '#C26A2A' : 'var(--text3)' }}>{icon} {label}</div>
        {active && hint && <div style={{ fontSize: '0.65rem', color: '#C26A2A', opacity: 0.8, marginTop: '0.1rem' }}>{hint}</div>}
      </div>
      {active && <span className="spinner dark" style={{ borderTopColor: 'var(--orange)', flexShrink: 0 }} />}
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