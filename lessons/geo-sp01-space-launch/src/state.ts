/** 极轻量集中状态（发布订阅）：仅保存跨模块共享的最小信息 */
export interface Store {
  activeScreen: string
  moduleDone: Record<string, boolean>
}

export const store: Store = {
  activeScreen: 'm1',
  moduleDone: {}
}

type Listener = (s: Store) => void

const listeners = new Set<Listener>()

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit(): void {
  listeners.forEach((fn) => fn(store))
}

export function setActiveScreen(id: string): void {
  if (store.activeScreen === id) return
  store.activeScreen = id
  emit()
}

export function markDone(key: string, value = true): void {
  if (store.moduleDone[key] === value) return
  store.moduleDone[key] = value
  emit()
}

export function isDone(key: string): boolean {
  return !!store.moduleDone[key]
}
