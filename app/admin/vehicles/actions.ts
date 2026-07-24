'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireFeature } from '@/lib/auth/session'
import { createManualDeal, moveToPrepping, moveToListing, recordSale, settleAndDeliver, cancelSettlement, setDealDestination, setPrepChecklist, DEFAULT_FROM_PREF } from '@/lib/portal/deals'
import { addDealCost, updateDealCost, deleteDealCost, uploadDealEvidence, setDealSourcingEvidence, clearDealSourcingEvidence, setDealResultReport, clearDealResultReport } from '@/lib/portal/deal-costs'
import { isPrefecture } from '@/lib/portal/prefectures'
import type { DealCostKind } from '@/types/database'

const COST_KINDS: DealCostKind[] = ['sourcing', 'prepping', 'shipping', 'other']
const ATTACH_MAX = 20 * 1024 * 1024
const EVIDENCE_TYPES = /^(image\/|application\/pdf)/

function num(v: FormDataEntryValue | null): number {
  return Number(String(v ?? '').replace(/[^\d]/g, ''))
}

function revalidateDeal(dealId: string) {
  revalidatePath(`/admin/vehicles/${dealId}`)
  revalidatePath('/admin/vehicles')
}

/** 本部が全自動フローの車両案件を起票する。受注可否（枠・キャパ・運用資金）を判定してブロック。 */
export async function createDealAction(formData: FormData) {
  await requireFeature('reports')
  const memberId = String(formData.get('member_id') ?? '')
  if (!memberId) return
  try {
    await createManualDeal({
      memberId,
      maker: String(formData.get('maker') ?? '').trim() || null,
      carModel: String(formData.get('car_model') ?? '').trim() || null,
      year: String(formData.get('year') ?? '').trim() || null,
      orderAmountYen: num(formData.get('order_amount')) || null,
    })
  } catch (e) {
    if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e
    const msg = e instanceof Error ? e.message : '起票に失敗しました'
    redirect(`/admin/vehicles?error=${encodeURIComponent(msg)}`)
  }
  revalidatePath('/admin/vehicles')
  redirect('/admin/vehicles?created=1')
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

/** 販売中の仕入れエビデンスを添付/差し替え（本部のみ・1案件1ファイル・画像/PDF）。 */
export async function uploadDealSourcingEvidenceAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return { ok: false, error: '対象がありません' }
  const file = formData.get('evidence')
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'ファイルを選択してください' }
  if (file.size > ATTACH_MAX) return { ok: false, error: 'ファイルは20MBまでです' }
  if (!EVIDENCE_TYPES.test(file.type)) return { ok: false, error: '画像またはPDFを添付してください' }
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await setDealSourcingEvidence(dealId, { buffer, name: file.name, type: file.type || 'application/octet-stream' })
    revalidateDeal(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '添付に失敗しました' }
  }
}

/** 仕入れエビデンスを削除（本部のみ）。 */
export async function removeDealSourcingEvidenceAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return { ok: false, error: '対象がありません' }
  try {
    await clearDealSourcingEvidence(dealId)
    revalidateDeal(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '削除に失敗しました' }
  }
}

/** 結果報告書を添付/差し替え（本部・D&D・画像/PDF）。 */
export async function uploadDealResultReportAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return { ok: false, error: '対象がありません' }
  const file = formData.get('report')
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'ファイルを選択してください' }
  if (file.size > ATTACH_MAX) return { ok: false, error: 'ファイルは20MBまでです' }
  if (!EVIDENCE_TYPES.test(file.type)) return { ok: false, error: '画像またはPDFを添付してください' }
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await setDealResultReport(dealId, { buffer, name: file.name, type: file.type || 'application/octet-stream' })
    revalidateDeal(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '添付に失敗しました' }
  }
}

/** 結果報告書を削除（本部）。 */
export async function removeDealResultReportAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return { ok: false, error: '対象がありません' }
  try {
    await clearDealResultReport(dealId)
    revalidateDeal(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '削除に失敗しました' }
  }
}

/** 商品化チェックリストの1項目を切り替える（本部）。 */
export async function togglePrepChecklistAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  const key = String(formData.get('key') ?? '')
  const value = String(formData.get('value') ?? '') === 'true'
  const map: Record<string, 'inspected' | 'cleaned' | 'photographed' | 'listedReady'> = {
    inspected: 'inspected', cleaned: 'cleaned', photographed: 'photographed', listedReady: 'listedReady',
  }
  if (!dealId || !map[key]) return { ok: false, error: '対象がありません' }
  try {
    await setPrepChecklist(dealId, { [map[key]]: value })
    revalidateDeal(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '更新に失敗しました' }
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

/**
 * 精算を取り消して訂正できる状態に戻す（本部・レビュー①）。
 * 預かり金を精算前に戻し、費目を再編集できるようにする。
 */
export async function cancelSettlementAction(formData: FormData): Promise<void> {
  const session = await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return
  try {
    await cancelSettlement(dealId, session.userId, true)
  } catch (e) {
    if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e
    const msg = e instanceof Error ? e.message : '取消に失敗しました'
    redirect(`/admin/vehicles/${dealId}?error=${encodeURIComponent(msg)}`)
  }
  revalidateDeal(dealId)
  redirect(`/admin/vehicles/${dealId}?cancelled=1`)
}
