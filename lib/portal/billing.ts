import { createServiceRoleClient } from '@/lib/supabase/admin'
import { MAX_SLOTS, SLOT_PRICE_YEN } from '@/lib/portal/auto-trading'
import { getConsumptionTaxPct, taxOf } from '@/lib/portal/mgmt-fee'
import type { InvoiceRow, InvoiceKind, InvoiceStatus, PaymentRow } from '@/types/database'

/**
 * 請求・入金消込（要件 5.2 消込機能 / PAY-01〜04・migration 028）。
 * invoices（請求）に payments（入金）を紐付けて消込する。
 * paid_yen / status はDBトリガで自動再計算されるため、ここでは操作のみ行う。
 * 呼び出し側で can_crm（admin / crm_staff）済みであること。
 */

export const INVOICE_KIND_LABEL: Record<InvoiceKind, string> = {
  joining: '加盟金',
  system_fee: 'システム導入費',
  monthly: '月額費用',
  royalty: 'ロイヤリティ',
  management_fee: '管理手数料',
  slot_fee: '追加枠費用',
  sourcing_fund: '仕入れ金',
  other: 'その他',
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  unbilled: '請求予定',
  billed: '請求済（未入金）',
  partial: '分割入金中',
  paid: '入金済',
  overdue: '支払遅延',
  cancelled: '取消',
}

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, string> = {
  unbilled: 'bg-slate-100 text-slate-600',
  billed: 'bg-amber-50 text-amber-700',
  partial: 'bg-sky-50 text-sky-700',
  paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-400',
}

/** 期限超過かつ未入金の請求を overdue に更新する（本部ダッシュボード表示前に呼ぶ／PAY-04）。 */
export async function refreshOverdue(): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.rpc('refresh_overdue_invoices')
  if (error) throw new Error(error.message)
}

/** 加盟店の請求一覧（新しい順）。 */
export async function listInvoices(memberId: string): Promise<InvoiceRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as InvoiceRow[]
}

/** 全加盟店の請求一覧（加盟店名つき・新しい順）。請求・入金管理の横断ページ用。status で絞込可。 */
export type InvoiceWithMember = InvoiceRow & { member: { id: string; member_name: string; company_name: string | null } | null }

export async function listAllInvoices(status?: InvoiceStatus): Promise<InvoiceWithMember[]> {
  await refreshOverdue()
  const supabase = createServiceRoleClient()
  let q = supabase
    .from('invoices')
    .select('*, member:members(id, member_name, company_name)')
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as InvoiceWithMember[]
}

/** 全加盟店の請求サマリ（請求総額・入金済・未収・遅延件数）。横断ページ用。 */
export function summarizeInvoices(invoices: InvoiceRow[]): BillingSummary {
  return summarize(invoices)
}

/** 加盟店ごとの請求サマリ（未収額・遅延件数）。会員一覧・ダッシュボード用。 */
export type BillingSummary = { billedYen: number; paidYen: number; outstandingYen: number; overdue: number }

export async function getBillingSummary(memberId: string): Promise<BillingSummary> {
  const invoices = await listInvoices(memberId)
  return summarize(invoices)
}

function summarize(invoices: InvoiceRow[]): BillingSummary {
  let billedYen = 0
  let paidYen = 0
  let overdue = 0
  for (const inv of invoices) {
    if (inv.status === 'cancelled' || inv.status === 'unbilled') continue
    billedYen += inv.amount_yen
    paidYen += inv.paid_yen
    if (inv.status === 'overdue') overdue++
  }
  return { billedYen, paidYen, outstandingYen: Math.max(0, billedYen - paidYen), overdue }
}

/** 請求を作成（本部）。requested=true なら即「請求済(billed)」にする（請求日時を打刻）。 */
export async function createInvoice(input: {
  memberId: string
  kind: InvoiceKind
  title?: string | null
  amountYen: number
  dueDate?: string | null
  requested?: boolean
  note?: string | null
}): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('invoices').insert({
    member_id: input.memberId,
    kind: input.kind,
    title: input.title ?? null,
    amount_yen: input.amountYen,
    due_date: input.dueDate ?? null,
    note: input.note ?? null,
    status: input.requested ? 'billed' : 'unbilled',
    billed_at: input.requested ? new Date().toISOString() : null,
  } as never)
  if (error) throw new Error(error.message)
}

/**
 * 枠購入の請求を発行する（⑦フェーズ5 / 2026-07-21 改定 / 2026-07-23 消費税対応）。1枠=10万円（税抜）。
 * 入金消込が完了（paid）すると、DBトリガで members.auto_slots が自動加算される（最大10）。
 *   - エコノミー等（プラン既定 < 2枠）は枠固定のため追加購入不可。
 *   - 上位プラン（既定2枠）は3枠目以降を10万円/枠（税抜）で購入（最大10枠）。
 *   - 請求額は税込（税抜 ＋ 消費税）。税率は本部設定（consumption_tax_pct）。
 */
