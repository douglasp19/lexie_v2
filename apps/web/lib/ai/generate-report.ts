// @route apps/web/lib/ai/generate-report.ts
import Groq from 'groq-sdk'
import { buildReportPrompt } from './prompts'
import type { ReportContent } from '../db/queries/reports'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// llama-3.3-70b-versatile → melhor qualidade para texto clínico estruturado
// llama-3.1-8b-instant     → alternativa mais rápida e barata se precisar
export const REPORT_MODEL = 'llama-3.3-70b-versatile'

export async function generateReport(params: {
  transcription: string
  notes:         string | null
  anchorWords:   string[]
  patientName:   string
}): Promise<ReportContent> {
  const prompt = buildReportPrompt(params)

  const response = await groq.chat.completions.create({
    model:       REPORT_MODEL,
    temperature: 0.2,    // baixo: precisão clínica, menos variação
    max_tokens:  2048,
    messages: [
      {
        role:    'system',
        content: 'Você é um assistente clínico. Responda SOMENTE com JSON válido, sem markdown.',
      },
      {
        role:    'user',
        content: prompt,
      },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''

  // Remove eventuais blocos ```json que o modelo inclua mesmo com instrução
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/,      '')
    .replace(/```\s*$/,      '')
    .trim()

  let parsed: ReportContent
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`generateReport: JSON inválido.\nResposta: ${raw.slice(0, 400)}`)
  }

  // Garante que todas as seções existem
  const required: (keyof ReportContent)[] = [
    'queixa', 'historico', 'dados', 'metas', 'proximos_passos',
  ]
  for (const key of required) {
    if (typeof parsed[key] !== 'string') {
      throw new Error(`generateReport: campo "${key}" ausente ou inválido.`)
    }
  }

  return parsed
}
