import { 
  saveOfflineMeal, 
  saveOfflineFavorite, 
  addToSyncQueue, 
  getSyncQueue, 
  removeFromSyncQueue,
  getDB,
  type OfflineMeal,
  type OfflineFavorite
} from './offlineDb';
import { 
  saveMeal, 
  addFavoriteMeal, 
  deleteFavoriteMeal,
  deleteMeal,
  updateUserCalories
} from '@/app/actions/nutrition';
import { setIsland, showIsland } from './uiStore';

export async function addMealWithSync(meal: OfflineMeal) {
  // 1. Sauvegarder localement immédiatement
  await saveOfflineMeal({ ...meal, synced: false });
  
  // 2. Tenter la sauvegarde sur le serveur si en ligne
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const userId = meal.id.split('_')[0];
      await saveMeal(userId, {
        mealType: meal.mealType,
        date: meal.date,
        foods: meal.items,
        totalCalories: meal.totalCalories,
        totalProtein: meal.totalProtein,
        totalCarbs: meal.totalCarbs,
        totalFat: meal.totalFat
      });
      // Marquer comme synchronisé si succès
      await saveOfflineMeal({ ...meal, synced: true });
    } catch (error) {
      console.error('Erreur de synchro immédiate, ajouté à la file:', error);
      await addToSyncQueue({
        type: 'ADD_MEAL',
        data: {
          userId: meal.id.split('_')[0],
          localId: meal.id,
          mealData: {
            mealType: meal.mealType,
            date: meal.date,
            foods: meal.items,
            totalCalories: meal.totalCalories,
            totalProtein: meal.totalProtein,
            totalCarbs: meal.totalCarbs,
            totalFat: meal.totalFat
          }
        },
        timestamp: Date.now()
      });
    }
  } else {
    // Hors ligne, ajouter à la file
    await addToSyncQueue({
      type: 'ADD_MEAL',
      data: {
        userId: meal.id.split('_')[0],
        localId: meal.id,
        mealData: {
          mealType: meal.mealType,
          date: meal.date,
          foods: meal.items,
          totalCalories: meal.totalCalories,
          totalProtein: meal.totalProtein,
          totalCarbs: meal.totalCarbs,
          totalFat: meal.totalFat
        }
      },
      timestamp: Date.now()
    });
  }
}

export async function addFavoriteWithSync(favorite: OfflineFavorite, userId: string) {
  await saveOfflineFavorite({ ...favorite, synced: false });
  
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await addFavoriteMeal(userId, {
        name: favorite.name,
        mealType: favorite.mealType,
        foods: favorite.items,
        totalCalories: favorite.totalCalories,
        totalProtein: favorite.totalProtein,
        totalCarbs: favorite.totalCarbs,
        totalFat: favorite.totalFat
      });
      await saveOfflineFavorite({ ...favorite, synced: true });
    } catch (error) {
      await addToSyncQueue({
        type: 'ADD_FAVORITE',
        data: { 
          userId, 
          localId: favorite.id,
          favoriteData: {
            name: favorite.name,
            mealType: favorite.mealType,
            foods: favorite.items,
            totalCalories: favorite.totalCalories,
            totalProtein: favorite.totalProtein,
            totalCarbs: favorite.totalCarbs,
            totalFat: favorite.totalFat
          }
        },
        timestamp: Date.now()
      });
    }
  } else {
    await addToSyncQueue({
      type: 'ADD_FAVORITE',
      data: { 
        userId, 
        localId: favorite.id,
        favoriteData: {
          name: favorite.name,
          mealType: favorite.mealType,
          foods: favorite.items,
          totalCalories: favorite.totalCalories,
          totalProtein: favorite.totalProtein,
          totalCarbs: favorite.totalCarbs,
          totalFat: favorite.totalFat
        }
      },
      timestamp: Date.now()
    });
  }
}

export async function deleteFavoriteWithSync(favoriteId: string, userId: string) {
  // 1. Supprimer localement
  const db = await getDB();
  if (db) {
    await db.delete('favorites', favoriteId);
  }
  
  // 2. Tenter la suppression sur le serveur si en ligne
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await deleteFavoriteMeal(favoriteId);
    } catch (error) {
      await addToSyncQueue({
        type: 'DELETE_FAVORITE',
        data: { favoriteId, userId },
        timestamp: Date.now()
      });
    }
  } else {
    await addToSyncQueue({
      type: 'DELETE_FAVORITE',
      data: { favoriteId, userId },
      timestamp: Date.now()
    });
  }
}

export async function deleteMealWithSync(mealId: string, userId: string) {
  // 1. Supprimer localement
  const db = await getDB();
  if (db) {
    await db.delete('meals', mealId);
  }
  
  // 2. Tenter la suppression sur le serveur si en ligne
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await deleteMeal(mealId);
    } catch (error) {
      await addToSyncQueue({
        type: 'DELETE_MEAL',
        data: { mealId, userId },
        timestamp: Date.now()
      });
    }
  } else {
    await addToSyncQueue({
      type: 'DELETE_MEAL',
      data: { mealId, userId },
      timestamp: Date.now()
    });
  }
}

let isSyncing = false;

export async function syncOfflineData() {
  if (isSyncing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  
  const queue = await getSyncQueue();
  if (queue.length === 0) return;
  
  isSyncing = true;
  setIsland({ status: 'syncing', message: `Synchronisation...`, visible: true });
  console.log(`Tentative de synchronisation de ${queue.length} actions...`);
  
  let successCount = 0;
  let errorCount = 0;
  for (const action of queue) {
    try {
      // ... existing switch case logic ...
      switch (action.type) {
        case 'ADD_MEAL':
          await saveMeal(action.data.userId, action.data.mealData);
          break;
        case 'DELETE_MEAL':
          await deleteMeal(action.data.mealId);
          break;
        case 'ADD_FAVORITE':
          await addFavoriteMeal(action.data.userId, action.data.favoriteData);
          break;
        case 'UPDATE_USER':
          await updateUserCalories(action.data.userId, action.data.calories);
          break;
        case 'DELETE_FAVORITE':
          await deleteFavoriteMeal(action.data.favoriteId);
          break;
      }
      
      if (action.id !== undefined) {
        await removeFromSyncQueue(action.id);
        successCount++;
      }
    } catch (error) {
      console.error('Erreur lors de la synchro d\'une action:', error);
      errorCount++;
      if (!navigator.onLine) break;
    }
  }
  
  isSyncing = false;
  if (successCount > 0) {
    const message = errorCount > 0 
      ? `${successCount} synchronisés, ${errorCount} erreurs`
      : `${successCount} action(s) synchronisée(s)`;
    showIsland(message, errorCount > 0 ? 'error' : 'success', 3000);
  } else if (errorCount > 0) {
    showIsland(`Échec de la synchronisation (${errorCount})`, 'error', 3000);
  } else {
    setIsland({ visible: false });
  }
  console.log(`Synchronisation terminée. ${successCount}/${queue.length} actions réussies.`);
  
  // Notifier l'UI que les données ont changé
  if (successCount > 0) {
    window.dispatchEvent(new Event('nutruition:sync-complete'));
  }
}
