'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth/session'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { requestWithdrawal, cancelWithdrawal } from '@/lib/portal/withdrawal'

async function ownMemberId(userId: string): Promise<string | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  return data?.id ?? null
}

/** 加盟店が出金を申請する。 */
export async function requestWithdrawalAction(amountYen: number): Promise<{ ok: boolean; error?: string }> {
  const session = await requireMember()
  try {
    const memberId = await ownMemberId(session.userId)
    if (!memberId) return { ok: false, error: '会員情報が紐付いていません' }
    await requestWithdrawal(memberId, amountYen)
    revalidatePath('/portal/withdrawal')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '申請に失敗しました' }
  }
}

/** 加盟店が申請を取り消す（承認前のみ）。 */
export async function cancelWithdrawalAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireMember()
  try {
    const memberId = await ownMemberId(session.userId)
    if (!memberId) return { ok: false, error: '会員情報が紐付いていません' }
    await cancelWithdrawal(id, memberId)
    revalidatePath('/portal/withdrawal')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '取消に失敗しました' }
  }
}
