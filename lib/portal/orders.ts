import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { OrderRow, OrderStatus } from '@/types/database'

export type OrderWithMember = OrderRow & {
  member: { id: string; member_name: string; company_name: string | null } | null
}

/** 全オーダー（本部）。加盟店名を結合。 */
export async function listOrders(status?: OrderStatus): Promise<OrderWithMember[]> {
  const supabase = createServiceRoleClient()
  let q = supabase
    .from('orders')
    .select('*, member:members(id, member_name, company_name)')
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as OrderWithMember[]
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
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>()
  if (!member) throw new Error('会員情報が紐付いていません')

  const { data, error } = await supabase
    .from('orders')
    .insert({ ...input, member_id: member.id } as never)
    .select('*')
    .single<OrderRow>()
  if (error) throw new Error(error.message)
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
