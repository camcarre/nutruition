'use client'

import { useState, useEffect } from 'react'
import { getReminders, saveReminders, type Reminder } from '@/lib/reminderStore'
import { showIsland } from '@/lib/uiStore'

interface ReminderSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function ReminderSettings({ isOpen, onClose }: ReminderSettingsProps) {
  const [reminders, setReminders] = useState<Reminder[]>([])

  useEffect(() => {
    if (isOpen) {
      setReminders(getReminders())
    }
  }, [isOpen])

  const toggleReminder = (id: string) => {
    const updated = reminders.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    )
    setReminders(updated)
  }

  const updateTime = (id: string, time: string) => {
    const updated = reminders.map(r => 
      r.id === id ? { ...r, time } : r
    )
    setReminders(updated)
  }

  const handleSave = async () => {
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        showIsland("Permission refusée pour les notifications", "error")
        return
      }
    }
    
    saveReminders(reminders)
    showIsland("Rappels enregistrés", "success")
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500 cubic-bezier(0.4, 0, 0.2, 1)">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-black text-[#1a1c2e]">Programmer des rappels</h2>
              <p className="text-sm text-gray-400 font-medium">Recevez une alerte pour vos repas</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 mb-8">
            {reminders.map((reminder) => (
              <div 
                key={reminder.id}
                className={`p-4 rounded-3xl border-2 transition-all duration-300 ${
                  reminder.enabled ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-50 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleReminder(reminder.id)}
                      className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${
                        reminder.enabled ? 'bg-indigo-500' : 'bg-gray-200'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${
                        reminder.enabled ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                    <div>
                      <p className={`text-sm font-bold ${reminder.enabled ? 'text-indigo-900' : 'text-gray-500'}`}>
                        {reminder.label}
                      </p>
                    </div>
                  </div>
                  
                  <input
                    type="time"
                    value={reminder.time}
                    onChange={(e) => updateTime(reminder.id, e.target.value)}
                    disabled={!reminder.enabled}
                    className={`bg-transparent font-black text-lg focus:outline-none transition-opacity ${
                      reminder.enabled ? 'text-indigo-600 opacity-100' : 'text-gray-300 opacity-50'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            className="w-full py-4 bg-[#1a1c2e] text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Enregistrer les rappels
          </button>
        </div>
      </div>
    </div>
  )
}
