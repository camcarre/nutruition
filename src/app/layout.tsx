import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { MobileNav } from '@/components/layout/MobileNav'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'
import { SyncListener } from '@/components/pwa/SyncListener'
import { ReminderListener } from '@/components/pwa/ReminderListener'
import { SplashScreen } from '@/components/layout/SplashScreen'
import { DynamicIsland } from '@/components/layout/DynamicIsland'
import { SwipeProvider } from '@/components/layout/SwipeProvider'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a1c2e',
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
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
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
        <SplashScreen />
        <DynamicIsland />
        <ServiceWorkerRegister />
        <SyncListener />
        <ReminderListener />
        <div className="min-h-screen max-w-mobile mx-auto bg-white">
          <SwipeProvider>
            <main className="pb-20">
              {children}
            </main>
          </SwipeProvider>
          <MobileNav />
        </div>
      </body>
    </html>
  )
}