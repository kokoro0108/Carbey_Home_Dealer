import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/session'
import { createPlanAction } from '../actions'

export const dynamic = 'force-dynamic'

const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none'
const label = 'mb-1 block text-sm font-medium text-slate-700'

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/admin/plans" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        プラン管理へ
      </Link>
      <h1 className="mb-6 text-xl font-bold text-slate-900">プランを追加</h1>

      {sp.error === 'required' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">コードとプラン名は必須です。</div>
      )}
      {sp.error === 'model_required' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          利用できる運用方式（半自動／全自動）を1つ以上選択してください。
        </div>
      )}

      <form action={createPlanAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>コード *</label>
            <input name="code" required placeholder="例: platinum" className={`${field} font-mono`} />
          </div>
          <div>
            <label className={label}>プラン名 *</label>
            <input name="name" required className={field} />
          </div>
        </div>

        {/* ⑫ 半自動・全自動は二者択一ではなく、それぞれ独立に割り当てる（両方可） */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-1 text-sm font-medium text-slate-700">利用できる運用方式 *</div>
          <p className="mb-2.5 text-xs text-slate-500">
            それぞれ個別に割り当てられます。両方を選ぶと、このプランの加盟店は半自動・全自動の両方を利用でき、フローの切り替えも可能になります。
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 hover:bg-slate-50">
              <input type="checkbox" name="has_semi" defaultChecked className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400" />
              <span>
                <span className="block text-sm font-medium text-slate-800">半自動（セミオート）</span>
                <span className="block text-xs text-slate-500">加盟者が仕入れオーダーを送り、自身で販売する</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 hover:bg-slate-50">
              <input type="checkbox" name="has_auto" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400" />
              <span>
                <span className="block text-sm font-medium text-slate-800">全自動（フルオート）</span>
                <span className="block text-xs text-slate-500">本部主導で仕入れ〜販売まで運用</span>
              </span>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={label}>月額 (円)</label>
            <input name="monthly_fee_yen" type="number" min="0" defaultValue="0" className={field} />
          </div>
          <div>
            <label className={label}>加盟金 (円)</label>
            <input name="joining_fee_yen" type="number" min="0" defaultValue="0" className={field} />
          </div>
          <div>
            <label className={label}>表示順</label>
            <input name="display_order" type="number" defaultValue="0" className={field} />
          </div>
        </div>
        {/* ⑦ 自動売買：初期枠数・月額管理手数料 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>自動売買 初期枠数</label>
            <input name="default_auto_slots" type="number" min="0" max="10" defaultValue="0" className={field} />
          </div>
          <div>
            <label className={label}>月額管理手数料 (円)</label>
            <input name="mgmt_fee_monthly_yen" type="number" min="0" defaultValue="0" className={field} />
          </div>
        </div>
        <div>
          <label className={label}>説明</label>
          <input name="description" className={field} />
        </div>
        <div>
          <label className={label}>機能 (1行1項目)</label>
          <textarea name="features" rows={3} className={field} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_active" defaultChecked />
          有効にする
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Link href="/admin/plans" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            キャンセル
          </Link>
          <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            追加する
          </button>
        </div>
      </form>
    </div>
  )
}
