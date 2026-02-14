'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getOrCreateUser } from '@/app/actions/nutrition'
import { showIsland } from '@/lib/uiStore'

export function RegisterForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setIsLoading(true)
    
    try {
      const user = await getOrCreateUser(formData.email)
      if (user) {
        const userToSave = { 
          id: user.id,
          email: user.email,
          photoUrl: user.photoUrl,
          targetCalories: user.targetCalories
        }
        localStorage.setItem('user', JSON.stringify(userToSave))
        window.dispatchEvent(new Event('nutruition:user'))
        showIsland('Compte créé !', 'success', 3000)
        
        // Force immediate redirection
        router.replace('/')
      }
    } catch (error) {
      console.error('Registration error:', error)
      setError('Une erreur est survenue lors de l’inscription')
      showIsland('Erreur d’inscription', 'error', 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-indigo-100 border border-indigo-50">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-xs font-bold animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-gray-900"
            placeholder="votre@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={formData.password}
            onChange={handleChange}
            className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-gray-900"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
            Confirmer le mot de passe
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            value={formData.confirmPassword}
            onChange={handleChange}
            className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-gray-900"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#1a1c2e] text-white py-4 px-6 rounded-2xl font-bold hover:bg-indigo-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Inscription...</span>
            </div>
          ) : "S'inscrire"}
        </button>

        <div className="text-center pt-2">
          <Link href="/login" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
            Déjà un compte ? <span className="underline decoration-indigo-200 underline-offset-4">Se connecter</span>
          </Link>
        </div>
      </form>
    </div>
  )
}
