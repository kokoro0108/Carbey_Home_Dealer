import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { listConversations } from '@/lib/portal/chat'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function AdminChatPage() {
  await requireFeature('chat')
  const conversations = await listConversations()
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">チャット</h1>
        <p className="text-sm text-slate-500">
          加盟店との個別連絡{totalUnread > 0 ? `（未読 ${totalUnread} 件）` : ''}
        </p>
      </div>

      <Card>
        <ul className="divide-y divide-slate-100">
          {conversations.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-slate-400">
              <MessageSquare className="mx-auto mb-2 h-6 w-6 text-slate-300" />
              まだ会話がありません。加盟店からのメッセージがここに表示されます。
            </li>
          )}
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/chat/${c.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                  {(c.company_name ?? c.member_name).charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-slate-900">{c.company_name ?? c.member_name}</span>
                    {c.last_message_at && (
                      <span className="text-[11px] text-slate-400">
                        {new Date(c.last_message_at).toLocaleDateString('ja-JP')}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-slate-500">{c.last_body ?? 'メッセージはありません'}</div>
                </div>
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">
                    {c.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
