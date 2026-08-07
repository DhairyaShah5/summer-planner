import { NextResponse } from 'next/server'
import { getGoalStatus } from '@/lib/goal-status'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await getGoalStatus()
  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'no-store, must-revalidate',
    },
  })
}
