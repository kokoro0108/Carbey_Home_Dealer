import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { MemberRow, MemberInsert, PaymentRow, PlanRow } from '@/types/database'

/**
 * 会員(加盟店)データアクセス。本部管理画面用。
 * 呼び出し側で requireStaff 済みであること (service-role は RLS バイパス)。
 */

export type MemberWithPlan = MemberRow & { plan: Pick<PlanRow, 'code' | 'name' | 'default_auto_slots'> | null }

export type MemberFilter = {
  q?: string // name/email/company 部分一致
  status?: string
  plan_id?: string
}

export async function listMembers(filter: MemberFilter = {}): Promise<MemberWithPlan[]> {
  const supabase = createServiceRoleClient()
  let query = supabase
    .from('members')
    .select('*, plan:plans(code, name, default_auto_slots)')
    .order('created_at', { ascending: false })

  if (filter.status) query = query.eq('status', filter.status)
  if (filter.plan_id) query = query.eq('plan_id', filter.plan_id)
  if (filter.q) {
    const q = `%${filter.q}%`
    query = query.or(`member_name.ilike.${q},email.ilike.${q},company_name.ilike.${q}`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as MemberWithPlan[]
}

export async function getMember(id: string): Promise<MemberWithPlan | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('members')
    .select('*, plan:plans(code, name, default_auto_slots)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as MemberWithPlan) ?? null
}

/**
 * 同じメールアドレスの会員が既に存在するか（1メール=1会員のため重複を防ぐ）。
 * excludeId を渡すと自分自身は除外（編集時に使用）。大文字小文字は無視。
 */
export async function findMemberByEmail(email: string, excludeId?: string): Promise<{ id: string; member_name: string } | null> {
  const supabase = createServiceRoleClient()
  let query = supabase
    .from('members')
    .select('id, member_name')
    .ilike('email', email)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query.limit(1).maybeSingle<{ id: string; member_name: string }>()
  if (error) throw new Error(error.message)
  return data ?? null
}

export async function createMember(input: MemberInsert): Promise<MemberRow> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('members')
    .insert(input as never)
    .select('*')
    .single<MemberRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function updateMember(id: string, patch: Partial<MemberInsert>): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('members').update(patch as never).eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * 加盟店本人による自己更新。user_id でスコープし、本人の行のみ更新する。
 * 呼び出し側で連絡先系フィールドのみに patch を絞ること (契約・財務・ステータスは本部専用)。
 */
export async function updateOwnMember(userId: string, patch: Partial<MemberInsert>): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('members').update(patch as never).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function listPayments(memberId: string): Promise<PaymentRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('member_id', memberId)
    .order('payment_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PaymentRow[]
}

/** member.user_id から自分の会員レコードを取得 (member 側ダッシュボード用)。 */
export async function getMemberByUserId(userId: string): Promise<MemberWithPlan | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('members')
    .select('*, plan:plans(code, name, default_auto_slots)')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as MemberWithPlan) ?? null
}
