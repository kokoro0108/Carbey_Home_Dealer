'use client'

import { useState, useTransition } from 'react'
import { Loader2, Bot, Hand, SlidersHorizontal } from 'lucide-react'
import { setBudgetAllocationAction } from '@/app/portal/reserve-actions'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

/**
 * フェーズ7：両フロー保有者の予算振り分け（自動売買用／半自動用）。
 * 加盟者が「自動売買用」の割当額を入力し、残りが自動的に「半自動用」になる。
 */
export default function BudgetAllocator({
  balance,
  autoBudget,
  hasAllocation,
}: {
  balance: number
  autoBudget: number
  hasAllocation: boolean
}) {
  const [auto, setAuto] = useState<number>(hasAllocation ? autoBudget : balance)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const clampedAuto = Math.max(0, Math.min(auto || 0, balance))
  const semi = balance - clampedAuto
  const autoPct = balance > 0 ? Math.round((clampedAuto / balance) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <SlidersHorizontal className="h-4 w-4 text-brand-300" />
        預かり金 <span className="font-semibold text-white">{yen(balance)}</span> を各フローに振り分けます
        {!hasAllocation && <span className="rounded bg-carbon-700 px-2 py-0.5 text-[11px] text-slate-400">未設定（各フロー全額で判定中）</span>}
      </div>

      {/* 割合バー */}
      <div className="flex h-3 overflow-hidden rounded-full bg-carbon-700">
        <div className="bg-brand-500" style={{ width: `${autoPct}%` }} />
        <div className="bg-emerald-500" style={{ width: `${100 - autoPct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-carbon-700 bg-carbon-800 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400"><Bot className="h-3.5 w-3.5 text-brand-300" /> 自動売買用</div>
          <div className="mt-1 text-lg font-bold text-white">{yen(clampedAuto)}</div>
        </div>
        <div className="rounded-lg border border-carbon-700 bg-carbon-800 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400"><Hand className="h-3.5 w-3.5 text-emerald-300" /> 半自動用</div>
          <div className="mt-1 text-lg font-bold text-white">{yen(semi)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-slate-400">自動売買用の割当（円）</label>
          <input
            type="number"
            min={0}
            max={balance}
            step={100000}
            value={auto}
            onChange={(e) => setAuto(Number(e.target.value))}
            className="w-44 rounded-lg border border-carbon-700 bg-carbon-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <button
          disabled={pending}
          onClick={() => {
            setMsg(null)
            start(async () => {
              const r = await setBudgetAllocationAction(clampedAuto)
              setMsg(r.ok ? { ok: true, text: '振り分けを保存しました' } : { ok: false, text: r.error ?? '保存に失敗しました' })
            })
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} 振り分けを保存
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        自動売買の受注可否は「自動売買用」の予算で、半自動の発注上限は「半自動用」の予算で判定されます。預かり金は共通のため、割当は判定のしきい値です。
      </p>
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</p>}
    </div>
  )
}
