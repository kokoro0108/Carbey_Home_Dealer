'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, FileText, Download, Loader2, Paperclip } from 'lucide-react'
import { addDealCostAction, updateDealCostAction, deleteDealCostAction } from '@/app/admin/vehicles/actions'
import { COST_KIND_LABEL } from '@/lib/portal/deal-costs'
import type { DealCostRow, DealCostKind } from '@/types/database'

const KIND_TONE: Record<DealCostKind, string> = {
  sourcing: 'bg-sky-50 text-sky-700',
  prepping: 'bg-amber-50 text-amber-700',
  shipping: 'bg-violet-50 text-violet-700',
  other: 'bg-slate-100 text-slate-600',
}

// 本部がよく使う費目のプリセット（代行手数料など）。ワンクリックで名称・分類を埋める。
const PRESETS: { label: string; kind: DealCostKind }[] = [
  { label: '仕入価格', kind: 'sourcing' },
  { label: '整備費', kind: 'prepping' },
  { label: '代行手数料', kind: 'other' },
  { label: '陸送費', kind: 'shipping' },
  { label: '手数料', kind: 'other' },
]

const yen = (n: number | null | undefined) => (n == null ? '¥0' : `¥${n.toLocaleString()}`)

/**
 * 本部側の費用内訳エディタ（諸費用・代行手数料を仕入れ中/商品化中に自由に追加）。
 * editable=false（精算後）は表示のみ。
 */
export default function AdminDealCostEditor({ dealId, costs, editable }: { dealId: string; costs: DealCostRow[]; editable: boolean }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [preset, setPreset] = useState<{ label: string; kind: DealCostKind } | null>(null)

  const submit = (fd: FormData, action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>) => {
    setError('')
    fd.set('deal_id', dealId)
    start(async () => { const r = await action(fd); if (!r.ok) setError(r.error ?? '') })
  }

  const inputCls = 'rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-brand-400 focus:outline-none'

  return (
    <div className="space-y-3">
      {/* 費目一覧 */}
      {costs.length === 0 ? (
        <p className="py-3 text-center text-xs text-slate-400">費目はまだありません。</p>
      ) : (
        <ul className="space-y-2">
          {costs.map((c) => (
            <li key={c.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              {editable ? (
                <form action={(fd) => submit(fd, updateDealCostAction)} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <select name="kind" defaultValue={c.kind} className={inputCls}>
                    {(Object.keys(COST_KIND_LABEL) as DealCostKind[]).map((k) => (
                      <option key={k} value={k}>{COST_KIND_LABEL[k]}</option>
                    ))}
                  </select>
                  <input name="label" defaultValue={c.label} className={`${inputCls} flex-1`} />
                  <input name="amount" defaultValue={c.amount_yen} inputMode="numeric" className={`${inputCls} w-28 text-right`} />
                  <button disabled={pending} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">更新</button>
                  {c.attachment_path && (
                    <a href={`/api/portal/deal-evidence/${c.id}`} target="_blank" rel="noopener noreferrer" title={c.attachment_name ?? '添付'} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
                      <FileText className="h-4 w-4" />
                    </a>
                  )}
                </form>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${KIND_TONE[c.kind]}`}>{COST_KIND_LABEL[c.kind]}</span>
                  <span className="flex-1 text-slate-800">{c.label}</span>
                  {c.attachment_path && (
                    <a href={`/api/portal/deal-evidence/${c.id}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600"><Download className="h-3.5 w-3.5" /></a>
                  )}
                  <span className="w-28 text-right font-medium text-slate-900">{yen(c.amount_yen)}</span>
                </div>
              )}
              {editable && (
                <form action={(fd) => submit(fd, deleteDealCostAction)} className="mt-1 flex justify-end">
                  <input type="hidden" name="id" value={c.id} />
                  <button disabled={pending} className="text-[11px] text-slate-400 hover:text-red-600">削除</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 追加フォーム（本部が諸費用・代行手数料を自由に追加） */}
      {editable && (
        <form action={(fd) => submit(fd, addDealCostAction)} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500">よく使う費目：</span>
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => setPreset(p)}
                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:border-brand-300 hover:text-brand-600">
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <select name="kind" key={`k-${preset?.label}`} defaultValue={preset?.kind ?? 'other'} className={inputCls}>
              {(Object.keys(COST_KIND_LABEL) as DealCostKind[]).map((k) => (
                <option key={k} value={k}>{COST_KIND_LABEL[k]}</option>
              ))}
            </select>
            <input name="label" key={`l-${preset?.label}`} required defaultValue={preset?.label ?? ''} placeholder="費目名（例：代行手数料）" className={`${inputCls} flex-1`} />
            <input name="amount" required inputMode="numeric" placeholder="金額(円)" className={`${inputCls} w-32 text-right`} />
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-white">
              <Paperclip className="h-3.5 w-3.5" /> 添付
              <input type="file" name="attachment" accept="image/*,application/pdf" className="hidden" />
            </label>
            <button disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} 追加
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
