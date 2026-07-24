'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Store,
  FileText,
  Wallet,
  ClipboardList,
  Truck,
  ShoppingCart,
  TrendingUp,
  MessageSquare,
  Users,
  Sparkles,
  Activity,
  BarChart3,
  Megaphone,
  Settings,
  LifeBuoy,
  Gauge,
  AlertTriangle,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'
import Logo from '@/components/Logo'
import { cn } from '@/lib/cn'

export type NavEntry = {
  href: string
  label: string
  icon: keyof typeof ICONS
  /** 未読・件数バッジ */
  badge?: number
  /** Phase2-4 で実装予定 (クリック不可・近日バッジ) */
  soon?: boolean
}

export type SidebarAlert = { label: string; count: number }
export type SidebarAccount = { company: string; name: string; roleLabel: string; avatarUrl?: string }

const ICONS = {
  dashboard: LayoutDashboard,
  store: Store,
  contract: FileText,
  billing: Wallet,
  onboarding: ClipboardList,
  vehicle: Truck,
  order: ShoppingCart,
  sales: TrendingUp,
  chat: MessageSquare,
  crm: Users,
  ai: Sparkles,
  aiUsage: Activity,
  report: BarChart3,
  announcement: Megaphone,
  settings: Settings,
  support: LifeBuoy,
  gauge: Gauge,
}

function NavLink({ entry, active }: { entry: NavEntry; active: boolean }) {
  const Icon = ICONS[entry.icon]
  if (entry.soon) {
    // Phase2 以降の項目: バッジは出さず、通常と同じ明るさ + 右に薄ドットのみ (clean)
    return (
      <div
        className="flex items-center justify-between rounded-lg px-3 py-[7px] text-[13px] font-medium text-slate-300"
        title="準備中"
      >
        <span className="flex items-center gap-3">
          <Icon className="h-[18px] w-[18px] text-slate-400" />
          {entry.label}
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-slate-600" aria-label="準備中" />
      </div>
    )
  }
  return (
    <Link
      href={entry.href}
      className={cn(
        'flex items-center justify-between rounded-lg px-3 py-[7px] text-[13px] font-medium transition',
        active
          ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
          : 'text-slate-300 hover:bg-white/5 hover:text-white',
      )}
    >
      <span className="flex items-center gap-3">
        <Icon className={cn('h-[18px] w-[18px]', active ? 'text-white' : 'text-slate-400')} />
        {entry.label}
      </span>
      {entry.badge != null && entry.badge > 0 && (
        <span
          className={cn(
            'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
            active ? 'bg-white/25 text-white' : 'bg-brand-500 text-white',
          )}
        >
          {entry.badge > 99 ? '99+' : entry.badge}
        </span>
      )}
    </Link>
  )
}

function NavList({ items, sectionLabel }: { items: NavEntry[]; sectionLabel?: string }) {
  const pathname = usePathname()
  return (
    <div>
      {sectionLabel && (
        <p className="mb-0.5 mt-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {sectionLabel}
        </p>
      )}
      <nav className="space-y-px">
        {items.map((e) => {
          const active = !e.soon && (pathname === e.href || pathname.startsWith(e.href + '/'))
          return <NavLink key={e.href + e.label} entry={e} active={active} />
        })}
      </nav>
    </div>
  )
}

/** プロフィールアバター。写真があれば表示、なければイニシャルのグラデ円。 */
function Avatar({ name, src }: { name: string; src?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/20"
      />
    )
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white ring-2 ring-white/15">
      {name.charAt(0)}
    </span>
  )
}

export default function Sidebar({
  brandLabel,
  primary,
  secondary,
  alerts,
  account,
}: {
  brandLabel: string
  primary: NavEntry[]
  secondary?: { label: string; items: NavEntry[] }
  alerts?: SidebarAlert[]
  account?: SidebarAccount
}) {
  const [open, setOpen] = useState(false)

  const content = (
    <div className="flex h-full flex-col">
      {/* ブランド */}
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <Logo variant="icon" className="h-8 w-8 rounded-lg" priority />
        <div className="leading-tight">
          <div className="text-[14px] font-bold text-white">
            CARBAY <span className="text-brand-400">Home Dealer</span>
          </div>
          <div className="text-[10px] text-slate-400">{brandLabel}</div>
        </div>
      </div>

      {/* ナビ */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1 scrollbar-slim">
        <NavList items={primary} />
        {secondary && <NavList items={secondary.items} sectionLabel={secondary.label} />}

        {/* 本日のアラート */}
        {alerts && alerts.length > 0 && (
          <div className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/10 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
              <AlertTriangle className="h-3 w-3" />
              本日のアラート
              <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] text-white">
                {alerts.length}
              </span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {alerts.map((a) => (
                <li key={a.label} className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>{a.label}</span>
                  <span className="font-semibold text-white">{a.count}件</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* アカウント切替フッター */}
      {account ? (
        <div className="border-t border-white/10 px-2.5 py-2.5">
          <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5">
            <Avatar name={account.name} src={account.avatarUrl} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12px] font-semibold text-white">{account.company}</span>
              <span className="block truncate text-[11px] text-slate-400">
                {account.name}・{account.roleLabel}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </div>
      ) : (
        <div className="border-t border-white/10 px-5 py-3">
          <p className="text-[11px] text-slate-500">© {new Date().getFullYear()} CARBAY Co., Ltd.</p>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* モバイル: ハンバーガー */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-3.5 z-30 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm lg:hidden"
        aria-label="メニューを開く"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* デスクトップ: 固定サイドバー (ダークネイビー) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 bg-navy-900 lg:block">{content}</aside>

      {/* モバイル: ドロワー */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-navy-900 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/10"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  )
}
