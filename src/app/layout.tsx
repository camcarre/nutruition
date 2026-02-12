import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { MobileNav } from '@/components/layout/MobileNav'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#4f46e5',
}

export const metadata: Metadata = {
  title: 'Nutruition',
  description: 'Application de gestion nutritionnelle mobile-first',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Nutruition',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: '/icons/icon-192x192.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-white text-gray-800`}>
        <div className="min-h-screen max-w-mobile mx-auto bg-white">
          <main className="pb-20">
            {children}
          </main>
          <MobileNav />
        </div>
      </body>
    </html>
  )
}