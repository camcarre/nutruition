'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { subscribeUser, getUserSnapshot, getUserServerSnapshot } from '@/lib/userStore'
import { getFoods, addCustomFood as addCustomFoodToDB, updateCustomFood as updateCustomFoodToDB, deleteCustomFood as deleteCustomFoodFromDB } from '@/app/actions/nutrition'

interface Food {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sodium?: number
  category: string
  servingSizeG: number
  isCustom?: boolean
  userId?: string | null
}

export function FoodList() {
  const user = useSyncExternalStore(subscribeUser, getUserSnapshot, getUserServerSnapshot)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [favoriteFoods, setFavoriteFoods] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const savedFavorites = localStorage.getItem('favoriteFoods')
      return savedFavorites ? (JSON.parse(savedFavorites) as string[]) : []
    } catch {
      return []
    }
  })
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingFood, setEditingFood] = useState<Food | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'custom'>('all')
  
  const [isFilterFavorites, setIsFilterFavorites] = useState(false)
  
  const [newFood, setNewFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    sodium: '',
    category: '',
    servingSizeG: '100'
  })

  useEffect(() => {
    async function fetchFoods() {
      setIsLoading(true)
      try {
        const dbFoods = await getFoods(user?.id)
        setFoods(dbFoods as any)
      } catch (error) {
        console.error('Error fetching foods:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchFoods()
  }, [user?.id])

  const categories = ['Protéines', 'Céréales', 'Produits laitiers', 'Légumes', 'Fruits']

  const toggleFavorite = (foodId: string) => {
    const updatedFavorites = favoriteFoods.includes(foodId)
      ? favoriteFoods.filter(id => id !== foodId)
      : [...favoriteFoods, foodId]
    
    setFavoriteFoods(updatedFavorites)
    localStorage.setItem('favoriteFoods', JSON.stringify(updatedFavorites))
  }

  const handleAddCustomFood = async () => {
    if (!newFood.name || !newFood.calories || !newFood.category || !user?.id) return

    const foodData = {
      name: newFood.name,
      calories: parseFloat(newFood.calories),
      protein: parseFloat(newFood.protein) || 0,
      carbs: parseFloat(newFood.carbs) || 0,
      fat: parseFloat(newFood.fat) || 0,
      fiber: parseFloat(newFood.fiber) || 0,
      sodium: parseFloat(newFood.sodium) || 0,
      category: newFood.category,
      servingSizeG: parseFloat(newFood.servingSizeG) || 100
    }

    try {
      const createdFood = await addCustomFoodToDB(user.id, foodData)
      if (createdFood) {
        setFoods(prev => [...prev, createdFood as any])
        setNewFood({
          name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', sodium: '', category: '', servingSizeG: '100'
        })
        setShowAddModal(false)
      }
    } catch (error) {
      console.error('Error adding custom food:', error)
    }
  }

  const handleUpdateFood = async (updatedFood: Food) => {
    if (!user?.id) return

    try {
      const { id, ...foodData } = updatedFood
      const success = await updateCustomFoodToDB(id, foodData)
      if (success) {
        setFoods(prev => prev.map(f => f.id === id ? updatedFood : f))
        setEditingFood(null)
        setShowEditModal(false)
      }
    } catch (error) {
      console.error('Error updating food:', error)
    }
  }

  const handleDeleteFood = async (foodId: string) => {
    if (!user?.id) return

    try {
      const success = await deleteCustomFoodFromDB(foodId)
      if (success) {
        setFoods(prev => prev.filter(f => f.id !== foodId))
      }
    } catch (error) {
      console.error('Error deleting food:', error)
    }
  }

  const filteredFoods = foods.filter(food => {
    const matchesSearch = food.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || food.category === selectedCategory
    
    const matchesTab = activeTab === 'all' || 
                     (activeTab === 'favorites' && favoriteFoods.includes(food.id)) ||
                     (activeTab === 'custom' && food.isCustom === true)
    
    const matchesFavoritesToggle = !isFilterFavorites || favoriteFoods.includes(food.id)
    
    return matchesSearch && matchesCategory && matchesTab && matchesFavoritesToggle
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
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
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-50 rounded-[1.5rem] shadow-sm text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-gray-300"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${
            selectedCategory === '' 
              ? 'bg-[#1a1c2e] text-white' 
              : 'bg-white text-gray-400 border border-gray-50'
          }`}
        >
          Tous
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap border ${
              selectedCategory === category 
                ? 'bg-[#1a1c2e] text-white border-transparent' 
                : 'bg-white text-gray-400 border-gray-50'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Action Buttons & Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex bg-gray-50 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'all' 
                ? 'bg-[#1a1c2e] text-white shadow-sm' 
                : 'text-gray-400'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'favorites' 
                ? 'bg-[#1a1c2e] text-white shadow-sm' 
                : 'text-gray-400'
            }`}
          >
            Favoris
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'custom' 
                ? 'bg-[#1a1c2e] text-white shadow-sm' 
                : 'text-gray-400'
            }`}
          >
            Autres
          </button>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => setIsFilterFavorites(!isFilterFavorites)}
            className={`flex-1 border rounded-2xl py-4 px-4 flex items-center justify-center gap-2 text-sm font-bold transition-all ${
              isFilterFavorites 
                ? 'bg-yellow-50 border-yellow-200 text-yellow-600 shadow-sm' 
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isFilterFavorites ? 'text-yellow-500' : 'text-gray-400'}`} fill={isFilterFavorites ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {isFilterFavorites ? 'Favoris' : 'Filtres'}
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-[1.5] bg-[#1a1c2e] rounded-2xl py-4 px-4 flex items-center justify-center gap-2 text-sm font-bold text-white shadow-md hover:bg-[#2a2d4a] transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Ajouter un aliment
          </button>
        </div>
      </div>

      {/* Food Cards */}
      <div className="space-y-6 min-h-[200px]">
        {filteredFoods.length > 0 ? (
          filteredFoods.map((food) => (
            <div 
              key={food.id} 
              className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
            {/* Badge Category */}
            <div className="flex justify-between items-start mb-4">
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                food.category === 'Protéines' ? 'bg-green-50 text-green-500' :
                food.category === 'Céréales' ? 'bg-blue-50 text-blue-500' :
                food.category === 'Produits laitiers' ? 'bg-purple-50 text-purple-500' :
                'bg-gray-50 text-gray-500'
              }`}>
                {food.category}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-orange-400">🔥</span>
                <span className="text-lg font-bold text-orange-500">{food.calories}</span>
                <span className="text-[10px] font-bold text-gray-300 uppercase">kcal</span>
              </div>
            </div>

            {/* Name and Favorite */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">{food.name}</h3>
              <button 
                onClick={() => toggleFavorite(food.id)}
                className={`transition-all ${favoriteFoods.includes(food.id) ? 'text-yellow-400' : 'text-gray-200'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            </div>

            {/* Macros Grid */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-gray-50/50 rounded-2xl p-3 flex flex-col items-center justify-center space-y-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">PROT</span>
                <span className="text-sm font-bold text-gray-900">{food.protein}g</span>
                <div className="w-8 h-1 bg-indigo-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '60%' }} />
                </div>
              </div>
              <div className="bg-gray-50/50 rounded-2xl p-3 flex flex-col items-center justify-center space-y-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">GLUC</span>
                <span className="text-sm font-bold text-gray-900">{food.carbs}g</span>
                <div className="w-8 h-1 bg-red-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: '40%' }} />
                </div>
              </div>
              <div className="bg-gray-50/50 rounded-2xl p-3 flex flex-col items-center justify-center space-y-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">LIP</span>
                <span className="text-sm font-bold text-gray-900">{food.fat}g</span>
                <div className="w-8 h-1 bg-yellow-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: '30%' }} />
                </div>
              </div>
              <div className="bg-gray-50/50 rounded-2xl p-3 flex flex-col items-center justify-center space-y-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">PORTION</span>
                <span className="text-sm font-bold text-gray-900">{food.servingSizeG}g</span>
                <div className="w-8 h-1 bg-gray-200 rounded-full mt-1" />
              </div>
            </div>

            {/* Fiber section */}
            {food.fiber !== undefined && food.fiber > 0 && (
              <div className="pt-4 border-t border-dashed border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-400">⚡</span>
                  <span className="text-xs font-bold text-gray-400">Fibres</span>
                </div>
                <span className="text-xs font-bold text-gray-900">{food.fiber}g</span>
              </div>
            )}

            {/* Edit Button for custom foods */}
            {food.userId && food.userId === user?.id && (
              <button
                onClick={() => {
                  setEditingFood(food)
                  setShowEditModal(true)
                }}
                className="absolute bottom-6 right-6 p-2 rounded-full bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4 bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100 animate-in fade-in duration-500">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-2xl">
            {isFilterFavorites ? '⭐' : '🔍'}
          </div>
          <div>
            <p className="text-gray-900 font-bold">Aucun aliment trouvé</p>
            <p className="text-gray-400 text-sm">
              {isFilterFavorites 
                ? "Vous n'avez pas encore d'aliments favoris." 
                : "Essayez de modifier vos critères de recherche."}
            </p>
          </div>
          {isFilterFavorites && (
            <button 
              onClick={() => setIsFilterFavorites(false)}
              className="text-indigo-600 font-bold text-sm hover:underline"
            >
              Voir tous les aliments
            </button>
          )}
        </div>
      )}
      </div>

      {/* Add/Edit Modal (simplified for now to keep the UI clean) */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              {showEditModal ? 'Modifier l\'aliment' : 'Nouvel aliment'}
            </h3>
            
	            <div className="space-y-4">
	              <div>
	                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Nom de l’aliment</label>
	                <input
	                  type="text"
	                  value={showEditModal ? editingFood?.name : newFood.name}
                  onChange={(e) => showEditModal ? setEditingFood({...editingFood!, name: e.target.value}) : setNewFood({...newFood, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Calories (kcal)</label>
                  <input
                    type="number"
                    value={showEditModal ? editingFood?.calories : newFood.calories}
                    onChange={(e) => showEditModal ? setEditingFood({...editingFood!, calories: parseFloat(e.target.value)}) : setNewFood({...newFood, calories: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Portion (g)</label>
                  <input
                    type="number"
                    value={showEditModal ? editingFood?.servingSizeG : newFood.servingSizeG}
                    onChange={(e) => showEditModal ? setEditingFood({...editingFood!, servingSizeG: parseFloat(e.target.value)}) : setNewFood({...newFood, servingSizeG: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Catégorie</label>
                <select
                  value={showEditModal ? editingFood?.category : newFood.category}
                  onChange={(e) => showEditModal ? setEditingFood({...editingFood!, category: e.target.value}) : setNewFood({...newFood, category: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium"
                >
                  <option value="">Sélectionner...</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1 text-center">PROT (g)</label>
                  <input
                    type="number"
                    value={showEditModal ? editingFood?.protein : newFood.protein}
                    onChange={(e) => showEditModal ? setEditingFood({...editingFood!, protein: parseFloat(e.target.value)}) : setNewFood({...newFood, protein: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1 text-center">GLUC (g)</label>
                  <input
                    type="number"
                    value={showEditModal ? editingFood?.carbs : newFood.carbs}
                    onChange={(e) => showEditModal ? setEditingFood({...editingFood!, carbs: parseFloat(e.target.value)}) : setNewFood({...newFood, carbs: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1 text-center">LIP (g)</label>
                  <input
                    type="number"
                    value={showEditModal ? editingFood?.fat : newFood.fat}
                    onChange={(e) => showEditModal ? setEditingFood({...editingFood!, fat: parseFloat(e.target.value)}) : setNewFood({...newFood, fat: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-gray-900 font-medium text-center"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-8">
              <div className="flex gap-4">
                <button 
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); setEditingFood(null); }}
                  className="flex-1 py-4 bg-gray-50 text-gray-400 font-bold rounded-2xl hover:bg-gray-100 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={showEditModal ? () => handleUpdateFood(editingFood!) : handleAddCustomFood}
                  className="flex-1 py-4 bg-[#1a1c2e] text-white font-bold rounded-2xl shadow-lg shadow-gray-200 hover:bg-[#2a2d4a] transition-colors"
                >
                  {showEditModal ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>
              
              {showEditModal && editingFood?.userId === user?.id && editingFood && (
                 <button 
                   onClick={() => handleDeleteFood(editingFood.id)}
                  className="w-full py-4 bg-red-50 text-red-500 font-bold rounded-2xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Supprimer l'aliment
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
