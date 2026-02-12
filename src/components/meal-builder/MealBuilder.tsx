'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { 
  format, 
  addDays, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns'
import { fr } from 'date-fns/locale'

interface Food {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  servingSizeG: number
}

interface MealFood extends Food {
  quantityG: number
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
}

interface FavoriteMeal {
  id: string
  name: string
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  foods: MealFood[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  date: string // New field for selected date
  createdAt: string
}

type TDEEStorageResult = {
  targetCalories: number
  mealDistribution?: {
    breakfast?: number
    lunch?: number
    dinner?: number
    snacks?: number
  }
}

function stableHashBase36(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

export function MealBuilder() {
  const searchParams = useSearchParams()

  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'snack' | 'dinner'>('breakfast')
  const [foods, setFoods] = useState<MealFood[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showFoodSearch, setShowFoodSearch] = useState(false)
  const [favoriteMeals, setFavoriteMeals] = useState<FavoriteMeal[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const savedFavorites = localStorage.getItem('favoriteMeals')
      return savedFavorites ? (JSON.parse(savedFavorites) as FavoriteMeal[]) : []
    } catch {
      return []
    }
  })
  const [showFavorites, setShowFavorites] = useState(false)
  const [mealName, setMealName] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [tdeeResult] = useState<TDEEStorageResult | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const savedTDEE = localStorage.getItem('tdeeResult')
      if (!savedTDEE) return null
      const parsed = JSON.parse(savedTDEE) as Partial<TDEEStorageResult>
      return typeof parsed?.targetCalories === 'number' ? (parsed as TDEEStorageResult) : null
    } catch {
      return null
    }
  })
  const [selectedDate, setSelectedDate] = useState(() => {
    return searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [viewDate, setViewDate] = useState(new Date())

  // Mock food data
  const availableFoods: Food[] = [
    { id: '1', name: 'Oeuf entier', calories: 155, protein: 13, carbs: 1, fat: 11, servingSizeG: 100 },
    { id: '2', name: 'Avoine', calories: 389, protein: 17, carbs: 66, fat: 7, servingSizeG: 100 },
    { id: '3', name: 'Lait demi-écrémé', calories: 46, protein: 3.4, carbs: 4.8, fat: 1.7, servingSizeG: 100 },
    { id: '4', name: 'Poulet grillé', calories: 165, protein: 31, carbs: 0, fat: 3.6, servingSizeG: 100 },
    { id: '5', name: 'Riz blanc cuit', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, servingSizeG: 100 },
    { id: '6', name: 'Brocoli cuit', calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4, servingSizeG: 100 },
    { id: '7', name: 'Pomme', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, servingSizeG: 100 },
    { id: '8', name: 'Banane', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, servingSizeG: 100 },
  ]

  const addFood = (food: Food, quantityG: number) => {
    const totalCalories = Math.round((food.calories * quantityG) / food.servingSizeG)
    const totalProtein = Math.round((food.protein * quantityG) / food.servingSizeG * 10) / 10
    const totalCarbs = Math.round((food.carbs * quantityG) / food.servingSizeG * 10) / 10
    const totalFat = Math.round((food.fat * quantityG) / food.servingSizeG * 10) / 10

    const newFood: MealFood = {
      ...food,
      quantityG,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat
    }

    setFoods(prev => [...prev, newFood])
    setShowFoodSearch(false)
    setSearchQuery('')
  }

  const removeFood = (id: string) => {
    setFoods(prev => prev.filter(food => food.id !== id))
  }

  const updateQuantity = (id: string, newQuantity: number) => {
    setFoods(prev => prev.map(food => {
      if (food.id === id) {
        const totalCalories = Math.round((food.calories * newQuantity) / food.servingSizeG)
        const totalProtein = Math.round((food.protein * newQuantity) / food.servingSizeG * 10) / 10
        const totalCarbs = Math.round((food.carbs * newQuantity) / food.servingSizeG * 10) / 10
        const totalFat = Math.round((food.fat * newQuantity) / food.servingSizeG * 10) / 10

        return {
          ...food,
          quantityG: newQuantity,
          totalCalories,
          totalProtein,
          totalCarbs,
          totalFat
        }
      }
      return food
    }))
  }

  const totalNutrients = foods.reduce(
    (acc, food) => ({
      calories: acc.calories + food.totalCalories,
      protein: acc.protein + food.totalProtein,
      carbs: acc.carbs + food.totalCarbs,
      fat: acc.fat + food.totalFat
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const saveAsFavorite = () => {
    if (!mealName.trim() || foods.length === 0) return

    const idSeed = `${selectedDate}|${mealType}|${mealName.trim()}|${foods
      .map((f) => `${f.id}:${f.quantityG}`)
      .join(',')}`
    const favoriteId = `${stableHashBase36(idSeed)}-${favoriteMeals.length + 1}`

    const newFavoriteMeal: FavoriteMeal = {
      id: favoriteId,
      name: mealName.trim(),
      mealType,
      foods: [...foods],
      totalCalories: Math.round(totalNutrients.calories),
      totalProtein: Math.round(totalNutrients.protein * 10) / 10,
      totalCarbs: Math.round(totalNutrients.carbs * 10) / 10,
      totalFat: Math.round(totalNutrients.fat * 10) / 10,
      date: selectedDate, // Add the selected date
      createdAt: new Date().toISOString()
    }

    const updatedFavorites = [...favoriteMeals, newFavoriteMeal]
    setFavoriteMeals(updatedFavorites)
    localStorage.setItem('favoriteMeals', JSON.stringify(updatedFavorites))
    
    setMealName('')
    setShowSaveModal(false)
  }

  const loadFavoriteMeal = (favoriteMeal: FavoriteMeal) => {
    setFoods([...favoriteMeal.foods])
    setMealType(favoriteMeal.mealType)
    setSelectedDate(favoriteMeal.date) // Set the selected date from the favorite meal
    setShowFavorites(false)
  }

  const deleteFavoriteMeal = (id: string) => {
    const updatedFavorites = favoriteMeals.filter(meal => meal.id !== id)
    setFavoriteMeals(updatedFavorites)
    localStorage.setItem('favoriteMeals', JSON.stringify(updatedFavorites))
  }

  const mealTypeLabels = {
    breakfast: { label: 'Petit-déjeuner', icon: '☕' },
    lunch: { label: 'Déjeuner', icon: '🥗' },
    snack: { label: 'Collation', icon: '🍎' },
    dinner: { label: 'Dîner', icon: '🍗' }
  }

  const mealTypeEntries = Object.entries(mealTypeLabels) as Array<
    [keyof typeof mealTypeLabels, (typeof mealTypeLabels)[keyof typeof mealTypeLabels]]
  >

  const handlePreviousDay = () => {
    const previousDay = subDays(new Date(selectedDate), 1)
    setSelectedDate(format(previousDay, 'yyyy-MM-dd'))
  }

  const handleNextDay = () => {
    const nextDay = addDays(new Date(selectedDate), 1)
    setSelectedDate(format(nextDay, 'yyyy-MM-dd'))
  }

  const filteredFoods = availableFoods.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const consumedCalories = totalNutrients.calories
  const targetCalories = typeof tdeeResult?.targetCalories === 'number' ? tdeeResult.targetCalories : 2560
  const mealDistribution = tdeeResult?.mealDistribution
  const computedMealTargetCalories =
    mealDistribution && typeof mealDistribution === 'object' ? (
      mealType === 'breakfast' ? Math.round(mealDistribution.breakfast ?? NaN) :
      mealType === 'lunch' ? Math.round(mealDistribution.lunch ?? NaN) :
      mealType === 'dinner' ? Math.round(mealDistribution.dinner ?? NaN) :
      Math.round(mealDistribution.snacks ?? NaN)
    ) : NaN
  const mealTargetCalories = Number.isFinite(computedMealTargetCalories) && computedMealTargetCalories > 0 ? computedMealTargetCalories : 640
  const remainingCalories = targetCalories - consumedCalories
  const progressPercentage = Math.min((consumedCalories / targetCalories) * 100, 100)

  return (
    <div className="space-y-6 pb-20">
      <Header />

      {/* Page Title */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-1">Composer un repas</h2>
        <p className="text-gray-400 text-sm font-medium">Gérez votre apport nutritionnel quotidien</p>
      </div>

      {/* Date Selection Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
        <button
          onClick={handlePreviousDay}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <button 
          onClick={() => {
            setViewDate(new Date(selectedDate))
            setShowDatePicker(true)
          }}
          className="flex items-center gap-2 hover:bg-gray-50 px-3 py-1 rounded-xl transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-semibold text-gray-800 capitalize">
            {format(new Date(selectedDate), 'EEEE d MMMM', { locale: fr })}
          </span>
        </button>
        <button
          onClick={handleNextDay}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* TDEE Purple Card */}
      <div className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-lg shadow-indigo-200">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-2">
            <span className="text-orange-400">🔥</span>
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Objectif TDEE</span>
          </div>
          <span className="bg-indigo-500/50 text-xs px-3 py-1 rounded-full backdrop-blur-sm">
            {mealTypeLabels[mealType].label}
          </span>
        </div>

        <div className="flex justify-between items-end mb-6">
          <div>
            <div className="text-4xl font-bold">{targetCalories}</div>
            <div className="text-[10px] opacity-70 uppercase font-bold tracking-tight">Calories journalières</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{mealTargetCalories}</div>
            <div className="text-[10px] opacity-70 uppercase font-bold tracking-tight">Cible par repas</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
            <span>{consumedCalories} kcal consommés</span>
            <span>Reste: {remainingCalories} kcal</span>
          </div>
          <div className="h-2 bg-indigo-800/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Meal Tabs Horizontal Scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {mealTypeEntries.map(([key, { label, icon }]) => (
          <button
            key={key}
            onClick={() => setMealType(key)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl whitespace-nowrap transition-all border ${
              mealType === key
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm'
                : 'bg-white border-gray-100 text-gray-500'
            }`}
          >
            <span>{icon}</span>
            <span className="text-sm font-semibold">{label}</span>
          </button>
        ))}
      </div>

      {/* Favorites Section */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">🍱</span>
          <h3 className="font-bold text-gray-900">Plats favoris</h3>
        </div>
        <button 
          onClick={() => setShowFavorites(true)}
          className="text-indigo-600 text-sm font-semibold flex items-center gap-1"
        >
          Voir tout 
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Foods List Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-lg font-bold text-gray-900">Aliments</h3>
          <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
            {foods.length} {foods.length <= 1 ? 'item' : 'items'}
          </span>
        </div>

        {foods.length === 0 ? (
          <div className="border-2 border-dashed border-gray-100 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center space-y-4 bg-gray-50/30">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center">
              <span className="text-4xl text-indigo-200">🍽️</span>
            </div>
            <div>
              <h4 className="font-bold text-gray-800">Votre assiette est vide</h4>
	          <p className="text-gray-400 text-xs mt-1">
                Appuyez sur le bouton “+” pour ajouter des aliments
              </p>
            </div>
            <button
              onClick={() => setShowFoodSearch(true)}
              className="mt-2 bg-indigo-600 text-white w-10 h-10 rounded-full shadow-lg shadow-indigo-200 flex items-center justify-center hover:bg-indigo-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {foods.map((food) => (
              <div key={food.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <div className="flex-1">
                  <div className="font-bold text-gray-800">{food.name}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                    {food.totalCalories} cal • {food.totalProtein}g P • {food.totalCarbs}g C • {food.totalFat}g L
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-50 rounded-xl border border-gray-100 px-2">
                    <input
                      type="number"
                      value={food.quantityG}
                      onChange={(e) => updateQuantity(food.id, parseInt(e.target.value) || 0)}
                      className="w-12 bg-transparent py-2 text-sm font-bold text-gray-700 text-center focus:outline-none"
                      min="0"
                    />
                    <span className="text-[10px] font-bold text-gray-400 uppercase">g</span>
                  </div>
                  <button
                    onClick={() => removeFood(food.id)}
                    className="p-2 text-red-300 hover:text-red-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            
            <button
              onClick={() => setShowFoodSearch(true)}
              className="w-full py-4 border-2 border-dashed border-indigo-100 rounded-2xl text-indigo-400 font-bold text-sm hover:bg-indigo-50/30 transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Ajouter un aliment
            </button>

            <div className="pt-2">
              <button
                onClick={() => setShowSaveModal(true)}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                <span>💾</span>
                Sauvegarder ce repas
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nutrient Breakdown - Always visible if foods present */}
      {foods.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900">Récapitulatif nutritionnel</h3>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Calories', val: Math.round(totalNutrients.calories), unit: 'kcal', color: 'indigo' },
              { label: 'Protéines', val: Math.round(totalNutrients.protein), unit: 'g', color: 'orange' },
              { label: 'Glucides', val: Math.round(totalNutrients.carbs), unit: 'g', color: 'blue' },
              { label: 'Lipides', val: Math.round(totalNutrients.fat), unit: 'g', color: 'green' }
            ].map((item) => (
              <div key={item.label} className="text-center space-y-1">
                <div className={`text-sm font-black text-${item.color}-600`}>{item.val}</div>
                <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Food Search Modal */}
      {showFoodSearch && (
        <div className="fixed inset-0 bg-[#1a1c2e]/80 backdrop-blur-sm z-50 flex items-end">
          <div className="w-full bg-white rounded-t-[2.5rem] p-6 shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-6" />
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Ajouter un aliment</h3>
              <button
                onClick={() => setShowFoodSearch(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un aliment..."
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pb-8">
              {filteredFoods.map((food) => (
                <div key={food.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-indigo-100 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900">{food.name}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-1">
                      {food.calories} cal • {food.protein}g P • {food.carbs}g C • {food.fat}g L
                    </div>
                  </div>
                  <button
                    onClick={() => addFood(food, food.servingSizeG)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors"
                  >
                    Ajouter
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save Meal Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-[#1a1c2e]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Sauvegarder le plat</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Nom du plat</label>
                <input
                  type="text"
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  placeholder="Ex: Petit-déj protéiné"
                  className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-4 bg-gray-50 text-gray-400 font-bold rounded-2xl hover:bg-gray-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={saveAsFavorite}
                  disabled={!mealName.trim()}
                  className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Favorite Meals Modal */}
      {showFavorites && (
        <div className="fixed inset-0 bg-[#1a1c2e]/80 backdrop-blur-sm z-50 flex items-end">
          <div className="w-full bg-white rounded-t-[2.5rem] p-6 shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-6" />
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Plats favoris</h3>
              <button
                onClick={() => setShowFavorites(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pb-8">
              {favoriteMeals.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🍱</div>
                  <p className="text-gray-400 text-sm font-medium">
                    Aucun plat favori. Créez et sauvegardez vos premiers plats !
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {favoriteMeals.map((meal) => (
                    <div key={meal.id} className="bg-gray-50 rounded-3xl p-5 border border-transparent hover:border-indigo-100 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="font-bold text-lg text-gray-900">{meal.name}</div>
                          <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">
                            {mealTypeLabels[meal.mealType].label} • {meal.totalCalories} kcal
                          </div>
                        </div>
                        <button
                          onClick={() => deleteFavoriteMeal(meal.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-white rounded-xl p-2 text-center">
                          <div className="text-xs font-bold text-gray-900">{meal.totalProtein}g</div>
                          <div className="text-[8px] font-bold text-gray-400 uppercase">Prot</div>
                        </div>
                        <div className="bg-white rounded-xl p-2 text-center">
                          <div className="text-xs font-bold text-gray-900">{meal.totalCarbs}g</div>
                          <div className="text-[8px] font-bold text-gray-400 uppercase">Gluc</div>
                        </div>
                        <div className="bg-white rounded-xl p-2 text-center">
                          <div className="text-xs font-bold text-gray-900">{meal.totalFat}g</div>
                          <div className="text-[8px] font-bold text-gray-400 uppercase">Lip</div>
                        </div>
                      </div>

                      <button
                        onClick={() => loadFavoriteMeal(meal)}
                        className="w-full bg-white border border-indigo-100 text-indigo-600 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-50 transition-colors"
                      >
                        Charger ce plat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-[#1a1c2e]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 capitalize">
                {format(viewDate, 'MMMM yyyy', { locale: fr })}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewDate(subMonths(viewDate, 1))}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewDate(addMonths(viewDate, 1))}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((day) => (
                <div key={day} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const monthStart = startOfMonth(viewDate)
                const monthEnd = endOfMonth(monthStart)
                const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
                const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
                const days = eachDayOfInterval({ start: startDate, end: endDate })

                return days.map((day) => {
                  const isSelected = isSameDay(day, new Date(selectedDate))
                  const isCurrentMonth = isSameMonth(day, monthStart)
                  const isCurrentDay = isToday(day)

                  return (
                    <button
                      key={day.toString()}
                      onClick={() => {
                        setSelectedDate(day.toISOString().split('T')[0])
                        setShowDatePicker(false)
                      }}
                      className={`
                        h-10 w-10 flex items-center justify-center rounded-xl text-sm font-medium transition-all
                        ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110 z-10' : ''}
                        ${!isSelected && isCurrentMonth ? 'text-gray-900 hover:bg-indigo-50 hover:text-indigo-600' : ''}
                        ${!isSelected && !isCurrentMonth ? 'text-gray-200' : ''}
                        ${isCurrentDay && !isSelected ? 'text-indigo-600 font-bold border border-indigo-100' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })
              })()}
            </div>

            <button
              onClick={() => setShowDatePicker(false)}
              className="w-full mt-6 py-4 bg-gray-50 text-gray-400 font-bold rounded-2xl hover:bg-gray-100 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
