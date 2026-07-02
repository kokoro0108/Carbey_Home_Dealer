'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth/session'
import { createOwnOrder } from '@/lib/portal/orders'

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}
function num(v: FormDataEntryValue | null): number | null {
  const s = str(v)
  return s == null ? null : Number(s)
}

/** 加盟店が自分の仕入れオーダーを作成する。 */
export async function createOrderAction(formData: FormData) {
  const session = await requireMember()
  const car_model = str(formData.get('car_model'))
  if (!car_model) redirect('/portal/orders?error=model_required')

  await createOwnOrder(session.userId, {
    maker: str(formData.get('maker')),
    car_model: car_model!,
    year: str(formData.get('year')),
    budget_yen: num(formData.get('budget_yen')),
    preferred_color: str(formData.get('preferred_color')),
    mileage_max: num(formData.get('mileage_max')),
    notes: str(formData.get('notes')),
  })

  revalidatePath('/portal/orders')
  redirect('/portal/orders?created=1')
}
