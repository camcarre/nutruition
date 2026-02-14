import { FoodList } from '@/components/foods/FoodList'
import { Header } from '@/components/layout/Header'

export default function FoodsPage() {
  return (
    <div className="px-4 py-6 pb-24 min-h-screen bg-gray-50/30">
      <Header />
      
      <FoodList />
    </div>
  )
}
