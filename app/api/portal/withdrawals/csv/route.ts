import { NextResponse, type NextRequest } from 'next/server'
import { apiRequireStaff } from '@/lib/auth/session'
import { listAllWithdrawals, buildWithdrawalCsv } from '@/lib/portal/withdrawal'
import type { WithdrawalStatus } from '@/types/database'

/**
 * 振込用CSVのダウンロード（本部のみ）。
 * 既定は「承認済み（振込待ち）」。?status= で絞り込み可。
 */
export async function GET(request: NextRequest) {
  const gate = await apiRequireStaff()
  if (!gate.ok) return gate.response

  const s = request.nextUrl.searchParams.get('status') as WithdrawalStatus | null
  const status: WithdrawalStatus = s && ['requested', 'approved', 'paid', 'rejected', 'cancelled'].includes(s) ? s : 'approved'
  const rows = await listAllWithdrawals(status)
  const csv = buildWithdrawalCsv(rows)
  const name = `withdrawals_${status}_${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
