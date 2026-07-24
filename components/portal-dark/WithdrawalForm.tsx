'use client'

import { useState, useTransition } from 'react'
import { Loader2, Banknote, X } from 'lucide-react'
import { requestWithdrawalAction, cancelWithdrawalAction } from '@/app/portal/withdrawal/actions'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

/** 出金申請フォーム（申請可能なときのみ表示）。手数料を差し引いた振込額をその場で表示する。 */
export function WithdrawalForm({ balance, feeYen, dueDays, minYen }: { balance: number; feeYen: number; dueDays: number; minYen: number }) {
  const [amount, setAmount] = useState<number>(0)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const amt = Math.max(0, Math.min(amount || 0, balance))
  const net = Math.max(0, amt - feeYen)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-400">出金額（円）</label>
          <input
            type="number"
            min={minYen || 0}
            max={balance}
            step={10000}
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="100000"
            className="w-48 rounded-lg border border-carbon-700 bg-carbon-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <button
          disabled={pending || amt <= feeYen}
          onClick={() => {
            setMsg(null)
            start(async () => {
              const r = await requestWithdrawalAction(amt)
              setMsg(r.ok ? { ok: true, text: '出金を申請しました。本部の承認をお待ちください。' } : { ok: false, text: r.error ?? '申請に失敗しました' })
              if (r.ok) setAmount(0)
            })
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} 出金を申請
        </button>
      </div>

      <div className="rounded-lg border border-carbon-700 bg-carbon-800/50 p-3 text-xs">
        <div className="flex justify-between py-0.5"><span className="text-slate-400">申請額（預かり金から差引）</span><span className="text-slate-200">{yen(amt)}</span></div>
        <div className="flex justify-between py-0.5"><span className="text-slate-400">出金手数料</span><span className="text-amber-300">−{yen(feeYen)}</span></div>
        <div className="mt-1 flex justify-between border-t border-carbon-700 pt-1.5"><span className="font-medium text-slate-300">お振込額</span><span className="text-base font-bold text-white">{yen(net)}</span></div>
      </div>
      <p className="text-[11px] text-slate-500">申請後、本部の承認を経て <span className="text-slate-400">最大{dueDays}日以内</span> にお振込みします。{minYen > 0 && `最低出金額は ${yen(minYen)} です。`}</p>
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</p>}
    </div>
  )
}

/** 申請中の出金を取り消すボタン（承認前のみ）。 */
export function CancelWithdrawalButton({ id }: { id: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  return (
    <>
      <button
        disabled={pending}
        onClick={() => { setError(''); start(async () => { const r = await cancelWithdrawalAction(id); if (!r.ok) setError(r.error ?? '') }) }}
        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />} 取消
      </button>
      {error && <span className="ml-2 text-[11px] text-rose-400">{error}</span>}
    </>
  )
}
