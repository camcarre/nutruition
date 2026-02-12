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

  const userInitial = user?.email ? user.email[0].toUpperCase() : '?'
  const username = user?.email ? user.email.split('@')[0] : 'Invité'

  return (
    <div className="flex justify-between items-center mb-8 relative">
      <div>
        <h1 className="text-2xl font-bold text-indigo-600">Nutruition</h1>
      </div>
      <div className="flex gap-3 items-center">
        <button className="p-2 rounded-full text-gray-300 hover:text-gray-400 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
        
        <div className="relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-10 h-10 rounded-full bg-[#1a1c2e] text-white flex items-center justify-center font-bold overflow-hidden border-2 border-transparent hover:border-indigo-100 transition-all"
          >
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span>{userInitial}</span>
            )}
          </button>

          {showProfileMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowProfileMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-20 animate-in fade-in zoom-in-95 duration-200">
                <div className="px-4 py-3 border-b border-gray-50">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Utilisateur</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{username}</p>
                  <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
                </div>
                
                <button 
                  onClick={() => {
                    setShowProfileMenu(false)
                    // Profile link logic could go here
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Mon Profil
                </button>

                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Déconnexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
