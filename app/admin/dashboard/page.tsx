import Link from 'next/link'
import {
  Store,
  FileText,
  CircleDollarSign,
  MessageSquare,
  ShoppingCart,
  AlertTriangle,
} from 'lucide-react'
import { getAdminStats } from '@/lib/portal/dashboard'
import { listMembers } from '@/lib/portal/members'
import { listOrders } from '@/lib/portal/orders'
import { listConversations } from '@/lib/portal/chat'
import { listAnnouncements } from '@/lib/portal/announcements'
import { getOverdueOverview } from '@/lib/portal/billing'
import { getSalesSummary, getMonthlySales } from '@/lib/portal/sales'
import { LineChart } from '@/components/charts/MiniCharts'
import { yen, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/portal/labels'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DonutChart } from '@/components/charts/MiniCharts'

export const dynamic = 'force-dynamic'

const DONUT_COLORS = ['#fb2c1d', '#1d5cf0', '#06b6d4', '#f59e0b', '#94a3b8']

export default async function AdminDashboardPage() {
  const [stats, recentOrders, members, chats, announcements, overdue, salesSummary, monthlySales] = await Promise.all([
    getAdminStats(),
    listOrders(),
    listMembers(),
    listConversations(),
    listAnnouncements(true, 5),
    getOverdueOverview(),
    getSalesSummary(),
    getMonthlySales({ months: 6 }),
  ])
  const hasSales = salesSummary.count > 0
  const m = stats.members
  const totalContracts = stats.planDistribution.reduce((s, p) => s + p.count, 0)

  // オンボーディング進捗の実集計
  const withProgress = members.map((x) => ({
    pct: x.onboarding_total ? Math.round((x.onboarding_done / x.onboarding_total) * 100) : 0,
  }))
  const obNotStarted = withProgress.filter((x) => x.pct === 0).length
  const obInProgress = withProgress.filter((x) => x.pct > 0 && x.pct < 100).length
  const obCompleted = withProgress.filter((x) => x.pct >= 100).length

  const planSlices = stats.planDistribution
    .filter((p) => p.count > 0)
    .map((p, i) => ({ label: p.name, value: p.count, color: DONUT_COLORS[i % DONUT_COLORS.length] }))

  const recentChats = chats.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* ===== ヘッダー ===== */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">ダッシュボード</h1>
        <p className="text-sm text-slate-500">本部管理者ビュー</p>
      </div>

      {/* ===== 支払遅延の警告（PAY-04） ===== */}
      {overdue.overdueCount > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-red-800">
                支払遅延が {overdue.overdueCount}件（{yen(overdue.overdueYen)}）発生しています
              </div>
              <ul className="mt-2 space-y-1">
                {overdue.members.slice(0, 5).map((mm) => (
                  <li key={mm.memberId} className="flex items-center justify-between text-xs">
                    <Link href={`/admin/members/${mm.memberId}`} className="truncate text-red-700 hover:underline">
                      {mm.companyName ? `${mm.companyName}（${mm.memberName}）` : mm.memberName}
                    </Link>
                    <span className="ml-2 shrink-0 font-medium text-red-700">{yen(mm.overdueYen)} / {mm.count}件</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ===== KPI（実データのみ） ===== */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="加盟店数" value={m.total} icon={<Store className="h-4 w-4" />} tone="brand" href="/admin/members" sub={`稼働中 ${m.active}`} />
        <StatCard label="有効契約数" value={totalContracts} icon={<FileText className="h-4 w-4" />} tone="blue" sub="プラン割当済み" />
        <StatCard label="今月の入金" value={yen(stats.monthlyRevenueYen)} icon={<CircleDollarSign className="h-4 w-4" />} tone="green" sub="確定入金の合計" />
        <StatCard label="新規オーダー" value={stats.newOrders} icon={<ShoppingCart className="h-4 w-4" />} tone="slate" href="/admin/orders?status=received" sub="受付中" />
        <StatCard label="未読チャット" value={stats.unreadChats} icon={<MessageSquare className="h-4 w-4" />} tone="blue" href="/admin/chat" sub="加盟店からの未読" />
      </div>

      {/* ===== 販売実績（Phase 3・要件5.6：グラフ＋サマリ） ===== */}
      <Card>
        <CardHeader title="販売実績" action={<Link href="/admin/sales" className="text-xs text-info-600 hover:underline">販売実績管理へ</Link>} />
        <CardBody>
          {hasSales ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <LineChart
                  series={[
                    { name: '売上', data: monthlySales.map((m) => m.revenueYen), color: '#1d5cf0' },
                    { name: '粗利益', data: monthlySales.map((m) => m.profitYen), color: '#16a34a' },
                  ]}
                  labels={monthlySales.map((m) => m.label)}
                  valueFormat={(v) => `${Math.round(v / 10000)}万`}
                  unit="円"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <SalesTile label="販売台数" value={`${salesSummary.count}台`} />
                <SalesTile label="売上合計" value={yen(salesSummary.revenueYen)} />
                <SalesTile label="粗利益合計" value={yen(salesSummary.profitYen)} tone="text-emerald-700" />
                <SalesTile label="利益率" value={`${salesSummary.marginPct}%`} tone="text-emerald-700" />
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              まだ売却済みの車両がありません。加盟店が車両を売却すると、ここに売上・粗利益の推移が表示されます。
            </p>
          )}
        </CardBody>
      </Card>

      {/* ===== オンボーディング要対応 + プラン別 ===== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="オンボーディング進捗状況" action={<Link href="/admin/onboarding" className="text-xs text-info-600 hover:underline">一覧を見る</Link>} />
          <CardBody>
            {members.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">加盟店がまだありません。</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-bold text-slate-900">{obNotStarted}</div>
                  <div className="mt-1 text-xs text-slate-500">未着手</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-bold text-info-600">{obInProgress}</div>
                  <div className="mt-1 text-xs text-slate-500">進行中</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{obCompleted}</div>
                  <div className="mt-1 text-xs text-slate-500">完了</div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="プラン別加盟店数" action={<Link href="/admin/plans" className="text-xs text-info-600 hover:underline">プラン管理</Link>} />
          <CardBody>
            {planSlices.length > 0 ? (
              <DonutChart slices={planSlices} centerLabel="合計" centerValue={totalContracts} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">プラン割当済みの加盟店がありません。</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ===== オーダー + チャット ===== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* オーダー管理 */}
        <Card>
          <CardHeader title="最近のオーダー" action={<Link href="/admin/orders" className="text-xs text-info-600 hover:underline">すべて見る</Link>} />
          <CardBody className="p-0">
            {recentOrders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">オーダーはまだありません。</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">オーダーID</th>
                    <th className="px-2 py-2 text-left font-medium">加盟店名</th>
                    <th className="px-2 py-2 text-left font-medium">車種</th>
                    <th className="px-2 py-2 text-center font-medium">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.slice(0, 5).map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{o.order_number ?? o.id.slice(0, 8)}</td>
                      <td className="px-2 py-2.5 text-slate-600">{o.member?.company_name ?? o.member?.member_name ?? '—'}</td>
                      <td className="px-2 py-2.5 text-slate-600">{[o.maker, o.car_model].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-2 py-2.5 text-center"><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        {/* チャット */}
        <Card>
          <CardHeader title="チャット" action={<Link href="/admin/chat" className="text-xs text-info-600 hover:underline">すべて見る</Link>} />
          <CardBody className="p-0">
            {recentChats.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">会話はまだありません。</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentChats.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                      {(c.company_name ?? c.member_name).charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[13px] font-medium text-slate-800">{c.company_name ?? c.member_name}</span>
                        <span className="text-[11px] text-slate-400">{c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('ja-JP') : ''}</span>
                      </div>
                      <div className="truncate text-[12px] text-slate-500">{c.last_body ?? 'メッセージはありません'}</div>
                    </div>
                    {c.unread > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ===== お知らせ ===== */}
      <Card>
        <CardHeader title="お知らせ" action={<Link href="/admin/announcements" className="text-xs text-info-600 hover:underline">配信管理</Link>} />
        <CardBody className="p-0">
          {announcements.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">お知らせはありません。</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {announcements.map((n) => (
                <li key={n.id} className="flex items-start gap-2 px-5 py-3">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.level === 'important' ? 'bg-brand-500' : 'bg-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-slate-700">{n.title}</div>
                    <div className="text-[11px] text-slate-400">{new Date(n.created_at).toLocaleDateString('ja-JP')}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function SalesTile({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold ${tone}`}>{value}</div>
    </div>
  )
}
