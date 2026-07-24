import { createServiceRoleClient } from '@/lib/supabase/admin'
import { assertTradingAllowed } from '@/lib/portal/trading'
import { getOwnOnboarding } from '@/lib/portal/onboarding'
import { getOwnFlow } from '@/lib/portal/flow'
import { getFlowBudgets } from '@/lib/portal/budget'
import { createDealFromOrder } from '@/lib/portal/deals'
import type { OrderRow, OrderStatus } from '@/types/database'

/**
 * ㉜ STEP5：オーダーのオンボーディング完了ゲート（㉚）の有効/無効。
 * クライアント要望「今回はオーダー権限を解放、次回は制限をかけて再確認」に対応。
 * 前回は解放（false）で確認済み。今回、要件（5.3 ロック制御・論点B）どおり
 * 「オンボーディング完了までオーダー不可」を再度有効化する（true）。
 */
export const ORDER_ONBOARDING_GATE = true

export type OrderWithMember = OrderRow & {
  member: { id: string; member_name: string; company_name: string | null } | null
}

/**
 * ㉕ 本部が「オンボーディング未完了でも取引を許可」した加盟店か。
 * 古物商猶予の超過ロックはこの特例では解除されない（assertTradingAllowed 側で判定）。
 */
export async function hasTradingOverride(userId: string): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('members')
    .select('trading_override')
    .eq('user_id', userId)
    .maybeSingle<{ trading_override: boolean }>()
  return !!data?.trading_override
}

/** 全オーダー（本部）。加盟店名を結合。status / memberId で絞り込み可。 */
export async function listOrders(filter?: { status?: OrderStatus; memberId?: string }): Promise<OrderWithMember[]> {
  const supabase = createServiceRoleClient()
  let q = supabase
    .from('orders')
    .select('*, member:members(id, member_name, company_name)')
    .order('created_at', { ascending: false })
  if (filter?.status) q = q.eq('status', filter.status)
  if (filter?.memberId) q = q.eq('member_id', filter.memberId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as OrderWithMember[]
}

export type OrderSummary = { total: number; received: number; in_progress: number; completed: number; cancelled: number }

/** 加盟店ごとのオーダー件数サマリ（本部・会員個別画面用）。 */
export async function getMemberOrderSummary(memberId: string): Promise<OrderSummary> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('member_id', memberId)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { status: OrderStatus }[]
  const s: OrderSummary = { total: rows.length, received: 0, in_progress: 0, completed: 0, cancelled: 0 }
  for (const r of rows) s[r.status]++
  return s
}

/** member.user_id から自分のオーダー一覧（加盟店）。 */
export async function listOwnOrders(userId: string): Promise<OrderRow[]> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>()
  if (!member) return []
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('member_id', member.id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as OrderRow[]
}

/** 単一オーダー（本部）。 */
export async function getOrder(id: string): Promise<OrderWithMember | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, member:members(id, member_name, company_name)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as OrderWithMember) ?? null
}

/** member.user_id を解決して自分のオーダーを作成（加盟店）。 */
export async function createOwnOrder(
  userId: string,
  input: Pick<OrderRow, 'maker' | 'car_model' | 'year' | 'budget_yen' | 'preferred_color' | 'mileage_max' | 'notes'>,
): Promise<OrderRow> {
  // ㉚ オンボーディング完了ゲート（要件定義書 論点B：未完了はオーダー不可）
  // ㉜ STEP5：前回は解放して確認済み。現在は要件どおり有効（ORDER_ONBOARDING_GATE=true）。
  // ㉕ 本部が特例で許可（trading_override）していれば未完了でもオーダー可。
  if (ORDER_ONBOARDING_GATE && !(await hasTradingOverride(userId))) {
    const onboarding = await getOwnOnboarding(userId)
    if (!onboarding?.unlocked) {
      throw new Error('オンボーディングが完了していません。すべてのステップを完了すると仕入れオーダーを作成できます。')
    }
  }

  // ㉙ オーダーフォームは半自動売買モデルの運用。自動売買フローでは手動オーダー不可。
  const flowInfo = await getOwnFlow(userId)
  if (flowInfo && flowInfo.flow !== 'semi') {
    throw new Error('自動売買フローでは仕入れは自動化されます（手動オーダーは半自動売買フローでのみ利用できます）。')
  }

  // 取引可否ガード：古物商猶予の超過中は発注不可（自動発注の事故防止）
  await assertTradingAllowed(userId)

  const supabase = createServiceRoleClient()
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>()
  if (!member) throw new Error('会員情報が紐付いていません')

  // フェーズ2 超過オーダー制限：発注金額（予算）は預かり残高より低いこと。
  //   仕入資金を超えるオーダーを禁止（自動精算の前提）。
  //   フェーズ7：両フロー保有者は「半自動用」の割当額で判定（単独フローは預かり残高全額）。
  const budgets = await getFlowBudgets(member.id)
  const balance = budgets.semiBudget
  const orderAmount = input.budget_yen ?? 0
  if (!orderAmount || orderAmount <= 0) {
    throw new Error('予算（発注金額）を入力してください。')
  }
  if (orderAmount >= balance) {
    const label = budgets.isDual && budgets.hasAllocation ? '半自動用の予算' : '仕入れ資金の預かり残高'
    throw new Error(`発注金額（${orderAmount.toLocaleString()}円）が${label}（${balance.toLocaleString()}円）を超えています。残高の範囲内でオーダーしてください。`)
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({ ...input, member_id: member.id } as never)
    .select('*')
    .single<OrderRow>()
  if (error) throw new Error(error.message)

  // フェーズ3：オーダー送信で車両案件を生成し「仕入れ中」に自動遷移
  await createDealFromOrder(data)
  return data
}

/** オーダーのステータスを変更（本部）。 */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('orders').update({ status } as never).eq('id', id)
  if (error) throw new Error(error.message)
}

/** ステータス別の件数（ダッシュボード用）。 */
export async function orderStatusCounts(): Promise<Record<OrderStatus, number> & { total: number }> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.from('orders').select('status')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { status: OrderStatus }[]
  const counts = { received: 0, in_progress: 0, completed: 0, cancelled: 0, total: rows.length }
  for (const r of rows) counts[r.status]++
  return counts
}
