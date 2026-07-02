'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireFeature } from '@/lib/auth/session'
import { updateOrderStatus } from '@/lib/portal/orders'
import type { OrderStatus } from '@/types/database'

const STATUSES: OrderStatus[] = ['received', 'in_progress', 'completed', 'cancelled']

/** オーダーのステータスを変更する（本部）。 */
export async function setOrderStatusAction(formData: FormData) {
  await requireFeature('orders')
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '') as OrderStatus
  if (!id || !STATUSES.includes(status)) redirect('/admin/orders')

  await updateOrderStatus(id, status)
  revalidatePath('/admin/orders')
  redirect('/admin/orders')
}
