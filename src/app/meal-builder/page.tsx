import { Suspense } from 'react'
import { MealBuilder } from '@/components/meal-builder/MealBuilder'

export default function MealBuilderPage() {
  return (
    <div className="px-4 py-6">
      <Suspense fallback={<div>Chargement du repas...</div>}>
        <MealBuilder />
      </Suspense>
    </div>
  )
}