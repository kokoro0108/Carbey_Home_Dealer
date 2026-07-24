import Link from 'next/link'
import { Plus, Users, ChevronRight } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/session'
import { listPlans, getPlanMemberCounts } from '@/lib/portal/plans'
import { yen } from '@/lib/portal/labels'
import { updatePlanAction } from './actions'

export const dynamic = 'force-dynamic'

const field = 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none'

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  // プラン管理は super_admin のみ (permission matrix)
  await requireAdmin()
  const [plans, memberCounts, sp] = await Promise.all([listPlans(), getPlanMemberCounts(), searchParams])

  return (
    <div>
      {sp.error === 'model_required' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          利用できる運用方式（半自動／全自動）を1つ以上選択してください。保存されていません。
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">プラン管理</h1>
          <p className="mt-1 text-sm text-slate-500">{plans.length} プラン</p>
        </div>
        <Link
          href="/admin/plans/new"
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          プランを追加
        </Link>
      </div>

      <div className="space-y-4">
        {plans.map((p) => (
          <form
            key={p.id}
            action={updatePlanAction}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <input type="hidden" name="id" value={p.id} />
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{p.code}</span>
                {/* ⑫ 実際に利用できる運用方式（保有モデル）をそのまま表示する。
                       plan_type 由来の二者択一ラベルは実態と食い違うため使わない。 */}
                {p.has_semi && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">半自動</span>}
                {p.has_auto && <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-600">全自動</span>}
                {p.has_semi && p.has_auto && <span className="text-[11px] text-slate-400">（両方・切替可）</span>}
                {!p.has_semi && !p.has_auto && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">運用方式なし</span>}
                {/* このプランの加盟店数 → 会員一覧（plan_id 絞り込み）へ */}
                <Link href={`/admin/members?plan_id=${p.id}`} className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100">
                  <Users className="h-3 w-3" /> 加盟店 {memberCounts[p.id] ?? 0} 件 <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" name="is_active" defaultChecked={p.is_active} />
                有効
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-slate-500">プラン名</label>
                <input name="name" defaultValue={p.name} className={field} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">月額 (円)</label>
                <input name="monthly_fee_yen" type="number" min="0" defaultValue={p.monthly_fee_yen} className={field} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">加盟金 (円)</label>
                <input name="joining_fee_yen" type="number" min="0" defaultValue={p.joining_fee_yen} className={field} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">表示順</label>
                <input name="display_order" type="number" defaultValue={p.display_order} className={field} />
              </div>
              {/* ⑦ 自動売買：初期枠数・月額管理手数料 */}
              <div>
                <label className="mb-1 block text-xs text-slate-500">自動売買 初期枠数</label>
                <input name="default_auto_slots" type="number" min="0" max="10" defaultValue={p.default_auto_slots} className={field} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">月額管理手数料 (円)</label>
                <input name="mgmt_fee_monthly_yen" type="number" min="0" defaultValue={p.mgmt_fee_monthly_yen} className={field} />
              </div>
              {/* ⑫ 利用できる運用方式：半自動・全自動をそれぞれ独立に割り当てる（両方可）。
                     plan_type はこの選択から自動導出するため、hidden で持ち回らない。 */}
              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs text-slate-500">利用できる運用方式 *</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" name="has_semi" defaultChecked={p.has_semi} className="h-4 w-4 rounded border-slate-300 text-brand-500" />
                    半自動（セミオート）
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" name="has_auto" defaultChecked={p.has_auto} className="h-4 w-4 rounded border-slate-300 text-brand-500" />
                    全自動（フルオート）
                  </label>
                  <span className="text-xs text-slate-400">※両方に割り当てると、加盟店はどちらも利用でき、フローを切り替えられます</span>
                </div>
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs text-slate-500">説明</label>
                <input name="description" defaultValue={p.description ?? ''} className={field} />
              </div>
              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs text-slate-500">機能 (1行1項目)</label>
                <textarea name="features" rows={2} defaultValue={p.features.join('\n')} className={field} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">月額 {yen(p.monthly_fee_yen)} / 加盟金 {yen(p.joining_fee_yen)}</span>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">保存</button>
            </div>
          </form>
        ))}
      </div>
    </div>
  )
}
