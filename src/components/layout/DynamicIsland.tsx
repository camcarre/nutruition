'use client'

import { useSyncExternalStore, useEffect, useState } from 'react'
import { subscribeIsland, getIslandSnapshot, type IslandStatus } from '@/lib/uiStore'

export function DynamicIsland() {
  const island = useSyncExternalStore(subscribeIsland, getIslandSnapshot, getIslandSnapshot)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (island.visible) {
      // Un petit délai avant d'étendre si on veut un effet spécifique
      const timer = setTimeout(() => setIsExpanded(true), 100)
      return () => clearTimeout(timer)
    } else {
      setIsExpanded(false)
    }
  }, [island.visible])

  if (!island.visible && !isExpanded) return null

  const getStatusConfig = (status: IslandStatus) => {
    switch (status) {
      case 'syncing':
        return {
          bg: 'bg-black',
          icon: (
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ),
          color: 'text-white'
        }
      case 'success':
        return {
          bg: 'bg-green-600',
          icon: (
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ),
          color: 'text-white'
        }
      case 'error':
        return {
          bg: 'bg-red-600',
          icon: (
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          color: 'text-white'
        }
      case 'offline':
        return {
          bg: 'bg-gray-700',
          icon: (
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
            </svg>
          ),
          color: 'text-white'
        }
      case 'online':
        return {
          bg: 'bg-indigo-600',
          icon: (
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          ),
          color: 'text-white'
        }
      default:
        return {
          bg: 'bg-black',
          icon: null,
          color: 'text-white'
        }
    }
  }

  const config = getStatusConfig(island.status)

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none pt-[env(safe-area-inset-top,12px)]">
      <div 
        className={`
          ${config.bg} ${config.color}
          relative flex items-center gap-3 px-4 py-2
          rounded-full shadow-2xl transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
          ${isExpanded ? 'min-w-[180px] opacity-100 translate-y-2 scale-100' : 'min-w-[40px] opacity-0 -translate-y-4 scale-90'}
          pointer-events-auto cursor-pointer
        `}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-shrink-0">
          {config.icon}
        </div>
        
        {isExpanded && (
          <span className="text-xs font-bold whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
            {island.message}
          </span>
        )}

        {/* Effet de brillance type Dynamic Island */}
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/20"></div>
        </div>
      </div>
    </div>
  )
}
