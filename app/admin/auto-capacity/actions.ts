'use server'

import { revalidatePath } from 'next/cache'
import { requireFeature } from '@/lib/auth/session'
import { setAutoSetting, requestReservation, moveReservation, cancelReservation, markReservationAssigned } from '@/lib/portal/auto-trading'
import { runMonthlyMgmtFeeAll, setMgmtFeeSetting } from '@/lib/portal/mgmt-fee'
import { redirect } from 'next/navigation'

/** 月額管理手数料の設定（1枠単価・消費税率）を更新する（本部）。 */
export async function updateMgmtFeeSettingsAction(formData: FormData) {
  await requireFeature('reports')
  const unit = Number(String(formData.get('mgmt_fee_per_slot_yen') ?? '').replace(/[^\d]/g, ''))
  const taxPct = Number(String(formData.get('consumption_tax_pct') ?? '').replace(/[^\d]/g, ''))
  if (Number.isFinite(unit)) await setMgmtFeeSetting('mgmt_fee_per_slot_yen', unit)
  if (Number.isFinite(taxPct)) await setMgmtFeeSetting('consumption_tax_pct', taxPct)
  revalidatePath('/admin/auto-capacity')
  redirect('/admin/auto-capacity?msg=' + encodeURIComponent('月額管理手数料の設定を更新しました'))
}

function num(v: FormDataEntryValue | null): number {
  return Number(String(v ?? '').replace(/[^\d]/g, ''))
}

/** 全対象加盟者（上位プランの自動売買）の月額管理手数料を月次で一括実行する（本部）。 */
export async function runAllMgmtFeeAction() {
  const session = await requireFeature('reports')
  const results = await runMonthlyMgmtFeeAll(session.userId)
  const charged = results.filter((r) => r.charged)
  const gross = charged.reduce((s, r) => s + r.gross, 0)
  const invoiced = charged.reduce((s, r) => s + r.shortfall, 0)
  revalidatePath('/admin/auto-capacity')
  const msg = charged.length === 0
    ? '当月分の課金対象はありませんでした。'
    : `${charged.length}名に実行：総額${gross.toLocaleString()}円（うち不足請求${invoiced.toLocaleString()}円）`
  redirect(`/admin/auto-capacity?msg=${encodeURIComponent(msg)}`)
}

/** 全体設定（同時運用上限・最低預かり金）を更新する（本部）。 */
export async function updateAutoSettingsAction(formData: FormData) {
  await requireFeature('reports')
  const cap = num(formData.get('auto_capacity_total'))
  const minDep = num(formData.get('auto_min_deposit'))
  if (cap > 0) await setAutoSetting('auto_capacity_total', cap)
  if (minDep >= 0) await setAutoSetting('auto_min_deposit', minDep)
  revalidatePath('/admin/auto-capacity')
}

/** 本部が加盟者を受注待ちに追加する。 */
export async function addReservationAction(formData: FormData) {
  await requireFeature('reports')
  const memberId = String(formData.get('member_id') ?? '')
  if (!memberId) return
  await requestReservation(memberId, String(formData.get('note') ?? '').trim() || null)
  revalidatePath('/admin/auto-capacity')
}

/** 予約の順番を上/下へ入れ替える（本部の手動並替）。 */
export async function moveReservationAction(formData: FormData) {
  await requireFeature('reports')
  const id = String(formData.get('id') ?? '')
  const dir = String(formData.get('direction') ?? '') as 'up' | 'down'
  if (!id || (dir !== 'up' && dir !== 'down')) return
  await moveReservation(id, dir)
  revalidatePath('/admin/auto-capacity')
}

/** 予約を取消（本部）。 */
export async function cancelReservationAction(formData: FormData) {
  await requireFeature('reports')
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await cancelReservation(id)
  revalidatePath('/admin/auto-capacity')
}

/** 予約を割当済みにする（本部が起票へ進めたとき）。 */
export async function assignReservationAction(formData: FormData) {
  await requireFeature('reports')
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await markReservationAssigned(id)
  revalidatePath('/admin/auto-capacity')
}
