import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { DealCostRow, DealCostKind } from '@/types/database'

/**
 * 案件の費用内訳（動的費目・半自動売買フェーズ4）。
 * kind(分類) + label(名称・変更可) + amount + エビデンス。
 * 残金 = 預かり金 − Σ(amount)（精算はフェーズ6）。
 */

const BUCKET = 'deal-evidences'

export const COST_KIND_LABEL: Record<DealCostKind, string> = {
  sourcing: '仕入',
  prepping: '商品化',
  shipping: '陸送',
  other: 'その他',
}

/** 案件の費目一覧（並び順）。 */
export async function listDealCosts(dealId: string): Promise<DealCostRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('deal_costs')
    .select('*')
    .eq('deal_id', dealId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as DealCostRow[]
}

/** 案件の費用合計。 */
export async function getDealCostTotal(dealId: string): Promise<number> {
  const costs = await listDealCosts(dealId)
  return costs.reduce((s, c) => s + (c.amount_yen ?? 0), 0)
}

/** エビデンス（計算書等）をアップロードして path を返す。 */
export async function uploadDealEvidence(dealId: string, file: { buffer: Buffer; name: string; type: string }): Promise<string> {
  const supabase = createServiceRoleClient()
  const safe = file.name.replace(/[^\w.\-]/g, '_')
  const path = `${dealId}/${Date.now()}_${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file.buffer, { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)
  return path
}

/** 費目を追加。member_id は deal から解決。 */
export async function addDealCost(input: {
  dealId: string
  kind: DealCostKind
  label: string
  amount: number
  note?: string | null
  attachmentPath?: string | null
  attachmentName?: string | null
}): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data: deal } = await supabase.from('vehicle_deals').select('member_id').eq('id', input.dealId).maybeSingle<{ member_id: string }>()
  if (!deal) throw new Error('案件が見つかりません')
  const { data: last } = await supabase.from('deal_costs').select('sort_order').eq('deal_id', input.dealId).order('sort_order', { ascending: false }).limit(1).maybeSingle<{ sort_order: number }>()
  const sort = (last?.sort_order ?? 0) + 10
  const { error } = await supabase.from('deal_costs').insert({
    deal_id: input.dealId,
    member_id: deal.member_id,
    kind: input.kind,
    label: input.label,
    amount_yen: Math.round(input.amount),
    sort_order: sort,
    note: input.note ?? null,
    attachment_path: input.attachmentPath ?? null,
    attachment_name: input.attachmentName ?? null,
  } as never)
  if (error) throw new Error(error.message)
}

/** 費目を更新（名称・金額・メモ）。 */
export async function updateDealCost(id: string, patch: { label?: string; amount?: number; note?: string | null; kind?: DealCostKind }): Promise<void> {
  const supabase = createServiceRoleClient()
  const update: Record<string, unknown> = {}
  if (patch.label !== undefined) update.label = patch.label
  if (patch.amount !== undefined) update.amount_yen = Math.round(patch.amount)
  if (patch.note !== undefined) update.note = patch.note
  if (patch.kind !== undefined) update.kind = patch.kind
  const { error } = await supabase.from('deal_costs').update(update as never).eq('id', id)
  if (error) throw new Error(error.message)
}

/** 費目を削除。 */
export async function deleteDealCost(id: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data: row } = await supabase.from('deal_costs').select('attachment_path').eq('id', id).maybeSingle<{ attachment_path: string | null }>()
  if (row?.attachment_path) await supabase.storage.from(BUCKET).remove([row.attachment_path])
  const { error } = await supabase.from('deal_costs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * エビデンスを閲覧者の権限で取得（プロキシ用）。
 * 本部は全件、加盟店は自分の案件のみ。署名URLは露出しない。
 */
export async function getDealEvidenceForViewer(
  id: string,
  viewer: { userId: string; isStaff: boolean },
): Promise<{ data: Blob; name: string; type: string } | null> {
  const supabase = createServiceRoleClient()
  const { data: row } = await supabase
    .from('deal_costs')
    .select('member_id, attachment_path, attachment_name')
    .eq('id', id)
    .maybeSingle<{ member_id: string; attachment_path: string | null; attachment_name: string | null }>()
  if (!row?.attachment_path) return null

  if (!viewer.isStaff) {
    const { data: member } = await supabase.from('members').select('id').eq('user_id', viewer.userId).maybeSingle<{ id: string }>()
    if (!member || member.id !== row.member_id) return null
  }

  const { data: blob, error } = await supabase.storage.from(BUCKET).download(row.attachment_path)
  if (error || !blob) return null
  return { data: blob, name: row.attachment_name ?? 'evidence', type: blob.type || 'application/octet-stream' }
}
