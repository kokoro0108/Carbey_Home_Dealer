import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { VehicleDealRow } from '@/types/database'

/**
 * Phase 3 ②：販売実績・収益の集計（要件 5.6 販売実績管理 / 5.7 月次レポート）。
 * 売却済み（status='sold'）の案件を集計する。売上=販売価格、原価=費用合計、
 * 粗利益=gross_profit（生成列）。memberId 指定で加盟店別、未指定で全体。
 */

export type SalesSummary = {
  count: number         // 販売台数
  revenueYen: number    // 売上合計（販売価格）
  costYen: number       // 原価合計（費用合計）
  profitYen: number     // 粗利益合計
  marginPct: number     // 利益率（粗利益 ÷ 売上 × 100）
}

export type MonthlySales = {
  ym: string            // 'YYYY-MM'
  label: string         // '7月' など表示用
  count: number
  revenueYen: number
  costYen: number
  profitYen: number
}

/** sold 案件の生データを取得（memberId 指定で加盟店別）。 */
async function listSold(memberId?: string): Promise<VehicleDealRow[]> {
  const supabase = createServiceRoleClient()
  let q = supabase.from('vehicle_deals').select('*').eq('status', 'sold')
  if (memberId) q = q.eq('member_id', memberId)
  const { data, error } = await q.order('sold_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as VehicleDealRow[]
}

function summarize(deals: VehicleDealRow[]): SalesSummary {
  const revenueYen = deals.reduce((s, d) => s + (d.sale_price_yen ?? 0), 0)
  const costYen = deals.reduce((s, d) => s + (d.cost_total_yen ?? 0), 0)
  const profitYen = deals.reduce((s, d) => s + (d.gross_profit_yen ?? 0), 0)
  const marginPct = revenueYen > 0 ? Math.round((profitYen / revenueYen) * 1000) / 10 : 0
  return { count: deals.length, revenueYen, costYen, profitYen, marginPct }
}

/** 販売実績サマリ（全体 or 加盟店別）。 */
export async function getSalesSummary(memberId?: string): Promise<SalesSummary> {
  return summarize(await listSold(memberId))
}

/**
 * 月別集計（直近 months ヶ月・古い→新しい順）。グラフと月次レポートの共通データ。
 * anchor は基準日（既定は現在）。テスト再現性のため差し込み可能。
 */
export async function getMonthlySales(opts?: { memberId?: string; months?: number; anchor?: Date }): Promise<MonthlySales[]> {
  const months = opts?.months ?? 6
  const anchor = opts?.anchor ?? new Date()
  const deals = await listSold(opts?.memberId)

  // 対象月の枠を作る（古い順）
  const buckets: MonthlySales[] = []
  const index = new Map<string, MonthlySales>()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b: MonthlySales = { ym, label: `${d.getMonth() + 1}月`, count: 0, revenueYen: 0, costYen: 0, profitYen: 0 }
    buckets.push(b)
    index.set(ym, b)
  }

  for (const deal of deals) {
    if (!deal.sold_at) continue
    const ym = deal.sold_at.slice(0, 7) // 'YYYY-MM'
    const b = index.get(ym)
    if (!b) continue // 対象期間外
    b.count++
    b.revenueYen += deal.sale_price_yen ?? 0
    b.costYen += deal.cost_total_yen ?? 0
    b.profitYen += deal.gross_profit_yen ?? 0
  }
  return buckets
}

/** 月次レポート（当月・累計）。加盟店レポート画面用（要件 5.7）。 */
export type MonthlyReport = {
  ym: string
  monthRevenueYen: number
  monthProfitYen: number
  monthCount: number
  totalProfitYen: number   // 累計利益（全期間）
  totalCount: number
}

export async function getMonthlyReport(memberId?: string, anchor?: Date): Promise<MonthlyReport> {
  const now = anchor ?? new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const deals = await listSold(memberId)
  const thisMonth = deals.filter((d) => d.sold_at?.slice(0, 7) === ym)
  return {
    ym,
    monthRevenueYen: thisMonth.reduce((s, d) => s + (d.sale_price_yen ?? 0), 0),
    monthProfitYen: thisMonth.reduce((s, d) => s + (d.gross_profit_yen ?? 0), 0),
    monthCount: thisMonth.length,
    totalProfitYen: deals.reduce((s, d) => s + (d.gross_profit_yen ?? 0), 0),
    totalCount: deals.length,
  }
}

export type SoldDealWithMember = VehicleDealRow & {
  member: { id: string; member_name: string; company_name: string | null } | null
}

/** 売却済み案件の一覧（本部・加盟店名つき／加盟店別）。 */
export async function listSoldDeals(memberId?: string): Promise<SoldDealWithMember[]> {
  const supabase = createServiceRoleClient()
  let q = supabase
    .from('vehicle_deals')
    .select('*, member:members(id, member_name, company_name)')
    .eq('status', 'sold')
  if (memberId) q = q.eq('member_id', memberId)
  const { data, error } = await q.order('sold_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as SoldDealWithMember[]
}

/** 加盟店別の実績（本部の販売実績ページ：加盟店別収益一覧・要件 REP-02）。 */
export type MemberSales = { memberId: string; memberName: string; companyName: string | null } & SalesSummary

export async function getSalesByMember(): Promise<MemberSales[]> {
  const deals = await listSoldDeals()
  const map = new Map<string, { name: string; company: string | null; deals: VehicleDealRow[] }>()
  for (const d of deals) {
    const cur = map.get(d.member_id) ?? { name: d.member?.member_name ?? '—', company: d.member?.company_name ?? null, deals: [] }
    cur.deals.push(d)
    map.set(d.member_id, cur)
  }
  return [...map.entries()]
    .map(([memberId, v]) => ({ memberId, memberName: v.name, companyName: v.company, ...summarize(v.deals) }))
    .sort((a, b) => b.profitYen - a.profitYen)
}
