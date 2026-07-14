'use server'

import { revalidatePath } from 'next/cache'
import { requireFeature } from '@/lib/auth/session'
import { setShippingRate, deleteShippingRate, addSpecialMaker, deleteSpecialMaker } from '@/lib/portal/shipping'
import { isPrefecture } from '@/lib/portal/prefectures'

/** 陸送費（発地×着地）を設定。 */
export async function setRateAction(formData: FormData) {
  await requireFeature('members')
  const from = String(formData.get('from_pref') ?? '')
  const to = String(formData.get('to_pref') ?? '')
  const amount = Number(String(formData.get('amount') ?? '').replace(/[^\d]/g, ''))
  if (!isPrefecture(from) || !isPrefecture(to) || !amount || amount < 0) {
    return
  }
  await setShippingRate(from, to, amount)
  revalidatePath('/admin/shipping')
}

/** 料金設定を削除。 */
export async function deleteRateAction(formData: FormData) {
  await requireFeature('members')
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await deleteShippingRate(id)
  revalidatePath('/admin/shipping')
}

/** 特殊車メーカーを追加。 */
export async function addMakerAction(formData: FormData) {
  await requireFeature('members')
  const maker = String(formData.get('maker') ?? '').trim()
  if (!maker) return
  await addSpecialMaker(maker)
  revalidatePath('/admin/shipping')
}

/** 特殊車メーカーを削除。 */
export async function deleteMakerAction(formData: FormData) {
  await requireFeature('members')
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await deleteSpecialMaker(id)
  revalidatePath('/admin/shipping')
}
