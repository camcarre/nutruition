'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function parseMealWithAI(description: string) {
  if (!process.env.GEMINI_API_KEY) {
    return { error: 'Clé API Gemini manquante' }
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `Tu es un expert en nutrition. Analyse la description suivante : "${description}".
    
    Détermine d'abord l'intention de l'utilisateur :
    - "search" : si l'utilisateur cherche un seul aliment sans préciser de quantité particulière (ex: "pomme", "steak haché").
    - "add_meal" : si l'utilisateur décrit un repas complet ou plusieurs aliments, ou un aliment avec une quantité précise (ex: "un steak avec du riz", "200g de poulet", "une pomme et un yaourt").

    Identifie tous les aliments mentionnés. Pour chaque aliment, estime la quantité en grammes (par défaut 100g si non précisé).
    Donne les informations nutritionnelles pour 100g.

    Réponds UNIQUEMENT au format JSON suivant, sans texte avant ou après :
    {
      "intent": "search" | "add_meal",
      "foods": [
        {
          "name": "Nom de l'aliment en français",
          "quantityG": 0,
          "calories": 0, // pour 100g
          "protein": 0, // pour 100g
          "carbs": 0, // pour 100g
          "fat": 0, // pour 100g
          "category": "Catégorie"
        }
      ]
    }
    Si aucun aliment n'est reconnu, renvoie {"intent": "search", "foods": []}.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    const jsonStr = text.replace(/```json|```/g, '').trim()
    let analysisResult
    try {
      analysisResult = JSON.parse(jsonStr)
    } catch (e) {
      console.error('Erreur parsing JSON Gemini Meal:', text)
      return { error: 'Réponse de l\'IA malformée' }
    }

    if (!analysisResult.foods || !Array.isArray(analysisResult.foods)) {
      return { error: 'Format de réponse invalide' }
    }

    // Pour chaque aliment identifié, on vérifie s'il existe déjà ou on le crée
    const processedFoods = await Promise.all(analysisResult.foods.map(async (item: any) => {
      // On cherche d'abord si l'aliment existe déjà par son nom
      let food = await prisma.food.findFirst({
        where: { name: { equals: item.name, mode: 'insensitive' } }
      })

      if (!food) {
        // Sinon on le crée
        food = await prisma.food.create({
          data: {
            name: item.name,
            calories: parseFloat(item.calories) || 0,
            protein: parseFloat(item.protein) || 0,
            carbs: parseFloat(item.carbs) || 0,
            fat: parseFloat(item.fat) || 0,
            servingSizeG: 100,
            category: item.category || 'Autres',
            isCustom: false
          }
        })
      }

      return {
        ...food,
        quantityG: item.quantityG || 100
      }
    }))

    revalidatePath('/foods')
    revalidatePath('/meal-builder')
    
    return { 
      success: true, 
      intent: analysisResult.intent,
      foods: processedFoods 
    }
  } catch (error) {
    console.error('Erreur Gemini Meal:', error)
    return { error: 'Erreur lors de l\'analyse avec l\'IA' }
  }
}
