import Link from 'next/link'
import { Banknote, Download, Check, X, Landmark } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { listAllWithdrawals, getWithdrawalSettings, WITHDRAWAL_STATUS_LABEL } from '@/lib/portal/withdrawal'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { yen } from '@/lib/portal/labels'
import type { WithdrawalStatus } from '@/types/database'
import { approveWithdrawalAction, rejectWithdrawalAction, markPaidAction } from './actions'

export const dynamic = 'force-dynamic'

const TONE: Record<WithdrawalStatus, string> = {
  requested: 'bg-amber-50 text-amber-700',
  approved: 'bg-sky-50 text-sky-700',
  paid: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

export default async function AdminWithdrawalsPage({ searchParams }: { searchParams: Promise<{ status?: string; msg?: string; error?: string }> }) {
  await requireFeature('members')
  const sp = await searchParams
  const filter = (['requested', 'approved', 'paid', 'rejected', 'cancelled'] as WithdrawalStatus[]).includes(sp.status as WithdrawalStatus)
    ? (sp.status as WithdrawalStatus)
    : undefined

  const [all, settings] = await Promise.all([listAllWithdrawals(), getWithdrawalSettings()])
  const rows = filter ? all.filter((r) => r.status === filter) : all
  const count = (s: WithdrawalStatus) => all.filter((r) => r.status === s).length
  const approvedTotal = all.filter((r) => r.status === 'approved').reduce((s, r) => s + r.net_yen, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Banknote className="h-5 w-5 text-brand-500" /> 出金申請の管理
          </h1>
          <p className="text-sm text-slate-500">
            加盟店からの出金申請を承認し、振込用データを出力します。手数料 {yen(settings.feeYen)}／入金期限 最大{settings.dueDays}日／チケット {settings.ticketsPerYear}回・年
          </p>
        </div>
        <a
          href="/api/portal/withdrawals/csv?status=approved"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <Download className="h-4 w-4" /> 振込用CSVをダウンロード（承認済み）
        </a>
      </div>

      {sp.msg && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{sp.msg}</div>}
      {sp.error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{sp.error}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="申請中" value={`${count('requested')}件`} icon={<Banknote className="h-4 w-4" />} tone="amber" sub="承認待ち" />
        <StatCard label="承認済み" value={`${count('approved')}件`} icon={<Landmark className="h-4 w-4" />} tone="blue" sub="振込待ち" />
        <StatCard label="振込待ち合計" value={yen(approvedTotal)} icon={<Banknote className="h-4 w-4" />} tone="brand" sub="振込額の合計" />
        <StatCard label="振込完了" value={`${count('paid')}件`} icon={<Check className="h-4 w-4" />} tone="green" />
      </div>

      {/* 絞り込み */}
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/withdrawals" className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!filter ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>すべて（{all.length}）</Link>
        {(['requested', 'approved', 'paid', 'rejected', 'cancelled'] as WithdrawalStatus[]).map((s) => (
          <Link key={s} href={`/admin/withdrawals?status=${s}`} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === s ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {WITHDRAWAL_STATUS_LABEL[s]}（{count(s)}）
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title={`出金申請${filter ? `：${WITHDRAWAL_STATUS_LABEL[filter]}` : ''}`} />
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">該当する出金申請はありません。</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((w) => (
                <div key={w.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${TONE[w.status]}`}>{WITHDRAWAL_STATUS_LABEL[w.status]}</span>
                    <Link href={`/admin/members/${w.member_id}`} className="text-sm font-semibold text-slate-900 hover:underline">
                      {w.member?.company_name || w.member?.member_name || '—'}
                    </Link>
                    <span className="text-xs text-slate-400">{new Date(w.requested_at).toLocaleDateString('ja-JP')} 申請</span>
                    {w.due_date && w.status !== 'paid' && <span className="text-xs text-slate-500">入金期限 {w.due_date}</span>}
                    <span className="ml-auto text-sm text-slate-700">
                      振込 <span className="text-base font-bold text-slate-900">{yen(w.net_yen)}</span>
                      <span className="ml-2 text-xs text-slate-400">申請 {yen(w.amount_yen)}／手数料 {yen(w.fee_yen)}</span>
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Landmark className="h-3 w-3" />{w.bank_name ?? '—'} {w.bank_branch ?? ''} {w.bank_account_type ?? ''} {w.bank_account_number ?? ''}</span>
                    <span>名義：{w.bank_account_holder ?? '—'}</span>
                    {w.paid_at && <span className="text-green-700">振込完了 {new Date(w.paid_at).toLocaleDateString('ja-JP')}</span>}
                    {w.reject_reason && <span className="text-red-600">却下理由：{w.reject_reason}</span>}
                  </div>

                  {/* 操作 */}
                  {(w.status === 'requested' || w.status === 'approved') && (
                    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                      {w.status === 'requested' && (
                        <>
                          <form action={approveWithdrawalAction}>
                            <input type="hidden" name="id" value={w.id} />
                            <button className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">
                              <Check className="h-3.5 w-3.5" /> 承認する
                            </button>
                          </form>
                          <form action={rejectWithdrawalAction} className="flex items-end gap-2">
                            <input type="hidden" name="id" value={w.id} />
                            <input name="reason" placeholder="却下理由（任意）" className="w-48 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs" />
                            <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                              <X className="h-3.5 w-3.5" /> 却下
                            </button>
                          </form>
                        </>
                      )}
                      {w.status === 'approved' && (
                        <form action={markPaidAction}>
                          <input type="hidden" name="id" value={w.id} />
                          <button className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                            <Check className="h-3.5 w-3.5" /> 振込完了にする（預かり金から差引）
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
