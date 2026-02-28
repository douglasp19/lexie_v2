// @route apps/web/app/(platform)/guia/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

type Section = {
  id: string
  icon: string
  title: string
  topics: Topic[]
}

type Topic = {
  id: string
  title: string
  content: React.ReactNode
}

const SECTIONS: Section[] = [
  {
    id: 'primeiros-passos',
    icon: '🚀',
    title: 'Primeiros Passos',
    topics: [
      {
        id: 'visao-geral',
        title: 'O que é o Lexie?',
        content: (
          <div>
            <p>O Lexie é um assistente de IA para nutricionistas que transcreve automaticamente suas consultas e gera relatórios clínicos prontos para o prontuário.</p>
            <p style={{ marginTop: '0.75rem' }}>O fluxo básico é:</p>
            <ol style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', lineHeight: 2 }}>
              <li>Crie uma consulta na plataforma</li>
              <li>Grave o áudio via extensão Chrome (teleconsulta) ou envie um arquivo de áudio</li>
              <li>O Whisper transcreve automaticamente</li>
              <li>Gere o relatório com um clique usando IA</li>
            </ol>
          </div>
        ),
      },
      {
        id: 'instalar-extensao',
        title: 'Instalar a extensão Chrome',
        content: (
          <div>
            <p>A extensão captura o áudio do seu navegador durante videochamadas (Google Meet, Zoom, etc.).</p>
            <Steps steps={[
              { n: 1, text: <>Acesse <Link href="/onboarding" style={{ color: 'var(--green)', fontWeight: 600 }}>Instalar Extensão</Link> e baixe o arquivo .zip</> },
              { n: 2, text: 'Descompacte o .zip em uma pasta permanente no seu computador' },
              { n: 3, text: <>Abra <code>chrome://extensions</code> no Chrome e ative o <strong>Modo do desenvolvedor</strong></> },
              { n: 4, text: 'Clique em "Carregar sem compactação" e selecione a pasta extraída' },
            ]} />
            <Tip>Não mova a pasta após instalar — isso desativa a extensão.</Tip>
          </div>
        ),
      },
    ],
  },
  {
    id: 'consultas',
    icon: '📋',
    title: 'Consultas',
    topics: [
      {
        id: 'nova-consulta',
        title: 'Criar uma nova consulta',
        content: (
          <div>
            <p>Clique em <strong>Nova Consulta</strong> no menu superior. Preencha:</p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', lineHeight: 2 }}>
              <li><strong>Nome do paciente</strong> — ou vincule a um paciente cadastrado</li>
              <li><strong>Tipo de consulta</strong> — Presencial ou Online</li>
            </ul>
            <p style={{ marginTop: '0.75rem' }}>Após criar, você verá a página da consulta com o <strong>ID da Consulta</strong> — copie esse ID antes de começar a gravar.</p>
          </div>
        ),
      },
      {
        id: 'gravar-extensao',
        title: 'Gravar via extensão (teleconsulta)',
        content: (
          <div>
            <Steps steps={[
              { n: 1, text: 'Crie a consulta e copie o ID exibido no topo da página' },
              { n: 2, text: 'Abra a extensão Lexie no Chrome (ícone na barra de ferramentas)' },
              { n: 3, text: 'Cole o ID da consulta no campo da extensão' },
              { n: 4, text: 'Inicie a videochamada normalmente e clique em Gravar na extensão' },
              { n: 5, text: 'Ao terminar, clique em Parar — o áudio é enviado automaticamente' },
            ]} />
            <Tip>A extensão grava o áudio do sistema (o que você ouve), não apenas o microfone. Isso captura tanto você quanto o paciente.</Tip>
          </div>
        ),
      },
      {
        id: 'enviar-arquivo',
        title: 'Enviar arquivo de áudio',
        content: (
          <div>
            <p>Para consultas presenciais ou gravações externas, você pode enviar um arquivo de áudio diretamente:</p>
            <Steps steps={[
              { n: 1, text: 'Na página da consulta, role até a seção "Áudio da Consulta"' },
              { n: 2, text: 'Clique em "Enviar arquivo de áudio"' },
              { n: 3, text: 'Selecione o arquivo (.webm, .mp3, .mp4, .m4a, .ogg, .wav)' },
              { n: 4, text: 'Aguarde o upload e a transcrição automática' },
            ]} />
            <Tip>Arquivos grandes são enviados em partes automaticamente. O áudio é deletado após 24h — apenas a transcrição é armazenada.</Tip>
          </div>
        ),
      },
      {
        id: 'anotacoes',
        title: 'Anotações e palavras-chave',
        content: (
          <div>
            <p>Durante ou após a consulta, use o campo de <strong>Anotações</strong> para registrar observações livres. As anotações são salvas automaticamente.</p>
            <p style={{ marginTop: '0.75rem' }}><strong>Palavras-chave</strong> são termos importantes que você quer que o relatório priorize — ex: <em>hipertensão</em>, <em>perda de peso</em>, <em>intolerância à lactose</em>.</p>
            <Tip>Use modelos de anamnese para preencher o campo de anotações rapidamente com sua estrutura preferida.</Tip>
          </div>
        ),
      },
      {
        id: 'cancelar-upload',
        title: 'Cancelar ou substituir um áudio',
        content: (
          <div>
            <p>Durante o upload ou a transcrição, aparece o botão <strong>✕ Cancelar</strong> abaixo dos passos de progresso.</p>
            <p style={{ marginTop: '0.75rem' }}>Se o upload foi cancelado ou deu erro sem arquivo, aparece o botão <strong>📁 Carregar outro arquivo</strong> para tentar novamente com um arquivo diferente.</p>
            <p style={{ marginTop: '0.75rem' }}>Se o erro ocorreu com o arquivo já armazenado, aparece <strong>🔄 Tentar novamente</strong> para reprocessar o mesmo arquivo.</p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'relatorio',
    icon: '✨',
    title: 'Relatório',
    topics: [
      {
        id: 'gerar-relatorio',
        title: 'Gerar relatório com IA',
        content: (
          <div>
            <p>Após a transcrição ficar pronta, o botão <strong>✨ Gerar Relatório</strong> é habilitado na página da consulta.</p>
            <Steps steps={[
              { n: 1, text: 'Confirme as anotações e palavras-chave (elas influenciam o relatório)' },
              { n: 2, text: 'Clique em "Gerar Relatório"' },
              { n: 3, text: 'Aguarde ~30 segundos — a IA analisa a transcrição completa' },
              { n: 4, text: 'Revise e edite as seções antes de usar no prontuário' },
            ]} />
            <Tip>O relatório é gerado com base na transcrição + suas anotações. Quanto mais detalhadas as anotações, melhor o resultado.</Tip>
          </div>
        ),
      },
      {
        id: 'editar-relatorio',
        title: 'Editar e exportar',
        content: (
          <div>
            <p>Na página do relatório, cada seção é editável. Clique no texto para editar diretamente — as alterações são salvas automaticamente.</p>
            <p style={{ marginTop: '0.75rem' }}>Para exportar:</p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', lineHeight: 2 }}>
              <li><strong>Copiar texto</strong> — copia o relatório completo para área de transferência</li>
              <li><strong>Exportar PDF</strong> — gera um PDF formatado (em breve)</li>
            </ul>
          </div>
        ),
      },
    ],
  },
  {
    id: 'pacientes',
    icon: '👤',
    title: 'Pacientes',
    topics: [
      {
        id: 'cadastrar-paciente',
        title: 'Cadastrar um paciente',
        content: (
          <div>
            <p>Acesse <strong>Pacientes</strong> no menu → <strong>Novo Paciente</strong>. Preencha os dados básicos:</p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', lineHeight: 2 }}>
              <li><strong>Nome</strong> (obrigatório)</li>
              <li>Email, telefone e data de nascimento (opcionais)</li>
            </ul>
            <p style={{ marginTop: '0.75rem' }}>Após cadastrar, a ficha do paciente exibe todas as consultas vinculadas a ele.</p>
          </div>
        ),
      },
      {
        id: 'vincular-paciente',
        title: 'Vincular paciente a uma consulta',
        content: (
          <div>
            <p>Ao criar uma nova consulta, você pode buscar e vincular um paciente já cadastrado. A consulta aparecerá automaticamente na ficha do paciente.</p>
            <Tip>Consultas não vinculadas ficam acessíveis apenas pelo dashboard, não pela ficha do paciente.</Tip>
          </div>
        ),
      },
      {
        id: 'ficha-paciente',
        title: 'Ficha do paciente',
        content: (
          <div>
            <p>A ficha exibe:</p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', lineHeight: 2 }}>
              <li>Dados cadastrais (editáveis)</li>
              <li>Histórico de consultas com status</li>
              <li>Idade calculada automaticamente</li>
            </ul>
          </div>
        ),
      },
    ],
  },
  {
    id: 'modelos',
    icon: '📝',
    title: 'Modelos de Anamnese',
    topics: [
      {
        id: 'criar-modelo',
        title: 'Criar um modelo',
        content: (
          <div>
            <p>Na página de uma consulta, clique em <strong>Modelos</strong> → <strong>+ Novo Modelo</strong>. Dê um nome e escreva o conteúdo estruturado da anamnese.</p>
            <p style={{ marginTop: '0.75rem' }}>Exemplo de conteúdo:</p>
            <pre style={{ background: 'var(--surface2)', padding: '0.875rem', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', lineHeight: 1.7, overflowX: 'auto', marginTop: '0.5rem' }}>
{`Queixa principal:
Histórico alimentar:
Dados antropométricos:
  Peso: | Altura: | IMC:
Recordatório 24h:
Medicamentos em uso:
Alergias e intolerâncias:
Objetivos:`}
            </pre>
          </div>
        ),
      },
      {
        id: 'usar-modelo',
        title: 'Aplicar um modelo',
        content: (
          <div>
            <p>Na página da consulta, clique em <strong>Modelos</strong> e selecione o modelo desejado. O conteúdo é inserido no campo de anotações.</p>
            <Tip>Se já houver texto nas anotações, o modelo é adicionado ao final com um separador — o conteúdo existente não é apagado.</Tip>
          </div>
        ),
      },
    ],
  },
  {
    id: 'privacidade',
    icon: '🔒',
    title: 'Privacidade e Segurança',
    topics: [
      {
        id: 'audio',
        title: 'O que acontece com o áudio?',
        content: (
          <div>
            <p>O áudio é armazenado de forma segura e <strong>deletado automaticamente após 24 horas</strong>. Apenas a transcrição em texto é mantida.</p>
            <p style={{ marginTop: '0.75rem' }}>O armazenamento usa Vercel Blob com acesso privado — os arquivos não são acessíveis publicamente.</p>
          </div>
        ),
      },
      {
        id: 'transcricao',
        title: 'Onde fica a transcrição?',
        content: (
          <div>
            <p>A transcrição é salva no banco de dados vinculada à sua conta. Apenas você tem acesso — nunca é compartilhada com terceiros.</p>
            <p style={{ marginTop: '0.75rem' }}>A transcrição é usada apenas para gerar o relatório e fica disponível para consulta na página da sessão.</p>
          </div>
        ),
      },
    ],
  },
]

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Steps({ steps }: { steps: { n: number; text: React.ReactNode }[] }) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: '0.875rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {steps.map(s => (
        <li key={s.n} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--green)', color: 'white', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{s.n}</span>
          <span style={{ fontSize: '0.83rem', color: 'var(--text)', lineHeight: 1.55 }}>{s.text}</span>
        </li>
      ))}
    </ol>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.65rem 0.875rem', background: 'var(--gold-light)', border: '1px solid rgba(233,196,106,0.3)', borderRadius: 'var(--radius-sm)', marginTop: '0.875rem', fontSize: '0.79rem', color: '#7a5c00', lineHeight: 1.5 }}>
      <span style={{ flexShrink: 0 }}>💡</span>
      <span>{children}</span>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function GuiaPage() {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id)
  const [activeTopic,   setActiveTopic]   = useState(SECTIONS[0].topics[0].id)

  const section = SECTIONS.find(s => s.id === activeSection)!
  const topic   = section.topics.find(t => t.id === activeTopic) ?? section.topics[0]

  function selectSection(sId: string) {
    setActiveSection(sId)
    setActiveTopic(SECTIONS.find(s => s.id === sId)!.topics[0].id)
  }

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text3)', marginBottom: '1.5rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--green)', fontWeight: 500, textDecoration: 'none' }}>Dashboard</Link>
        <span>›</span>
        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>Guia de Uso</span>
      </div>

      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📖 Guia de Uso</h1>
      <p style={{ fontSize: '0.83rem', color: 'var(--text3)', marginBottom: '1.75rem' }}>
        Tudo o que você precisa saber para usar o Lexie.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'sticky', top: '1rem' }}>
          {SECTIONS.map(sec => (
            <div key={sec.id}>
              <button
                onClick={() => selectSection(sec.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                  background: activeSection === sec.id ? 'var(--green-light)' : 'none',
                  color: activeSection === sec.id ? 'var(--green-dark)' : 'var(--text2)',
                  fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  transition: 'all 0.15s',
                }}
              >
                <span>{sec.icon}</span> {sec.title}
              </button>

              {activeSection === sec.id && (
                <div style={{ paddingLeft: '0.5rem', marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                  {sec.topics.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTopic(t.id)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '0.35rem 0.75rem',
                        borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                        background: activeTopic === t.id ? 'var(--green)' : 'none',
                        color: activeTopic === t.id ? 'white' : 'var(--text3)',
                        fontSize: '0.78rem', fontWeight: activeTopic === t.id ? 600 : 400,
                        fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="card" style={{ padding: '1.5rem', minHeight: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '1.1rem' }}>{section.icon}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{section.title}</span>
            <span style={{ color: 'var(--border)' }}>›</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--green-dark)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{topic.title}</span>
          </div>

          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.875rem', color: 'var(--text)' }}>{topic.title}</h2>

          <div style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.7 }}>
            {topic.content}
          </div>

          {/* Navegação entre tópicos */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            {(() => {
              const allTopics = SECTIONS.flatMap(s => s.topics.map(t => ({ ...t, sectionId: s.id })))
              const idx = allTopics.findIndex(t => t.id === activeTopic)
              const prev = allTopics[idx - 1]
              const next = allTopics[idx + 1]
              return (
                <>
                  {prev ? (
                    <button onClick={() => { setActiveSection(prev.sectionId); setActiveTopic(prev.id) }}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.42rem 0.875rem', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--text2)', fontFamily: 'inherit' }}>
                      ← {prev.title}
                    </button>
                  ) : <div />}
                  {next ? (
                    <button onClick={() => { setActiveSection(next.sectionId); setActiveTopic(next.id) }}
                      style={{ background: 'var(--green)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.42rem 0.875rem', fontSize: '0.78rem', cursor: 'pointer', color: 'white', fontWeight: 600, fontFamily: 'inherit' }}>
                      {next.title} →
                    </button>
                  ) : (
                    <Link href="/dashboard" className="btn-primary" style={{ fontSize: '0.78rem' }}>Ir para o Dashboard →</Link>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}