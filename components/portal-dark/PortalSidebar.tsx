'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Home, LayoutDashboard, Car, ClipboardList, LineChart, FileBarChart,
  MessageSquare, Bell, Settings, ScrollText, Menu, X, GraduationCap, Bot, Banknote,
} from 'lucide-react'
import Logo from '@/components/Logo'
import { cn } from '@/lib/cn'

const ICONS = {
  onboarding: Home,
  dashboard: LayoutDashboard,
  vehicle: Car,
  order: ClipboardList,
  auto: Bot,
  withdrawal: Banknote,
  ai: LineChart,
  report: FileBarChart,
  chat: MessageSquare,
  announce: Bell,
  settings: Settings,
  terms: ScrollText,
  training: GraduationCap,
} as const

export type PortalNavEntry = {
  href: string
  label: string
  icon: keyof typeof ICONS
  badge?: number
  soon?: boolean
}

export type PortalPlan = {
  name: string
  status: string
  contractFrom: string | null
}

function NavLink({ entry, active }: { entry: PortalNavEntry; active: boolean }) {
  const Icon = ICONS[entry.icon]
  const inner = (
    <>
      <span className="flex items-center gap-3">
        <Icon className={cn('h-[18px] w-[18px]', active ? 'text-white' : 'text-slate-400')} />
        {entry.label}
      </span>
      {entry.badge != null && entry.badge > 0 && (
        <span className={cn(
          'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
          active ? 'bg-white/25 text-white' : 'bg-brand-500 text-white',
        )}>
          {entry.badge > 99 ? '99+' : entry.badge}
        </span>
      )}
    </>
  )
  if (entry.soon) {
    return (
      <div className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-500" title="準備中（今後のアップデートで対応予定）">
        <span className="flex items-center gap-3"><Icon className="h-[18px] w-[18px] text-slate-600" />{entry.label}</span>
        <span className="rounded bg-carbon-700 px-1.5 py-0.5 text-[9px] font-normal text-slate-500">準備中</span>
      </div>
    )
  }
  return (
    <Link
      href={entry.href}
      className={cn(
        'flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium transition',
        active
          ? 'bg-brand-500 text-white shadow-[0_0_20px_-4px_rgba(245,54,43,0.6)]'
          : 'text-slate-300 hover:bg-white/5 hover:text-white',
      )}
    >
      {inner}
    </Link>
  )
}

export default function PortalSidebar({ nav, plan }: { nav: PortalNavEntry[]; plan: PortalPlan }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const content = (
    <div className="flex h-full flex-col">
      {/* ブランド */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo variant="icon" className="h-9 w-9 rounded-xl" priority />
        <div className="leading-tight">
          <div className="text-[15px] font-bold text-white">
            Carbey <span className="text-brand-500">Home Dealer</span>
          </div>
          <div className="text-[10px] text-slate-500">加盟店プラットフォーム</div>
        </div>
      </div>

      {/* ナビ */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 scrollbar-dark">
        {nav.map((e) => {
          const active = !e.soon && (pathname === e.href || pathname.startsWith(e.href + '/'))
          return <NavLink key={e.href + e.label} entry={e} active={active} />
        })}
      </nav>

      {/* プラン情報カード */}
      <div className="m-3 rounded-xl border border-carbon-700 bg-carbon-900/60 p-4">
        <div className="text-[11px] text-slate-500">ご利用プラン</div>
        <div className="mt-1 text-lg font-bold text-white">{plan.name}</div>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-400">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          {plan.status}
        </span>
        {plan.contractFrom && (
          <div className="mt-2.5 text-[11px] text-slate-500">契約期間：{plan.contractFrom}〜</div>
        )}
        <Link href="/portal/profile" className="mt-3 block rounded-lg border border-carbon-600 px-3 py-1.5 text-center text-xs font-medium text-slate-300 transition hover:bg-white/5">
          プラン詳細
        </Link>
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-3.5 z-30 rounded-lg border border-carbon-700 bg-carbon-850 p-2 text-slate-300 lg:hidden"
        aria-label="メニューを開く"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-carbon-700 bg-carbon-900 lg:block">
        {content}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-carbon-700 bg-carbon-900">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/10" aria-label="閉じる">
              <X className="h-5 w-5" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  )
}
