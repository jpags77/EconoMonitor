import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EconoMonitor',
  description: 'Daily macro signals based on live market data and news — market environment, action bias, and per-asset guidance. Not financial advice.',
  openGraph: {
    title: 'EconoMonitor',
    description: 'Daily macro signals based on live market data and news — market environment, action bias, and per-asset guidance.',
    url: 'https://econo-monitor.vercel.app',
    siteName: 'EconoMonitor',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EconoMonitor',
    description: 'Daily macro signals based on live market data and news — market environment, action bias, and per-asset guidance.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
