'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth/session'
import { moveToPrepping, markDelivered } from '@/lib/portal/deals'

/** 加盟店：案件を商品化中へ移行（整備・修理が発生した場合）。 */
export async function moveToPreppingAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await requireMember()
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return { ok: false, error: '案件IDがありません' }
  try {
    await moveToPrepping(dealId, session.userId, false)
    revalidatePath('/portal/orders')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '移行に失敗しました' }
  }
}

/** 加盟店：受領（受け取り完了）→ 取引終了。 */
export async function markDeliveredAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await requireMember()
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return { ok: false, error: '案件IDがありません' }
  try {
    await markDelivered(dealId, session.userId, false)
    revalidatePath('/portal/orders')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '受領処理に失敗しました' }
  }
}
