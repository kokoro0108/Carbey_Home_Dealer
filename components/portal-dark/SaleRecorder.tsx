'use client'

import { useState, useTransition } from 'react'
import { TrendingUp, Loader2, CheckCircle2 } from 'lucide-react'
import { recordSaleAction } from '@/app/portal/orders/deal/actions'
import type { VehicleDealRow } from '@/types/database'

const yen = (n: number | null | undefined) => (n == null ? '—' : `¥${n.toLocaleString()}`)

/**
 * Phase 3：販売実績の登録（半自動フロー・加盟店が自分の売却を報告）。
 * 納品完了(delivered)後に表示。売却済み(sold)なら結果サマリを表示する。
 */
export default function SaleRecorder({ deal }: { deal: VehicleDealRow }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')

  // 費用合計（精算済みなら settled_amount、未設定なら販売登録時に確定）
  const costTotal = deal.settled_amount_yen ?? deal.cost_total_yen ?? null

  if (deal.status === 'sold') {
    const profit = deal.gross_profit_yen ?? 0
    const profitPositive = profit >= 0
    return (
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <CheckCircle2 className="h-4 w-4 text-brand-400" /> 販売実績（売却済み）
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="販売価格" value={yen(deal.sale_price_yen)} />
          <Stat label="費用合計" value={yen(deal.cost_total_yen)} />
          <Stat label="粗利益" value={yen(deal.gross_profit_yen)} tone={profitPositive ? 'text-brand-300' : 'text-rose-400'} />
          <Stat label="売却日" value={deal.sold_at ? new Date(deal.sold_at).toLocaleDateString('ja-JP') : '—'} />
        </dl>
      </div>
    )
  }

  // 販売実績を登録できるのは商品化以降（sourcing/ordered では出さない）
  if (deal.status === 'ordered' || deal.status === 'sourcing') return null

  const submit = (fd: FormData) => {
    setError('')
    fd.set('deal_id', deal.id)
    start(async () => {
      const r = await recordSaleAction(fd)
      if (!r.ok) setError(r.error ?? '登録に失敗しました')
    })
  }

  return (
    <div className="rounded-xl border border-carbon-700 bg-carbon-800/40 p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
        <TrendingUp className="h-4 w-4 text-brand-400" /> 販売実績を登録
      </div>
      <p className="mb-3 text-xs text-slate-400">
        車両が売れたら、販売価格と売却日を登録してください。粗利益（＝販売価格 − 費用合計{costTotal != null ? ` ${yen(costTotal)}` : ''}）は自動で計算されます。
      </p>
      <form action={submit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-slate-500">販売価格（円）*</label>
          <input name="sale_price" inputMode="numeric" required placeholder="1500000"
            className="w-40 rounded-lg border border-carbon-600 bg-carbon-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-slate-500">売却日</label>
          <input type="date" name="sold_at"
            className="rounded-lg border border-carbon-600 bg-carbon-900 px-3 py-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none" />
        </div>
        <button disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />} 登録する
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  )
}

function Stat({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={`text-sm font-semibold ${tone}`}>{value}</dd>
    </div>
  )
}
