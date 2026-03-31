type CachedDoc = {
  title: string
  content: string
  folder_id: string | null
  folder_name?: string | null
}

const cache = new Map<string, CachedDoc>()

export const docCache = {
  get: (id: string) => cache.get(id),
  set: (id: string, doc: CachedDoc) => cache.set(id, doc),
}
