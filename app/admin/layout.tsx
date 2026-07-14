import { requireStaff } from '@/lib/auth/session'
import { canAccess } from '@/lib/auth/permissions'
import { unreadAdminCount } from '@/lib/portal/notifications'
import { getAdminStats } from '@/lib/portal/dashboard'
import { ROLE_LABEL } from '@/lib/portal/labels'
import Sidebar, { type NavEntry } from '@/components/shell/Sidebar'
import Topbar from '@/components/shell/Topbar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff()
  const [unread, stats] = await Promise.all([unreadAdminCount(), getAdminStats()])

  // 要求書／カンプのサイドバー構成。実装済み=リンク、Phase2-4=soon(近日)。
  // permission matrix で権限の無い項目は出さない。
  const primary: NavEntry[] = [
    { href: '/admin/dashboard', label: 'ダッシュボード', icon: 'dashboard' },
  ]
  if (canAccess(session.role, 'members')) {
    primary.push({ href: '/admin/members', label: '加盟店管理', icon: 'store' })
    primary.push({ href: '/admin/contracts', label: '契約管理', icon: 'contract', soon: true })
    primary.push({ href: '/admin/billing', label: '請求・入金管理', icon: 'billing', soon: true })
    primary.push({ href: '/admin/funds', label: '資金管理', icon: 'billing' })
    primary.push({ href: '/admin/onboarding', label: 'オンボーディング管理', icon: 'onboarding' })
  }
  primary.push({ href: '/admin/vehicles', label: '車両進捗管理', icon: 'vehicle', soon: true })
  primary.push({ href: '/admin/orders', label: 'オーダー管理', icon: 'order' })
  primary.push({ href: '/admin/sales', label: '販売実績管理', icon: 'sales', soon: true })
  primary.push({ href: '/admin/ai', label: 'AI分析・壁打ち', icon: 'ai', soon: true })
  primary.push({ href: '/admin/chat', label: 'チャット', icon: 'chat' })
  if (canAccess(session.role, 'members')) {
    primary.push({ href: '/admin/support', label: '本部サポート', icon: 'support' })
  }
  primary.push({ href: '/admin/announcements', label: 'お知らせ配信', icon: 'announcement' })
  if (canAccess(session.role, 'crm')) {
    primary.push({ href: '/admin/crm', label: 'CRM', icon: 'crm' })
  }
  primary.push({ href: '/admin/ai-usage', label: 'AI利用状況', icon: 'aiUsage', soon: true })
  primary.push({ href: '/admin/reports', label: 'レポート', icon: 'report', soon: true })

  const settingsItems: NavEntry[] = []
  if (canAccess(session.role, 'plans')) settingsItems.push({ href: '/admin/plans', label: 'プラン管理', icon: 'settings' })
  if (canAccess(session.role, 'settings')) settingsItems.push({ href: '/admin/permissions', label: '権限管理', icon: 'settings' })
  settingsItems.push({ href: '/admin/terms', label: '利用規約設定', icon: 'contract' })
  settingsItems.push({ href: '/admin/manual', label: '実践マニュアル', icon: 'report' })
  if (canAccess(session.role, 'members')) settingsItems.push({ href: '/admin/shipping', label: '陸送費設定', icon: 'vehicle' })

  // 本日のアラート（実データ。0件の項目は表示しない）
  const alerts = [
    { label: '審査待ちの加盟店', count: stats.members.pending },
    { label: '新規オーダー（受付中）', count: stats.newOrders },
    { label: '未読チャット', count: stats.unreadChats },
  ].filter((a) => a.count > 0)

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Sidebar
        brandLabel="本部管理"
        primary={primary}
        secondary={settingsItems.length ? { label: '設定', items: settingsItems } : undefined}
        alerts={alerts}
        account={{
          company: 'カーベイ株式会社',
          name: session.name ?? session.email ?? 'ユーザー',
          roleLabel: ROLE_LABEL[session.role],
        }}
      />
      <div className="lg:pl-64">
        <Topbar
          userName={session.name ?? session.email ?? 'ユーザー'}
          roleLabel={ROLE_LABEL[session.role]}
          notificationsHref="/admin/notifications"
          unread={unread}
          showSearch
          notifyScope="admin"
          userId={session.userId}
        />
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
