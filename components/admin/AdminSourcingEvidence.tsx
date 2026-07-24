'use client'

import { useRef, useState, useTransition } from 'react'
import { Paperclip, FileText, Download, Trash2, Loader2, Upload } from 'lucide-react'
import { uploadDealSourcingEvidenceAction, removeDealSourcingEvidenceAction } from '@/app/admin/vehicles/actions'

/**
 * 本部が「販売中」の車両に仕入れデータのエビデンスを1点添付する（画像/PDF）。
 * 加盟店は閲覧のみ（この操作UIは本部側のみ）。
 */
export default function AdminSourcingEvidence({
  dealId,
  evidenceName,
  evidenceAt,
}: {
  dealId: string
  evidenceName: string | null
  evidenceAt: string | null
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const viewUrl = `/api/portal/deal-sourcing-evidence/${dealId}`

  const submit = (fd: FormData) => {
    setError('')
    fd.set('deal_id', dealId)
    start(async () => {
      const r = await uploadDealSourcingEvidenceAction(fd)
      if (!r.ok) setError(r.error ?? 'アップロードに失敗しました')
      else if (inputRef.current) inputRef.current.value = ''
    })
  }
  const remove = () => {
    setError('')
    const fd = new FormData()
    fd.set('deal_id', dealId)
    start(async () => {
      const r = await removeDealSourcingEvidenceAction(fd)
      if (!r.ok) setError(r.error ?? '削除に失敗しました')
    })
  }

  return (
    <div className="space-y-2">
      {evidenceName ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <FileText className="h-4 w-4 text-brand-500" />
          <span className="text-sm text-slate-700">{evidenceName}</span>
          {evidenceAt && <span className="text-[11px] text-slate-400">{new Date(evidenceAt).toLocaleString('ja-JP')}</span>}
          <a href={viewUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
            <Download className="h-3.5 w-3.5" /> 表示
          </a>
          <button onClick={remove} disabled={pending} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> 削除
          </button>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><Paperclip className="h-3.5 w-3.5" /> まだ仕入れエビデンスは添付されていません。</p>
      )}

      <form action={submit} className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          name="evidence"
          accept="image/*,application/pdf"
          className="text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {evidenceName ? '差し替え' : '添付'}
        </button>
        <span className="text-[11px] text-slate-400">画像 / PDF・20MBまで・1案件1点</span>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
