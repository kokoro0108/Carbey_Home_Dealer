import Link from 'next/link'
import {
  TrendingUp,
  Wallet,
  Percent,
  Truck,
  Sparkles,
  ShoppingCart,
  ArrowRight,
  Lock,
} from 'lucide-react'
import { requireMember } from '@/lib/auth/session'
import { getMemberByUserId } from '@/lib/portal/members'
import { MEMBER_STATUS_LABEL, yen } from '@/lib/portal/labels'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

export default async function MemberDashboardPage() {
  const session = await requireMember()
  const member = await getMemberByUserId(session.userId)

  const onboardingPct = member?.onboarding_total
    ? Math.round((member.onboarding_done / member.onboarding_total) * 100)
    : 0
  const onboardingDone = onboardingPct >= 100

  return (
    <div>
      {/* ウェルカム + 契約プラン */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">ようこそ</p>
          <h1 className="text-2xl font-bold text-slate-900">
            {member?.company_name ?? member?.member_name ?? session.name ?? 'ゲスト'}
          </h1>
        </div>
        {member && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-card">
            <span className="text-xs text-slate-500">契約プラン</span>
            <span className="font-semibold text-slate-900">{member.plan?.name ?? '未設定'}</span>
            <Badge tone={member.status === 'active' ? 'green' : member.status === 'pending' ? 'amber' : 'slate'}>
              {MEMBER_STATUS_LABEL[member.status]}
            </Badge>
          </div>
        )}
      </div>

      {!member && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          会員情報が紐付いていません。本部にお問い合わせください。
        </div>
      )}

      {/* 経営KPI (Phase3で実データ化) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="今月の売上" value={yen(0)} icon={<TrendingUp className="h-5 w-5" />} tone="blue" sub="Phase 3 で実装" />
        <StatCard label="今月の利益" value={yen(0)} icon={<Wallet className="h-5 w-5" />} tone="green" sub="Phase 3 で実装" />
        <StatCard label="累計利益" value={yen(0)} icon={<Wallet className="h-5 w-5" />} tone="brand" sub="契約開始からの累計" />
        <StatCard label="利益率" value="—%" icon={<Percent className="h-5 w-5" />} tone="amber" sub="粗利 ÷ 売上" />
      </div>

      {/* 2カラム: オンボーディング進捗 + クイックアクション/お知らせ */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* オンボーディング進捗 */}
        <Card className="lg:col-span-2">
          <CardHeader title="スタートアップ進捗" action={<Link href="/portal/onboarding" className="flex items-center gap-1 text-xs font-medium text-info-600 hover:underline">詳細を見る <ArrowRight className="h-3 w-3" /></Link>} />
          <CardBody>
            <div className="mb-2 flex items-end justify-between">
              <span className="text-3xl font-bold text-slate-900">{onboardingPct}<span className="text-lg text-slate-400">%</span></span>
              <span className="text-sm text-slate-500">{member?.onboarding_done ?? 0} / {member?.onboarding_total ?? 8} ステップ完了</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400" style={{ width: `${onboardingPct}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {onboardingDone
                ? 'オンボーディング完了。全機能が利用可能です。'
                : 'オンボーディング完了で、オーダー・AI壁打ち・販売登録が解放されます。'}
            </p>
          </CardBody>
        </Card>

        {/* お知らせ */}
        <Card>
          <CardHeader title="本部からのお知らせ" />
          <CardBody>
            <p className="text-sm text-slate-400">お知らせ機能は Phase 2 で実装予定です。</p>
          </CardBody>
        </Card>
      </div>

      {/* クイックアクション (ロック状態の表現) */}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-500">クイックアクション</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction icon={<Truck className="h-5 w-5" />} title="車両進捗" desc="案件の進捗を確認" locked={!onboardingDone} phase="Phase 3" />
        <QuickAction icon={<ShoppingCart className="h-5 w-5" />} title="仕入れオーダー" desc="本部へ仕入れ依頼" locked={!onboardingDone} phase="Phase 2" />
        <QuickAction icon={<Sparkles className="h-5 w-5" />} title="AI 壁打ち" desc="仕入れ判断を相談" locked={!onboardingDone} phase="Phase 4" />
        <QuickAction icon={<TrendingUp className="h-5 w-5" />} title="販売実績" desc="売上・利益を可視化" locked={false} phase="Phase 3" />
      </div>
    </div>
  )
}

function QuickAction({
  icon,
  title,
  desc,
  locked,
  phase,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  locked: boolean
  phase: string
}) {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
        {locked ? (
          <Lock className="h-4 w-4 text-slate-300" />
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{phase}</span>
        )}
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-800">{title}</div>
      <div className="mt-0.5 text-xs text-slate-400">{locked ? 'オンボーディング完了後に解放' : desc}</div>
    </div>
  )
}
