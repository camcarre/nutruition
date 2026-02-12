'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { subscribeUser, getUserSnapshot, getUserServerSnapshot } from '@/lib/userStore'
import { updateUserCalories } from '@/app/actions/nutrition'

type Sex = 'M' | 'F' | ''
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | ''
type Goal = 'lose' | 'maintain' | 'gain' | ''
type MealTiming = 'balanced' | 'morning_heavy' | 'evening_heavy' | ''
type WorkoutSchedule = 'none' | 'morning' | 'evening' | 'both' | ''
type SnackCount = 'yes' | 'no' | ''

interface TDEEForm {
  age: string
  sex: Sex
  weight: string
  height: string
  activityLevel: ActivityLevel
  goal: Goal
  mealTiming: MealTiming
  workoutSchedule: WorkoutSchedule
  snackCount: SnackCount
}

interface TDEEResult {
  bmr: number
  tdee: number
  targetCalories: number
  protein: number
  carbs: number
  fat: number
  mealDistribution: {
    breakfast: number
    lunch: number
    dinner: number
    snacks: number
  }
  workoutTiming: string
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h13" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  )
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  )
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 12h.01" />
    </svg>
  )
}

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sédentaire (0 séance)', multiplier: 1.2 },
  { value: 'light', label: 'Légèrement actif (1–2 séances)', multiplier: 1.375 },
  { value: 'moderate', label: 'Modérément actif (3–5 séances)', multiplier: 1.55 },
  { value: 'active', label: 'Très actif (6–7 séances)', multiplier: 1.725 },
  { value: 'very_active', label: 'Extrêmement actif (2×/jour)', multiplier: 1.9 },
] as const

const GOAL_OPTIONS = [
  { value: 'lose', label: 'Perte de poids', delta: -500 },
  { value: 'maintain', label: 'Maintien', delta: 0 },
  { value: 'gain', label: 'Prise de masse', delta: 300 },
] as const

const MEAL_TIMING_OPTIONS = [
  { value: 'balanced', label: 'Répartie équitablement' },
  { value: 'morning_heavy', label: 'Plus lourd le matin' },
  { value: 'evening_heavy', label: 'Plus lourd le soir' },
] as const

const SNACK_COUNT_OPTIONS = [
  { value: 'no', label: 'Non' },
  { value: 'yes', label: 'Oui' },
] as const

const WORKOUT_SCHEDULE_OPTIONS = [
  { value: 'none', label: 'Pas d’entraînement' },
  { value: 'morning', label: 'Matin' },
  { value: 'evening', label: 'Soir' },
  { value: 'both', label: 'Matin et soir' },
] as const

const DEFAULT_FORM: TDEEForm = {
  age: '21',
  sex: 'M',
  weight: '78',
  height: '175',
  activityLevel: 'moderate',
  goal: 'lose',
  mealTiming: 'balanced',
  workoutSchedule: 'none',
  snackCount: 'yes',
}

