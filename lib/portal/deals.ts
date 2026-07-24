import { createServiceRoleClient } from '@/lib/supabase/admin'
import { listDealCosts, addDealCost } from '@/lib/portal/deal-costs'
import { getLedgerBalance, addLedgerEntry } from '@/lib/portal/ledger'
import { quoteShipping } from '@/lib/portal/shipping'
import { getMemberAutoCapacity } from '@/lib/portal/auto-trading'
import type { VehicleDealRow, DealStatusStage, OrderRow } from '@/types/database'

/**
 * 車両案件ライフサイクル（半自動売買フェーズ3）。
 * ordered → sourcing(仕入れ中) → prepping(商品化中・任意) → delivered(納品完了)
 * オーダー送信で案件を生成し sourcing に自動遷移。受領で delivered。
 */

export const DEAL_STAGES: { key: DealStatusStage; label: string }[] = [
  { key: 'sourcing', label: '仕入れ中' },
  { key: 'prepping', label: '商品化中' },
  { key: 'delivered', label: '納品完了' },
]

export const DEAL_STAGE_LABEL: Record<DealStatusStage, string> = {
  ordered: '車両オーダー',
  sourcing: '仕入れ中',
  prepping: '商品化中',
  listing: '販売中',
  delivered: '納品完了',
  sold: '売却済み',
}

/**
 * 満了月数を数える（フェーズ6・月額管理手数料）。
 * 開始日基準で満了した月数のみ（切下げ・端数月は0・最短0）。
 * 例：3/15開始 → 4/14=0, 5/14=1, 5/15=2。
 * 月末調整：終了日がその月の末日なら、開始日が末日より大きくても満了とみなす（1/31→2/28=1）。
 */
export function completedMonths(startISO: string, endISO: string): number {
  const s = new Date(startISO)
  const e = new Date(endISO)
  if (!(e > s)) return 0
  let months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth())
  if (e.getUTCDate() < s.getUTCDate()) {
    const lastDayOfEndMonth = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + 1, 0)).getUTCDate()
    if (e.getUTCDate() !== lastDayOfEndMonth) months -= 1
  }
  return Math.max(0, months)
}

/** オーダーから案件を生成し「仕入れ中」に自動遷移（オーダー送信直後に呼ぶ）。 */
export async function createDealFromOrder(order: OrderRow): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('vehicle_deals').insert({
    member_id: order.member_id,
    order_id: order.id,
    flow: 'semi', // 加盟店オーダー由来＝半自動
    status: 'sourcing', // オーダー送信で仕入れ中に自動遷移
    maker: order.maker,
    car_model: order.car_model,
    year: order.year,
    order_amount_yen: order.budget_yen,
    sourcing_at: new Date().toISOString(),
  } as never)
  if (error) throw new Error(error.message)
}

/**
 * オーダーID → 案件（進捗）の対応表。本部オーダー管理で各オーダーの進捗を可視化するのに使う。
 * 1オーダー＝1案件の想定だが、万一複数あれば最新（created_at 降順の先頭）を採用する。
 */
export async function mapDealsByOrderId(orderIds: string[]): Promise<Map<string, VehicleDealRow>> {
  const map = new Map<string, VehicleDealRow>()
  if (orderIds.length === 0) return map
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vehicle_deals')
    .select('*')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  for (const d of (data ?? []) as unknown as VehicleDealRow[]) {
    if (d.order_id && !map.has(d.order_id)) map.set(d.order_id, d)
  }
  return map
}

export type DealWithMember = VehicleDealRow & {
  member: { id: string; member_name: string; company_name: string | null } | null
}

