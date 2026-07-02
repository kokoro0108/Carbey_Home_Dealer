import { requireStaff } from '@/lib/auth/session'
import { canAccess } from '@/lib/auth/permissions'
import { unreadAdminCount } from '@/lib/portal/notifications'
import { ROLE_LABEL } from '@/lib/portal/labels'
import Sidebar, { type NavEntry } from '@/components/shell/Sidebar'
import Topbar from '@/components/shell/Topbar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff()
  const unread = await unreadAdminCount()

  // 要求書／カンプのサイドバー構成。実装済み=リンク、Phase2-4=soon(近日)。
  // permission matrix で権限の無い項目は出さない。
  const primary: NavEntry[] = [
    { href: '/admin/dashboard', label: 'ダッシュボード', icon: 'dashboard' },
  ]
  if (canAccess(session.role, 'members')) {
    primary.push({ href: '/admin/members', label: '加盟店管理', icon: 'store' })
    primary.push({ href: '/admin/contracts', label: '契約管理', icon: 'contract', soon: true })
    primary.push({ href: '/admin/billing', label: '請求・入金管理', icon: 'billing', soon: true })
    primary.push({ href: '/admin/onboarding', label: 'オンボーディング管理', icon: 'onboarding' })
  }
  primary.push({ href: '/admin/vehicles', label: '車両進捗管理', icon: 'vehicle', soon: true })
  primary.push({ href: '/admin/orders', label: 'オーダー管理', icon: 'order' })
  primary.push({ href: '/admin/sales', label: '販売実績管理', icon: 'sales', soon: true })
  primary.push({ href: '/admin/ai', label: 'AI分析・壁打ち', icon: 'ai', soon: true })
  primary.push({ href: '/admin/chat', label: 'チャット', icon: 'chat' })
  if (canAccess(session.role, 'crm')) {
    primary.push({ href: '/admin/crm', label: 'CRM', icon: 'crm' })
  }
  primary.push({ href: '/admin/ai-usage', label: 'AI利用状況', icon: 'aiUsage', soon: true })
  primary.push({ href: '/admin/reports', label: 'レポート', icon: 'report', soon: true })

  const settingsItems: NavEntry[] = []
  if (canAccess(session.role, 'plans')) settingsItems.push({ href: '/admin/plans', label: 'プラン管理', icon: 'settings' })
  if (canAccess(session.role, 'settings')) settingsItems.push({ href: '/admin/permissions', label: '権限管理', icon: 'settings' })
  settingsItems.push({ href: '/admin/support', label: 'サポート', icon: 'support', soon: true })

  // 本日のアラート (Phase 2 で実データ化。現状はカンプ準拠のダミー)
  const alerts = [
    { label: 'オンボーディング未完了', count: 12 },
    { label: '未入金の請求書', count: 8 },
    { label: '車両報告の遅延', count: 5 },
  ]

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
