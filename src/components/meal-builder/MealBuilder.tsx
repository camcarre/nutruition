'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { subscribeUser, getUserSnapshot, getUserServerSnapshot } from '@/lib/userStore'
import { showIsland } from '@/lib/uiStore'
import { 
  getFavoriteMeals, 
  getFoods
} from '@/app/actions/nutrition'
import { addMealWithSync, addFavoriteWithSync, deleteFavoriteWithSync } from '@/lib/syncService'
import { getOfflineFavorites, saveOfflineFavorite, getOfflineMeals, saveOfflineMeal } from '@/lib/offlineDb'
import { deleteFavoriteMeal as deleteFavoriteFromDB, getMealsByDate } from '@/app/actions/nutrition'
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
  isToday,
  parseISO
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
  foods: any[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  date?: string
  createdAt?: string
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
  const user = useSyncExternalStore(subscribeUser, getUserSnapshot, getUserServerSnapshot)

  const [selectedDate, setSelectedDate] = useState(() => {
     const dateParam = searchParams.get('date')
     if (dateParam) return dateParam
     return format(new Date(), 'yyyy-MM-dd')
   })
   const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'snack' | 'dinner'>(() => {
     const typeParam = searchParams.get('type') as any
     if (typeParam && ['breakfast', 'lunch', 'snack', 'dinner'].includes(typeParam)) {
       return typeParam
     }
     return 'breakfast'
   })
   const [foods, setFoods] = useState<MealFood[]>([])
   const [searchQuery, setSearchQuery] = useState('')
   const [showFoodSearch, setShowFoodSearch] = useState(false)
   const [availableFoods, setAvailableFoods] = useState<Food[]>([])
   const [favoriteMeals, setFavoriteMeals] = useState<FavoriteMeal[]>([])
   const [recentMeals, setRecentMeals] = useState<any[]>([])
   const [todayTotalCalories, setTodayTotalCalories] = useState(0)
   const [isLoading, setIsLoading] = useState(true)
   const [isLoadingFavorites, setIsLoadingFavorites] = useState(false)
   const [showFavorites, setShowFavorites] = useState(false)
   const [mealName, setMealName] = useState('')
   const [showSaveModal, setShowSaveModal] = useState(false)
   const [isSaving, setIsSaving] = useState(false)
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

   // Fetch data from DB
   useEffect(() => {
     async function fetchData() {
      setIsLoading(true)
      setIsLoadingFavorites(true)
      
      if (!user?.id) {
        setIsLoading(false)
        setIsLoadingFavorites(false)
        return
      }
      
      try {
        // Reset local state before fetching
        setTodayTotalCalories(0)
        setRecentMeals([])

        // 1. Tenter de charger depuis IndexedDB d'abord (cache/offline)
         const [offlineFavs, offlineMeals] = await Promise.all([
           getOfflineFavorites(),
           getOfflineMeals()
         ])

         if (offlineFavs.length > 0) {
           const mappedOfflineFavs: FavoriteMeal[] = offlineFavs.map((f: any) => ({
             id: f.id,
             name: f.name,
             mealType: f.mealType as any,
             totalCalories: f.totalCalories,
             totalProtein: f.totalProtein,
             totalCarbs: f.totalCarbs,
             totalFat: f.totalFat,
             foods: f.items.map((item: any) => ({
               ...item.food,
               quantityG: item.quantityG
             }))
           }))
           setFavoriteMeals(mappedOfflineFavs)
         }

         if (offlineMeals.length > 0) {
           // Filtrer les repas d'aujourd'hui pour le total des calories
           const todayMeals = offlineMeals.filter((m: any) => m.date === selectedDate)
           const todayCal = todayMeals.reduce((acc: number, m: any) => acc + m.totalCalories, 0)
           setTodayTotalCalories(todayCal)

           // 10 derniers repas
           const sortedMeals = [...offlineMeals].sort((a: any, b: any) => 
             new Date(b.date).getTime() - new Date(a.date).getTime()
           ).slice(0, 10)
           setRecentMeals(sortedMeals)
         }

         // 2. Charger depuis Supabase si en ligne
         if (typeof navigator !== 'undefined' && navigator.onLine) {
           const [favs, dbFoods, dayMeals] = await Promise.all([
             getFavoriteMeals(user.id),
             getFoods(user.id),
             getMealsByDate(user.id, selectedDate)
           ])
           
           const mappedFavs: FavoriteMeal[] = favs.map((f: any) => ({
             id: f.id,
             name: f.name,
             mealType: f.mealType as any,
             totalCalories: f.totalCalories,
             totalProtein: f.totalProtein,
             totalCarbs: f.totalCarbs,
             totalFat: f.totalFat,
             foods: f.items.map((item: any) => ({
               ...item.food,
               quantityG: item.quantityG
             }))
           }))
           
           setFavoriteMeals(mappedFavs)
          setAvailableFoods(dbFoods as any)

          // Mettre à jour le cache local (Favoris)
           for (const fav of mappedFavs) {
             await saveOfflineFavorite({
               id: fav.id,
               name: fav.name,
               mealType: fav.mealType,
               items: fav.foods.map(food => ({
                 food: {
                   id: food.id,
                   name: food.name,
                   calories: food.calories,
                   protein: food.protein,
                   carbs: food.carbs,
                   fat: food.fat,
                   servingSizeG: food.servingSizeG
                 },
                 quantityG: food.quantityG
               })),
               totalCalories: fav.totalCalories,
               totalProtein: fav.totalProtein,
               totalCarbs: fav.totalCarbs,
               totalFat: fav.totalFat,
               synced: true
             })
           }

           // Mettre à jour le cache local (Repas d'aujourd'hui)
          for (const meal of dayMeals) {
            await saveOfflineMeal({
              id: meal.id,
              name: meal.mealType,
              mealType: meal.mealType,
              date: format(new Date(meal.date), 'yyyy-MM-dd'),
              items: meal.items,
              totalCalories: meal.totalCalories,
              totalProtein: meal.totalProtein,
              totalCarbs: meal.totalCarbs,
              totalFat: meal.totalFat,
              synced: true
            })
          }

          // Recharger tout depuis IndexedDB pour avoir la version fusionnée (offline + online)
          const finalOfflineMeals = await getOfflineMeals()
          
          // Calculer les calories d'aujourd'hui
          const todayMeals = finalOfflineMeals.filter((m: any) => m.date === selectedDate)
          const todayCal = todayMeals.reduce((acc: number, m: any) => acc + m.totalCalories, 0)
          setTodayTotalCalories(todayCal)

          // 10 derniers repas
          const sortedMeals = [...finalOfflineMeals].sort((a: any, b: any) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          ).slice(0, 10)
          setRecentMeals(sortedMeals)
        }
      } catch (error) {
         console.error('Error fetching data:', error)
       } finally {
         setIsLoading(false)
         setIsLoadingFavorites(false)
       }
     }
     
     fetchData()

    // Écouter la fin de la synchronisation pour rafraîchir les données
    const handleSyncComplete = () => {
      console.log('Sync complete detected in MealBuilder, refreshing...')
      fetchData()
    }
    window.addEventListener('nutruition:sync-complete', handleSyncComplete)

    return () => {
      window.removeEventListener('nutruition:sync-complete', handleSyncComplete)
    }
  }, [user?.id, selectedDate])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [viewDate, setViewDate] = useState(new Date())

  // Default foods if DB is empty
  const defaultFoods: Food[] = [
    { id: '1', name: 'Oeuf entier', calories: 155, protein: 13, carbs: 1, fat: 11, servingSizeG: 100 },
    { id: '2', name: 'Avoine', calories: 389, protein: 17, carbs: 66, fat: 7, servingSizeG: 100 },
    { id: '3', name: 'Lait demi-écrémé', calories: 46, protein: 3.4, carbs: 4.8, fat: 1.7, servingSizeG: 100 },
    { id: '4', name: 'Poulet grillé', calories: 165, protein: 31, carbs: 0, fat: 3.6, servingSizeG: 100 },
    { id: '5', name: 'Riz blanc cuit', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, servingSizeG: 100 },
    { id: '6', name: 'Brocoli cuit', calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4, servingSizeG: 100 },
    { id: '7', name: 'Pomme', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, servingSizeG: 100 },
    { id: '8', name: 'Banane', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, servingSizeG: 100 },
  ]

  const displayFoods = availableFoods.length > 0 ? availableFoods : defaultFoods


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
    showIsland(`${food.name} ajouté`, 'success', 2000)
  }

  const removeFood = (id: string) => {
    const foodToRemove = foods.find(f => f.id === id)
    setFoods(prev => prev.filter(food => food.id !== id))
    if (foodToRemove) {
      showIsland(`${foodToRemove.name} retiré`, 'success', 2000)
    }
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

  const saveAsFavorite = async () => {
    if (!mealName.trim() || foods.length === 0 || !user?.id) return

    setIsSaving(true)
    try {
      const favoriteData = {
        name: mealName,
        mealType,
        items: foods.map(f => ({
          id: f.id,
          quantityG: f.quantityG
        })),
        totalCalories: Math.round(totalNutrients.calories),
        totalProtein: Math.round(totalNutrients.protein * 10) / 10,
        totalCarbs: Math.round(totalNutrients.carbs * 10) / 10,
        totalFat: Math.round(totalNutrients.fat * 10) / 10
      }

      await addFavoriteWithSync({
        id: `${user.id}_fav_${Date.now()}`,
        name: mealName,
        mealType,
        items: favoriteData.items,
        totalCalories: favoriteData.totalCalories,
        totalProtein: favoriteData.totalProtein,
        totalCarbs: favoriteData.totalCarbs,
        totalFat: favoriteData.totalFat,
        synced: false
      }, user.id)

      const favs = await getFavoriteMeals(user.id)
      const mappedFavs: FavoriteMeal[] = favs.map((f: any) => ({
        id: f.id,
        name: f.name,
        mealType: f.mealType as any,
        totalCalories: f.totalCalories,
        totalProtein: f.totalProtein,
        totalCarbs: f.totalCarbs,
        totalFat: f.totalFat,
        foods: f.items.map((item: any) => ({
          ...item.food,
          quantityG: item.quantityG
        }))
      }))
      setFavoriteMeals(mappedFavs)

      setMealName('')
      setShowSaveModal(false)
      showIsland('Ajouté aux favoris !', 'success', 3000)
    } catch (error) {
      console.error('Error saving favorite:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const loadFavoriteMeal = (favoriteMeal: FavoriteMeal) => {
    const loadedFoods = favoriteMeal.foods.map(food => {
      const quantityG = food.quantityG
      return {
        ...food,
        totalCalories: Math.round((food.calories * quantityG) / food.servingSizeG),
        totalProtein: Math.round((food.protein * quantityG) / food.servingSizeG * 10) / 10,
        totalCarbs: Math.round((food.carbs * quantityG) / food.servingSizeG * 10) / 10,
        totalFat: Math.round((food.fat * quantityG) / food.servingSizeG * 10) / 10
      }
    })
    
    setFoods(loadedFoods)
    setMealType(favoriteMeal.mealType)
    setShowFavorites(false)
  }

  const handleDeleteFavoriteMeal = async (id: string) => {
    if (!user?.id) return

    try {
      await deleteFavoriteWithSync(id, user.id)
      setFavoriteMeals(prev => prev.filter(meal => meal.id !== id))
      showIsland('Favori supprimé', 'success', 2000)
    } catch (error) {
      console.error('Error deleting favorite:', error)
    }
  }

  const handleSaveMeal = async () => {
    if (foods.length === 0 || !user?.id) return

    setIsSaving(true)
    try {
      const mealData = {
        id: `${user.id}_meal_${Date.now()}`,
        name: mealTypeLabels[mealType].label,
        mealType,
        date: selectedDate,
        items: foods.map(f => ({
          id: f.id,
          quantityG: f.quantityG,
          totalCalories: f.totalCalories,
          totalProtein: f.totalProtein,
          totalCarbs: f.totalCarbs,
          totalFat: f.totalFat
        })),
        totalCalories: Math.round(totalNutrients.calories),
        totalProtein: Math.round(totalNutrients.protein * 10) / 10,
        totalCarbs: Math.round(totalNutrients.carbs * 10) / 10,
        totalFat: Math.round(totalNutrients.fat * 10) / 10,
        synced: false
      }

      await addMealWithSync(mealData)
      
      // Mettre à jour les repas récents localement
      setRecentMeals(prev => {
        const updated = [mealData, ...prev]
        return updated.slice(0, 10)
      })

      // Mettre à jour les calories du jour si c'est la date sélectionnée
      if (mealData.date === selectedDate) {
        setTodayTotalCalories(prev => prev + mealData.totalCalories)
      }

      setFoods([])
      showIsland('Repas enregistré !', 'success', 3000)
    } catch (error) {
      console.error('Error saving meal:', error)
    } finally {
      setIsSaving(false)
    }
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
    const previousDay = subDays(parseISO(selectedDate), 1)
    setSelectedDate(format(previousDay, 'yyyy-MM-dd'))
  }

  const handleNextDay = () => {
    const nextDay = addDays(parseISO(selectedDate), 1)
    setSelectedDate(format(nextDay, 'yyyy-MM-dd'))
  }

  const filteredFoods = availableFoods.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const consumedCalories = todayTotalCalories + totalNutrients.calories
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
            setViewDate(parseISO(selectedDate))
            setShowDatePicker(true)
          }}
          className="flex items-center gap-2 hover:bg-gray-50 px-3 py-1 rounded-xl transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-semibold text-gray-800 capitalize">
            {format(parseISO(selectedDate), 'EEEE d MMMM', { locale: fr })}
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
      {isLoading ? (
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 animate-pulse">
          <div className="flex justify-between items-start mb-6">
            <div className="w-24 h-4 bg-gray-100 rounded-full" />
            <div className="w-20 h-6 bg-gray-100 rounded-full" />
          </div>
          <div className="flex justify-between items-end mb-6">
            <div className="space-y-2">
              <div className="w-16 h-8 bg-gray-100 rounded-lg" />
              <div className="w-24 h-2 bg-gray-100 rounded-full" />
            </div>
            <div className="space-y-2 text-right">
              <div className="w-16 h-8 bg-gray-100 rounded-lg ml-auto" />
              <div className="w-24 h-2 bg-gray-100 rounded-full" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <div className="w-20 h-2 bg-gray-100 rounded-full" />
              <div className="w-20 h-2 bg-gray-100 rounded-full" />
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full" />
          </div>
        </div>
      ) : (
        <div className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-lg shadow-indigo-200 animate-in fade-in duration-500">
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
      )}

      {/* Meal Tabs Horizontal Scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {mealTypeEntries.map(([key, { label, icon }]) => (
          <button
            key={key}
            onClick={() => setMealType(key)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl whitespace-nowrap transition-all border ${
              mealType === key
                ? 'bg-[#1a1c2e] border-transparent text-white shadow-sm'
                : 'bg-white border-gray-100 text-gray-400'
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
            className="text-[#1a1c2e] text-sm font-semibold flex items-center gap-1"
          >
            Voir tout 
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
      </div>
      {/* 10 Last Meals Section */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-5 h-5 bg-gray-100 rounded-full animate-pulse" />
            <div className="w-32 h-4 bg-gray-100 rounded-full animate-pulse" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 min-w-[160px] shadow-sm flex flex-col gap-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-100 rounded-lg" />
                <div className="space-y-2">
                  <div className="w-20 h-3 bg-gray-100 rounded-full" />
                  <div className="w-12 h-2 bg-gray-100 rounded-full" />
                </div>
                <div className="w-10 h-2 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : recentMeals.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">🕒</span>
              <h3 className="font-bold text-gray-900">10 derniers repas</h3>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {recentMeals.map((meal) => (
              <div 
                key={meal.id}
                className="bg-white border border-gray-100 rounded-2xl p-4 min-w-[160px] shadow-sm flex flex-col gap-2 hover:border-indigo-100 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <span className="text-xl">{mealTypeLabels[meal.mealType as keyof typeof mealTypeLabels]?.icon || '🍽️'}</span>
                  {!meal.synced && <span className="text-[8px] bg-orange-100 text-orange-500 px-1.5 py-0.5 rounded-full font-bold uppercase">Offline</span>}
                </div>
                <div>
                  <div className="font-bold text-gray-800 text-sm truncate">{mealTypeLabels[meal.mealType as keyof typeof mealTypeLabels]?.label || meal.name}</div>
                  <div className="text-[10px] text-gray-400 font-bold">{meal.totalCalories} kcal</div>
                </div>
                <div className="text-[9px] text-gray-300 font-medium">
                  {format(parseISO(meal.date), 'd MMM', { locale: fr })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
 
       {/* Foods List Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-lg font-bold text-gray-900">Aliments</h3>
          <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
            {foods.length} {foods.length <= 1 ? 'item' : 'items'}
          </span>
        </div>

                {foods.length === 0 ? (
          <div className="border-2 border-dashed border-gray-100 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center space-y-4 bg-gray-50/30 animate-in zoom-in-95 duration-500">
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
              className="mt-2 bg-[#1a1c2e] text-white w-12 h-12 rounded-full shadow-xl flex items-center justify-center hover:bg-[#2a2d4a] transition-all hover:scale-105 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
            {foods.map((food) => (
              <div key={food.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-indigo-100 transition-all">
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
              className="w-full py-4 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 font-bold text-sm hover:bg-gray-50/30 transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Ajouter un aliment
            </button>

            <div className="pt-2 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowSaveModal(true)}
                className="w-full bg-white border-2 border-[#1a1c2e] text-[#1a1c2e] py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <span>⭐</span>
                Favoris
              </button>
              <button
                onClick={handleSaveMeal}
                disabled={isSaving || foods.length === 0}
                className="w-full bg-[#1a1c2e] text-white py-4 rounded-2xl font-bold shadow-lg shadow-gray-200 hover:bg-[#2a2d4a] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>✅</span>
                    Valider
                  </>
                )}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end">
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
                    className="bg-[#1a1c2e] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-gray-200 hover:bg-[#2a2d4a] transition-colors"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                  className="flex-1 py-4 bg-[#1a1c2e] text-white font-bold rounded-2xl shadow-lg shadow-gray-200 hover:bg-[#2a2d4a] disabled:opacity-50 transition-all"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end">
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
                          onClick={() => handleDeleteFavoriteMeal(meal.id)}
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
                        className="w-full bg-white border border-gray-100 text-[#1a1c2e] py-3 rounded-2xl text-sm font-bold hover:bg-gray-50 transition-colors"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                  const isSelected = isSameDay(day, parseISO(selectedDate))
                  const isCurrentMonth = isSameMonth(day, monthStart)
                  const isCurrentDay = isToday(day)

                  return (
                    <button
                      key={day.toString()}
                      onClick={() => {
                        setSelectedDate(format(day, 'yyyy-MM-dd'))
                        setShowDatePicker(false)
                      }}
                      className={`
                        h-10 w-10 flex items-center justify-center rounded-xl text-sm font-medium transition-all
                        ${isSelected ? 'bg-[#1a1c2e] text-white shadow-lg shadow-gray-200 scale-110 z-10' : ''}
                        ${!isSelected && isCurrentMonth ? 'text-gray-900 hover:bg-gray-50 hover:text-[#1a1c2e]' : ''}
                        ${!isSelected && !isCurrentMonth ? 'text-gray-200' : ''}
                        ${isCurrentDay && !isSelected ? 'text-[#1a1c2e] font-bold border border-gray-100' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })
              })()}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  const today = new Date()
                  setSelectedDate(format(today, 'yyyy-MM-dd'))
                  setViewDate(today)
                  setShowDatePicker(false)
                }}
                className="flex-1 py-4 bg-gray-50 text-gray-900 font-bold rounded-2xl hover:bg-gray-100 transition-colors text-sm"
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => setShowDatePicker(false)}
                className="flex-1 py-4 bg-[#1a1c2e] text-white font-bold rounded-2xl hover:bg-[#2a2d4a] transition-colors text-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
