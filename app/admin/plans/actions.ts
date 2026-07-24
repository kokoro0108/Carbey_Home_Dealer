'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/session'
import { createPlan, updatePlan } from '@/lib/portal/plans'
import type { PlanType } from '@/types/database'

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}
function num(v: FormDataEntryValue | null): number {
  const s = str(v)
  return s == null ? 0 : Number(s)
}
function features(v: FormDataEntryValue | null): string[] {
  const s = str(v)
  if (!s) return []
  return s.split('\n').map((x) => x.trim()).filter(Boolean)
}

/**
 * レビュー⑫：半自動・全自動は「どちらか一方」ではなく、それぞれ独立に割り当てる。
 * plan_type は旧来の区分表示のために残っており、保有モデルから導出する
 * （全自動を含む→full_auto／半自動のみ→semi_auto）。真実は has_semi / has_auto。
 */
function derivePlanType(hasSemi: boolean, hasAuto: boolean): PlanType {
  return hasAuto ? 'full_auto' : 'semi_auto'
}

export async function createPlanAction(formData: FormData) {
  await requireAdmin()
  const code = str(formData.get('code'))
  const name = str(formData.get('name'))
  if (!code || !name) redirect('/admin/plans/new?error=required')

  // ⑫ 保有モデルは個別に割り当て（両方可）。最低1つは必要。
  const has_semi = formData.get('has_semi') === 'on'
  const has_auto = formData.get('has_auto') === 'on'
  if (!has_semi && !has_auto) redirect('/admin/plans/new?error=model_required')

  await createPlan({
    code,
    name,
    plan_type: derivePlanType(has_semi, has_auto),
    has_semi,
    has_auto,
    monthly_fee_yen: num(formData.get('monthly_fee_yen')),
    default_auto_slots: num(formData.get('default_auto_slots')),
    mgmt_fee_monthly_yen: num(formData.get('mgmt_fee_monthly_yen')),
    joining_fee_yen: num(formData.get('joining_fee_yen')),
    display_order: num(formData.get('display_order')),
    description: str(formData.get('description')),
    features: features(formData.get('features')),
    is_active: formData.get('is_active') === 'on',
  })
  revalidatePath('/admin/plans')
  redirect('/admin/plans')
}

export async function updatePlanAction(formData: FormData) {
  await requireAdmin()
  const id = str(formData.get('id'))
  if (!id) redirect('/admin/plans')

  const has_semi = formData.get('has_semi') === 'on'
  const has_auto = formData.get('has_auto') === 'on'
  if (!has_semi && !has_auto) redirect('/admin/plans?error=model_required')

  await updatePlan(id, {
    name: str(formData.get('name')) ?? undefined,
    // plan_type は保有モデルから導出し、常に整合させる
    plan_type: derivePlanType(has_semi, has_auto),
    has_semi,
    has_auto,
    monthly_fee_yen: num(formData.get('monthly_fee_yen')),
    default_auto_slots: num(formData.get('default_auto_slots')),
    mgmt_fee_monthly_yen: num(formData.get('mgmt_fee_monthly_yen')),
    joining_fee_yen: num(formData.get('joining_fee_yen')),
    display_order: num(formData.get('display_order')),
    description: str(formData.get('description')),
    features: features(formData.get('features')),
    is_active: formData.get('is_active') === 'on',
  })
  revalidatePath('/admin/plans')
  redirect('/admin/plans')
}
