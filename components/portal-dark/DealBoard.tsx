'use client'

import { useState, useTransition } from 'react'
import { Package, Wrench, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'
import { moveToPreppingAction, markDeliveredAction } from '@/app/portal/orders/deal-actions'
import type { VehicleDealRow } from '@/types/database'

/** 進捗ステージ（横軸表示）。ordered はオーダー送信で即 sourcing になるため表示は3段。 */
const STAGES = [
  { key: 'sourcing', label: '仕入れ中', icon: Package },
  { key: 'prepping', label: '商品化中', icon: Wrench },
  { key: 'delivered', label: '納品完了', icon: CheckCircle2 },
] as const

const ORDER = ['ordered', 'sourcing', 'prepping', 'delivered']

/** 車両案件の進捗ボード（半自動売買・横軸）。1案件ごと。 */
export default function DealBoard({ deal }: { deal: VehicleDealRow }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const idx = ORDER.indexOf(deal.status)

  const toPrepping = () => {
    setError('')
    const fd = new FormData(); fd.set('deal_id', deal.id)
    start(async () => { const r = await moveToPreppingAction(fd); if (!r.ok) setError(r.error ?? '') })
  }
  const receive = () => {
    setError('')
    const fd = new FormData(); fd.set('deal_id', deal.id)
    start(async () => { const r = await markDeliveredAction(fd); if (!r.ok) setError(r.error ?? '') })
  }

  return (
    <div className="rounded-xl border border-carbon-700 bg-carbon-800/40 p-4">
      {/* 車両情報 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-white">
          {[deal.maker, deal.car_model, deal.year].filter(Boolean).join(' ') || '車両案件'}
        </div>
        {deal.order_amount_yen != null && (
          <div className="text-xs text-slate-400">発注 ¥{deal.order_amount_yen.toLocaleString()}</div>
        )}
      </div>

      {/* 横軸ステータス */}
      <ol className="flex items-center">
        {STAGES.map((s, i) => {
          const sIdx = ORDER.indexOf(s.key)
          const done = idx > sIdx
          const current = deal.status === s.key
          const Icon = s.icon
          return (
            <li key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center text-center">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  done ? 'bg-brand-500 text-white' : current ? 'border-2 border-brand-500 bg-brand-500/15 text-brand-400' : 'border-2 border-carbon-600 bg-carbon-800 text-slate-500'
                }`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`mt-1.5 text-[11px] ${current ? 'font-semibold text-brand-400' : done ? 'text-slate-400' : 'text-slate-500'}`}>{s.label}</span>
              </div>
              {i < STAGES.length - 1 && (
                <div className={`mx-1 mt-[-18px] h-0.5 flex-1 ${idx > sIdx ? 'bg-brand-500' : 'bg-carbon-600'}`} />
              )}
            </li>
          )
        })}
      </ol>

      {/* アクション */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {deal.status === 'sourcing' && (
          <button onClick={toPrepping} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-carbon-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
            整備・修理する（商品化中へ）
          </button>
        )}
        {(deal.status === 'sourcing' || deal.status === 'prepping') && (
          <button onClick={receive} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            受け取り完了（取引終了）
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-right text-[11px] text-rose-400">{error}</p>}
    </div>
  )
}
