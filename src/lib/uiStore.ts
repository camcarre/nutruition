'use client'

export type IslandStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline' | 'online'

export interface IslandState {
  status: IslandStatus
  message: string
  visible: boolean
  duration?: number
}

let islandState: IslandState = {
  status: 'idle',
  message: '',
  visible: false
}

const listeners = new Set<() => void>()

export const subscribeIsland = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getIslandSnapshot = () => islandState

export const setIsland = (state: Partial<IslandState>) => {
  islandState = { ...islandState, ...state }
  listeners.forEach(l => l())

  if (state.visible && state.duration) {
    setTimeout(() => {
      islandState = { ...islandState, visible: false }
      listeners.forEach(l => l())
    }, state.duration)
  }
}

export const showIsland = (message: string, status: IslandStatus = 'success', duration: number = 3000) => {
  setIsland({
    message,
    status,
    visible: true,
    duration
  })
}
