'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { togglePrepChecklistAction } from '@/app/admin/vehicles/actions'

type Item = { key: string; label: string; value: boolean }

/** 商品化チェックリスト（点検・清掃・撮影・掲載準備・CAR-05）。本部が切り替え。 */
export default function AdminPrepChecklist({
  dealId,
  inspected,
  cleaned,
  photographed,
  listedReady,
  editable = true,
}: {
  dealId: string
  inspected: boolean
  cleaned: boolean
  photographed: boolean
  listedReady: boolean
  editable?: boolean
}) {
  const [items, setItems] = useState<Item[]>([
    { key: 'inspected', label: '点検', value: inspected },
    { key: 'cleaned', label: '清掃', value: cleaned },
    { key: 'photographed', label: '撮影', value: photographed },
    { key: 'listedReady', label: '掲載準備', value: listedReady },
  ])
  const [pending, start] = useTransition()
  const [busyKey, setBusyKey] = useState('')

  const toggle = (it: Item) => {
    if (!editable) return
    const next = !it.value
    setItems((prev) => prev.map((p) => (p.key === it.key ? { ...p, value: next } : p)))
    setBusyKey(it.key)
    const fd = new FormData()
    fd.set('deal_id', dealId); fd.set('key', it.key); fd.set('value', String(next))
    start(async () => {
      const r = await togglePrepChecklistAction(fd)
      if (!r.ok) setItems((prev) => prev.map((p) => (p.key === it.key ? { ...p, value: it.value } : p))) // 失敗したら戻す
      setBusyKey('')
    })
  }

  const done = items.filter((i) => i.value).length
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
        商品化の状態 <span className="font-medium text-slate-700">{done}/{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <button
            key={it.key}
            onClick={() => toggle(it)}
            disabled={!editable || pending}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
              it.value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {busyKey === it.key && pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className={`h-3.5 w-3.5 ${it.value ? 'text-emerald-600' : 'text-slate-300'}`} />}
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}
