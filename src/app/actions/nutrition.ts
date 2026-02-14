'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// --- Users ---

export async function loginUser(email: string, password?: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim()
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (!user) {
      return { error: 'Utilisateur non trouvé' }
    }

    if (user.password && user.password !== password) {
      return { error: 'Mot de passe incorrect' }
    }

    return { user }
  } catch (error) {
    console.error('Error in loginUser:', error)
    return { error: 'Erreur lors de la connexion' }
  }
}

export async function registerUser(email: string, password?: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim()
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (existingUser) {
      return { error: 'Cet email est déjà utilisé' }
    }

    const user = await prisma.user.create({
      data: { 
        email: normalizedEmail,
        password 
      }
    })

    return { user }
  } catch (error) {
    console.error('Error in registerUser:', error)
    return { error: 'Erreur lors de l\'inscription' }
  }
}

export async function updateUserCalories(userId: string, targetCalories: number) {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { targetCalories }
    })
    revalidatePath('/')
    revalidatePath('/meal-builder')
    return user
  } catch (error) {
    console.error('Error in updateUserCalories:', error)
    return null
  }
}

// --- Foods ---

export async function getFoods(userId?: string) {
  try {
    const foods = await prisma.food.findMany({
      where: {
        OR: [
          { isCustom: false },
          { userId: userId }
        ]
      },
      orderBy: { name: 'asc' }
    })

    // If no global foods exist, seed them
    const globalFoods = foods.filter((f: any) => !f.isCustom)
    if (globalFoods.length === 0) {
      const defaultFoods = [
        { name: 'Oeuf entier', calories: 155, protein: 13, carbs: 1, fat: 11, servingSizeG: 100, category: 'Protéines' },
        { name: 'Avoine', calories: 389, protein: 17, carbs: 66, fat: 7, servingSizeG: 100, category: 'Céréales' },
        { name: 'Lait demi-écrémé', calories: 46, protein: 3.4, carbs: 4.8, fat: 1.7, servingSizeG: 100, category: 'Produits laitiers' },
        { name: 'Poulet grillé', calories: 165, protein: 31, carbs: 0, fat: 3.6, servingSizeG: 100, category: 'Protéines' },
        { name: 'Riz blanc cuit', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, servingSizeG: 100, category: 'Céréales' },
        { name: 'Brocoli cuit', calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4, servingSizeG: 100, category: 'Légumes' },
        { name: 'Pomme', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, servingSizeG: 100, category: 'Fruits' },
        { name: 'Banane', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, servingSizeG: 100, category: 'Fruits' },
      ]

      await prisma.food.createMany({
        data: defaultFoods
      })

      // Fetch again after seeding
      return await prisma.food.findMany({
        where: {
          OR: [
            { isCustom: false },
            { userId: userId }
          ]
        },
        orderBy: { name: 'asc' }
      })
    }

    return foods
  } catch (error) {
    console.error('Error in getFoods:', error)
    return []
  }
}

export async function addCustomFood(userId: string, foodData: any) {
  try {
    const food = await prisma.food.create({
      data: {
        ...foodData,
        isCustom: true,
        userId
      }
    })
    revalidatePath('/foods')
    return food
  } catch (error) {
    console.error('Error in addCustomFood:', error)
    return null
  }
}

export async function updateCustomFood(foodId: string, foodData: any) {
  try {
    const food = await prisma.food.update({
      where: { id: foodId },
      data: foodData
    })
    revalidatePath('/foods')
    return food
  } catch (error) {
    console.error('Error in updateCustomFood:', error)
    return null
  }
}

export async function deleteCustomFood(foodId: string) {
  try {
    await prisma.food.delete({
      where: { id: foodId }
    })
    revalidatePath('/foods')
    return true
  } catch (error) {
    console.error('Error in deleteCustomFood:', error)
    return false
  }
}

// --- Meals ---

export async function getMealsByDate(userId: string, date: string) {
  try {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    return await prisma.meal.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        items: {
          include: {
            food: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })
  } catch (error) {
    console.error('Error in getMealsByDate:', error)
    return []
  }
}

export async function getMealsForInterval(userId: string, startDate: string, endDate: string) {
  try {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    return await prisma.meal.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        items: {
          include: {
            food: true
          }
        }
      },
      orderBy: { date: 'asc' }
    })
  } catch (error) {
    console.error('Error in getMealsForInterval:', error)
    return []
  }
}

export async function saveMeal(userId: string, mealData: any) {
  try {
    const { date, mealType, foods, totalCalories, totalProtein, totalCarbs, totalFat } = mealData

    const meal = await prisma.meal.create({
      data: {
        userId,
        date: new Date(date),
        mealType,
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        items: {
          create: foods.map((item: any) => ({
            foodId: item.id,
            quantityG: item.quantityG,
            totalCalories: item.totalCalories,
            totalProtein: item.totalProtein,
            totalCarbs: item.totalCarbs,
            totalFat: item.totalFat
          }))
        }
      }
    })

    revalidatePath('/calendar')
    revalidatePath('/meal-builder')
    return meal
  } catch (error) {
    console.error('Error in saveMeal:', error)
    return null
  }
}

export async function deleteMeal(mealId: string) {
  try {
    await prisma.meal.delete({
      where: { id: mealId }
    })
    revalidatePath('/calendar')
    revalidatePath('/meal-builder')
    return true
  } catch (error) {
    console.error('Error in deleteMeal:', error)
    return false
  }
}

// --- Favorites ---

export async function getFavoriteMeals(userId: string) {
  try {
    return await prisma.favoriteMeal.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            food: true
          }
        }
      }
    })
  } catch (error) {
    console.error('Error in getFavoriteMeals:', error)
    return []
  }
}

export async function addFavoriteMeal(userId: string, favoriteData: any) {
  try {
    const { name, mealType, foods, totalCalories, totalProtein, totalCarbs, totalFat } = favoriteData

    const favorite = await prisma.favoriteMeal.create({
      data: {
        userId,
        name,
        mealType,
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        items: {
          create: foods.map((item: any) => ({
            foodId: item.id,
            quantityG: item.quantityG
          }))
        }
      }
    })

    return favorite
  } catch (error) {
    console.error('Error in addFavoriteMeal:', error)
    return null
  }
}

export async function deleteFavoriteMeal(favoriteId: string) {
  try {
    await prisma.favoriteMeal.delete({
      where: { id: favoriteId }
    })
    return true
  } catch (error) {
    console.error('Error in deleteFavoriteMeal:', error)
    return false
  }
}
