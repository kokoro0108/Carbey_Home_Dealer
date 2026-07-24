import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getFlowBudgets } from '@/lib/portal/budget'

/**
 * 自動売買の枠・キャパ・受注管理（⑦・docs/auto-trading-slots-design.md）。
 * フェーズ1：全体設定の取得と、加盟者ごとの「有効枠」の算出（受注可否の土台）。
 */

export type AutoSettings = {
  capacityTotal: number   // 同時運用の全体上限（既定200・拡張可）
  minDeposit: number      // 受注に必要な最低預かり金（既定100万）
}

const DEFAULTS: AutoSettings = { capacityTotal: 200, minDeposit: 1_000_000 }

/** 全体設定を取得（system_settings。未設定は既定値）。 */
export async function getAutoSettings(): Promise<AutoSettings> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('system_settings').select('key, value_int')
  const map = new Map<string, number | null>()
  for (const r of (data ?? []) as { key: string; value_int: number | null }[]) map.set(r.key, r.value_int)
  return {
    capacityTotal: map.get('auto_capacity_total') ?? DEFAULTS.capacityTotal,
    minDeposit: map.get('auto_min_deposit') ?? DEFAULTS.minDeposit,
  }
}

/** 全体設定を更新（本部）。 */
export async function setAutoSetting(key: 'auto_capacity_total' | 'auto_min_deposit', value: number): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key, value_int: Math.max(0, Math.round(value)) } as never, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

/**
 * 加盟者の「有効枠数」を算出する（フェーズ2で受注可否に使う土台）。
 *   有効枠 = min(保有枠数, floor(自動売買用の預かり金 / 1枠あたり資金))
 *   ただし 預かり金 < 最低預かり金 なら 0（ロック）。
 * ここでは autoBalance（自動売買に割り当てられた預かり金）を引数で受ける。
 * フェーズ7（予算振り分け）実装までは、暫定的に預かり金残高全体を渡す運用。
 */
export function effectiveSlots(input: {
  ownedSlots: number
  capitalPerSlot: number
  autoBalance: number
  minDeposit: number
}): number {
  if (input.autoBalance < input.minDeposit) return 0
  const byCapital = input.capitalPerSlot > 0 ? Math.floor(input.autoBalance / input.capitalPerSlot) : input.ownedSlots
  return Math.max(0, Math.min(input.ownedSlots, byCapital))
}

export const MAX_SLOTS = 10
export const SLOT_PRICE_YEN = 100_000

// ===== 受注待ち（予約・フェーズ4）=====

export type ReservationWithMember = {
  id: string
  memberId: string
  memberName: string
  companyName: string | null
  status: 'waiting' | 'assigned' | 'cancelled'
  sortOrder: number
  requestedAt: string
  note: string | null
}

/** 受注待ち（waiting）を順番（sort_order→申込順）で取得。本部の受注管理用。 */
export async function listWaitingReservations(): Promise<ReservationWithMember[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('auto_reservations')
    .select('id, member_id, status, sort_order, requested_at, note, member:members(member_name, company_name)')
    .eq('status', 'waiting')
    .order('sort_order', { ascending: true })
    .order('requested_at', { ascending: true })
  if (error) throw new Error(error.message)
  type Row = { id: string; member_id: string; status: 'waiting'; sort_order: number; requested_at: string; note: string | null; member: { member_name: string; company_name: string | null } | null }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, memberId: r.member_id, memberName: r.member?.member_name ?? '—', companyName: r.member?.company_name ?? null,
    status: r.status, sortOrder: r.sort_order, requestedAt: r.requested_at, note: r.note,
  }))
}

/** 加盟者の現在の受注待ち（自分の順番表示用）。無ければ null。 */
export async function getMemberWaitingPosition(memberId: string): Promise<{ position: number; total: number } | null> {
  const waiting = await listWaitingReservations()
  const idx = waiting.findIndex((w) => w.memberId === memberId)
  if (idx < 0) return null
  return { position: idx + 1, total: waiting.length }
}

