import { requireMember } from '@/lib/auth/session'
import { ROLE_LABEL } from '@/lib/portal/labels'
import { unreadUserCount } from '@/lib/portal/notifications'
import Sidebar, { type NavEntry } from '@/components/shell/Sidebar'
import Topbar from '@/components/shell/Topbar'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireMember()
  const unread = await unreadUserCount(session.userId)

  // 加盟店向けナビ (要求書 5.4 加盟店ダッシュボード周辺)。Phase2-4 は soon。
  const primary: NavEntry[] = [
    { href: '/portal/dashboard', label: 'ダッシュボード', icon: 'dashboard' },
    { href: '/portal/onboarding', label: 'スタートアップ', icon: 'onboarding' },
    { href: '/portal/vehicles', label: '車両進捗', icon: 'vehicle', soon: true },
    { href: '/portal/orders', label: '仕入れオーダー', icon: 'order' },
    { href: '/portal/reports', label: '販売実績', icon: 'report', soon: true },
    { href: '/portal/ai', label: 'AI 壁打ち', icon: 'ai', soon: true },
    { href: '/portal/chat', label: 'チャット', icon: 'chat' },
    { href: '/portal/profile', label: 'プロフィール', icon: 'store' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar brandLabel="加盟店" primary={primary} />
      <div className="lg:pl-64">
        <Topbar
          userName={session.name ?? session.email ?? 'ユーザー'}
          roleLabel={ROLE_LABEL[session.role]}
          notificationsHref="/portal/chat"
          unread={unread}
          notifyScope="user"
          userId={session.userId}
        />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
