import { TrendingUp, Package } from 'lucide-react'
import { requireMember } from '@/lib/auth/session'
import { getMemberByUserId } from '@/lib/portal/members'
import { getSalesSummary, getMonthlySales, getMonthlyReport, listSoldDeals } from '@/lib/portal/sales'
import { DarkCard, DarkCardHeader, DarkCardBody, DarkStat } from '@/components/portal-dark/DarkUI'
import { DarkLineChart } from '@/components/portal-dark/DarkCharts'
import { yen } from '@/lib/portal/labels'

export const dynamic = 'force-dynamic'

export default async function MemberReportsPage() {
  const session = await requireMember()
  const member = await getMemberByUserId(session.userId)
  if (!member) {
    return <p className="text-sm text-slate-400">会員情報が見つかりません。</p>
  }
  const [summary, monthly, report, sold] = await Promise.all([
    getSalesSummary(member.id),
    getMonthlySales({ memberId: member.id, months: 6 }),
    getMonthlyReport(member.id),
    listSoldDeals(member.id),
  ])

  const hasData = summary.count > 0
  const fmtMan = (v: number) => `${Math.round(v / 10000)}万`

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <TrendingUp className="h-5 w-5 text-brand-400" /> 販売レポート
        </h1>
        <p className="text-sm text-slate-400">売却済みの車両から、売上・粗利益を自動集計します。</p>
      </div>

      {/* 月次サマリ（要件 5.7） */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <DarkStat label="今月の売上" value={fmtMan(report.monthRevenueYen)} unit="円" sub={`${report.monthCount}台`} />
        <DarkStat label="今月の粗利益" value={fmtMan(report.monthProfitYen)} unit="円" />
        <DarkStat label="累計粗利益" value={fmtMan(report.totalProfitYen)} unit="円" sub={`累計${report.totalCount}台`} />
        <DarkStat label="利益率" value={summary.marginPct} unit="%" sub="売上に対する粗利益" />
      </div>

      {/* 月別推移グラフ（㉑ 縦軸目盛りつき） */}
      <DarkCard>
        <DarkCardHeader title="月別 粗利益の推移" />
        <DarkCardBody>
          {hasData ? (
            <DarkLineChart
              data={monthly.map((m) => m.profitYen)}
              labels={monthly.map((m) => m.label)}
              valueFormat={(v) => `${Math.round(v / 10000)}万`}
            />
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              まだ売却済みの車両がありません。案件を「売却済み」にすると、ここに実績が表示されます。
            </p>
          )}
        </DarkCardBody>
      </DarkCard>

      {/* 販売履歴 */}
      <DarkCard>
        <DarkCardHeader title="販売履歴" action={<span className="text-xs text-slate-500">{sold.length} 台</span>} />
        <DarkCardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-carbon-700 bg-carbon-900/50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">車両</th>
                  <th className="px-5 py-3 font-medium">販売価格</th>
                  <th className="px-5 py-3 font-medium">費用合計</th>
                  <th className="px-5 py-3 font-medium">粗利益</th>
                  <th className="px-5 py-3 font-medium">売却日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-700">
                {sold.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    <Package className="mx-auto mb-2 h-6 w-6 text-slate-600" /> 売却済みの車両はまだありません。
                  </td></tr>
                )}
                {sold.map((d) => {
                  const profit = d.gross_profit_yen ?? 0
                  return (
                    <tr key={d.id} className="hover:bg-white/5">
                      <td className="px-5 py-3 text-slate-200">{[d.maker, d.car_model, d.year].filter(Boolean).join(' ') || '車両'}</td>
                      <td className="px-5 py-3 text-slate-300">{yen(d.sale_price_yen)}</td>
                      <td className="px-5 py-3 text-slate-400">{yen(d.cost_total_yen)}</td>
                      <td className={`px-5 py-3 font-medium ${profit >= 0 ? 'text-brand-300' : 'text-rose-400'}`}>{yen(profit)}</td>
                      <td className="px-5 py-3 text-slate-500">{d.sold_at ? new Date(d.sold_at).toLocaleDateString('ja-JP') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </DarkCardBody>
      </DarkCard>
    </div>
  )
}
