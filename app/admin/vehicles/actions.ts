'use server'

import { revalidatePath } from 'next/cache'
import { requireFeature } from '@/lib/auth/session'
import { createManualDeal, moveToPrepping, moveToListing, recordSale } from '@/lib/portal/deals'

function num(v: FormDataEntryValue | null): number {
  return Number(String(v ?? '').replace(/[^\d]/g, ''))
}

/** 本部が全自動フローの車両案件を起票する。 */
export async function createDealAction(formData: FormData) {
  await requireFeature('reports')
  const memberId = String(formData.get('member_id') ?? '')
  if (!memberId) return
  await createManualDeal({
    memberId,
    maker: String(formData.get('maker') ?? '').trim() || null,
    carModel: String(formData.get('car_model') ?? '').trim() || null,
    year: String(formData.get('year') ?? '').trim() || null,
    orderAmountYen: num(formData.get('order_amount')) || null,
  })
  revalidatePath('/admin/vehicles')
}

/** 商品化中へ。 */
export async function dealToPreppingAction(formData: FormData) {
  const session = await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return
  await moveToPrepping(dealId, session.userId, true)
  revalidatePath('/admin/vehicles')
}

/** 販売中へ（全自動）。 */
export async function dealToListingAction(formData: FormData) {
  const session = await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  if (!dealId) return
  await moveToListing(dealId, session.userId, true)
  revalidatePath('/admin/vehicles')
}

/** 販売実績を記録して売却済みに（本部）。 */
export async function recordSaleAction(formData: FormData) {
  const session = await requireFeature('reports')
  const dealId = String(formData.get('deal_id') ?? '')
  const salePriceYen = num(formData.get('sale_price'))
  const soldAt = String(formData.get('sold_at') ?? '').trim() || null
  if (!dealId || !salePriceYen) return
  await recordSale(dealId, { salePriceYen, soldAt }, session.userId, true)
  revalidatePath('/admin/vehicles')
  revalidatePath('/admin/sales')
}
