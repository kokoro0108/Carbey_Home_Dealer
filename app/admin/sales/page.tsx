import Link from 'next/link'
import { TrendingUp, Package, ChevronRight } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { getSalesSummary, getMonthlySales, getSalesByMember, listSoldDeals } from '@/lib/portal/sales'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { LineChart } from '@/components/charts/MiniCharts'
import { yen } from '@/lib/portal/labels'

export const dynamic = 'force-dynamic'

export default async function AdminSalesPage() {
  await requireFeature('reports')
  const [summary, monthly, byMember, sold] = await Promise.all([
    getSalesSummary(),
    getMonthlySales({ months: 6 }),
    getSalesByMember(),
    listSoldDeals(),
  ])
  const hasData = summary.count > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <TrendingUp className="h-5 w-5 text-brand-500" /> 販売実績管理
        </h1>
        <p className="text-sm text-slate-500">売却済みの車両から、売上・原価・粗利益を自動集計します。</p>
      </div>

      {/* 全体サマリ（要件 5.6 / CAR-04） */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="販売台数" value={`${summary.count}台`} icon={<Package className="h-4 w-4" />} tone="brand" />
        <StatCard label="売上合計" value={yen(summary.revenueYen)} icon={<TrendingUp className="h-4 w-4" />} tone="blue" />
        <StatCard label="原価合計" value={yen(summary.costYen)} icon={<TrendingUp className="h-4 w-4" />} tone="slate" />
        <StatCard label="粗利益合計" value={yen(summary.profitYen)} icon={<TrendingUp className="h-4 w-4" />} tone="green" />
        <StatCard label="利益率" value={`${summary.marginPct}%`} icon={<TrendingUp className="h-4 w-4" />} tone="green" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="平均在庫日数" value={`${summary.avgStockDays}日`} icon={<TrendingUp className="h-4 w-4" />} tone="slate" sub="仕入れ〜売却の平均" />
        <StatCard label="回転率（年換算）" value={`${summary.turnoverRate}回`} icon={<TrendingUp className="h-4 w-4" />} tone="blue" sub="365 ÷ 平均在庫日数（目安）" />
      </div>

      {/* 月別推移グラフ（㉑ 縦軸目盛りつき） */}
      <Card>
        <CardHeader title="月別 売上・粗利益の推移" />
        <CardBody>
          {hasData ? (
            <LineChart
              series={[
                { name: '売上', data: monthly.map((m) => m.revenueYen), color: '#1d5cf0' },
                { name: '粗利益', data: monthly.map((m) => m.profitYen), color: '#16a34a' },
              ]}
              labels={monthly.map((m) => m.label)}
              valueFormat={(v) => `${Math.round(v / 10000)}万`}
              unit="円"
            />
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">
              まだ売却済みの車両がありません。加盟店が車両を売却すると、ここに実績とグラフが表示されます。
            </p>
          )}
        </CardBody>
      </Card>

      {/* 加盟店別の収益一覧（要件 REP-02） */}
      <Card>
        <CardHeader title="加盟店別の収益" />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">加盟店</th>
                  <th className="px-5 py-3 font-medium">販売台数</th>
                  <th className="px-5 py-3 font-medium">売上</th>
                  <th className="px-5 py-3 font-medium">粗利益</th>
                  <th className="px-5 py-3 font-medium">利益率</th>
                  <th className="px-5 py-3 font-medium">平均在庫日数</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byMember.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">実績のある加盟店がまだありません。</td></tr>
                )}
                {byMember.map((m) => (
                  <tr key={m.memberId} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-800">{m.companyName ?? m.memberName}</td>
                    <td className="px-5 py-3 text-slate-600">{m.count}台</td>
                    <td className="px-5 py-3 text-slate-700">{yen(m.revenueYen)}</td>
                    <td className={`px-5 py-3 font-medium ${m.profitYen >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{yen(m.profitYen)}</td>
                    <td className="px-5 py-3 text-slate-600">{m.marginPct}%</td>
                    <td className="px-5 py-3 text-slate-600">{m.avgStockDays}日</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/admin/members/${m.memberId}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-info-600 hover:underline">
                        詳細 <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* 販売明細 */}
      <Card>
        <CardHeader title="販売明細" action={<span className="text-xs text-slate-400">{sold.length} 台</span>} />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">加盟店</th>
                  <th className="px-5 py-3 font-medium">車両</th>
                  <th className="px-5 py-3 font-medium">販売価格</th>
                  <th className="px-5 py-3 font-medium">費用合計</th>
                  <th className="px-5 py-3 font-medium">粗利益</th>
                  <th className="px-5 py-3 font-medium">売却日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sold.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">売却済みの車両はまだありません。</td></tr>
                )}
                {sold.map((d) => {
                  const profit = d.gross_profit_yen ?? 0
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-700">{d.member?.company_name ?? d.member?.member_name ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-700">{[d.maker, d.car_model, d.year].filter(Boolean).join(' ') || '車両'}</td>
                      <td className="px-5 py-3 text-slate-700">{yen(d.sale_price_yen)}</td>
                      <td className="px-5 py-3 text-slate-500">{yen(d.cost_total_yen)}</td>
                      <td className={`px-5 py-3 font-medium ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{yen(profit)}</td>
                      <td className="px-5 py-3 text-slate-500">{d.sold_at ? new Date(d.sold_at).toLocaleDateString('ja-JP') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
