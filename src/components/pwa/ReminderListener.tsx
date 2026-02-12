'use client'

import { useEffect } from 'react'
import { checkAndShowReminders } from '@/lib/reminderStore'

export function ReminderListener() {
  useEffect(() => {
    // Vérification initiale
    checkAndShowReminders()

    // Vérification chaque minute
    const interval = setInterval(() => {
      checkAndShowReminders()
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  return null
}