/** 本部：全加盟店の案件を加盟店名つきで取得（車両進捗カンバン用）。memberId で絞り込み可。 */
export async function listAllDeals(memberId?: string): Promise<DealWithMember[]> {
  const supabase = createServiceRoleClient()
  let q = supabase
    .from('vehicle_deals')
    .select('*, member:members(id, member_name, company_name)')
    .order('created_at', { ascending: false })
  if (memberId) q = q.eq('member_id', memberId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as DealWithMember[]
}

/**
 * 本部が車両案件を起票する（全自動フロー：加盟店はオーダーしないため本部が作成）。
 * 仕入れ中(sourcing)から開始する。
 */
export async function createManualDeal(input: {
  memberId: string
  maker?: string | null
  carModel?: string | null
  year?: string | null
  orderAmountYen?: number | null
  /** 受注可否チェックを行うか（既定 true）。フェーズ2：枠・キャパ・運用資金の判定。 */
  enforceCapacity?: boolean
}): Promise<VehicleDealRow> {
  // ⑦ フェーズ2：受注可否（空き枠・全体キャパ・預かり金）を判定してブロック
  if (input.enforceCapacity !== false) {
    const cap = await getMemberAutoCapacity(input.memberId)
    if (!cap.canAccept) throw new Error(cap.blockReason ?? '現在この加盟者の自動売買は受注できません。')
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vehicle_deals')
    .insert({
      member_id: input.memberId,
      flow: 'auto', // 本部起票＝自動売買
      status: 'sourcing',
      maker: input.maker ?? null,
      car_model: input.carModel ?? null,
      year: input.year ?? null,
      order_amount_yen: input.orderAmountYen ?? null,
      sourcing_at: new Date().toISOString(),
    } as never)
    .select('*')
    .single<VehicleDealRow>()
  if (error) throw new Error(error.message)
  return data
}

/** 加盟店の案件をステージ別に集計（会員個別画面の車両サマリ・全ステージ）。 */
export type MemberDealSummary = {
  sourcing: number; prepping: number; listing: number; delivered: number; sold: number; total: number
}
export async function getMemberDealSummary(memberId: string): Promise<MemberDealSummary> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('vehicle_deals').select('status').eq('member_id', memberId)
  const rows = (data ?? []) as { status: DealStatusStage }[]
  const s: MemberDealSummary = { sourcing: 0, prepping: 0, listing: 0, delivered: 0, sold: 0, total: rows.length }
  for (const r of rows) if (r.status !== 'ordered') s[r.status]++
  return s
}

/** 本部用：全加盟店の案件をステージ別に集計（オーダー管理の一元管理ヘッダー）。 */
export async function getAdminDealSummary(): Promise<DealBoardSummary> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('vehicle_deals').select('status')
  const rows = (data ?? []) as { status: DealStatusStage }[]
  const s = { sourcing: 0, prepping: 0, delivered: 0, active: 0 }
  for (const r of rows) {
    if (r.status === 'sourcing') s.sourcing++
    else if (r.status === 'prepping') s.prepping++
    else if (r.status === 'delivered') s.delivered++
  }
  s.active = s.sourcing + s.prepping
  return s
}

/**
 * 加盟店の「進行中」案件を新しい順に取得。
 * 売却済み(sold)＝完了は除外。納品完了(delivered)は「販売実績の登録待ち」として進行中に含む。
 */
export async function listActiveDeals(memberId: string): Promise<VehicleDealRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vehicle_deals')
    .select('*')
    .eq('member_id', memberId)
    .neq('status', 'sold')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as VehicleDealRow[]
}

/** 商品化チェックリスト（点検・清掃・撮影・掲載準備）を更新する（本部・CAR-05）。 */
export async function setPrepChecklist(
  dealId: string,
  patch: { inspected?: boolean; cleaned?: boolean; photographed?: boolean; listedReady?: boolean },
): Promise<void> {
  const supabase = createServiceRoleClient()
  const update: Record<string, boolean> = {}
  if (patch.inspected !== undefined) update.prep_inspected = patch.inspected
  if (patch.cleaned !== undefined) update.prep_cleaned = patch.cleaned
  if (patch.photographed !== undefined) update.prep_photographed = patch.photographed
  if (patch.listedReady !== undefined) update.prep_listed_ready = patch.listedReady
  if (Object.keys(update).length === 0) return
  const { error } = await supabase.from('vehicle_deals').update(update as never).eq('id', dealId)
  if (error) throw new Error(error.message)
}

/** フェーズ8：加盟者の全自動（flow='auto'）案件を新しい順に取得（進捗フロー表示用）。 */
export async function listMemberAutoDeals(memberId: string): Promise<VehicleDealRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vehicle_deals')
    .select('*')
    .eq('member_id', memberId)
    .eq('flow', 'auto')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as VehicleDealRow[]
}

/** ユーザーIDから自分の全自動案件を取得。会員未紐付けは空配列。 */
export async function listOwnAutoDeals(userId: string): Promise<VehicleDealRow[]> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  if (!member) return []
  return listMemberAutoDeals(member.id)
}

export type DealBoardSummary = {
  sourcing: number   // 仕入れ中
  prepping: number   // 商品化中
  delivered: number  // 納品完了（累計）
  active: number     // 進行中合計（sourcing+prepping）
}

