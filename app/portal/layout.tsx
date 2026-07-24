import { requireMember } from '@/lib/auth/session'
import { getMemberByUserId } from '@/lib/portal/members'
import { unreadUserCount } from '@/lib/portal/notifications'
import { MEMBER_STATUS_LABEL } from '@/lib/portal/labels'
import PortalSidebar, { type PortalNavEntry } from '@/components/portal-dark/PortalSidebar'
import PortalTopbar from '@/components/portal-dark/PortalTopbar'
import type { MemberStatus } from '@/types/database'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireMember()
  const [member, unread] = await Promise.all([
    getMemberByUserId(session.userId),
    unreadUserCount(session.userId),
  ])

  // カンプ準拠のナビ。Phase 3/4 の未実装は soon。
  const nav: PortalNavEntry[] = [
    { href: '/portal/onboarding', label: 'オンボーディング', icon: 'onboarding' },
    { href: '/portal/dashboard', label: 'ダッシュボード', icon: 'dashboard' },
    { href: '/portal/vehicles', label: '車両管理', icon: 'vehicle', soon: true },
    { href: '/portal/orders', label: 'オーダー管理', icon: 'order' },
    // 自動売買（フェーズ8）：権限を持つ加盟者のみ表示
    ...(member?.grant_auto ? [{ href: '/portal/auto', label: '自動売買', icon: 'auto' as const }] : []),
    { href: '/portal/training', label: 'トレーニング', icon: 'training' },
    { href: '/portal/ai', label: 'AI分析・相場', icon: 'ai', soon: true },
    { href: '/portal/withdrawal', label: '出金申請', icon: 'withdrawal' },
    { href: '/portal/reports', label: 'レポート', icon: 'report' },
    { href: '/portal/chat', label: 'チャット', icon: 'chat' },
    { href: '/portal/announcements', label: 'お知らせ', icon: 'announce', badge: unread },
    { href: '/portal/terms', label: '利用規約', icon: 'terms' },
    { href: '/portal/profile', label: '設定', icon: 'settings' },
  ]

  const plan = {
    name: member?.plan?.name ?? '未設定',
    status: member ? MEMBER_STATUS_LABEL[member.status as MemberStatus] : '—',
    contractFrom: member?.contract_date ?? member?.registration_date ?? null,
  }

  // 加盟店ID表示（member.id から短縮コード）
  const memberCode = member ? `HD-${member.id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : '—'

  return (
    <div className="hud-grid min-h-screen bg-carbon-950 text-slate-200 on-dark">
      <PortalSidebar nav={nav} plan={plan} />
      <div className="lg:pl-64">
        <PortalTopbar
          userName={session.name ?? session.email ?? 'ユーザー'}
          memberCode={memberCode}
          userId={session.userId}
          unread={unread}
        />
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
