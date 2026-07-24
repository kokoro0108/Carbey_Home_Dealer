import { Banknote, Lock, Ticket, Clock, AlertCircle } from 'lucide-react'
import { requireMember } from '@/lib/auth/session'
import { getOwnWithdrawalEligibility, listWithdrawals, WITHDRAWAL_STATUS_LABEL } from '@/lib/portal/withdrawal'
import { WithdrawalForm, CancelWithdrawalButton } from '@/components/portal-dark/WithdrawalForm'
import { yen } from '@/lib/portal/labels'
import type { WithdrawalStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

const TONE: Record<WithdrawalStatus, string> = {
  requested: 'bg-amber-500/15 text-amber-300',
  approved: 'bg-sky-500/15 text-sky-300',
  paid: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-rose-500/15 text-rose-300',
  cancelled: 'bg-carbon-700 text-slate-400',
}

export default async function WithdrawalPage() {
  const session = await requireMember()
  const own = await getOwnWithdrawalEligibility(session.userId)
  if (!own) {
    return <div className="rounded-2xl border border-carbon-700 bg-carbon-900/60 p-8 text-center text-sm text-slate-400">会員情報が紐付いていません。</div>
  }
  const e = own.eligibility
  const history = await listWithdrawals(own.memberId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Banknote className="h-6 w-6 text-brand-400" />
        <h1 className="text-xl font-bold text-white">運転資金の出金</h1>
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-carbon-700 bg-carbon-900/60 p-4">
          <div className="text-[11px] text-slate-400">預かり金残高</div>
          <div className="mt-1 text-xl font-bold text-white">{yen(e.balance)}</div>
        </div>
        <div className="rounded-xl border border-carbon-700 bg-carbon-900/60 p-4">
          <div className="flex items-center gap-1 text-[11px] text-slate-400"><Ticket className="h-3 w-3" /> 今年度の残回数</div>
          <div className="mt-1 text-xl font-bold text-white">{e.ticketsLeft}<span className="ml-1 text-xs font-normal text-slate-400">/ {e.ticketsPerYear}回</span></div>
        </div>
        <div className="rounded-xl border border-carbon-700 bg-carbon-900/60 p-4">
          <div className="text-[11px] text-slate-400">出金手数料</div>
          <div className="mt-1 text-xl font-bold text-amber-300">{yen(e.feeYen)}</div>
        </div>
        <div className="rounded-xl border border-carbon-700 bg-carbon-900/60 p-4">
          <div className="flex items-center gap-1 text-[11px] text-slate-400"><Clock className="h-3 w-3" /> 入金までの期限</div>
          <div className="mt-1 text-xl font-bold text-white">最大{e.dueDays}日</div>
        </div>
      </div>

      {/* 申請 or ロック理由 */}
      <div className="rounded-2xl border border-carbon-700 bg-carbon-900/60 p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">出金の申請</h2>
        {e.canRequest ? (
          <WithdrawalForm balance={e.balance} feeYen={e.feeYen} dueDays={e.dueDays} minYen={e.minYen} />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              <Lock className="h-4 w-4 shrink-0" /> 現在、出金申請はできません
            </div>
            <ul className="space-y-1">
              {e.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />{r}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500">オーダー中・仕入れ中のお取引が完了しますと、出金申請ができるようになります。</p>
          </div>
        )}
      </div>

      {/* 履歴 */}
      <div className="rounded-2xl border border-carbon-700 bg-carbon-900/60 p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">出金の履歴</h2>
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">出金の申請はまだありません。</p>
        ) : (
          <div className="space-y-2">
            {history.map((w) => (
              <div key={w.id} className="rounded-xl border border-carbon-700 bg-carbon-800/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${TONE[w.status]}`}>{WITHDRAWAL_STATUS_LABEL[w.status]}</span>
                  <span className="text-[11px] text-slate-400">{new Date(w.requested_at).toLocaleDateString('ja-JP')} 申請</span>
                  {w.due_date && w.status !== 'paid' && <span className="text-[11px] text-slate-500">入金期限 {w.due_date}</span>}
                  <span className="ml-auto text-sm font-semibold text-white">振込 {yen(w.net_yen)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
                  <span>申請額 {yen(w.amount_yen)}</span>
                  <span>手数料 {yen(w.fee_yen)}</span>
                  {w.paid_at && <span className="text-emerald-400">振込完了 {new Date(w.paid_at).toLocaleDateString('ja-JP')}</span>}
                  {w.reject_reason && <span className="text-rose-400">却下理由：{w.reject_reason}</span>}
                  {w.status === 'requested' && <span className="ml-auto"><CancelWithdrawalButton id={w.id} /></span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
