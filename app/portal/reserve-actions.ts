'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth/session'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { requestReservation } from '@/lib/portal/auto-trading'
import { setAutoAllocation } from '@/lib/portal/budget'

/** 加盟者が預かり金の予算振り分け（自動売買用）を設定する（両フロー保有者のみ）。 */
export async function setBudgetAllocationAction(autoAllocatedYen: number): Promise<{ ok: boolean; error?: string }> {
  const session = await requireMember()
  try {
    const supabase = createServiceRoleClient()
    const { data: member } = await supabase.from('members').select('id').eq('user_id', session.userId).maybeSingle<{ id: string }>()
    if (!member) return { ok: false, error: '会員情報が紐付いていません' }
    await setAutoAllocation(member.id, autoAllocatedYen)
    revalidatePath('/portal/dashboard')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '振り分けの保存に失敗しました' }
  }
}

/** 加盟者が自動売買の受注待ちに登録する（全体上限で受注不可のとき）。 */
export async function requestReservationAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await requireMember()
  try {
    const supabase = createServiceRoleClient()
    const { data: member } = await supabase.from('members').select('id, grant_auto').eq('user_id', session.userId).maybeSingle<{ id: string; grant_auto: boolean }>()
    if (!member || !member.grant_auto) return { ok: false, error: '自動売買の権限がありません' }
    await requestReservation(member.id, '加盟者からの受注待ち申込')
    revalidatePath('/portal/dashboard')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '予約に失敗しました' }
  }
}
