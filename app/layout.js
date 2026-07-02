import { Inter } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/layout/AppShell'
import { ToastProvider } from '@/components/layout/ToastProvider'
import { ThemeProvider } from '@/context/ThemeContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata = {
  title: 'ArshaNemi MultiImage Background Remover',
  description: 'Remove backgrounds, change canvas colors, resize and export images in HD quality.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.variable} h-full flex flex-col`}>
        <ThemeProvider>
          <ToastProvider>
            <AppShell>
              {children}
            </AppShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
