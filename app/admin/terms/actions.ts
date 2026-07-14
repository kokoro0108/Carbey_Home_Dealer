'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/lib/auth/session'
import { saveAgreement, deleteAgreement, saveAttachment, deleteAttachment } from '@/lib/portal/agreements'

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** 別添（各種料金表）を保存（新規/更新）。 */
export async function saveAttachmentAction(formData: FormData) {
  await requireStaff()
  const id = str(formData.get('id')) || undefined
  const agreementId = str(formData.get('agreement_id'))
  const title = str(formData.get('title'))
  const body = str(formData.get('body'))
  if (!agreementId || !title) redirect('/admin/terms?error=attach_required')
  await saveAttachment({ id, agreementId, title, body })
  revalidatePath('/admin/terms')
  revalidatePath('/portal/terms')
  redirect('/admin/terms?saved=1')
}

/** 別添（各種料金表）を削除。 */
export async function deleteAttachmentAction(formData: FormData) {
  await requireStaff()
  const id = str(formData.get('id'))
  if (!id) redirect('/admin/terms')
  await deleteAttachment(id)
  revalidatePath('/admin/terms')
  revalidatePath('/portal/terms')
  redirect('/admin/terms?saved=1')
}

/** 利用規約を保存（新規/更新）。 */
export async function saveAgreementAction(formData: FormData) {
  const session = await requireStaff()
  const id = str(formData.get('id')) || undefined
  const title = str(formData.get('title'))
  const body = str(formData.get('body'))
  const published = formData.get('published') === 'on'
  if (!title || !body) redirect('/admin/terms?error=required')

  await saveAgreement({ id, title, body, published, authorId: session.userId })
  revalidatePath('/admin/terms')
  revalidatePath('/portal/terms')
  redirect('/admin/terms?saved=1')
}

/** 利用規約を削除。 */
export async function deleteAgreementAction(formData: FormData) {
  await requireStaff()
  const id = str(formData.get('id'))
  if (!id) redirect('/admin/terms')
  await deleteAgreement(id)
  revalidatePath('/admin/terms')
  redirect('/admin/terms')
}
