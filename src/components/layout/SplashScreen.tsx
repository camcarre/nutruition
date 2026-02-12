'use client'

import { useState, useEffect } from 'react'

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Check if splash has already been shown in this session
    const hasShown = sessionStorage.getItem('splash_shown')
    if (hasShown) {
      setIsVisible(false)
      return
    }

    const timer = setTimeout(() => {
      setIsVisible(false)
      sessionStorage.setItem('splash_shown', 'true')
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  if (!isVisible) return null

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
