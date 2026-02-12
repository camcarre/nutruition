import { FoodList } from '@/components/foods/FoodList'
import { Header } from '@/components/layout/Header'

export default function FoodsPage() {
  return (
    <div className="px-4 py-6 pb-24">
      <Header />

      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-1">Aliments</h2>
        <p className="text-gray-400 text-sm font-medium">
          Explorez la base de données
        </p>
      </div>
      
      <FoodList />
    </div>
  )
}
