'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function MobileNav() {
  const pathname = usePathname()

  const navItems = [
    { 
      href: '/', 
      label: 'Calcul', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      href: '/meal-builder', 
      label: 'Repas', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 2v9m0 11V11m-2-9v9m4-9v9m3-9v9c0 2 1.5 3 3 3v8m3-19v9" />
        </svg>
      )
    },
    { 
      href: '/calendar', 
      label: 'Journal', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      href: '/foods', 
      label: 'Aliments', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21s-7-4.6-9.3-9C.7 7.8 3.1 4.5 6.6 4.5c1.8 0 3.3.9 4.4 2.2 1.1-1.3 2.6-2.2 4.4-2.2 3.5 0 5.9 3.3 3.9 7.5C19 16.4 12 21 12 21Z" />
        </svg>
      )
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-40">
      <div className="max-w-mobile mx-auto">
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={`grid place-items-center h-11 w-11 rounded-2xl transition-all duration-300 ${
                    isActive ? 'bg-[#1a1c2e] text-white shadow-lg shadow-indigo-100 scale-110' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {item.icon}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    isActive ? 'text-[#1a1c2e]' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
