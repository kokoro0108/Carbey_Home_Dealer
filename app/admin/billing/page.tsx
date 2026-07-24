import Link from 'next/link'
import { Wallet, ChevronRight, AlertTriangle } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { listAllInvoices, summarizeInvoices, INVOICE_KIND_LABEL, INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from '@/lib/portal/billing'
import { yen } from '@/lib/portal/labels'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import type { InvoiceStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * 請求・入金管理（全加盟店の請求一覧・横断ビュー / 要件 A-06・PAY-01〜04）。
 * 請求総額・入金済・未収・遅延を集計。消込（入金記録）・請求発行は各会員詳細で行う。
 */
export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireFeature('members')
  const sp = await searchParams
  const all = await listAllInvoices()
  const filter = (['unbilled', 'billed', 'partial', 'paid', 'overdue', 'cancelled'] as InvoiceStatus[]).includes(sp.status as InvoiceStatus)
    ? (sp.status as InvoiceStatus)
    : undefined
  const rows = filter ? all.filter((i) => i.status === filter) : all
  const count = (s: InvoiceStatus) => all.filter((i) => i.status === s).length
  const summary = summarizeInvoices(all)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Wallet className="h-5 w-5 text-brand-500" /> 請求・入金管理
        </h1>
        <p className="text-sm text-slate-500">全加盟店の請求・入金状況を横断で確認します。入金の消込・請求の発行は、各加盟店の詳細画面から行います。</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="請求総額" value={yen(summary.billedYen)} icon={<Wallet className="h-4 w-4" />} tone="brand" sub="請求済（取消・予定を除く）" />
        <StatCard label="入金済" value={yen(summary.paidYen)} icon={<Wallet className="h-4 w-4" />} tone="green" />
        <StatCard label="未収" value={yen(summary.outstandingYen)} icon={<Wallet className="h-4 w-4" />} tone={summary.outstandingYen > 0 ? 'amber' : 'slate'} />
        <StatCard label="支払遅延" value={`${count('overdue')}件`} icon={<AlertTriangle className="h-4 w-4" />} tone={count('overdue') > 0 ? 'amber' : 'slate'} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/billing" className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!filter ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>すべて（{all.length}）</Link>
        {(['billed', 'partial', 'overdue', 'paid', 'unbilled', 'cancelled'] as InvoiceStatus[]).map((s) => (
          <Link key={s} href={`/admin/billing?status=${s}`} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === s ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {INVOICE_STATUS_LABEL[s]}（{count(s)}）
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title={`請求一覧${filter ? `：${INVOICE_STATUS_LABEL[filter]}` : ''}`} action={<span className="text-xs text-slate-400">{rows.length} 件</span>} />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">加盟店</th>
                  <th className="px-5 py-3 font-medium">費目</th>
                  <th className="px-5 py-3 font-medium">請求額</th>
                  <th className="px-5 py-3 font-medium">入金済</th>
                  <th className="px-5 py-3 font-medium">残</th>
                  <th className="px-5 py-3 font-medium">状態</th>
                  <th className="px-5 py-3 font-medium">期限</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">該当する請求はありません。</td></tr>
                )}
                {rows.map((inv) => {
                  const remaining = Math.max(0, inv.amount_yen - inv.paid_yen)
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-800">{inv.member?.company_name ?? inv.member?.member_name ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-700">
                        {INVOICE_KIND_LABEL[inv.kind]}
                        {inv.title && <span className="ml-1 text-xs text-slate-400">{inv.title}</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{yen(inv.amount_yen)}</td>
                      <td className="px-5 py-3 text-green-700">{yen(inv.paid_yen)}</td>
                      <td className={`px-5 py-3 font-medium ${remaining > 0 && inv.status !== 'cancelled' ? 'text-amber-700' : 'text-slate-400'}`}>{yen(remaining)}</td>
                      <td className="px-5 py-3"><span className={`rounded px-2 py-0.5 text-[11px] font-medium ${INVOICE_STATUS_TONE[inv.status]}`}>{INVOICE_STATUS_LABEL[inv.status]}</span></td>
                      <td className={`px-5 py-3 text-xs ${inv.status === 'overdue' ? 'font-semibold text-red-600' : 'text-slate-500'}`}>{inv.due_date ?? '—'}</td>
                      <td className="px-5 py-3 text-right">
                        {inv.member && (
                          <Link href={`/admin/members/${inv.member.id}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-info-600 hover:underline">
                            消込・詳細 <ChevronRight className="h-3 w-3" />
                          </Link>
                        )}
                      </td>
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
