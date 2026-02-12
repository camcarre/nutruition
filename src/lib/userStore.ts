'use client'

export type User = {
  email?: string
  photoUrl?: string
} | null

let lastRaw: string | null = null
let lastParsed: User = null

export function subscribeUser(callback: () => void) {
  window.addEventListener('nutruition:user', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('nutruition:user', callback)
    window.removeEventListener('storage', callback)
  }
}

export function getUserSnapshot() {
  const raw = localStorage.getItem('user')
  if (raw === lastRaw) return lastParsed

  lastRaw = raw
  if (!raw) {
    lastParsed = null
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NonNullable<User>> | null
    lastParsed = parsed && typeof parsed === 'object' ? (parsed as NonNullable<User>) : null
    return lastParsed
  } catch {
    lastParsed = null
    return null
  }
}

export function getUserServerSnapshot() {
  return null
}
