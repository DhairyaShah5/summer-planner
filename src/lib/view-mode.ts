import { cookies } from 'next/headers'

export const VIEW_COOKIE = 'view_mode'
export const VIEW_TOKEN_PARAM = 'view'

export async function isViewMode(): Promise<boolean> {
  const store = await cookies()
  return store.get(VIEW_COOKIE)?.value === '1'
}

export function isValidViewToken(token: string | null | undefined): boolean {
  const expected = process.env.VIEW_TOKEN
  if (!expected || !token) return false
  return token === expected
}

export function getOwnerUserId(): string {
  const id = process.env.OWNER_USER_ID
  if (!id) {
    throw new Error(
      'OWNER_USER_ID is not configured — required for view mode.',
    )
  }
  return id
}

export function viewOnlyError() {
  return {
    ok: false as const,
    error: 'View-only mode — mutations are disabled.',
  }
}
