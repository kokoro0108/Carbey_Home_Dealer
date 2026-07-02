import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { NotificationRow } from '@/types/database'

/** admin/staff 宛て通知 (audience='admin') を取得。 */
export async function listAdminNotifications(limit = 20): Promise<NotificationRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('audience', 'admin')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as NotificationRow[]
}

/** 特定ユーザー宛て通知。 */
export async function listUserNotifications(userId: string, limit = 20): Promise<NotificationRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as NotificationRow[]
}

export async function unreadAdminCount(): Promise<number> {
  const supabase = createServiceRoleClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('audience', 'admin')
    .eq('is_read', false)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function markAllAdminRead(): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true } as never)
    .eq('audience', 'admin')
    .eq('is_read', false)
  if (error) throw new Error(error.message)
}

/** 特定ユーザー宛て通知の未読数（加盟店の通知ベル用）。 */
export async function unreadUserCount(userId: string): Promise<number> {
  const supabase = createServiceRoleClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** 特定ユーザー宛て通知をすべて既読化。 */
export async function markAllUserRead(userId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true } as never)
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw new Error(error.message)
}

/** 通知を作成 (新規会員登録・入金確認など)。 */
export async function notifyAdmin(kind: string, title: string, message?: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('notifications')
    .insert({ audience: 'admin', kind, title, message: message ?? null } as never)
  if (error) throw new Error(error.message)
}
