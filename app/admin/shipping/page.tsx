import { Truck, Plus, Trash2, Car } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { listShippingRates, listSpecialMakers } from '@/lib/portal/shipping'
import { PREFECTURES } from '@/lib/portal/prefectures'
import { yen } from '@/lib/portal/labels'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { setRateAction, deleteRateAction, addMakerAction, deleteMakerAction } from './actions'

export const dynamic = 'force-dynamic'

const field = 'rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none'

export default async function AdminShippingPage() {
  await requireFeature('members')
  const [rates, makers] = await Promise.all([listShippingRates(), listSpecialMakers()])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Truck className="h-5 w-5 text-brand-500" /> 陸送費設定
        </h1>
        <p className="mt-1 text-sm text-slate-500">発地×着地の陸送費を設定します。設定した区間は自動計算、未設定・特殊車は個別見積もりに切り替わります。</p>
      </div>

      {/* 料金の追加 */}
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Plus className="h-4 w-4 text-brand-500" /> 料金を設定（発地 → 着地）</span>} />
        <CardBody>
          <form action={setRateAction} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">発地</label>
              <select name="from_pref" className={field} defaultValue="">
                <option value="" disabled>選択</option>
                {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <span className="pb-2 text-slate-400">→</span>
            <div>
              <label className="mb-1 block text-xs text-slate-500">着地</label>
              <select name="to_pref" className={field} defaultValue="">
                <option value="" disabled>選択</option>
                {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">料金（円）</label>
              <input name="amount" inputMode="numeric" placeholder="50000" className={`${field} w-32`} />
            </div>
            <button className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600">設定</button>
          </form>
          <p className="mt-2 text-[11px] text-slate-400">同じ区間を再設定すると上書きされます。</p>
        </CardBody>
      </Card>

      {/* 料金一覧 */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">設定済みの料金（{rates.length} 区間）</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">発地</th>
                <th className="px-4 py-2.5 font-medium">着地</th>
                <th className="px-4 py-2.5 font-medium">料金</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rates.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">未設定です。区間ごとに料金を追加してください。</td></tr>}
              {rates.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{r.from_pref}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.to_pref}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{yen(r.amount_yen)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <form action={deleteRateAction} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="削除"><Trash2 className="h-4 w-4" /></button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 特殊車メーカー（個別見積） */}
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Car className="h-4 w-4 text-brand-500" /> 個別見積もり対象メーカー（高級車・規格外車）</span>} />
        <CardBody>
          <p className="mb-3 text-xs text-slate-500">これらのメーカーは陸送費が高額になるため、自動計算せず「個別見積もり」に切り替わります。</p>
          <form action={addMakerAction} className="mb-3 flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-500">メーカー名</label>
              <input name="maker" placeholder="例：マセラティ" className={`${field} w-full`} />
            </div>
            <button className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600">追加</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {makers.length === 0 && <span className="text-xs text-slate-400">未登録です。</span>}
            {makers.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {m.maker}
                <form action={deleteMakerAction} className="inline">
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-slate-400 hover:text-red-600" title="削除"><Trash2 className="h-3 w-3" /></button>
                </form>
              </span>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