export function Calculator() {
  const user = useSyncExternalStore(subscribeUser, getUserSnapshot, getUserServerSnapshot)
  const [form, setForm] = useState<TDEEForm>(() => {
    if (typeof window === 'undefined') return DEFAULT_FORM
    try {
      const savedForm = localStorage.getItem('tdeeForm')
      if (!savedForm) return DEFAULT_FORM

      const parsed = JSON.parse(savedForm) as Partial<TDEEForm>
      return {
        ...DEFAULT_FORM,
        ...(typeof parsed.age === 'string' ? { age: parsed.age } : {}),
        ...(typeof parsed.sex === 'string' ? { sex: parsed.sex as Sex } : {}),
        ...(typeof parsed.weight === 'string' ? { weight: parsed.weight } : {}),
        ...(typeof parsed.height === 'string' ? { height: parsed.height } : {}),
        ...(typeof parsed.activityLevel === 'string'
          ? { activityLevel: parsed.activityLevel as ActivityLevel }
          : {}),
        ...(typeof parsed.goal === 'string' ? { goal: parsed.goal as Goal } : {}),
        ...(typeof parsed.mealTiming === 'string'
          ? { mealTiming: parsed.mealTiming as MealTiming }
          : {}),
        ...(typeof parsed.workoutSchedule === 'string'
          ? { workoutSchedule: parsed.workoutSchedule as WorkoutSchedule }
          : {}),
        ...(typeof parsed.snackCount === 'string'
          ? { snackCount: parsed.snackCount as SnackCount }
          : {}),
      }
    } catch {
      return DEFAULT_FORM
    }
  })

  const [result, setResult] = useState<TDEEResult | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const savedResult = localStorage.getItem('tdeeResult')
      if (!savedResult) return null

      const parsed = JSON.parse(savedResult) as Partial<TDEEResult>
      if (
        typeof parsed?.bmr === 'number' &&
        typeof parsed?.tdee === 'number' &&
        typeof parsed?.targetCalories === 'number'
      ) {
        return parsed as TDEEResult
      }
      return null
    } catch {
      return null
    }
  })

  const activityLabel = useMemo(() => {
    const option = ACTIVITY_OPTIONS.find((o) => o.value === form.activityLevel)
    return option?.label ?? 'Sélectionner'
  }, [form.activityLevel])

  const goalLabel = useMemo(() => {
    const option = GOAL_OPTIONS.find((o) => o.value === form.goal)
    return option?.label ?? 'Sélectionner'
  }, [form.goal])

  const isFormComplete =
    !!form.age &&
    !!form.sex &&
    !!form.weight &&
    !!form.height &&
    !!form.activityLevel &&
    !!form.goal &&
    !!form.mealTiming &&
    !!form.workoutSchedule &&
    !!form.snackCount

  const updateForm = <K extends keyof TDEEForm>(field: K, value: TDEEForm[K]) => {
    const nextForm = { ...form, [field]: value }
    setForm(nextForm)
    localStorage.setItem('tdeeForm', JSON.stringify(nextForm))
  }

  const calculateTDEE = () => {
    if (!isFormComplete) return

    const age = Number(form.age)
    const weight = Number(form.weight)
    const height = Number(form.height)

    if (!Number.isFinite(age) || age <= 0) return
    if (!Number.isFinite(weight) || weight <= 0) return
    if (!Number.isFinite(height) || height <= 0) return
    if (form.sex !== 'M' && form.sex !== 'F') return

    const activity = ACTIVITY_OPTIONS.find((o) => o.value === form.activityLevel)
    const goal = GOAL_OPTIONS.find((o) => o.value === form.goal)
    if (!activity || !goal) return

    // Mifflin-St Jeor Equation
    const bmr =
      form.sex === 'M'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161

    const tdee = bmr * activity.multiplier
    const targetCalories = tdee + goal.delta

    // Macro split based on workout schedule
    let proteinMultiplier = 0.3
    if (form.workoutSchedule === 'both') proteinMultiplier = 0.35
    else if (form.workoutSchedule !== 'none') proteinMultiplier = 0.32

    const protein = Math.round((targetCalories * proteinMultiplier) / 4)
    const carbs = Math.round((targetCalories * 0.4) / 4)
    const fat = Math.round((targetCalories * (1 - proteinMultiplier - 0.4)) / 9)

    // Meal distribution based on timing preference
    let mealDistribution = {
      breakfast: Math.round(targetCalories * 0.25),
      lunch: Math.round(targetCalories * 0.35),
      dinner: Math.round(targetCalories * 0.3),
      snacks: Math.round(targetCalories * 0.1),
    }

    if (form.mealTiming === 'morning_heavy') {
      mealDistribution = {
        breakfast: Math.round(targetCalories * 0.4),
        lunch: Math.round(targetCalories * 0.3),
        dinner: Math.round(targetCalories * 0.2),
        snacks: Math.round(targetCalories * 0.1),
      }
    } else if (form.mealTiming === 'evening_heavy') {
      mealDistribution = {
        breakfast: Math.round(targetCalories * 0.2),
        lunch: Math.round(targetCalories * 0.3),
        dinner: Math.round(targetCalories * 0.4),
        snacks: Math.round(targetCalories * 0.1),
      }
    }

    // Adjust snacks based on preference
    if (form.snackCount === 'no') {
      mealDistribution.breakfast += mealDistribution.snacks
      mealDistribution.snacks = 0
    } else {
      // Default 'yes' to 1 snack (10%)
      mealDistribution.snacks = Math.round(targetCalories * 0.1)
    }

    // Workout timing recommendation
    let workoutTiming = ''
    if (form.workoutSchedule === 'morning') {
      workoutTiming =
        'Entraînement le matin — petit-déjeuner riche en glucides 1–2h avant.'
    } else if (form.workoutSchedule === 'evening') {
      workoutTiming =
        'Entraînement le soir — collation protéinée après l’entraînement.'
    } else if (form.workoutSchedule === 'both') {
      workoutTiming = 'Deux entraînements — collations protéinées matin et soir.'
    }

    const resultData: TDEEResult = {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targetCalories: Math.round(targetCalories),
      protein,
      carbs,
      fat,
      mealDistribution,
      workoutTiming,
    }

    setResult(resultData)
    localStorage.setItem('tdeeResult', JSON.stringify(resultData))

    // Sync with DB if user is logged in
    if (user?.id) {
      updateUserCalories(user.id, resultData.targetCalories)
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-[13px] font-extrabold tracking-[0.2em] text-indigo-600">
          PHYSIQUE
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-400">
              Âge
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={form.age}
              onChange={(e) => updateForm('age', e.target.value)}
              className="mt-2 w-full appearance-none bg-transparent p-0 text-3xl font-extrabold leading-none text-gray-900 outline-none placeholder:text-gray-300"
              placeholder="21"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-400">
              Sexe
            </label>
            <select
              value={form.sex}
              onChange={(e) => updateForm('sex', e.target.value as Sex)}
              className="mt-2 w-full appearance-none bg-transparent p-0 text-2xl font-extrabold leading-none text-gray-900 outline-none"
            >
              <option value="">Sélectionner</option>
              <option value="M">Homme</option>
              <option value="F">Femme</option>
            </select>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-400">
              Poids (kg)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={form.weight}
              onChange={(e) => updateForm('weight', e.target.value)}
              className="mt-2 w-full appearance-none bg-transparent p-0 text-3xl font-extrabold leading-none text-gray-900 outline-none placeholder:text-gray-300"
              placeholder="78"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-400">
              Taille (cm)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={form.height}
              onChange={(e) => updateForm('height', e.target.value)}
              className="mt-2 w-full appearance-none bg-transparent p-0 text-3xl font-extrabold leading-none text-gray-900 outline-none placeholder:text-gray-300"
              placeholder="175"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[13px] font-extrabold tracking-[0.2em] text-indigo-600">
          MODE DE VIE &amp; OBJECTIFS
        </h3>

        <div className="space-y-4">
          <div className="relative flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <ActivityIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-400">
                Niveau d’activité
              </div>
              <div className="mt-1 truncate text-lg font-extrabold text-gray-900">
                {activityLabel}
              </div>
            </div>
            <select
              value={form.activityLevel}
              onChange={(e) =>
                updateForm('activityLevel', e.target.value as ActivityLevel)
              }
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Niveau d’activité"
            >
              <option value="">Sélectionner</option>
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <TargetIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-400">
                Objectif principal
              </div>
              <div className="mt-1 truncate text-lg font-extrabold text-gray-900">
                {goalLabel}
              </div>
            </div>
            <select
              value={form.goal}
              onChange={(e) => updateForm('goal', e.target.value as Goal)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Objectif principal"
            >
              <option value="">Sélectionner</option>
              {GOAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <TargetIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-400">
                Répartition des repas
              </div>
              <div className="mt-1 truncate text-lg font-extrabold text-gray-900">
                {MEAL_TIMING_OPTIONS.find((o) => o.value === form.mealTiming)?.label ??
                  'Sélectionner'}
              </div>
            </div>
            <select
              value={form.mealTiming}
              onChange={(e) => updateForm('mealTiming', e.target.value as MealTiming)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Répartition des repas"
            >
              <option value="">Sélectionner</option>
              {MEAL_TIMING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <ActivityIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-400">
                Prendre des collations ?
              </div>
              <div className="mt-1 truncate text-lg font-extrabold text-gray-900">
                {SNACK_COUNT_OPTIONS.find((o) => o.value === form.snackCount)?.label ??
                  'Sélectionner'}
              </div>
            </div>
            <select
              value={form.snackCount}
              onChange={(e) => updateForm('snackCount', e.target.value as SnackCount)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Prendre des collations ?"
            >
              <option value="">Sélectionner</option>
              {SNACK_COUNT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <ActivityIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-400">
                Horaire d’entraînement
              </div>
              <div className="mt-1 truncate text-lg font-extrabold text-gray-900">
                {WORKOUT_SCHEDULE_OPTIONS.find((o) => o.value === form.workoutSchedule)
                  ?.label ?? 'Sélectionner'}
              </div>
            </div>
            <select
              value={form.workoutSchedule}
              onChange={(e) =>
                updateForm('workoutSchedule', e.target.value as WorkoutSchedule)
              }
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Horaire d’entraînement"
            >
              <option value="">Sélectionner</option>
              {WORKOUT_SCHEDULE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={calculateTDEE}
        disabled={!isFormComplete}
        className="w-full rounded-3xl bg-gradient-to-r from-[#0b1020] to-[#121a35] px-6 py-5 text-lg font-extrabold text-white shadow-xl transition-colors hover:from-[#0a0f1e] hover:to-[#111a33] disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 disabled:shadow-none"
      >
        <span className="flex items-center justify-center gap-3">
          Calculer mes besoins
          <ArrowRightIcon className="h-5 w-5" />
        </span>
      </button>

      {result && (
        <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-extrabold text-gray-900">
            Résultats personnalisés
          </h3>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-400">BMR</div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900">
                {result.bmr} cal
              </div>
              <div className="mt-2 text-xs font-semibold leading-relaxed text-gray-500">
                BMR (métabolisme de base) : calories dépensées au repos, sans activité.
              </div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-400">TDEE</div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900">
                {result.tdee} cal
              </div>
              <div className="mt-2 text-xs font-semibold leading-relaxed text-gray-500">
                TDEE (dépense totale) : BMR + activité physique du quotidien.
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-indigo-50 p-5 text-center">
            <div className="text-sm font-semibold text-indigo-600">
              Objectif quotidien
            </div>
            <div className="mt-2 text-4xl font-extrabold tracking-tight text-indigo-700">
              {result.targetCalories}
            </div>
            <div className="mt-1 text-sm font-semibold text-indigo-600">
              calories / jour
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-400">Protéines</div>
              <div className="mt-1 text-lg font-extrabold text-gray-900">
                {result.protein}g
              </div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-400">Glucides</div>
              <div className="mt-1 text-lg font-extrabold text-gray-900">
                {result.carbs}g
              </div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-400">Lipides</div>
              <div className="mt-1 text-lg font-extrabold text-gray-900">
                {result.fat}g
              </div>
            </div>
          </div>

          {result.workoutTiming && (
            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-400">
                Conseils entraînement
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-700">
                {result.workoutTiming}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
