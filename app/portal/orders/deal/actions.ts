'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth/session'
import { addDealCost, updateDealCost, deleteDealCost, uploadDealEvidence } from '@/lib/portal/deal-costs'
import { moveToPrepping, markDelivered, setDealDestination } from '@/lib/portal/deals'
import { isPrefecture } from '@/lib/portal/prefectures'
import type { DealCostKind } from '@/types/database'

const KINDS: DealCostKind[] = ['sourcing', 'prepping', 'shipping', 'other']
const ATTACH_MAX = 20 * 1024 * 1024

/** 費目を追加（名称・分類・金額・任意でエビデンス添付）。 */
export async function addDealCostAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireMember()
  const dealId = String(formData.get('deal_id') ?? '')
  const kindRaw = String(formData.get('kind') ?? 'other')
  const kind = (KINDS.includes(kindRaw as DealCostKind) ? kindRaw : 'other') as DealCostKind
  const label = String(formData.get('label') ?? '').trim()
  const amount = Number(String(formData.get('amount') ?? '').replace(/[^\d]/g, ''))
  const note = String(formData.get('note') ?? '').trim() || null
  if (!dealId || !label) return { ok: false, error: '費目名を入力してください' }
  if (!amount || amount < 0) return { ok: false, error: '金額を入力してください' }

  try {
    let attachmentPath: string | null = null
    let attachmentName: string | null = null
    const file = formData.get('attachment')
    if (file instanceof File && file.size > 0) {
      if (file.size > ATTACH_MAX) return { ok: false, error: 'ファイルは20MBまでです' }
      const buffer = Buffer.from(await file.arrayBuffer())
      attachmentPath = await uploadDealEvidence(dealId, { buffer, name: file.name, type: file.type || 'application/octet-stream' })
      attachmentName = file.name
    }
    await addDealCost({ dealId, kind, label, amount, note, attachmentPath, attachmentName })
    revalidatePath(`/portal/orders/deal/${dealId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '追加に失敗しました' }
  }
}

/** 費目を更新（名称・金額）。 */
export async function updateDealCostAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireMember()
  const id = String(formData.get('id') ?? '')
  const dealId = String(formData.get('deal_id') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const amount = Number(String(formData.get('amount') ?? '').replace(/[^\d]/g, ''))
  if (!id || !label) return { ok: false, error: '費目名を入力してください' }
  try {
    await updateDealCost(id, { label, amount })
    revalidatePath(`/portal/orders/deal/${dealId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '更新に失敗しました' }
  }
}

/** 費目を削除。 */
export async function deleteDealCostAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireMember()
  const id = String(formData.get('id') ?? '')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!id) return { ok: false, error: '対象がありません' }
  try {
    await deleteDealCost(id)
    revalidatePath(`/portal/orders/deal/${dealId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '削除に失敗しました' }
  }
}

/** 商品化中へ移行（案件詳細から）。 */
export async function dealToPreppingAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await requireMember()
  const dealId = String(formData.get('deal_id') ?? '')
  try {
    await moveToPrepping(dealId, session.userId, false)
    revalidatePath(`/portal/orders/deal/${dealId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '移行に失敗しました' }
  }
}

/** 陸送先（着地県）を設定（フォーム直用・void）。 */
export async function setDestinationAction(formData: FormData): Promise<void> {
  const session = await requireMember()
  const dealId = String(formData.get('deal_id') ?? '')
  const toPref = String(formData.get('to_pref') ?? '')
  if (!dealId || !isPrefecture(toPref)) return
  await setDealDestination(dealId, toPref, session.userId, false)
  revalidatePath(`/portal/orders/deal/${dealId}`)
}

/** 受領（受け取り完了）→ 自動精算 → 取引終了。 */
export async function dealDeliveredAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await requireMember()
  const dealId = String(formData.get('deal_id') ?? '')
  try {
    await markDelivered(dealId, session.userId, false)
    revalidatePath(`/portal/orders/deal/${dealId}`)
    revalidatePath('/portal/orders')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '受領処理に失敗しました' }
  }
}
