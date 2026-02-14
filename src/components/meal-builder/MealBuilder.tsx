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
import { getOfflineFavorites, saveOfflineFavorite, getOfflineMeals, saveOfflineMeal, getOfflineFoods, saveOfflineFood } from '@/lib/offlineDb'
import { getMealsByDate } from '@/app/actions/nutrition'
import { parseMealWithAI } from '@/app/actions/ai'
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
  category?: string
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

interface DailyTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

type TDEEStorageResult = {
  targetCalories: number
  protein: number
  carbs: number
  fat: number
  mealDistribution?: {
    breakfast?: number
    lunch?: number
    dinner?: number
    snacks?: number
  }
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
   const [foods, setFoods] = useState<MealFood[]>(() => {
     if (typeof window === 'undefined') return []
     try {
       const saved = localStorage.getItem('draftMeal')
       return saved ? JSON.parse(saved) : []
     } catch {
       return []
     }
   })

   // Sauvegarder le repas en cours dans le cache local
   useEffect(() => {
     if (typeof window !== 'undefined') {
       localStorage.setItem('draftMeal', JSON.stringify(foods))
     }
   }, [foods])
   const [searchQuery, setSearchQuery] = useState('')
   const [showFoodSearch, setShowFoodSearch] = useState(false)
   const [availableFoods, setAvailableFoods] = useState<Food[]>([])
   const [favoriteMeals, setFavoriteMeals] = useState<FavoriteMeal[]>([])
   const [recentMeals, setRecentMeals] = useState<any[]>([])
   const [todayTotals, setTodayTotals] = useState<DailyTotals>({
     calories: 0,
     protein: 0,
     carbs: 0,
     fat: 0
   })
   const [isLoading, setIsLoading] = useState(true)
   const [isAISearching, setIsAISearching] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognitionInstance = new SpeechRecognition()
      recognitionInstance.continuous = false
      recognitionInstance.interimResults = false
      recognitionInstance.lang = 'fr-FR'

      recognitionInstance.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript
        console.log('Transcript:', transcript)
        setIsRecording(false)
        await handleVoiceMealAnalysis(transcript)
      }

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)
        showIsland("Erreur lors de la reconnaissance vocale", "error")
      }

      recognitionInstance.onend = () => {
        setIsRecording(false)
      }

      setRecognition(recognitionInstance)
    }
  }, [])

  const handleVoiceMealAnalysis = async (text: string) => {
    setIsAISearching(true)
    showIsland("L'IA Gemini analyse votre repas...", "syncing", 4000)
    
    try {
      const result = await parseMealWithAI(text)
      
      if (result.success && result.foods) {
        // Pour la voix, on ajoute toujours au repas (add_meal)
        const newFoods = result.foods.map((f: any) => {
          const quantityG = f.quantityG || 100
          return {
            ...f,
            quantityG,
            totalCalories: (f.calories * quantityG) / 100,
            totalProtein: (f.protein * quantityG) / 100,
            totalCarbs: (f.carbs * quantityG) / 100,
            totalFat: (f.fat * quantityG) / 100
          }
        })
        
        setFoods(prev => [...prev, ...newFoods])
        
        // Sauvegarder chaque aliment dans le cache offline
        for (const food of result.foods) {
          await saveOfflineFood({
            id: food.id,
            name: food.name,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            servingSizeG: food.servingSizeG,
            category: food.category || 'Autres',
            isCustom: food.isCustom || false,
            userId: food.userId
          })
        }
        
        showIsland(`${result.foods.length} aliments ajoutés via l'IA !`, "success")
        setShowFoodSearch(false)
      } else {
        showIsland(result.error || "Une erreur est survenue", "error")
      }
    } catch (error) {
      console.error('Voice analysis error:', error)
      showIsland("Erreur lors de l'analyse IA", "error")
    } finally {
      setIsAISearching(false)
    }
  }

  const toggleRecording = () => {
    if (!recognition) {
      showIsland("La reconnaissance vocale n'est pas supportée par votre navigateur", "error")
      return
    }

    if (isRecording) {
      recognition.stop()
    } else {
      setIsRecording(true)
      recognition.start()
      showIsland("Écoute en cours... Dites ce que vous avez mangé", "syncing", 3000)
    }
  }
   const [showFavorites, setShowFavorites] = useState(false)
   const [mealName, setMealName] = useState('')
   const [showSaveModal, setShowSaveModal] = useState(false)
   const [isSaving, setIsSaving] = useState(false)
   const [viewMode, setViewMode] = useState<'day' | 'meal'>('day')
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
      
      if (!user?.id) {
        setIsLoading(false)
        return
      }
      
      try {
        // Reset local state before fetching
        setTodayTotals({ calories: 0, protein: 0, carbs: 0, fat: 0 })
        setRecentMeals([])

        // 1. Tenter de charger depuis IndexedDB d'abord (cache/offline)
        const [offlineFavs, offlineMeals, offlineFoods] = await Promise.all([
          getOfflineFavorites(),
          getOfflineMeals(),
          getOfflineFoods()
        ])

        if (offlineFoods.length > 0) {
          setAvailableFoods(offlineFoods as any)
        }

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
           // Filtrer les repas d'aujourd'hui pour le total des nutriments
           const todayMeals = offlineMeals.filter((m: any) => m.date === selectedDate)
           const totals = todayMeals.reduce((acc: DailyTotals, m: any) => ({
             calories: acc.calories + m.totalCalories,
             protein: acc.protein + m.totalProtein,
             carbs: acc.carbs + m.totalCarbs,
             fat: acc.fat + m.totalFat
           }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
           setTodayTotals(totals)

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

          // Mettre à jour le cache local (Aliments)
          for (const food of (dbFoods as any)) {
            await saveOfflineFood({
              id: food.id,
              name: food.name,
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              servingSizeG: food.servingSizeG,
              category: food.category || 'Autres',
              isCustom: food.isCustom,
              userId: food.userId
            })
          }

          // Mettre à jour le cache local (Favoris)
           for (const fav of mappedFavs) {
             await saveOfflineFavorite({
               id: fav.id,
               userId: user.id,
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
              userId: user.id,
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
          
          // Calculer les nutriments d'aujourd'hui
          const todayMeals = finalOfflineMeals.filter((m: any) => m.date === selectedDate)
          const totals = todayMeals.reduce((acc: DailyTotals, m: any) => ({
            calories: acc.calories + m.totalCalories,
            protein: acc.protein + m.totalProtein,
            carbs: acc.carbs + m.totalCarbs,
            fat: acc.fat + m.totalFat
          }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
          setTodayTotals(totals)

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
    { id: '1', name: 'Oeuf entier', calories: 155, protein: 13, carbs: 1, fat: 11, servingSizeG: 100, category: 'Protéines' },
    { id: '2', name: 'Avoine', calories: 389, protein: 17, carbs: 66, fat: 7, servingSizeG: 100, category: 'Céréales' },
    { id: '3', name: 'Lait demi-écrémé', calories: 46, protein: 3.4, carbs: 4.8, fat: 1.7, servingSizeG: 100, category: 'Produits laitiers' },
    { id: '4', name: 'Poulet grillé', calories: 165, protein: 31, carbs: 0, fat: 3.6, servingSizeG: 100, category: 'Protéines' },
    { id: '5', name: 'Riz blanc cuit', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, servingSizeG: 100, category: 'Céréales' },
    { id: '6', name: 'Brocoli cuit', calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4, servingSizeG: 100, category: 'Légumes' },
    { id: '7', name: 'Pomme', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, servingSizeG: 100, category: 'Fruits' },
    { id: '8', name: 'Banane', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, servingSizeG: 100, category: 'Fruits' },
  ]

  // Fusionner les aliments de la BDD avec les aliments par défaut (sans doublons par nom)
  const displayFoods = [
    ...availableFoods,
    ...defaultFoods.filter(df => !availableFoods.some(f => f.name.toLowerCase() === df.name.toLowerCase()))
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
    // Tentative de récupération de l'ID utilisateur de secours si le store est en retard
    let currentUserId = user?.id
    if (!currentUserId && typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('user')
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser)
          currentUserId = parsed.id
        } catch (e) {}
      }
    }

    if (!mealName.trim() || foods.length === 0 || !currentUserId) {
      if (!currentUserId) showIsland('Utilisateur non identifié', 'error', 3000)
      if (foods.length === 0) showIsland('Ajoutez des aliments d\'abord', 'error', 3000)
      return
    }

    setIsSaving(true)
    try {
      const favoriteId = `${currentUserId}_fav_${Date.now()}`
      const newFavorite = {
        id: favoriteId,
        userId: currentUserId,
        name: mealName,
        mealType,
        items: foods.map(f => ({
          id: f.id,
          quantityG: f.quantityG
        })),
        totalCalories: Math.round(totalNutrients.calories),
        totalProtein: Math.round(totalNutrients.protein * 10) / 10,
        totalCarbs: Math.round(totalNutrients.carbs * 10) / 10,
        totalFat: Math.round(totalNutrients.fat * 10) / 10,
        synced: false
      }

      // Sauvegarder avec synchro (gère l'offline)
      await addFavoriteWithSync(newFavorite, currentUserId)

      // Mettre à jour l'état local immédiatement pour un retour rapide
      const mappedNewFav: FavoriteMeal = {
        id: favoriteId,
        name: mealName,
        mealType,
        totalCalories: newFavorite.totalCalories,
        totalProtein: newFavorite.totalProtein,
        totalCarbs: newFavorite.totalCarbs,
        totalFat: newFavorite.totalFat,
        foods: foods.map(f => ({
          ...f,
          id: f.id,
          name: f.name,
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
          servingSizeG: f.servingSizeG
        }))
      }

      setFavoriteMeals(prev => [mappedNewFav, ...prev])
      setMealName('')
      setShowSaveModal(false)
      showIsland('Plat ajouté aux favoris !', 'success', 3000)
    } catch (error) {
      console.error('Error saving favorite:', error)
      showIsland('Erreur lors de la sauvegarde', 'error', 3000)
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
    // Tentative de récupération de l'ID utilisateur de secours
    let currentUserId = user?.id
    if (!currentUserId && typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('user')
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser)
          currentUserId = parsed.id
        } catch (e) {}
      }
    }

    if (foods.length === 0 || !currentUserId) {
      if (!currentUserId) showIsland('Utilisateur non identifié', 'error', 3000)
      return
    }

    setIsSaving(true)
    try {
      const mealData = {
        userId: currentUserId,
        date: new Date(selectedDate),
        mealType,
        totalCalories: Math.round(totalNutrients.calories),
        totalProtein: Math.round(totalNutrients.protein * 10) / 10,
        totalCarbs: Math.round(totalNutrients.carbs * 10) / 10,
        totalFat: Math.round(totalNutrients.fat * 10) / 10,
        items: foods.map(f => ({
          foodId: f.id,
          quantityG: f.quantityG,
          totalCalories: f.totalCalories,
          totalProtein: f.totalProtein,
          totalCarbs: f.totalCarbs,
          totalFat: f.totalFat
        }))
      }

      await addMealWithSync({
        ...mealData,
        id: `meal_${Date.now()}`,
        name: mealTypeLabels[mealType].label,
        date: selectedDate,
        synced: false
      })

      localStorage.removeItem('draftMeal')
      setFoods([])
      setTodayTotals(prev => ({
        calories: prev.calories + mealData.totalCalories,
        protein: prev.protein + mealData.totalProtein,
        carbs: prev.carbs + mealData.totalCarbs,
        fat: prev.fat + mealData.totalFat
      }))
      showIsland('Repas enregistré !', 'success', 3000)
    } catch (error) {
      console.error('Error saving meal:', error)
      showIsland('Erreur lors de l\'enregistrement', 'error', 3000)
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

  const handleAISearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsAISearching(true)
    showIsland("L'IA Gemini analyse votre demande...", "syncing", 3000)
    
    try {
      const result = await parseMealWithAI(searchQuery)
      
      if (result.success && result.foods) {
        if (result.intent === 'add_meal') {
          // Ajout direct au repas
          const newFoods = result.foods.map((f: any) => {
            const quantityG = f.quantityG || 100
            return {
              ...f,
              quantityG,
              totalCalories: (f.calories * quantityG) / 100,
              totalProtein: (f.protein * quantityG) / 100,
              totalCarbs: (f.carbs * quantityG) / 100,
              totalFat: (f.fat * quantityG) / 100
            }
          })
          
          setFoods(prev => [...prev, ...newFoods])
          showIsland(`${result.foods.length} aliments ajoutés au repas !`, "success")
          setSearchQuery('')
          setShowFoodSearch(false)
        } else {
          // Ajout aux résultats de recherche
          const food = result.foods[0] as any
          if (food) {
            setAvailableFoods(prev => [food, ...prev])
            showIsland(`${food.name} trouvé par l'IA !`, "success")
          } else {
            showIsland("Aucun aliment trouvé", "error")
          }
        }
        
        // Sauvegarder dans le cache offline
        for (const food of result.foods) {
          await saveOfflineFood({
            id: food.id,
            name: food.name,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            servingSizeG: food.servingSizeG,
            category: food.category || 'Autres',
            isCustom: food.isCustom || false,
            userId: food.userId
          })
        }
      } else {
        showIsland(result.error || "Une erreur est survenue", "error")
      }
    } catch (error) {
      console.error('AI search error:', error)
      showIsland("Erreur lors de la recherche IA", "error")
    } finally {
      setIsAISearching(false)
    }
  }

  const filteredFoods = displayFoods.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const consumedCalories = todayTotals.calories + totalNutrients.calories
  const targetCalories = user?.targetCalories ?? (typeof tdeeResult?.targetCalories === 'number' ? tdeeResult.targetCalories : 2560)
  const targetProtein = typeof tdeeResult?.protein === 'number' ? tdeeResult.protein : 150
  const targetCarbs = typeof tdeeResult?.carbs === 'number' ? tdeeResult.carbs : 300
  const targetFat = typeof tdeeResult?.fat === 'number' ? tdeeResult.fat : 70
  
  const consumedProtein = todayTotals.protein + totalNutrients.protein
  const consumedCarbs = todayTotals.carbs + totalNutrients.carbs
  const consumedFat = todayTotals.fat + totalNutrients.fat
  
  // Calcul des objectifs par repas avec fallback si non défini
  const mealDistribution = tdeeResult?.mealDistribution
  const getMealTarget = () => {
    if (mealDistribution) {
      if (mealType === 'breakfast' && mealDistribution.breakfast) return mealDistribution.breakfast
      if (mealType === 'lunch' && mealDistribution.lunch) return mealDistribution.lunch
      if (mealType === 'dinner' && mealDistribution.dinner) return mealDistribution.dinner
      if (mealType === 'snack' && mealDistribution.snacks) return mealDistribution.snacks
    }
    
    // Fallback basé sur targetCalories si pas de distribution précise
    const base = targetCalories
    if (mealType === 'breakfast') return Math.round(base * 0.3)
    if (mealType === 'lunch') return Math.round(base * 0.35)
    if (mealType === 'dinner') return Math.round(base * 0.25)
    return Math.round(base * 0.1) // snacks
  }

  const mealTargetCalories = getMealTarget()
  const mealTargetProtein = Math.round((mealTargetCalories * 0.3) / 4)
  const mealTargetCarbs = Math.round((mealTargetCalories * 0.4) / 4)
  const mealTargetFat = Math.round((mealTargetCalories * 0.3) / 9)

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
        <div 
          data-no-swipe="true"
          className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-lg shadow-indigo-200 animate-in fade-in duration-500 overflow-hidden relative"
        >
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <span className="text-orange-400">🔥</span>
              <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                {viewMode === 'day' ? 'Objectif Journée' : `Objectif ${mealTypeLabels[mealType].label}`}
              </span>
            </div>
            
            {/* Widget Toggle Slider */}
            <div className="bg-indigo-900/40 p-1 rounded-xl flex relative w-32 h-8">
              <div 
                className={`absolute top-1 bottom-1 bg-white rounded-lg transition-all duration-300 ease-out shadow-sm ${
                  viewMode === 'day' ? 'left-1 w-[calc(50%-4px)]' : 'left-[calc(50%+2px)] w-[calc(50%-4px)]'
                }`}
              />
              <button 
                onClick={() => setViewMode('day')}
                className={`flex-1 text-[10px] font-bold z-10 transition-colors duration-300 ${
                  viewMode === 'day' ? 'text-indigo-600' : 'text-white/60'
                }`}
              >
                JOUR
              </button>
              <button 
                onClick={() => setViewMode('meal')}
                className={`flex-1 text-[10px] font-bold z-10 transition-colors duration-300 ${
                  viewMode === 'meal' ? 'text-indigo-600' : 'text-white/60'
                }`}
              >
                REPAS
              </button>
            </div>
          </div>

          <div className="relative h-48">
            {/* Mode Journée */}
            <div className={`absolute inset-0 transition-all duration-500 transform ${
              viewMode === 'day' ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
            }`}>
              <div className="mb-6">
                <div className="text-4xl font-bold">{targetCalories}</div>
                <div className="text-[10px] opacity-70 uppercase font-bold tracking-tight">Calories journalières cibles</div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span>{Math.round(consumedCalories)} kcal consommés</span>
                    <span>Reste: {Math.max(0, Math.round(remainingCalories))} kcal</span>
                  </div>
                  <div className="h-3 bg-indigo-900/40 rounded-full overflow-hidden p-[2px] border border-white/10">
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-bold uppercase opacity-80">
                      <span>Prot</span>
                      <span>{Math.round(consumedProtein)}/{targetProtein}g</span>
                    </div>
                    <div className="h-1 bg-indigo-800/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min((consumedProtein / targetProtein) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-bold uppercase opacity-80">
                      <span>Glu</span>
                      <span>{Math.round(consumedCarbs)}/{targetCarbs}g</span>
                    </div>
                    <div className="h-1 bg-indigo-800/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min((consumedCarbs / targetCarbs) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-bold uppercase opacity-80">
                      <span>Lip</span>
                      <span>{Math.round(consumedFat)}/{targetFat}g</span>
                    </div>
                    <div className="h-1 bg-indigo-800/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min((consumedFat / targetFat) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mode Repas */}
            <div className={`absolute inset-0 transition-all duration-500 transform ${
              viewMode === 'meal' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}>
              <div className="mb-6">
                <div className="text-4xl font-bold">{mealTargetCalories}</div>
                <div className="text-[10px] opacity-70 uppercase font-bold tracking-tight">Cible pour ce repas</div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-orange-300">
                    <span>Ce repas: {Math.round(totalNutrients.calories)} kcal</span>
                    <span>{Math.round((totalNutrients.calories / mealTargetCalories) * 100)}% de la cible</span>
                  </div>
                  <div className="h-3 bg-indigo-800/50 rounded-full overflow-hidden border border-indigo-400/30 p-[2px]">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-400 to-amber-300 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(251,146,60,0.5)]"
                      style={{ width: `${Math.min((totalNutrients.calories / mealTargetCalories) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-bold uppercase opacity-80">
                      <span>Prot</span>
                      <span>{Math.round(totalNutrients.protein)}/{mealTargetProtein}g</span>
                    </div>
                    <div className="h-1 bg-indigo-800/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min((totalNutrients.protein / mealTargetProtein) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-bold uppercase opacity-80">
                      <span>Glu</span>
                      <span>{Math.round(totalNutrients.carbs)}/{mealTargetCarbs}g</span>
                    </div>
                    <div className="h-1 bg-indigo-800/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min((totalNutrients.carbs / mealTargetCarbs) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-bold uppercase opacity-80">
                      <span>Lip</span>
                      <span>{Math.round(totalNutrients.fat)}/{mealTargetFat}g</span>
                    </div>
                    <div className="h-1 bg-indigo-800/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min((totalNutrients.fat / mealTargetFat) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
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
                Sauvegarder le plat
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
                    Enregistrer le repas
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
                className="w-full pl-12 pr-14 py-4 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                autoFocus
              />
              {/* AI & Voice Buttons */}
              <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    onClick={handleAISearch}
                    disabled={isAISearching}
                    className={`px-3 py-2 rounded-xl flex items-center justify-center transition-all ${
                      isAISearching 
                        ? 'bg-blue-50 text-blue-300' 
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-95'
                    }`}
                    title="Rechercher avec Gemini AI"
                  >
                    {isAISearching ? (
                      <div className="w-5 h-5 border-2 border-blue-200 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-xl">✨</span>
                    )}
                  </button>
                )}
                <button
                  onClick={toggleRecording}
                  disabled={isAISearching}
                  className={`p-2 rounded-xl transition-all ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200' 
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-indigo-500'
                  }`}
                  title="Parler pour ajouter un repas"
                >
                  {isRecording ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
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
                  disabled={!mealName.trim() || isSaving}
                  className="flex-1 py-4 bg-[#1a1c2e] text-white font-bold rounded-2xl shadow-lg shadow-gray-200 hover:bg-[#2a2d4a] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Enregistrer'
                  )}
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
