import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireFeature, getSessionUser } from '@/lib/auth/session'
import { getConversationById, listMessages, markRead } from '@/lib/portal/chat'
import ChatThread from '@/components/chat/ChatThread'

export const dynamic = 'force-dynamic'

export default async function AdminChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature('chat')
  const session = await getSessionUser()
  const { id } = await params

  const conv = await getConversationById(id)
  if (!conv || !session) notFound()

  const messages = await listMessages(id)
  await markRead(id, true)

  return (
    <div className="space-y-4">
      <Link href="/admin/chat" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> チャット一覧へ
      </Link>
      <div>
        <h1 className="text-xl font-bold text-slate-900">{conv.company_name ?? conv.member_name}</h1>
        <p className="text-sm text-slate-500">加盟店とのチャット</p>
      </div>
      <ChatThread
        conversationId={id}
        initialMessages={messages}
        currentUserId={session.userId}
        isStaffViewer
      />
    </div>
  )
}