export async function createSlotPurchaseInvoice(input: { memberId: string; slotCount: number; dueDate?: string | null }): Promise<void> {
  if (input.slotCount <= 0) throw new Error('購入枠数を入力してください。')
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase
    .from('members')
    .select('auto_slots, plan:plans(default_auto_slots)')
    .eq('id', input.memberId)
    .maybeSingle<{ auto_slots: number; plan: { default_auto_slots: number } | null }>()
  const current = member?.auto_slots ?? 0
  const planDefault = member?.plan?.default_auto_slots ?? 0
  if (planDefault < 2) {
    throw new Error('このプランは枠数が固定（追加購入不可）です。枠の追加購入は上位プラン（既定2枠・3枠目以降が購入対象）でのみ可能です。')
  }
  if (current + input.slotCount > MAX_SLOTS) {
    throw new Error(`枠は1加盟者あたり最大${MAX_SLOTS}枠までです（現在${current}枠・購入${input.slotCount}枠は上限超過）。`)
  }
  const taxPct = await getConsumptionTaxPct()
  const excl = input.slotCount * SLOT_PRICE_YEN
  const tax = taxOf(excl, taxPct)
  const total = excl + tax // 税込
  const { error } = await supabase.from('invoices').insert({
    member_id: input.memberId,
    kind: 'slot_fee',
    title: `販売可能枠 ${input.slotCount}枠の購入`,
    amount_yen: total,
    slot_count: input.slotCount,
    due_date: input.dueDate ?? null,
    status: 'billed',
    billed_at: new Date().toISOString(),
    note: `枠購入（${SLOT_PRICE_YEN.toLocaleString()}円 × ${input.slotCount}枠）税抜${excl.toLocaleString()}円＋消費税${tax.toLocaleString()}円（${taxPct}%）＝税込${total.toLocaleString()}円。入金消込で自動的に枠が付与されます。`,
  } as never)
  if (error) throw new Error(error.message)
}

/** 請求を「請求済(billed)」にする（請求予定→請求発行・PAY-02）。 */
export async function markBilled(invoiceId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('invoices')
    .update({ billed_at: new Date().toISOString(), status: 'billed' } as never)
    .eq('id', invoiceId)
  if (error) throw new Error(error.message)
}

/** 請求を取消（cancelled）。 */
export async function cancelInvoice(invoiceId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('invoices').update({ status: 'cancelled' } as never).eq('id', invoiceId)
  if (error) throw new Error(error.message)
}

/** 請求を削除（本部）。紐づく payments.invoice_id は on delete set null で外れる。 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId)
  if (error) throw new Error(error.message)
}

/**
 * 消込：入金を記録して請求に紐付ける（PAY-03）。
 * payments に confirmed の入金行を作り invoice_id で紐付ける。
 * paid_yen / status はトリガで自動再計算される。
 */
export async function recordPayment(input: {
  invoiceId: string
  memberId: string
  amountYen: number
  paymentDate?: string | null
  note?: string | null
}): Promise<void> {
  if (input.amountYen <= 0) throw new Error('入金額を入力してください。')
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('payments').insert({
    member_id: input.memberId,
    invoice_id: input.invoiceId,
    amount_yen: input.amountYen,
    payment_date: input.paymentDate ?? new Date().toISOString().slice(0, 10),
    kind: 'other',
    status: 'confirmed',
    note: input.note ?? '消込',
  } as never)
  if (error) throw new Error(error.message)
}

/** 請求に紐づく入金明細（消込内訳）。 */
export async function listInvoicePayments(invoiceId: string): Promise<PaymentRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PaymentRow[]
}

/** 本部ダッシュボード用：遅延・未収の全体集計（PAY-04）。 */
export type OverdueOverview = {
  overdueCount: number
  overdueYen: number
  outstandingYen: number
  members: { memberId: string; memberName: string; companyName: string | null; overdueYen: number; count: number }[]
}

export async function getOverdueOverview(): Promise<OverdueOverview> {
  await refreshOverdue()
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('member_id, amount_yen, paid_yen, status, member:members(member_name, company_name)')
    .eq('status', 'overdue')
  if (error) throw new Error(error.message)

  type Row = {
    member_id: string
    amount_yen: number
    paid_yen: number
    member: { member_name: string; company_name: string | null } | null
  }
  const rows = (data ?? []) as unknown as Row[]

  const byMember = new Map<string, OverdueOverview['members'][number]>()
  let overdueYen = 0
  for (const r of rows) {
    const remaining = Math.max(0, r.amount_yen - r.paid_yen)
    overdueYen += remaining
    const cur = byMember.get(r.member_id) ?? {
      memberId: r.member_id,
      memberName: r.member?.member_name ?? '—',
      companyName: r.member?.company_name ?? null,
      overdueYen: 0,
      count: 0,
    }
    cur.overdueYen += remaining
    cur.count++
    byMember.set(r.member_id, cur)
  }

  return {
    overdueCount: rows.length,
    overdueYen,
    outstandingYen: overdueYen,
    members: [...byMember.values()].sort((a, b) => b.overdueYen - a.overdueYen),
  }
}
