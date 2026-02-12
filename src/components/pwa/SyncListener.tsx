'use client'

import { useEffect } from 'react'
import { syncOfflineData } from '@/lib/syncService'

export function SyncListener() {
  useEffect(() => {
    // Tentative de synchro initiale
    syncOfflineData()

    const handleOnline = () => {
      console.log('Connexion rétablie, lancement de la synchronisation...')
      syncOfflineData()
    }

    window.addEventListener('online', handleOnline)
    
    // Synchro périodique toutes les 5 minutes au cas où
    const interval = setInterval(syncOfflineData, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [])

  return null
}