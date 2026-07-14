'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, FileText, Download, Loader2, Paperclip } from 'lucide-react'
import { addDealCostAction, updateDealCostAction, deleteDealCostAction } from '@/app/portal/orders/deal/actions'
import { COST_KIND_LABEL } from '@/lib/portal/deal-costs'
import type { DealCostRow, DealCostKind } from '@/types/database'

const KIND_TONE: Record<DealCostKind, string> = {
  sourcing: 'bg-sky-500/15 text-sky-400',
  prepping: 'bg-amber-500/15 text-amber-400',
  shipping: 'bg-violet-500/15 text-violet-400',
  other: 'bg-carbon-700 text-slate-400',
}

/**
 * 案件の費用内訳エディタ（動的費目・㉜Q7）。
 * 費目の追加・名称変更・金額編集・削除・エビデンス添付。読み取り専用（closed）時は表示のみ。
 */
export default function DealCostEditor({ dealId, costs, editable }: { dealId: string; costs: DealCostRow[]; editable: boolean }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')

  const submit = (fd: FormData, action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>) => {
    setError('')
    start(async () => { const r = await action(fd); if (!r.ok) setError(r.error ?? '') })
  }

  return (
    <div className="space-y-3">
      {/* 費目一覧 */}
      {costs.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">費目はまだありません。</p>
      ) : (
        <ul className="space-y-2">
          {costs.map((c) => (
            <li key={c.id} className="rounded-lg border border-carbon-700 bg-carbon-800/40 px-3 py-2.5">
              {editable ? (
                <form action={(fd) => submit(fd, updateDealCostAction)} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="deal_id" value={dealId} />
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${KIND_TONE[c.kind]}`}>{COST_KIND_LABEL[c.kind]}</span>
                  <input name="label" defaultValue={c.label} className="min-w-0 flex-1 rounded border border-carbon-600 bg-carbon-900 px-2 py-1 text-sm text-slate-100" />
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">¥</span>
                    <input name="amount" inputMode="numeric" defaultValue={c.amount_yen} className="w-32 rounded border border-carbon-600 bg-carbon-900 py-1 pl-5 pr-2 text-sm text-slate-100" />
                  </div>
                  <button disabled={pending} className="rounded bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">更新</button>
                  {c.attachment_path && (
                    <a href={`/api/portal/deal-evidence/${c.id}?download=1`} title="エビデンスDL" className="rounded p-1 text-slate-400 hover:bg-white/5"><Download className="h-4 w-4" /></a>
                  )}
                  <button formAction={(fd) => submit(fd, deleteDealCostAction)} disabled={pending} className="rounded p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400" title="削除">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${KIND_TONE[c.kind]}`}>{COST_KIND_LABEL[c.kind]}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{c.label}</span>
                  <span className="font-medium text-slate-100">¥{c.amount_yen.toLocaleString()}</span>
                  {c.attachment_path && (
                    <a href={`/api/portal/deal-evidence/${c.id}?download=1`} title="エビデンスDL" className="rounded p-1 text-slate-400 hover:bg-white/5"><Download className="h-4 w-4" /></a>
                  )}
                </div>
              )}
              {c.attachment_name && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><FileText className="h-3 w-3" />{c.attachment_name}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 費目の追加 */}
      {editable && (
        <form action={(fd) => submit(fd, addDealCostAction)} className="rounded-lg border border-dashed border-carbon-600 bg-carbon-800/20 p-3">
          <input type="hidden" name="deal_id" value={dealId} />
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300"><Plus className="h-3.5 w-3.5 text-brand-400" /> 費目を追加</div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-[10px] text-slate-500">分類</label>
              <select name="kind" className="rounded border border-carbon-600 bg-carbon-900 px-2 py-1.5 text-sm text-slate-100">
                <option value="sourcing">仕入</option>
                <option value="prepping">商品化</option>
                <option value="shipping">陸送</option>
                <option value="other">その他</option>
              </select>
            </div>
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-[10px] text-slate-500">費目名（自由）</label>
              <input name="label" placeholder="仕入価格 / 整備費 等" className="w-full rounded border border-carbon-600 bg-carbon-900 px-2 py-1.5 text-sm text-slate-100" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-500">金額（円）</label>
              <input name="amount" inputMode="numeric" placeholder="500000" className="w-32 rounded border border-carbon-600 bg-carbon-900 px-2 py-1.5 text-sm text-slate-100" />
            </div>
            <label className="flex cursor-pointer items-center gap-1 rounded border border-carbon-600 bg-carbon-900 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-carbon-800">
              <Paperclip className="h-3.5 w-3.5" /> 計算書等
              <input type="file" name="attachment" accept="image/*,application/pdf" className="hidden" />
            </label>
            <button disabled={pending} className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '追加'}
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}
