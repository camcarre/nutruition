'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getOrCreateUser } from '@/app/actions/nutrition'
import { showIsland } from '@/lib/uiStore'

export function LoginForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const user = await getOrCreateUser(formData.email)
      if (user) {
        localStorage.setItem('user', JSON.stringify({ 
          id: user.id,
          email: user.email,
          photoUrl: user.photoUrl 
        }))
        window.dispatchEvent(new Event('nutruition:user'))
        showIsland(`Bon retour !`, 'success', 3000)
        router.push('/')
      }
    } catch (error) {
      console.error('Login error:', error)
      showIsland('Erreur de connexion', 'error', 3000)
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="votre@email.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-primary-600 text-gray-900 py-3 px-4 rounded-md font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Connexion...' : 'Se connecter'}
      </button>

      <div className="text-center">
        <Link href="/register" className="text-sm text-primary-600 hover:text-primary-700">
          Pas encore de compte ? S’inscrire
        </Link>
      </div>
    </form>
  )
}
