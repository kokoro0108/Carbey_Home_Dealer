import Link from 'next/link'
import { Wallet, ChevronRight } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { listAllMemberFunds } from '@/lib/portal/ledger'
import { yen } from '@/lib/portal/labels'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

/**
 * 資金管理（全体）— 全加盟店の預かり金残高・加盟金支払状況を一覧集計。
 * 半自動売買フェーズ1。個別管理は各会員詳細画面。
 */
export default async function AdminFundsPage() {
  await requireFeature('members')
  const funds = await listAllMemberFunds()

  const totalBalance = funds.reduce((s, f) => s + f.balanceYen, 0)
  const withBalance = funds.filter((f) => f.balanceYen > 0).length
  const unpaid = funds.filter((f) => f.paymentStatus !== 'paid').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Wallet className="h-5 w-5 text-brand-500" /> 資金管理（全体）
        </h1>
        <p className="text-sm text-slate-500">全加盟店の仕入れ資金（預かり金）と加盟金の支払状況を一覧します。</p>
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm text-slate-500">預かり金 合計</div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">{yen(totalBalance)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm text-slate-500">残高あり</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{withBalance}<span className="ml-1 text-sm font-normal text-slate-400">店</span></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm text-slate-500">加盟金 未払い</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{unpaid}<span className="ml-1 text-sm font-normal text-slate-400">店</span></div>
        </div>
      </div>

      {/* 一覧 */}
      <Card>
        <div className="overflow-x-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">加盟店</th>
                <th className="px-5 py-3 font-medium">預かり金残高</th>
                <th className="px-5 py-3 font-medium">加盟金</th>
                <th className="px-5 py-3 font-medium">加盟金 支払状況</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {funds.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">加盟店がいません。</td></tr>
              )}
              {funds.map((f) => (
                <tr key={f.memberId} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{f.companyName ?? f.memberName}</div>
                    <div className="text-xs text-slate-500">{f.memberName}</div>
                  </td>
                  <td className={`px-5 py-3 font-medium ${f.balanceYen > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{yen(f.balanceYen)}</td>
                  <td className="px-5 py-3 text-slate-600">{yen(f.joiningFeeYen)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={f.paymentStatus === 'paid' ? 'green' : f.paymentStatus === 'overdue' ? 'red' : 'amber'}>
                      {f.paymentStatus === 'paid' ? '支払済み' : f.paymentStatus === 'overdue' ? '延滞' : '未払い'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/members/${f.memberId}`} className="inline-flex items-center gap-1 text-xs font-medium text-info-600 hover:underline">
                      資金管理 <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
