'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const NAV_ORDER = ['/', '/meal-builder', '/calendar', '/foods']
const SWIPE_THRESHOLD = 50 // px
const VERTICAL_THRESHOLD = 100 // px

export function SwipeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)

  const onTouchStart = useCallback((e: TouchEvent) => {
    // Check if the target or any parent has data-no-swipe or is a horizontal scroll area
    let target = e.target as HTMLElement | null
    while (target && target !== document.body) {
      if (
        target.getAttribute('data-no-swipe') === 'true' ||
        target.style.overflowX === 'auto' ||
        target.style.overflowX === 'scroll' ||
        target.classList.contains('overflow-x-auto')
      ) {
        setTouchStart(null)
        return
      }
      target = target.parentElement
    }

    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    })
  }, [])

  const onTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStart) return

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    }

    const dx = touchEnd.x - touchStart.x
    const dy = touchEnd.y - touchStart.y

    // Reset touch start
    setTouchStart(null)

    // Check if it's a horizontal swipe
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dy) < VERTICAL_THRESHOLD) {
      const currentIndex = NAV_ORDER.indexOf(pathname)
      if (currentIndex === -1) return

      if (dx > 0) {
        // Swipe Right -> Previous Page
        if (currentIndex > 0) {
          setDirection('left') // Moving from left to right
          router.push(NAV_ORDER[currentIndex - 1])
        }
      } else {
        // Swipe Left -> Next Page
        if (currentIndex < NAV_ORDER.length - 1) {
          setDirection('right') // Moving from right to left
          router.push(NAV_ORDER[currentIndex + 1])
        }
      }
    }
  }, [touchStart, pathname, router])

  useEffect(() => {
    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [onTouchStart, onTouchEnd])

  return (
    <div 
      key={pathname} 
      className={`relative overflow-x-hidden min-h-screen animate-in fade-in duration-300 ${
        direction === 'left' ? 'slide-in-from-left-4' : 'slide-in-from-right-4'
      }`}
    >
      {children}
    </div>
  )
}
