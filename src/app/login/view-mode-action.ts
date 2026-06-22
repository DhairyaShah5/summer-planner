'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const VIEW_COOKIE = 'view_mode'
const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Enable read-only view mode for this browser session by setting the
 * view_mode cookie. The cookie is the same one the /?view=<token> URL
 * sets via the proxy — this server action is just a public entry point
 * for the "View only" button on /login.
 */
export async function enterViewMode() {
  const store = await cookies()
  store.set(VIEW_COOKIE, '1', {
    maxAge: VIEW_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
  })
  redirect('/')
}

/**
 * Clear the view_mode cookie. Useful if the owner is on the same browser
 * and wants to sign in normally after browsing as a viewer.
 */
export async function exitViewMode() {
  const store = await cookies()
  store.delete(VIEW_COOKIE)
  redirect('/login')
}
