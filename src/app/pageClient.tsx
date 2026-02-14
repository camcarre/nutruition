'use client'

import dynamic from 'next/dynamic'
import { useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { subscribeUser, getUserSnapshot, getUserServerSnapshot } from '@/lib/userStore'

const Header = dynamic(
  () => import('@/components/layout/Header').then((m) => m.Header),
  { ssr: false },
)

const Calculator = dynamic(
  () => import('@/components/calculator/Calculator').then((m) => m.Calculator),
  { ssr: false },
)

export function HomeClient() {
  const router = useRouter()
  const user = useSyncExternalStore(
    subscribeUser,
    getUserSnapshot,
    getUserServerSnapshot
  )

  useEffect(() => {
    if (typeof window !== 'undefined' && !user) {
      router.replace('/login')
    }
  }, [user, router])

  if (!user) return null

  return (
    <div className="bg-gray-50 px-4 pt-6 pb-6 min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Header />

      <div className="mb-8">
        <h2 className="text-4xl font-extrabold tracking-tight text-gray-900">
          Calculateur TDEE
        </h2>
        <p className="mt-4 text-base leading-relaxed text-gray-500">
          Déterminez précisément votre besoin énergétique quotidien
        </p>
      </div>
      <Calculator />
    </div>
  )
}

