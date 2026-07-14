import { FileText, CheckCircle2, Trash2, Plus, Receipt } from 'lucide-react'
import { requireStaff } from '@/lib/auth/session'
import { listAgreements, listAttachments } from '@/lib/portal/agreements'
import { saveAgreementAction, deleteAgreementAction, saveAttachmentAction, deleteAttachmentAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; edit?: string; edit_attach?: string }>
}) {
  await requireStaff()
  const items = await listAgreements()
  const sp = await searchParams
  const editing = sp.edit ? items.find((a) => a.id === sp.edit) : undefined
  const active = items.find((a) => a.published)
  const attachments = active ? await listAttachments(active.id) : []
  const editingAttach = sp.edit_attach ? attachments.find((a) => a.id === sp.edit_attach) : undefined

  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">利用規約の設定</h1>
        <p className="text-sm text-slate-500">加盟店が同意する利用規約を編集・公開します。公開できるのは1つです。</p>
      </div>

      {sp.saved && <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" /> 保存しました。</div>}
      {sp.error === 'required' && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">タイトルと本文は必須です。</div>}

      {/* 編集フォーム */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FileText className="h-4 w-4 text-brand-500" /> {editing ? '規約を編集' : '新しい規約を作成'}
        </h2>
        <form action={saveAgreementAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">タイトル *</label>
            <input name="title" required defaultValue={editing?.title ?? 'カーベイホームディーラー 加盟店利用規約'} className={field} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">本文 *</label>
            <textarea name="body" required rows={14} defaultValue={editing?.body ?? ''} placeholder="利用規約の本文を入力（改行はそのまま反映されます）" className={`${field} font-mono`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="published" defaultChecked={editing?.published ?? true} className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400" />
            この規約を公開する（加盟店に表示・同意対象になります）
          </label>
          <div className="flex justify-end gap-2">
            {editing && <a href="/admin/terms" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">新規に切替</a>}
            <button className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600">保存する</button>
          </div>
        </form>
      </div>

      {/* 一覧 */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">規約の履歴</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {items.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">まだ規約がありません。</li>}
            {items.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{a.title}</span>
                    <span className="text-xs text-slate-400">v{a.version}</span>
                    {a.published && <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">公開中</span>}
                  </div>
                  <div className="text-xs text-slate-400">{new Date(a.updated_at).toLocaleString('ja-JP')}</div>
                </div>
                <a href={`/admin/terms?edit=${a.id}`} className="rounded-md px-2.5 py-1 text-xs font-medium text-info-600 hover:underline">編集</a>
                {!a.published && (
                  <form action={deleteAgreementAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="削除"><Trash2 className="h-4 w-4" /></button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
        {!active && <p className="mt-2 text-xs text-amber-600">⚠️ 公開中の規約がありません。加盟店が同意できるよう、いずれかを公開してください。</p>}
      </div>

      {/* ===== 各種料金表（別添・規約と同居して同意対象） ===== */}
      {active && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Receipt className="h-4 w-4 text-brand-500" /> 各種料金表（利用規約の別添）
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            「{active.title}」に付随する料金表です。加盟店の規約ページに同居表示され、規約と一緒に同意対象になります。項目は自由に追加できます。
          </p>

          {/* 追加/編集フォーム */}
          <form action={saveAttachmentAction} className="mb-4 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <input type="hidden" name="agreement_id" value={active.id} />
            {editingAttach && <input type="hidden" name="id" value={editingAttach.id} />}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              {editingAttach ? <FileText className="h-3.5 w-3.5 text-brand-500" /> : <Plus className="h-3.5 w-3.5 text-brand-500" />}
              {editingAttach ? '料金表を編集' : '料金表を追加'}
            </div>
            <input name="title" required defaultValue={editingAttach?.title ?? ''} placeholder="料金表のタイトル（例：各種料金表 / 陸送料金表）" className={field} />
            <textarea name="body" rows={8} defaultValue={editingAttach?.body ?? ''} placeholder="料金表の内容をテキストで入力（改行はそのまま反映されます）" className={`${field} font-mono`} />
            <div className="flex justify-end gap-2">
              {editingAttach && <a href="/admin/terms" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-white">新規に切替</a>}
              <button className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600">保存</button>
            </div>
          </form>

          {/* 料金表一覧 */}
          <ul className="divide-y divide-slate-100">
            {attachments.length === 0 && <li className="py-3 text-center text-xs text-slate-400">料金表はまだありません。</li>}
            {attachments.map((att) => (
              <li key={att.id} className="flex items-center gap-3 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{att.title}</span>
                {!att.body && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">内容未入力</span>}
                <a href={`/admin/terms?edit_attach=${att.id}`} className="rounded-md px-2.5 py-1 text-xs font-medium text-info-600 hover:underline">編集</a>
                <form action={deleteAttachmentAction}>
                  <input type="hidden" name="id" value={att.id} />
                  <button className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="削除"><Trash2 className="h-4 w-4" /></button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">
            ※ 料金表を変更した場合、既存加盟店にも再同意を求めるには、規約を編集・再公開して新バージョンを発行してください。
          </p>
        </div>
      )}
    </div>
  )
}
