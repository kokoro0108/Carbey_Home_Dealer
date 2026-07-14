import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { LedgerEntryRow, LedgerEntryKind } from '@/types/database'

/**
 * 預かり金台帳（仕入れ資金）のデータアクセス（半自動売買フェーズ1）。
 * 加盟金/月額は既存 payments、ここは仕入れ資金の預かり金に特化。
 * 残高は member_ledger.balance_yen（entries から自動再計算・トリガ管理）。
 */

/** 加盟店の預かり金残高を取得（台帳が無ければ 0）。 */
export async function getLedgerBalance(memberId: string): Promise<number> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('member_ledger')
    .select('balance_yen')
    .eq('member_id', memberId)
    .maybeSingle<{ balance_yen: number }>()
  return data?.balance_yen ?? 0
}

/** 加盟店の入出金明細（新しい順）。 */
export async function listLedgerEntries(memberId: string): Promise<LedgerEntryRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as LedgerEntryRow[]
}

/**
 * 入出金を登録（本部）。amount は正の絶対値で受け、kind により符号を決める。
 *   deposit(入金) / adjust(+調整) → +amount
 *   withdraw(出金) / settlement(精算) → -amount
 */
export async function addLedgerEntry(input: {
  memberId: string
  kind: LedgerEntryKind
  amount: number // 絶対値（正）
  note?: string | null
  dealId?: string | null
  createdBy?: string | null
}): Promise<void> {
  const supabase = createServiceRoleClient()
  const abs = Math.abs(Math.round(input.amount))
  const signed = input.kind === 'deposit' || input.kind === 'adjust' ? abs : -abs
  const { error } = await supabase.from('ledger_entries').insert({
    member_id: input.memberId,
    kind: input.kind,
    amount_yen: signed,
    note: input.note ?? null,
    deal_id: input.dealId ?? null,
    created_by: input.createdBy ?? null,
  } as never)
  if (error) throw new Error(error.message)
}

/** 明細を削除（本部・誤登録の取消）。残高はトリガで再計算される。 */
export async function deleteLedgerEntry(id: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('ledger_entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export type MemberFundsSummary = {
  memberId: string
  memberName: string
  companyName: string | null
  balanceYen: number
  paymentStatus: string
  joiningFeeYen: number | null
}

/** 全加盟店の資金サマリ（全体管理用）。預かり金残高＋加盟金支払状況。 */
export async function listAllMemberFunds(): Promise<MemberFundsSummary[]> {
  const supabase = createServiceRoleClient()
  const { data: members, error } = await supabase
    .from('members')
    .select('id, member_name, company_name, payment_status, joining_fee_yen')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const { data: ledgers } = await supabase.from('member_ledger').select('member_id, balance_yen')
  const balByMember = new Map<string, number>()
  for (const l of (ledgers ?? []) as { member_id: string; balance_yen: number }[]) balByMember.set(l.member_id, l.balance_yen)

  return ((members ?? []) as {
    id: string; member_name: string; company_name: string | null; payment_status: string; joining_fee_yen: number | null
  }[]).map((m) => ({
    memberId: m.id,
    memberName: m.member_name,
    companyName: m.company_name,
    balanceYen: balByMember.get(m.id) ?? 0,
    paymentStatus: m.payment_status,
    joiningFeeYen: m.joining_fee_yen,
  }))
}