/** 加盟店の案件をステージ別に集計（ダッシュボード進捗ボード用・フェーズ7）。 */
export async function getDealBoardSummary(userId: string): Promise<DealBoardSummary> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  if (!member) return { sourcing: 0, prepping: 0, delivered: 0, active: 0 }
  const { data } = await supabase.from('vehicle_deals').select('status').eq('member_id', member.id)
  const rows = (data ?? []) as { status: DealStatusStage }[]
  const s = { sourcing: 0, prepping: 0, delivered: 0, active: 0 }
  for (const r of rows) {
    if (r.status === 'sourcing') s.sourcing++
    else if (r.status === 'prepping') s.prepping++
    else if (r.status === 'delivered') s.delivered++
  }
  s.active = s.sourcing + s.prepping
  return s
}

/** user_id から自分の進行中案件を取得。 */
export async function listOwnActiveDeals(userId: string): Promise<VehicleDealRow[]> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  if (!member) return []
  return listActiveDeals(member.id)
}

/** 単一案件を取得。 */
export async function getDeal(id: string): Promise<VehicleDealRow | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.from('vehicle_deals').select('*').eq('id', id).maybeSingle<VehicleDealRow>()
  if (error) throw new Error(error.message)
  return data ?? null
}

async function resolveMemberId(userId: string): Promise<string> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  if (!data) throw new Error('会員情報が紐付いていません')
  return data.id
}

/**
 * 商品化中(prepping)へ手動移行（加盟者/本部どちらでも）。
 * sourcing のときのみ。整備・修理が発生した場合のクロスセル導線。
 */
export async function moveToPrepping(dealId: string, userId: string, isStaff: boolean): Promise<void> {
  const supabase = createServiceRoleClient()
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('案件が見つかりません')
  if (!isStaff && deal.member_id !== (await resolveMemberId(userId))) throw new Error('権限がありません')
  if (deal.status !== 'sourcing') throw new Error('仕入れ中の案件のみ商品化に移行できます')

  const { error } = await supabase
    .from('vehicle_deals')
    .update({ status: 'prepping', prepping_at: new Date().toISOString() } as never)
    .eq('id', dealId)
  if (error) throw new Error(error.message)
}

/** 陸送先（着地県）を設定（陸送費の自動計算に使う）。 */
export async function setDealDestination(dealId: string, toPref: string, userId: string, isStaff: boolean): Promise<void> {
  const supabase = createServiceRoleClient()
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('案件が見つかりません')
  if (!isStaff && deal.member_id !== (await resolveMemberId(userId))) throw new Error('権限がありません')
  const { error } = await supabase.from('vehicle_deals').update({ to_pref: toPref } as never).eq('id', dealId)
  if (error) throw new Error(error.message)
}

export type SettlementPreview = {
  balance: number
  costTotal: number
  shippingType: 'auto' | 'special' | 'unset' | 'none'
  shippingAmount: number
  shippingReason?: string
  remaining: number
  /** 精算に進めるか（特殊車/未設定の陸送費が未確定だと false） */
  canSettle: boolean
  blockReason?: string
}

/**
 * 受領前の精算プレビュー。陸送費が自動計算できるか、費目に陸送費があるかを見て残金を算出。
 * fromPref は本部/オークション拠点の想定（当面は本部設定に依存。ここでは to のみで判定し、
 * 陸送費は「費目に既にある」or「自動計算可」or「個別見積が必要」を返す）。
 */
export async function getSettlementPreview(dealId: string, fromPref: string): Promise<SettlementPreview> {
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('案件が見つかりません')
  const [costs, balance] = await Promise.all([listDealCosts(dealId), getLedgerBalance(deal.member_id)])
  const hasShippingCost = costs.some((c) => c.kind === 'shipping')
  const costTotal = costs.reduce((s, c) => s + (c.amount_yen ?? 0), 0)

  // 既に陸送費が費目にある → それを使う（自動計算不要）
  if (hasShippingCost || !deal.to_pref) {
    const remaining = balance - costTotal
    return {
      balance, costTotal,
      shippingType: hasShippingCost ? 'none' : 'unset',
      shippingAmount: 0,
      shippingReason: deal.to_pref ? undefined : '陸送先（着地県）が未設定です',
      remaining,
      canSettle: hasShippingCost || !!deal.to_pref, // 陸送費目があるか、着地県設定済みなら精算可（下で自動計算）
      blockReason: (!hasShippingCost && !deal.to_pref) ? '陸送先（着地県）を設定するか、陸送費を費目に追加してください' : undefined,
    }
  }

  // 陸送費が費目に無い → 着地県から自動計算を試みる
  const quote = await quoteShipping({ maker: deal.maker, fromPref, toPref: deal.to_pref })
  if (quote.type === 'auto') {
    const remaining = balance - costTotal - quote.amountYen
    return { balance, costTotal, shippingType: 'auto', shippingAmount: quote.amountYen, remaining, canSettle: true }
  }
  // 特殊車 or 未設定区間 → 個別見積が必要
  return {
    balance, costTotal, shippingType: quote.type, shippingAmount: 0, shippingReason: quote.reason,
    remaining: balance - costTotal, canSettle: false,
    blockReason: `${quote.reason}。陸送費を費目に追加してから受領してください。`,
  }
}

