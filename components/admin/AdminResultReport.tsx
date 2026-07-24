'use client'

import { useRef, useState, useTransition } from 'react'
import { FileText, Download, Trash2, Loader2, UploadCloud } from 'lucide-react'
import { uploadDealResultReportAction, removeDealResultReportAction } from '@/app/admin/vehicles/actions'

/**
 * 結果報告書のドラッグ＆ドロップ添付（本部・要件5.5）。画像/PDF・1案件1点。
 * ドロップ / クリック選択の両対応。加盟店は閲覧のみ。
 */
export default function AdminResultReport({ dealId, reportName, reportAt }: { dealId: string; reportName: string | null; reportAt: string | null }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const viewUrl = `/api/portal/deal-result-report/${dealId}`

  const upload = (file: File | undefined) => {
    if (!file) return
    setError('')
    const fd = new FormData()
    fd.set('deal_id', dealId)
    fd.set('report', file)
    start(async () => {
      const r = await uploadDealResultReportAction(fd)
      if (!r.ok) setError(r.error ?? 'アップロードに失敗しました')
      if (inputRef.current) inputRef.current.value = ''
    })
  }
  const remove = () => {
    setError('')
    const fd = new FormData(); fd.set('deal_id', dealId)
    start(async () => { const r = await removeDealResultReportAction(fd); if (!r.ok) setError(r.error ?? '') })
  }

  return (
    <div className="space-y-2">
      {reportName && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <FileText className="h-4 w-4 text-brand-500" />
          <span className="text-sm text-slate-700">{reportName}</span>
          {reportAt && <span className="text-[11px] text-slate-400">{new Date(reportAt).toLocaleString('ja-JP')}</span>}
          <a href={viewUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"><Download className="h-3.5 w-3.5" /> 表示</a>
          <button onClick={remove} disabled={pending} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> 削除</button>
        </div>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]) }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${drag ? 'border-brand-400 bg-brand-50' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin text-brand-500" /> : <UploadCloud className="h-5 w-5 text-slate-400" />}
        <span className="text-xs text-slate-500">{reportName ? '差し替え：' : ''}結果報告書をここにドラッグ＆ドロップ、またはクリックして選択</span>
        <span className="text-[11px] text-slate-400">画像 / PDF・20MBまで・1案件1点</span>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0] ?? undefined)} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
