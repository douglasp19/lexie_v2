import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title:       'Lexie — Resumos de Consultas para Nutricionistas',
  description: 'Grave, transcreva e gere relatórios clínicos automáticos para suas consultas.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body suppressHydrationWarning>{children}</body>
      </html>
    </ClerkProvider>
  )
}
