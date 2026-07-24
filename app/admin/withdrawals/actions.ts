'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireFeature } from '@/lib/auth/session'
import { approveWithdrawal, rejectWithdrawal, markWithdrawalPaid } from '@/lib/portal/withdrawal'

function back(msg?: string, error?: string) {
  const q = error ? `?error=${encodeURIComponent(error)}` : msg ? `?msg=${encodeURIComponent(msg)}` : ''
  redirect(`/admin/withdrawals${q}`)
}

/** 出金申請を承認する（振込待ちへ）。 */
export async function approveWithdrawalAction(formData: FormData) {
  const session = await requireFeature('members')
  const id = String(formData.get('id') ?? '')
  if (!id) return
  try {
    await approveWithdrawal(id, session.userId)
    revalidatePath('/admin/withdrawals')
  } catch (e) {
    if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e
    back(undefined, e instanceof Error ? e.message : '承認に失敗しました')
  }
  back('出金申請を承認しました（振込待ち）')
}

/** 出金申請を却下する。 */
export async function rejectWithdrawalAction(formData: FormData) {
  const session = await requireFeature('members')
  const id = String(formData.get('id') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  if (!id) return
  try {
    await rejectWithdrawal(id, session.userId, reason)
    revalidatePath('/admin/withdrawals')
  } catch (e) {
    if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e
    back(undefined, e instanceof Error ? e.message : '却下に失敗しました')
  }
  back('出金申請を却下しました')
}

/** 振込完了を記録する（預かり金から減算）。 */
export async function markPaidAction(formData: FormData) {
  const session = await requireFeature('members')
  const id = String(formData.get('id') ?? '')
  if (!id) return
  try {
    await markWithdrawalPaid(id, session.userId)
    revalidatePath('/admin/withdrawals')
  } catch (e) {
    if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e
    back(undefined, e instanceof Error ? e.message : '振込完了の記録に失敗しました')
  }
  back('振込完了を記録し、預かり金から差し引きました')
}
