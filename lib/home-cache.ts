type Doc = {
  id: string
  title: string
  updated_at: string
  folder_id: string | null
}

type FolderItem = {
  id: string
  name: string
  created_at: string
}

type HomeCache = {
  docs: Doc[]
  folders: FolderItem[]
}

let cache: HomeCache | null = null

export const homeCache = {
  get: () => cache,
  set: (data: HomeCache) => { cache = data },
}
