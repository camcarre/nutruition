'use client'

import { useEffect } from 'react'
import { syncOfflineData } from '@/lib/syncService'
import { showIsland } from '@/lib/uiStore'

export function SyncListener() {
  useEffect(() => {
    // Tentative de synchro initiale
    syncOfflineData()

    const handleOnline = () => {
      showIsland('Connexion rétablie', 'online', 3000)
      syncOfflineData()
    }

    const handleOffline = () => {
      showIsland('Mode hors ligne', 'offline', 3000)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Synchro périodique toutes les 5 minutes au cas où
    const interval = setInterval(syncOfflineData, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  return null
}