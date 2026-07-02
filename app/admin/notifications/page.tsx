import { Bell } from 'lucide-react'
import { requireStaff } from '@/lib/auth/session'
import { listAdminNotifications } from '@/lib/portal/notifications'
import MarkAllReadButton from './MarkAllReadButton'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  member_registered: '会員登録',
  payment_confirmed: '入金確認',
  order: 'オーダー',
  chat: 'チャット',
  info: 'お知らせ',
}

export default async function NotificationsPage() {
  await requireStaff()
  const items = await listAdminNotifications(50)
  const hasUnread = items.some((n) => !n.is_read)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">通知</h1>
        {hasUnread && <MarkAllReadButton />}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-slate-400">
            <Bell className="h-8 w-8" />
            <span className="text-sm">通知はありません。</span>
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {items.map((n) => (
            <li key={n.id} className={`flex gap-3 px-4 py-3 ${n.is_read ? '' : 'bg-brand-50/40'}`}>
              {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
              <div className={n.is_read ? 'ml-5 flex-1' : 'flex-1'}>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    {KIND_LABEL[n.kind] ?? n.kind}
                  </span>
                  <span className="font-medium text-slate-900">{n.title}</span>
                </div>
                {n.message && <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>}
                <div className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString('ja-JP')}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
