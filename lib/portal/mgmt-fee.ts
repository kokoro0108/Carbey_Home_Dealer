import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getLedgerBalance, addLedgerEntry } from '@/lib/portal/ledger'
import { completedMonths } from '@/lib/portal/deals'
import { notifyMember } from '@/lib/portal/notifications'
import type { MemberMgmtFeeRunRow } from '@/types/database'

/**
 * 月額管理手数料（枠数連動・毎月課金）— 2026-07-21 クライアント確定モデル。
 *
 *   月額 =（auto_slots − 1）× 単価（system_settings.mgmt_fee_per_slot_yen＝既定10万）。
 *     エコノミー(1枠)=0。上位=2枠(=10万)〜10枠(=90万)。
 *   起算＝枠取得日(mgmt_fee_anchor)・満了月。前回課金〜現在の満了月数ぶんを課金。
 *   預かり金(運転資金)から可能分を相殺し、不足は請求(kind=management_fee)＋通知（受注は継続）。
 *   本部が月次で実行する（cronなし）。当機能は members.mgmt_fee_billed_months で二重課金を防ぐ。
 */

export const MGMT_FEE_DEFAULT_UNIT = 100_000

/** 1枠あたり単価（system_settings。未設定は既定10万）。 */
export async function getMgmtFeeUnit(): Promise<number> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('system_settings').select('value_int').eq('key', 'mgmt_fee_per_slot_yen').maybeSingle<{ value_int: number | null }>()
  return data?.value_int ?? MGMT_FEE_DEFAULT_UNIT
}

/** 枠数と単価から月額を算出。=（枠数−1）×単価（下限0）。 */
export function monthlyMgmtFee(slots: number, unit: number): number {
  return Math.max(0, slots - 1) * unit
}

type MemberFeeRow = {
  id: string
  member_name: string
  grant_auto: boolean
  auto_slots: number
  mgmt_fee_anchor: string | null
  mgmt_fee_billed_months: number
  plan: { default_auto_slots: number } | null
}

async function fetchMemberFee(memberId: string): Promise<MemberFeeRow | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('members')
    .select('id, member_name, grant_auto, auto_slots, mgmt_fee_anchor, mgmt_fee_billed_months, plan:plans(default_auto_slots)')
    .eq('id', memberId)
    .maybeSingle<MemberFeeRow>()
  return data ?? null
}

export type MgmtFeePreview = {
  memberId: string
  eligible: boolean       // 上位プランの自動売買加盟者か
  slots: number
  unit: number
  monthlyFee: number      // 当月の月額（=(枠数-1)×単価）
  anchor: string | null
  billedMonths: number    // 課金済み満了月数
  dueMonths: number       // 今回課金できる満了月数（未課金の満了月）
  dueGross: number        // 今回の請求総額（monthlyFee × dueMonths）
  balance: number         // 現在の預かり金残高
}

/** 会員の月額管理手数料プレビュー（本部の月次実行・加盟店表示の両方に使う）。 */
export async function getMgmtFeePreview(memberId: string, unitOverride?: number): Promise<MgmtFeePreview> {
  const m = await fetchMemberFee(memberId)
  const unit = unitOverride ?? (await getMgmtFeeUnit())
  const slots = m?.auto_slots ?? 0
  const planDefault = m?.plan?.default_auto_slots ?? 0
  const eligible = !!m?.grant_auto && planDefault >= 2
  const monthlyFee = eligible ? monthlyMgmtFee(slots, unit) : 0
  const anchor = m?.mgmt_fee_anchor ?? null
  const billedMonths = m?.mgmt_fee_billed_months ?? 0
  const total = anchor ? completedMonths(anchor + 'T00:00:00Z', new Date().toISOString()) : 0
  const dueMonths = Math.max(0, total - billedMonths)
  const balance = await getLedgerBalance(memberId)
  return { memberId, eligible, slots, unit, monthlyFee, anchor, billedMonths, dueMonths, dueGross: monthlyFee * dueMonths, balance }
}

export type MgmtFeeRunResult = {
  memberId: string
  memberName: string
  charged: boolean
  months: number
  gross: number
  fromDeposit: number
  shortfall: number
  invoiceId: string | null
  skippedReason?: string
}

/**
 * 会員1名の月次管理手数料を実行（本部）。
 *   起算日未設定なら当日で起算（遡及課金なし）。未到来なら何もしない。
 *   預かり金から可能分を相殺し、不足は請求(management_fee)＋通知。billed_months を進める。
 */
