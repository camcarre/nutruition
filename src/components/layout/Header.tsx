'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { subscribeUser, getUserSnapshot, getUserServerSnapshot, type User } from '@/lib/userStore'

export function Header() {
  const router = useRouter()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const user = useSyncExternalStore(
    subscribeUser,
    getUserSnapshot,
    getUserServerSnapshot
  ) as User

  const handleLogout = () => {
    localStorage.removeItem('user')
    window.dispatchEvent(new Event('nutruition:user'))
    router.push('/login')
  }

  const userInitial = user?.email ? user.email[0].toUpperCase() : 'N'
  const username = user?.email ? user.email.split('@')[0] : 'Invité'

  return (
    <div className="flex justify-between items-center mb-8 relative">
      <div className="relative">
        <button 
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-full bg-[#1a1c2e] text-white flex items-center justify-center font-bold overflow-hidden border-2 border-transparent group-hover:border-indigo-200 transition-all shadow-sm">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span>{userInitial}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-[#1a1c2e] tracking-tight">
            utruition
          </h1>
        </button>

        {showProfileMenu && (
          <>
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => setShowProfileMenu(false)}
            />
            <div className="absolute left-0 mt-3 w-56 bg-white rounded-3xl shadow-2xl border border-gray-100 py-2 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-5 py-4 border-b border-gray-50">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Session active</p>
                <p className="text-base font-bold text-gray-900 truncate">{username}</p>
                <p className="text-xs text-gray-400 truncate font-medium">{user?.email}</p>
              </div>
              
              <div className="p-2">
                <button 
                  onClick={() => {
                    setShowProfileMenu(false)
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 rounded-2xl flex items-center gap-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  Mon Profil
                </button>

                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-2xl flex items-center gap-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  Déconnexion
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