/**
 * 受領（受け取り完了）→ 自動精算 → delivered（Q5/Q6/Q7）。
 *   1. 陸送費が費目に無く着地県から自動計算できる場合、陸送費を費目に追加
 *   2. 費用合計を算出 → ledger に settlement 記帳（残高から減算）
 *   3. 案件を delivered・settled にし、残金を記録（残金は台帳に残り次回繰越）
 * 特殊車/未設定で陸送費が確定できない場合はブロック（個別見積を促す）。
 * @param fromPref 発地（本部/拠点県）。当面は呼び出し側で指定。
 */
export async function settleAndDeliver(dealId: string, userId: string, isStaff: boolean, fromPref: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('案件が見つかりません')
  if (!isStaff && deal.member_id !== (await resolveMemberId(userId))) throw new Error('権限がありません')
  if (deal.status === 'delivered') return
  if (deal.status === 'ordered') throw new Error('仕入れ中になってから受領できます')

  const costs = await listDealCosts(dealId)
  const hasShippingCost = costs.some((c) => c.kind === 'shipping')

  // 陸送費が費目に無ければ自動計算して費目化（可能な場合のみ）
  if (!hasShippingCost && deal.to_pref) {
    const quote = await quoteShipping({ maker: deal.maker, fromPref, toPref: deal.to_pref })
    if (quote.type === 'auto') {
      await addDealCost({ dealId, kind: 'shipping', label: `陸送費（${fromPref}→${deal.to_pref}）`, amount: quote.amountYen })
    } else {
      throw new Error(`${quote.reason}。陸送費を費目に追加してから受領してください。`)
    }
  } else if (!hasShippingCost && !deal.to_pref) {
    throw new Error('陸送先（着地県）を設定するか、陸送費を費目に追加してください。')
  }

  // 費用合計（陸送費追加後）と残金
  const finalCosts = await listDealCosts(dealId)
  const costTotal = finalCosts.reduce((s, c) => s + (c.amount_yen ?? 0), 0)
  const balance = await getLedgerBalance(deal.member_id)
  const remaining = balance - costTotal

  // ledger に精算を記帳（費用分を残高から減算 → 残高＝残金）
  if (costTotal > 0) {
    await addLedgerEntry({
      memberId: deal.member_id,
      kind: 'settlement',
      amount: costTotal,
      note: `取引精算：${[deal.maker, deal.car_model].filter(Boolean).join(' ')}`,
      dealId,
      createdBy: isStaff ? userId : null,
    })
  }

  // 案件を delivered・settled に
  const { error } = await supabase
    .from('vehicle_deals')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      settled: true,
      settled_amount_yen: costTotal,
      remaining_yen: remaining,
    } as never)
    .eq('id', dealId)
  if (error) throw new Error(error.message)
}

/**
 * Phase 3：販売中（listing）へ移行（全自動フローの本部操作）。
 */
export async function moveToListing(dealId: string, userId: string, isStaff: boolean): Promise<void> {
  const supabase = createServiceRoleClient()
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('案件が見つかりません')
  if (!isStaff && deal.member_id !== (await resolveMemberId(userId))) throw new Error('権限がありません')
  if (deal.status === 'sold') throw new Error('売却済みの案件です')
  const { error } = await supabase
    .from('vehicle_deals')
    .update({ status: 'listing', listed_at: new Date().toISOString() } as never)
    .eq('id', dealId)
  if (error) throw new Error(error.message)
}

/**
 * Phase 3：販売実績を記録して「売却済み（sold）」にする（要件 5.5〜5.6）。
 *   - 半自動：納品完了(delivered)後に加盟店が自分の売却結果を報告（本部も代理可）
 *   - 全自動：本部が販売〜清算を記録
 *   粗利益 = 販売価格 − 費用合計（gross_profit は生成列で自動算出）。
 *   費用合計のスナップショット：
 *     1) 精算済み（半自動）→ 精算額 / 2) 費目あり → 費目合計 / 3) どちらも無い（全自動）→ 発注金額
 */
