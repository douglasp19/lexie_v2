// @route apps/web/lib/ai/prompts.ts

// ─── Prompt do relatório clínico ──────────────────────────────────────────────
// v1 — otimizado para llama-3.3-70b-versatile via Groq

export function buildReportPrompt(params: {
  transcription: string
  notes:         string | null
  anchorWords:   string[]
  patientName:   string
}): string {
  const { transcription, notes, anchorWords, patientName } = params

  const anchorSection = anchorWords.length > 0
    ? `Palavras-âncora destacadas pelo profissional: ${anchorWords.join(', ')}.`
    : ''

  const notesSection = notes?.trim()
    ? `Anotações registradas durante a consulta:\n${notes.trim()}`
    : 'Nenhuma anotação registrada.'

  return `Você é um assistente especializado em nutrição clínica. Gere um resumo estruturado de consulta nutricional com base nas informações abaixo.

Paciente: ${patientName}
${anchorSection}

${notesSection}

Transcrição da consulta:
${transcription}

Instruções:
- Use linguagem técnica de prontuário
- Não invente dados ausentes na transcrição ou anotações
- Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois

Formato obrigatório:
{
  "queixa": "Queixa principal e motivo da consulta.",
  "historico": "Histórico alimentar, hábitos e contexto de saúde relevantes.",
  "dados": "Dados objetivos: peso, altura, IMC, exames, medidas se mencionados.",
  "metas": "Metas e objetivos terapêuticos definidos na consulta.",
  "proximos_passos": "Condutas, orientações e próximos passos acordados."
}`
}

// ─── Dica de contexto para o Whisper (Groq) ──────────────────────────────────
// Melhora reconhecimento de termos técnicos em português

export const WHISPER_PROMPT = `Consulta de nutrição clínica em português brasileiro. \
Termos frequentes: IMC, VCT, GET, GEB, CHO, PTN, LIP, kcal, proteína, carboidrato, lipídio, \
fibra, micronutriente, suplementação, dietoterapia, anamnese, recordatório alimentar, \
fracionamento, índice glicêmico, insulinorresistência, bioimpedância.`
