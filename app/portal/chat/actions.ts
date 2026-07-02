'use server'

import { revalidatePath } from 'next/cache'
import { requireSession, isStaff } from '@/lib/auth/session'
import {
  getOwnConversation,
  getOrCreateConversation,
  sendMessage,
  markRead,
  uploadAttachment,
  editMessage,
  deleteMessage,
  searchMessages,
  type Attachment,
} from '@/lib/portal/chat'
import { markAllAdminRead, markAllUserRead } from '@/lib/portal/notifications'
import type { ChatMessageRow } from '@/types/database'

// 許可する MIME と上限
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]

/**
 * メッセージ送信（本部・加盟店 共通）。本文・ファイルいずれか、または両方。
 * conversation_id があれば本部、無ければ加盟店として自分の会話に送る。
 */
export async function sendChatMessageAction(formData: FormData) {
  const session = await requireSession()
  const body = String(formData.get('body') ?? '').trim()
  const conversationIdInput = String(formData.get('conversation_id') ?? '')
  const file = formData.get('file')
  const hasFile = file instanceof File && file.size > 0
  if (!body && !hasFile) return

  let conversationId = conversationIdInput
  if (!conversationId) {
    const own = await getOwnConversation(session.userId)
    if (!own) return
    conversationId = own.conversationId
  } else if (!isStaff(session.role)) {
    // 加盟店が他人の会話IDを指定してくるのを防ぐ：自分の会話に強制
    const own = await getOwnConversation(session.userId)
    if (!own || own.conversationId !== conversationId) return
  }

  let attachment: Attachment | null = null
  if (hasFile) {
    const f = file as File
    if (f.size > MAX_SIZE) throw new Error('ファイルサイズは10MBまでです。')
    if (!ALLOWED_TYPES.includes(f.type)) throw new Error('この形式のファイルは送信できません。')
    const buffer = await f.arrayBuffer()
    attachment = await uploadAttachment(conversationId, { buffer, name: f.name, type: f.type, size: f.size })
  }

  await sendMessage(conversationId, session.userId, session.role, body || null, attachment)

  if (isStaff(session.role)) {
    revalidatePath(`/admin/chat/${conversationId}`)
    revalidatePath('/admin/chat')
  } else {
    revalidatePath('/portal/chat')
  }
}

/** 会話を既読にする（相手の発言）。 */
export async function markReadAction(conversationId: string) {
  const session = await requireSession()
  await markRead(conversationId, isStaff(session.role))
}

/** 本部：member_id から会話を取得 or 作成して ID を返す。 */
export async function ensureConversationAction(memberId: string): Promise<string> {
  await requireSession()
  return getOrCreateConversation(memberId)
}

/** メッセージを編集する（本人のみ）。 */
export async function editMessageAction(messageId: string, body: string): Promise<{ ok: boolean }> {
  const session = await requireSession()
  const text = body.trim()
  if (!text) return { ok: false }
  await editMessage(messageId, session.userId, text)
  return { ok: true }
}

/** メッセージを削除する（本人のみ）。 */
export async function deleteMessageAction(messageId: string): Promise<{ ok: boolean }> {
  const session = await requireSession()
  await deleteMessage(messageId, session.userId)
  return { ok: true }
}

/** 会話内メッセージを検索する。 */
export async function searchMessagesAction(conversationId: string, query: string): Promise<ChatMessageRow[]> {
  await requireSession()
  if (!query.trim()) return []
  return searchMessages(conversationId, query.trim())
}

/**
 * チャットを開いている間、自分宛てのチャット通知を既読化する。
 * 本部＝audience='admin'、加盟店＝自分の user_id 宛て。
 * バッジをどの scope で 0 にすればよいかを返す。
 */
export async function markChatNotificationsReadAction(): Promise<{ scope: 'admin' | 'user' }> {
  const session = await requireSession()
  if (isStaff(session.role)) {
    await markAllAdminRead()
    return { scope: 'admin' }
  }
  await markAllUserRead(session.userId)
  return { scope: 'user' }
}
