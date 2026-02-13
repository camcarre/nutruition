'use client'

import { saveOfflineUser } from './offlineDb'

export type User = {
  id?: string
  email?: string
  photoUrl?: string
  dailyCalories?: number
} | null

let lastRaw: string | null = null
let lastParsed: User = null

export function subscribeUser(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('nutruition:user', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('nutruition:user', callback)
    window.removeEventListener('storage', callback)
  }
}

export function getUserSnapshot() {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('user')
  if (raw === lastRaw) return lastParsed

  lastRaw = raw
  if (!raw) {
    lastParsed = null
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NonNullable<User>> | null
    if (parsed && typeof parsed === 'object' && parsed.id) {
      lastParsed = parsed as NonNullable<User>
    } else {
      lastParsed = null
      return null
    }
    
    // Sync to IndexedDB in background
    if (lastParsed && lastParsed.id) {
      saveOfflineUser({
        id: lastParsed.id,
        email: lastParsed.email || '',
        photoUrl: lastParsed.photoUrl,
        dailyCalories: lastParsed.dailyCalories,
        synced: true
      }).catch(console.error)
    }
    
    return lastParsed
  } catch {
    lastParsed = null
    return null
  }
}

export function updateUserLocal(user: User) {
  if (typeof window === 'undefined') return
  if (user) {
    localStorage.setItem('user', JSON.stringify(user))
    if (user.id) {
      saveOfflineUser({
        id: user.id,
        email: user.email || '',
        photoUrl: user.photoUrl,
        dailyCalories: user.dailyCalories,
        synced: true
      }).catch(console.error)
    }
  } else {
    localStorage.removeItem('user')
  }
  window.dispatchEvent(new Event('nutruition:user'))
}

export function getUserServerSnapshot() {
  return null
}
