import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'nutrition-db';
const DB_VERSION = 2;

export interface OfflineFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSizeG: number;
  category: string;
  isCustom: boolean;
  userId?: string | null;
}

export interface OfflineMeal {
  id: string;
  userId: string;
  name: string;
  mealType: string;
  date: string;
  items: any[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  synced: boolean;
}

export interface OfflineFavorite {
  id: string;
  userId: string;
  name: string;
  mealType: string;
  items: any[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  synced: boolean;
}

export interface OfflineUser {
  id: string;
  email: string;
  name?: string;
  photoUrl?: string;
  targetCalories?: number;
  synced: boolean;
}

export interface SyncAction {
  id?: number;
  type: 'ADD_MEAL' | 'UPDATE_MEAL' | 'DELETE_MEAL' | 'ADD_FAVORITE' | 'DELETE_FAVORITE' | 'UPDATE_USER';
  data: any;
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Stockage des repas (10 derniers + journée actuelle)
      if (!db.objectStoreNames.contains('meals')) {
        db.createObjectStore('meals', { keyPath: 'id' });
      }
      
      // Stockage des plats favoris
      if (!db.objectStoreNames.contains('favorites')) {
        db.createObjectStore('favorites', { keyPath: 'id' });
      }
      
      // Stockage du profil utilisateur
      if (!db.objectStoreNames.contains('user')) {
        db.createObjectStore('user', { keyPath: 'id' });
      }
      
      // File d'attente de synchronisation
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }

      // Stockage des aliments
      if (!db.objectStoreNames.contains('foods')) {
        db.createObjectStore('foods', { keyPath: 'id' });
      }
    },
  });
}

export const getDB = () => dbPromise;

// Fonctions d'aide pour les repas
export async function saveOfflineMeal(meal: OfflineMeal) {
  const db = await getDB();
  if (!db) return;
  await db.put('meals', meal);
}

export async function getOfflineMeals() {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('meals');
}

export async function deleteOfflineMeal(id: string) {
  const db = await getDB();
  if (!db) return;
  await db.delete('meals', id);
}

// Fonctions d'aide pour les favoris
export async function saveOfflineFavorite(favorite: OfflineFavorite) {
  const db = await getDB();
  if (!db) return;
  await db.put('favorites', favorite);
}

export async function getOfflineFavorites() {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('favorites');
}

// Fonctions d'aide pour l'utilisateur
export async function saveOfflineUser(user: OfflineUser) {
  const db = await getDB();
  if (!db) return;
  await db.put('user', user);
}

export async function getOfflineUser(id: string) {
  const db = await getDB();
  if (!db) return null;
  return db.get('user', id);
}

// Fonctions pour la file de synchronisation
export async function addToSyncQueue(action: SyncAction) {
  const db = await getDB();
  if (!db) return;
  await db.add('syncQueue', action);
}

export async function getSyncQueue() {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('syncQueue');
}

export async function clearSyncQueue() {
  const db = await getDB();
  if (!db) return;
  await db.clear('syncQueue');
}

export async function removeFromSyncQueue(id: number) {
  const db = await getDB();
  if (!db) return;
  await db.delete('syncQueue', id);
}

// Fonctions d'aide pour les aliments
export async function saveOfflineFood(food: OfflineFood) {
  const db = await getDB();
  if (!db) return;
  await db.put('foods', food);
}

export async function getOfflineFoods() {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('foods');
}