/** 受注待ちに登録する（加盟者本人 or 本部）。既に waiting があれば重複させない。 */
export async function requestReservation(memberId: string, note?: string | null): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data: existing } = await supabase
    .from('auto_reservations')
    .select('id')
    .eq('member_id', memberId)
    .eq('status', 'waiting')
    .maybeSingle<{ id: string }>()
  if (existing) return
  // 末尾の sort_order + 10
  const { data: last } = await supabase
    .from('auto_reservations')
    .select('sort_order')
    .eq('status', 'waiting')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>()
  const sort = (last?.sort_order ?? 0) + 10
  const { error } = await supabase
    .from('auto_reservations')
    .insert({ member_id: memberId, status: 'waiting', sort_order: sort, note: note ?? null } as never)
  if (error) throw new Error(error.message)
}

/** 予約の順番を1つ上/下へ入れ替える（本部の手動並替）。 */
export async function moveReservation(id: string, direction: 'up' | 'down'): Promise<void> {
  const waiting = await listWaitingReservations()
  const idx = waiting.findIndex((w) => w.id === id)
  if (idx < 0) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= waiting.length) return
  const a = waiting[idx]
  const b = waiting[swapIdx]
  const supabase = createServiceRoleClient()
  // sort_order を入れ替え（同値なら a を b の前後にずらす）
  const aSort = a.sortOrder
  const bSort = b.sortOrder === a.sortOrder ? (direction === 'up' ? a.sortOrder - 1 : a.sortOrder + 1) : b.sortOrder
  await supabase.from('auto_reservations').update({ sort_order: bSort } as never).eq('id', a.id)
  await supabase.from('auto_reservations').update({ sort_order: aSort } as never).eq('id', b.id)
}

/** 予約を取消（本部）。 */
export async function cancelReservation(id: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('auto_reservations').update({ status: 'cancelled' } as never).eq('id', id)
  if (error) throw new Error(error.message)
}

/** 予約を「割当済み」にする（本部が起票へ進めたとき）。 */
export async function markReservationAssigned(id: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('auto_reservations')
    .update({ status: 'assigned', assigned_at: new Date().toISOString() } as never)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** 清算後などに「次に割り当てるべき予約」（先頭の waiting）を返す。無ければ null。 */
export async function nextWaitingReservation(): Promise<ReservationWithMember | null> {
  const waiting = await listWaitingReservations()
  return waiting[0] ?? null
}

/** 自動売買の「稼働中」ステージ（キャパ・枠を消費）。清算済み(sold)は対象外（確定ルール）。 */
const ACTIVE_STAGES = ['sourcing', 'prepping', 'listing'] as const

/** 全体の稼働台数（自動売買・仕入れ中〜販売中）と残キャパ。 */
export async function getGlobalAutoCapacity(): Promise<{ active: number; total: number; available: number }> {
  const supabase = createServiceRoleClient()
  const settings = await getAutoSettings()
  const { count } = await supabase
    .from('vehicle_deals')
    .select('id', { count: 'exact', head: true })
    .eq('flow', 'auto')
    .in('status', ACTIVE_STAGES as unknown as string[])
  const active = count ?? 0
  return { active, total: settings.capacityTotal, available: Math.max(0, settings.capacityTotal - active) }
}

export type MemberAutoCapacity = {
  ownedSlots: number
  capitalPerSlot: number
  autoBalance: number         // 自動売買に使える預かり金（暫定：残高全体・フェーズ7で振り分け対応）
  minDeposit: number
  depositLocked: boolean      // 預かり金 < 最低額 でロック
  effectiveSlots: number      // 有効枠 = min(保有枠, 資金/1枠資金)
  activeCount: number         // この加盟者の稼働中の自動売買案件数
  availableSlots: number      // 空き枠 = 有効枠 − 稼働
  globalActive: number
  globalTotal: number
  globalAvailable: number
  canAccept: boolean          // 受注可否
  blockReason?: string
}

/** ユーザーIDから自分の自動売買キャパを取得（加盟店側）。auto権限が無ければ null。 */
export async function getOwnAutoCapacity(userId: string): Promise<MemberAutoCapacity | null> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase
    .from('members')
    .select('id, grant_auto')
    .eq('user_id', userId)
    .maybeSingle<{ id: string; grant_auto: boolean }>()
  if (!member || !member.grant_auto) return null
  return getMemberAutoCapacity(member.id)
}

