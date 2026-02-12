'use client'

import dynamic from 'next/dynamic'

const Header = dynamic(
  () => import('@/components/layout/Header').then((m) => m.Header),
  { ssr: false },
)

const Calculator = dynamic(
  () => import('@/components/calculator/Calculator').then((m) => m.Calculator),
  { ssr: false },
)

export function HomeClient() {
  return (
    <div className="bg-gray-50 px-4 pt-6 pb-6">
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