export async function runMonthlyMgmtFee(memberId: string, ranBy: string | null): Promise<MgmtFeeRunResult> {
  const supabase = createServiceRoleClient()
  const m = await fetchMemberFee(memberId)
  const base = { memberId, memberName: m?.member_name ?? '', charged: false, months: 0, gross: 0, fromDeposit: 0, shortfall: 0, invoiceId: null as string | null }
  if (!m) return { ...base, skippedReason: '会員が見つかりません' }

  const planDefault = m.plan?.default_auto_slots ?? 0
  if (!m.grant_auto || planDefault < 2) return { ...base, skippedReason: '対象外（上位プランの自動売買加盟者のみ）' }

  // 起算日が未設定なら当日で起算（この回は課金しない）
  if (!m.mgmt_fee_anchor) {
    await supabase.from('members').update({ mgmt_fee_anchor: new Date().toISOString().slice(0, 10) } as never).eq('id', memberId)
    return { ...base, skippedReason: '起算日を当日で設定しました（次回から課金）' }
  }

  const unit = await getMgmtFeeUnit()
  const monthlyFee = monthlyMgmtFee(m.auto_slots, unit)
  if (monthlyFee <= 0) return { ...base, skippedReason: '月額0円（枠数1以下）' }

  const total = completedMonths(m.mgmt_fee_anchor + 'T00:00:00Z', new Date().toISOString())
  const dueMonths = Math.max(0, total - m.mgmt_fee_billed_months)
  if (dueMonths <= 0) return { ...base, skippedReason: '今月分は未到来（満了月なし）' }

  const gross = monthlyFee * dueMonths
  const balance = await getLedgerBalance(memberId)
  const fromDeposit = Math.min(gross, Math.max(0, balance))
  const shortfall = gross - fromDeposit
  const label = `月額管理手数料 ${dueMonths}か月分（${m.auto_slots}枠 → 月額${monthlyFee.toLocaleString()}円）`

  // 預かり金から可能分を相殺
  if (fromDeposit > 0) {
    await addLedgerEntry({ memberId, kind: 'mgmt_fee', amount: fromDeposit, note: label, createdBy: ranBy })
  }

  // 不足分は請求（デポジット依頼）＋通知
  let invoiceId: string | null = null
  if (shortfall > 0) {
    const { data: inv } = await supabase
      .from('invoices')
      .insert({
        member_id: memberId,
        kind: 'management_fee',
        title: '月額管理手数料 不足分（デポジットのお願い）',
        amount_yen: shortfall,
        status: 'billed',
        billed_at: new Date().toISOString(),
        note: `${label}。預かり金では不足のため、不足分を請求します。デポジットのご入金をお願いします。`,
      } as never)
      .select('id')
      .maybeSingle<{ id: string }>()
    invoiceId = inv?.id ?? null
    await notifyMember(
      memberId,
      'mgmt_fee',
      '月額管理手数料のお支払い（デポジット）のお願い',
      `${label} のうち ${shortfall.toLocaleString()}円が預かり金で不足しています。デポジットのご入金をお願いします。`,
    )
  }

  // 実行履歴 + 課金済み月数を前進
  await supabase.from('member_mgmt_fee_runs').insert({
    member_id: memberId, months: dueMonths, slots: m.auto_slots, unit_yen: unit,
    gross_yen: gross, from_deposit_yen: fromDeposit, invoiced_yen: shortfall,
    invoice_id: invoiceId, ran_by: ranBy, note: label,
  } as never)
  await supabase.from('members').update({ mgmt_fee_billed_months: m.mgmt_fee_billed_months + dueMonths } as never).eq('id', memberId)

  return { memberId, memberName: m.member_name, charged: true, months: dueMonths, gross, fromDeposit, shortfall, invoiceId }
}

/** 全対象加盟者（上位プランの自動売買）に月次実行。結果配列を返す。 */
export async function runMonthlyMgmtFeeAll(ranBy: string | null): Promise<MgmtFeeRunResult[]> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('members')
    .select('id, grant_auto, plan:plans(default_auto_slots)')
    .eq('grant_auto', true)
  const rows = (data ?? []) as { id: string; grant_auto: boolean; plan: { default_auto_slots: number } | null }[]
  const targets = rows.filter((r) => (r.plan?.default_auto_slots ?? 0) >= 2)
  const results: MgmtFeeRunResult[] = []
  for (const t of targets) results.push(await runMonthlyMgmtFee(t.id, ranBy))
  return results
}

/** 会員の月次実行履歴（新しい順）。 */
export async function listMgmtFeeRuns(memberId: string, limit = 24): Promise<MemberMgmtFeeRunRow[]> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('member_mgmt_fee_runs')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as MemberMgmtFeeRunRow[]
}

/** ユーザーIDから自分の月額管理手数料プレビューを取得（加盟店表示）。 */
export async function getOwnMgmtFeePreview(userId: string): Promise<MgmtFeePreview | null> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  if (!member) return null
  return getMgmtFeePreview(member.id)
}
