'use server'

import { revalidatePath } from 'next/cache'
import { requireFeature } from '@/lib/auth/session'
import { addLedgerEntry, deleteLedgerEntry } from '@/lib/portal/ledger'
import type { LedgerEntryKind } from '@/types/database'

const KINDS: LedgerEntryKind[] = ['deposit', 'withdraw', 'settlement', 'adjust']

/** 本部が預かり金の入出金を登録する。 */
export async function addLedgerEntryAction(formData: FormData) {
  const session = await requireFeature('members')
  const memberId = String(formData.get('member_id') ?? '')
  const kind = String(formData.get('kind') ?? '') as LedgerEntryKind
  const amount = Number(String(formData.get('amount') ?? '').replace(/[^\d]/g, ''))
  const note = String(formData.get('note') ?? '').trim() || null
  if (!memberId || !KINDS.includes(kind) || !amount || amount <= 0) return

  await addLedgerEntry({ memberId, kind, amount, note, createdBy: session.userId })
  revalidatePath(`/admin/members/${memberId}`)
}

/** 本部が誤登録の明細を取り消す。 */
export async function deleteLedgerEntryAction(formData: FormData) {
  await requireFeature('members')
  const id = String(formData.get('id') ?? '')
  const memberId = String(formData.get('member_id') ?? '')
  if (!id) return
  await deleteLedgerEntry(id)
  revalidatePath(`/admin/members/${memberId}`)
}
