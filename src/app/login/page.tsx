import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50/50">
      <div className="w-full max-w-mobile">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[2rem] bg-[#1a1c2e] text-white font-black text-3xl mb-6 shadow-xl shadow-indigo-100">
            u
          </div>
          <h1 className="text-4xl font-black text-[#1a1c2e] tracking-tighter mb-3">
            Bon retour
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 ml-1"></span>
          </h1>
          <p className="text-gray-400 font-medium">Continuez votre parcours nutritionnel</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}