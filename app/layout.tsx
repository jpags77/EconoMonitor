import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EconoMonitor',
  description: 'Daily macro signals powered by Claude AI — market environment, action bias, and per-asset guidance. Not financial advice.',
  openGraph: {
    title: 'EconoMonitor',
    description: 'Daily macro signals powered by Claude AI — market environment, action bias, and per-asset guidance.',
    url: 'https://econo-monitor.vercel.app',
    siteName: 'EconoMonitor',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EconoMonitor',
    description: 'Daily macro signals powered by Claude AI — market environment, action bias, and per-asset guidance.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
