type UserCache = {
  avatarUrl?: string
  name?: string
}

let cache: UserCache | null = null

export const userCache = {
  get: () => cache,
  set: (data: UserCache) => { cache = data },
}
