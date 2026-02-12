import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Connexion</h1>
          <p className="text-gray-600">Bienvenue sur Nutruition</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}