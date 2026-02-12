'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import { subscribeUser, getUserSnapshot, getUserServerSnapshot } from '@/lib/userStore'
import { getMealsForInterval } from '@/app/actions/nutrition'

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

interface Meal {
  id: string
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  date: Date
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  items: any[]
}

type TDEEStorageResult = {
  targetCalories: number
}

export function Calendar() {
  const user = useSyncExternalStore(subscribeUser, getUserSnapshot, getUserServerSnapshot)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
  const [meals, setMeals] = useState<Meal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
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

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  useEffect(() => {
    async function fetchMeals() {
      if (!user?.id) return
      
      setIsLoading(true)
      try {
        // Fetch for the whole week to cover both views
        const startDate = format(weekStart, 'yyyy-MM-dd')
        const endDate = format(weekEnd, 'yyyy-MM-dd')
        const dbMeals = await getMealsForInterval(user.id, startDate, endDate)
        setMeals(dbMeals as any)
      } catch (error) {
        console.error('Error fetching meals:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMeals()
  }, [user?.id, selectedDate, viewMode])

  const formattedDate = format(selectedDate, 'yyyy-MM-dd')

  const mealsByDate = meals.reduce<Record<string, Meal[]>>((acc, meal) => {
    const dateKey = format(new Date(meal.date), 'yyyy-MM-dd')
    ;(acc[dateKey] ??= []).push(meal)
    return acc
  }, {})

  // Day meals (day view)
  const dayMeals = mealsByDate[formattedDate] ?? []

  // Calculate totals for the day
  const totals = dayMeals.reduce((acc, meal) => ({
    calories: acc.calories + meal.totalCalories,
    protein: acc.protein + meal.totalProtein,
    carbs: acc.carbs + meal.totalCarbs,
    fat: acc.fat + meal.totalFat
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const targetCalories = tdeeResult ? tdeeResult.targetCalories : 2000
  const targetProtein = tdeeResult ? (targetCalories * 0.3 / 4) : 150
  const targetCarbs = tdeeResult ? (targetCalories * 0.4 / 4) : 250
  const targetFat = tdeeResult ? (targetCalories * 0.3 / 9) : 65

  const dayProgressPercentage = Math.min(Math.round((totals.calories / targetCalories) * 100), 100)

  const weekTotals = weekDays.reduce(
    (acc, day) => {
      const dateKey = format(day, 'yyyy-MM-dd')
      const dayMealsList = mealsByDate[dateKey] ?? []
      for (const meal of dayMealsList) {
        acc.calories += meal.totalCalories
        acc.protein += meal.totalProtein
        acc.carbs += meal.totalCarbs
        acc.fat += meal.totalFat
      }
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  const weekTargetCalories = targetCalories * 7
  const weekTargetProtein = targetProtein * 7
  const weekTargetCarbs = targetCarbs * 7
  const weekTargetFat = targetFat * 7
  const weekProgressPercentage = Math.min(
    Math.round((weekTotals.calories / weekTargetCalories) * 100),
    100,
  )

  const handlePrevious = () => {
    setSelectedDate((prev) => (viewMode === 'week' ? subWeeks(prev, 1) : subDays(prev, 1)))
  }
  const handleNext = () => {
    setSelectedDate((prev) => (viewMode === 'week' ? addWeeks(prev, 1) : addDays(prev, 1)))
  }

  const calendarTitle =
    viewMode === 'week'
      ? `Semaine du ${format(weekStart, 'd MMM', { locale: fr })} au ${format(weekEnd, 'd MMM', { locale: fr })}`
      : format(selectedDate, 'EEEE d MMMM', { locale: fr })

  const mealTypeLabels: Record<string, { label: string, icon: string, time: string, id: string }> = {
    breakfast: { id: 'breakfast', label: 'Petit-déjeuner', icon: '🥣', time: '07:30' },
    lunch: { id: 'lunch', label: 'Déjeuner', icon: '🍱', time: '12:45' },
    snack: { id: 'snack', label: 'Collation', icon: '🍎', time: '16:00' },
    dinner: { id: 'dinner', label: 'Dîner', icon: '🍗', time: '20:00' }
  }

  // Define standard meal types to show even if empty
  const standardMealTypes: ('breakfast' | 'lunch' | 'snack' | 'dinner')[] = ['breakfast', 'lunch', 'snack', 'dinner']

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-[#1a1c2e] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Date Selector Card */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50">
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={handlePrevious}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 capitalize">
              {calendarTitle}
            </div>
            <div className="text-sm text-gray-400 font-medium">
              {format(selectedDate, 'yyyy')}
            </div>
          </div>

          <button 
            onClick={handleNext}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex bg-gray-50 p-1 rounded-2xl">
          <button 
            onClick={() => setViewMode('day')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              viewMode === 'day' 
                ? 'bg-[#1a1c2e] text-white shadow-sm' 
                : 'text-gray-400'
            }`}
          >
            Jour
          </button>
          <button 
            onClick={() => setViewMode('week')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              viewMode === 'week' 
                ? 'bg-[#1a1c2e] text-white shadow-sm' 
                : 'text-gray-400'
            }`}
          >
            Semaine
          </button>
        </div>
      </div>

      {/* Progression Card */}
      <div className="bg-[#1a1c2e] rounded-[2rem] p-6 text-white shadow-xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">
              {viewMode === 'week' ? 'PROGRESSION HEBDOMADAIRE' : 'PROGRESSION QUOTIDIENNE'}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">
                {Math.round(viewMode === 'week' ? weekTotals.calories : totals.calories)}
              </span>
              <span className="text-lg opacity-60">
                / {viewMode === 'week' ? weekTargetCalories : targetCalories} kcal
              </span>
            </div>
          </div>
          
          <div className="relative w-20 h-20">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="34"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-white/10"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={213.6}
                strokeDashoffset={213.6 - (213.6 * (viewMode === 'week' ? weekProgressPercentage : dayProgressPercentage)) / 100}
                strokeLinecap="round"
                className="text-indigo-500 transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {viewMode === 'week' ? weekProgressPercentage : dayProgressPercentage}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight">
              <span className="opacity-60">PROTÉINES</span>
              <span>{Math.round(viewMode === 'week' ? weekTotals.protein : totals.protein)}G</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-400 rounded-full"
                style={{
                  width: `${Math.min(
                    ((viewMode === 'week' ? weekTotals.protein : totals.protein) /
                      (viewMode === 'week' ? weekTargetProtein : targetProtein)) *
                      100,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight">
              <span className="opacity-60">GLUCIDES</span>
              <span>{Math.round(viewMode === 'week' ? weekTotals.carbs : totals.carbs)}G</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-400 rounded-full"
                style={{
                  width: `${Math.min(
                    ((viewMode === 'week' ? weekTotals.carbs : totals.carbs) /
                      (viewMode === 'week' ? weekTargetCarbs : targetCarbs)) *
                      100,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight">
              <span className="opacity-60">LIPIDES</span>
              <span>{Math.round(viewMode === 'week' ? weekTotals.fat : totals.fat)}G</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-pink-400 rounded-full"
                style={{
                  width: `${Math.min(
                    ((viewMode === 'week' ? weekTotals.fat : totals.fat) /
                      (viewMode === 'week' ? weekTargetFat : targetFat)) *
                      100,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'week' ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Semaine</h3>
            <button
              type="button"
              onClick={() => {
                setViewMode('day')
              }}
              className="text-xs font-bold text-[#1a1c2e]"
            >
              Voir par jour
            </button>
          </div>

          <div className="space-y-3">
            {weekDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const meals = mealsByDate[dateKey] ?? []
              const dayTotals = meals.reduce(
                (acc, meal) => {
                  acc.calories += meal.totalCalories
                  acc.protein += meal.totalProtein
                  acc.carbs += meal.totalCarbs
                  acc.fat += meal.totalFat
                  return acc
                },
                { calories: 0, protein: 0, carbs: 0, fat: 0 },
              )
              const pct = Math.min(Math.round((dayTotals.calories / targetCalories) * 100), 100)

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => {
                    setSelectedDate(day)
                    setViewMode('day')
                  }}
                  className="w-full text-left bg-white rounded-[1.5rem] p-4 shadow-sm border border-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-gray-900 capitalize">
                        {format(day, 'EEEE d MMM', { locale: fr })}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-gray-400">
                        {Math.round(dayTotals.calories)} / {targetCalories} kcal • {pct}%
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-300">
                      {meals.length} repas
                    </div>
                  </div>
                  <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1a1c2e] rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Repas de la journée</h3>
            <button className="text-xs font-bold text-[#1a1c2e] flex items-center gap-1">
              Historique 
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            {standardMealTypes.map(type => {
              const meal = dayMeals.find(m => m.mealType === type)
              const labelInfo = mealTypeLabels[type]

              if (meal) {
                return (
                  <Link 
                    key={meal.id} 
                    href={`/meal-builder?date=${formattedDate}&type=${type}`}
                    className="bg-white rounded-[1.5rem] p-4 shadow-sm border border-gray-50 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                        {labelInfo.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{labelInfo.label}</h4>
                        <div className="text-xs font-medium text-gray-400 flex items-center gap-2">
                          <span>{Math.round(meal.totalCalories)} cal</span>
                          <span className="w-1 h-1 bg-gray-200 rounded-full" />
                          <span className="text-indigo-400">{Math.round(meal.totalProtein)}P</span>
                          <span className="text-orange-400">{Math.round(meal.totalCarbs)}G</span>
                          <span className="text-pink-400">{Math.round(meal.totalFat)}L</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-300">
                      {labelInfo.time}
                    </div>
                  </Link>
                )
              }

              return (
                <div key={type} className="border-2 border-dashed border-gray-100 rounded-[1.5rem] p-4 flex items-center justify-between bg-gray-50/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl opacity-50">
                      {labelInfo.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-400">{labelInfo.label}</h4>
                      <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Non renseigné</p>
                    </div>
                  </div>
                  <Link 
                    href={`/meal-builder?date=${formattedDate}&type=${type}`}
                    className="w-10 h-10 bg-gray-50 text-[#1a1c2e] rounded-2xl flex items-center justify-center shadow-sm hover:bg-gray-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
