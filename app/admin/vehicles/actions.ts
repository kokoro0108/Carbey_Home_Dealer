'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireFeature } from '@/lib/auth/session'
import { createManualDeal, moveToPrepping, moveToListing, recordSale, settleAndDeliver, setDealDestination, DEFAULT_FROM_PREF } from '@/lib/portal/deals'
import { addDealCost, updateDealCost, deleteDealCost, uploadDealEvidence } from '@/lib/portal/deal-costs'
import { isPrefecture } from '@/lib/portal/prefectures'
import type { DealCostKind } from '@/types/database'

const COST_KINDS: DealCostKind[] = ['sourcing', 'prepping', 'shipping', 'other']
const ATTACH_MAX = 20 * 1024 * 1024

function num(v: FormDataEntryValue | null): number {
  return Number(String(v ?? '').replace(/[^\d]/g, ''))
}

function revalidateDeal(dealId: string) {
  revalidatePath(`/admin/vehicles/${dealId}`)
  revalidatePath('/admin/vehicles')
}

/** 本部が全自動フローの車両案件を起票する。 */
export async function createDealAction(formData: FormData) {
  await requireFeature('reports')
  const memberId = String(formData.get('member_id') ?? '')
  if (!memberId) return
  await createManualDeal({
    memberId,
    maker: String(formData.get('maker') ?? '').trim() || null,
    carModel: String(formData.get('car_model') ?? '').trim() || null,
    year: String(formData.get('year') ?? '').trim() || null,
    orderAmountYen: num(formData.get('order_amount')) || null,
  })
  revalidatePath('/admin/vehicles')
}

/** 商品化中へ。 */
export async function dealToPreppingAction(formData: FormData) {
  const session = await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return
  await moveToPrepping(dealId, session.userId, true)
  revalidatePath('/admin/vehicles')
}

/** 販売中へ（全自動）。 */
export async function dealToListingAction(formData: FormData) {
  const session = await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return
  await moveToListing(dealId, session.userId, true)
  revalidatePath('/admin/vehicles')
}

/** 販売実績を記録して売却済みに（本部）。 */
export async function recordSaleAction(formData: FormData) {
  const session = await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  const salePriceYen = num(formData.get('sale_price'))
  const soldAt = String(formData.get('sold_at') ?? '').trim() || null
  if (!dealId || !salePriceYen) return
  await recordSale(dealId, { salePriceYen, soldAt }, session.userId, true)
  revalidatePath('/admin/vehicles')
  revalidatePath('/admin/sales')
}

// ===== 費用（諸費用・代行手数料）の管理：本部が仕入れ中/商品化中に追加（クライアント要望 2026-07-19）=====

/** 本部が費目（諸費用・代行手数料等）を追加する。自由な名称＋分類＋金額＋任意でエビデンス。 */
export async function addDealCostAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  const kindRaw = String(formData.get('kind') ?? 'other')
  const kind = (COST_KINDS.includes(kindRaw as DealCostKind) ? kindRaw : 'other') as DealCostKind
  const label = String(formData.get('label') ?? '').trim()
  const amount = num(formData.get('amount'))
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
    revalidateDeal(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '追加に失敗しました' }
  }
}

/** 費目を更新（名称・分類・金額）。 */
export async function updateDealCostAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireFeature('reports')
  const id = String(formData.get('id') ?? '')
  const dealId = String(formData.get('deal_id') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const amount = num(formData.get('amount'))
  const kindRaw = String(formData.get('kind') ?? '')
  const kind = COST_KINDS.includes(kindRaw as DealCostKind) ? (kindRaw as DealCostKind) : undefined
  if (!id || !label) return { ok: false, error: '費目名を入力してください' }
  try {
    await updateDealCost(id, { label, amount, kind })
    revalidateDeal(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '更新に失敗しました' }
  }
}

/** 費目を削除。 */
export async function deleteDealCostAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireFeature('reports')
  const id = String(formData.get('id') ?? '')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!id) return { ok: false, error: '対象がありません' }
  try {
    await deleteDealCost(id)
    revalidateDeal(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '削除に失敗しました' }
  }
}

/** 陸送先（着地県）を設定（フォーム直用・void）。 */
export async function setDestinationAction(formData: FormData): Promise<void> {
  const session = await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  const toPref = String(formData.get('to_pref') ?? '')
  if (!dealId || !isPrefecture(toPref)) return
  await setDealDestination(dealId, toPref, session.userId, true)
  revalidateDeal(dealId)
}

/**
 * 費用を確定して精算する（本部・半自動／フォーム直用・void）。
 * 諸費用（代行手数料含む）の合計を預かり金から差し引き、残金を反映する（自動計算・自動反映）。
 * 陸送費が未登録でも着地県から自動計算できる場合は費目化される（settleAndDeliver）。
 * エラーは詳細ページへ ?error= で戻して表示する。
 */
export async function settleDealAction(formData: FormData): Promise<void> {
  const session = await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return
  try {
    await settleAndDeliver(dealId, session.userId, true, DEFAULT_FROM_PREF)
  } catch (e) {
    if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e
    const msg = e instanceof Error ? e.message : '精算に失敗しました'
    redirect(`/admin/vehicles/${dealId}?error=${encodeURIComponent(msg)}`)
  }
  revalidateDeal(dealId)
  redirect(`/admin/vehicles/${dealId}?settled=1`)
}