export type MemberAutoRow = {
  memberId: string
  memberName: string
  companyName: string | null
  ownedSlots: number
  effectiveSlots: number
  activeCount: number
  availableSlots: number
  autoBalance: number
  canAccept: boolean
}

/** 本部：自動売買権限を持つ全加盟者の枠・稼働・空きの一覧（キャパ管理ダッシュボード用）。 */
export async function listAutoMembers(): Promise<MemberAutoRow[]> {
  const supabase = createServiceRoleClient()
  const { data: members } = await supabase
    .from('members')
    .select('id, member_name, company_name')
    .eq('grant_auto', true)
    .order('member_name', { ascending: true })
  const rows = (members ?? []) as { id: string; member_name: string; company_name: string | null }[]
  const caps = await Promise.all(rows.map((m) => getMemberAutoCapacity(m.id)))
  return rows.map((m, i) => ({
    memberId: m.id,
    memberName: m.member_name,
    companyName: m.company_name,
    ownedSlots: caps[i].ownedSlots,
    effectiveSlots: caps[i].effectiveSlots,
    activeCount: caps[i].activeCount,
    availableSlots: caps[i].availableSlots,
    autoBalance: caps[i].autoBalance,
    canAccept: caps[i].canAccept,
  }))
}

/**
 * 加盟者の自動売買 受注可否を算出する（フェーズ2）。
 * 受注可 = 空き枠あり かつ 全体キャパに空き かつ 預かり金ロックなし。
 */
export async function getMemberAutoCapacity(memberId: string): Promise<MemberAutoCapacity> {
  const supabase = createServiceRoleClient()
  const [settings, global] = await Promise.all([getAutoSettings(), getGlobalAutoCapacity()])

  const { data: m } = await supabase
    .from('members')
    .select('auto_slots, capital_per_slot_yen')
    .eq('id', memberId)
    .maybeSingle<{ auto_slots: number; capital_per_slot_yen: number }>()
  const ownedSlots = m?.auto_slots ?? 0
  const capitalPerSlot = m?.capital_per_slot_yen ?? 4_000_000

  // フェーズ7：両フロー保有者は自動売買用の割当額で判定（単独フローは預かり残高全額）。
  const budgets = await getFlowBudgets(memberId)
  const autoBalance = budgets.autoBudget

  const { count } = await supabase
    .from('vehicle_deals')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('flow', 'auto')
    .in('status', ACTIVE_STAGES as unknown as string[])
  const activeCount = count ?? 0

  const depositLocked = autoBalance < settings.minDeposit
  const eff = effectiveSlots({ ownedSlots, capitalPerSlot, autoBalance, minDeposit: settings.minDeposit })
  const availableSlots = Math.max(0, eff - activeCount)

  let blockReason: string | undefined
  if (depositLocked) blockReason = `預かり金が最低額（${settings.minDeposit.toLocaleString()}円）に満たないため受注できません`
  else if (availableSlots <= 0) blockReason = `空き枠がありません（有効枠 ${eff} / 稼働 ${activeCount}）`
  else if (global.available <= 0) blockReason = `全体の運用上限（${global.total}台）に達しています`

  return {
    ownedSlots, capitalPerSlot, autoBalance, minDeposit: settings.minDeposit,
    depositLocked, effectiveSlots: eff, activeCount, availableSlots,
    globalActive: global.active, globalTotal: global.total, globalAvailable: global.available,
    canAccept: !blockReason, blockReason,
  }
}
