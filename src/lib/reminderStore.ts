'use client'

export interface Reminder {
  id: string
  label: string
  time: string // format HH:mm
  enabled: boolean
}

const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'breakfast', label: 'Petit-déjeuner', time: '08:00', enabled: false },
  { id: 'lunch', label: 'Déjeuner', time: '12:30', enabled: false },
  { id: 'snack', label: 'Collation', time: '16:00', enabled: false },
  { id: 'dinner', label: 'Dîner', time: '20:00', enabled: false },
]

export const getReminders = (): Reminder[] => {
  if (typeof window === 'undefined') return DEFAULT_REMINDERS
  const saved = localStorage.getItem('nutruition:reminders')
  return saved ? JSON.parse(saved) : DEFAULT_REMINDERS
}

export const saveReminders = (reminders: Reminder[]) => {
  if (typeof window === 'undefined') return
  localStorage.setItem('nutruition:reminders', JSON.stringify(reminders))
  window.dispatchEvent(new Event('nutruition:reminders-updated'))
}

export const checkAndShowReminders = async () => {
  if (typeof window === 'undefined') return
  if (Notification.permission !== 'granted') return

  const reminders = getReminders()
  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  
  // On évite de spammer si on a déjà montré le rappel cette minute
  const lastShown = localStorage.getItem('nutruition:last-reminder-shown')
  if (lastShown === currentTime) return

  const activeReminder = reminders.find(r => r.enabled && r.time === currentTime)
  
  if (activeReminder) {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      registration.showNotification('Nutruition : C\'est l\'heure !', {
        body: `N'oubliez pas de noter votre ${activeReminder.label.toLowerCase()}.`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: `reminder-${activeReminder.id}`,
        vibrate: [200, 100, 200]
      } as any)
      localStorage.setItem('nutruition:last-reminder-shown', currentTime)
    }
  }
}
