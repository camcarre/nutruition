'use client'

import { useState, useEffect } from 'react'
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
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-[#1a1c2e] z-[100] flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/20 animate-bounce">
          <span className="text-4xl">🥗</span>
        </div>
        <h1 className="text-4xl font-black tracking-tighter mb-2">
          <span className="text-indigo-400">u</span>truition
          <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 ml-1"></span>
        </h1>
        <p className="text-indigo-200/60 text-sm font-bold uppercase tracking-widest">Premium Nutrition</p>
        
        <div className="absolute bottom-12 w-12 h-1 bg-indigo-900/30 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 w-full animate-progress-fast origin-left"></div>
        </div>
      </div>
    )
  }

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