export async function recordSale(
  dealId: string,
  input: { salePriceYen: number; soldAt?: string | null },
  userId: string,
  isStaff: boolean,
): Promise<void> {
  if (!input.salePriceYen || input.salePriceYen <= 0) throw new Error('販売価格を入力してください。')
  const supabase = createServiceRoleClient()
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('案件が見つかりません')
  if (!isStaff && deal.member_id !== (await resolveMemberId(userId))) throw new Error('権限がありません')
  if (deal.status === 'ordered' || deal.status === 'sourcing') {
    throw new Error('商品化以降の案件のみ販売実績を登録できます。')
  }

  let costTotal = deal.settled_amount_yen
  if (costTotal == null) {
    const costs = await listDealCosts(dealId)
    costTotal = costs.length > 0
      ? costs.reduce((s, c) => s + (c.amount_yen ?? 0), 0)
      : (deal.order_amount_yen ?? 0)
  }

  const soldAt = input.soldAt ?? new Date().toISOString()

  // 【2026-07-21 改定】月額管理手数料は「案件清算時」ではなく「枠数連動の毎月課金」に変更したため、
  //   ここでは手数料の差引を行わない（lib/portal/mgmt-fee.ts の月次実行に一本化）。
  //   諸経費（仕入/整備/陸送/代行手数料）の売上相殺は従来どおり cost_total_yen / 粗利で扱う。

  const { error } = await supabase
    .from('vehicle_deals')
    .update({
      status: 'sold',
      sale_price_yen: input.salePriceYen,
      sold_at: soldAt,
      sold_by: userId,
      cost_total_yen: costTotal,
    } as never)
    .eq('id', dealId)
  if (error) throw new Error(error.message)
}

/**
 * 精算を取り消して訂正できる状態に戻す（本部・レビュー 2026-07-21 ①）。
 *   1. この案件の精算記帳（settlement）を削除 → 預かり金残高が自動で元に戻る
 *   2. 案件を精算前（商品化中）に戻し、settled/精算額/残金をクリア
 *   → 費目が再び編集可能になり、修正して再精算できる。
 * 売却済みの案件は取り消せない（先に販売実績の取消が必要）。
 */
export async function cancelSettlement(dealId: string, userId: string, isStaff: boolean): Promise<void> {
  const supabase = createServiceRoleClient()
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('案件が見つかりません')
  if (!isStaff && deal.member_id !== (await resolveMemberId(userId))) throw new Error('権限がありません')
  if (!deal.settled) throw new Error('この案件はまだ精算されていません。')
  if (deal.status === 'sold') throw new Error('売却済みの案件は取り消せません。先に販売実績の登録を取り消してください。')

  // 1) 精算の記帳を削除（残高はトリガで自動再計算＝元に戻る）
  const { data: entries } = await supabase
    .from('ledger_entries')
    .select('id')
    .eq('deal_id', dealId)
    .eq('kind', 'settlement')
  for (const e of (entries ?? []) as { id: string }[]) {
    const { error } = await supabase.from('ledger_entries').delete().eq('id', e.id)
    if (error) throw new Error(error.message)
  }

  // 2) 案件を精算前（商品化中）へ戻す
  const { error } = await supabase
    .from('vehicle_deals')
    .update({ status: 'prepping', settled: false, settled_amount_yen: null, remaining_yen: null, delivered_at: null } as never)
    .eq('id', dealId)
  if (error) throw new Error(error.message)
}

/** 旧名互換（精算なしの単純遷移）。既存呼び出し用に残す。 */
export async function markDelivered(dealId: string, userId: string, isStaff: boolean): Promise<void> {
  // 既定の発地（拠点）は東京都とする。将来は本部設定から取得。
  await settleAndDeliver(dealId, userId, isStaff, DEFAULT_FROM_PREF)
}

/** 発地（拠点）の既定。将来は本部設定（system_settings）から取得。 */
export const DEFAULT_FROM_PREF = '東京都'

/** 加盟店の取引履歴（売却済み＝完了）を新しい順に取得。 */
export async function listDealHistory(memberId: string): Promise<VehicleDealRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vehicle_deals')
    .select('*')
    .eq('member_id', memberId)
    .eq('status', 'sold')
    .order('sold_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as VehicleDealRow[]
}

export async function listOwnDealHistory(userId: string): Promise<VehicleDealRow[]> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  if (!member) return []
  return listDealHistory(member.id)
}
