import { Plus, CheckCircle2, ShoppingCart } from 'lucide-react'
import { requireMember } from '@/lib/auth/session'
import { listOwnOrders } from '@/lib/portal/orders'
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, yen } from '@/lib/portal/labels'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { createOrderAction } from './actions'

export const dynamic = 'force-dynamic'

const field =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'
const labelCls = 'mb-1 block text-[13px] font-medium text-slate-700'

export default async function MemberOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>
}) {
  const session = await requireMember()
  const orders = await listOwnOrders(session.userId)
  const sp = await searchParams

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">仕入れオーダー</h1>
          <p className="text-sm text-slate-500">本部へ車両の仕入れを依頼します。</p>
        </div>
      </div>

      {sp.created && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> 仕入れオーダーを送信しました。本部からの連絡をお待ちください。
        </div>
      )}
      {sp.error === 'model_required' && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">車種は必須です。</div>
      )}

      {/* 新規オーダーフォーム */}
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Plus className="h-4 w-4 text-brand-500" /> 新規オーダー</span>} />
        <CardBody>
          <form action={createOrderAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>メーカー</label>
              <input name="maker" placeholder="トヨタ" className={field} />
            </div>
            <div>
              <label className={labelCls}>車種 *</label>
              <input name="car_model" required placeholder="ハリアー" className={field} />
            </div>
            <div>
              <label className={labelCls}>年式</label>
              <input name="year" placeholder="2021年" className={field} />
            </div>
            <div>
              <label className={labelCls}>予算（円）</label>
              <input name="budget_yen" type="number" min="0" placeholder="2500000" className={field} />
            </div>
            <div>
              <label className={labelCls}>希望色</label>
              <input name="preferred_color" placeholder="ホワイトパール" className={field} />
            </div>
            <div>
              <label className={labelCls}>走行距離上限（km）</label>
              <input name="mileage_max" type="number" min="0" placeholder="30000" className={field} />
            </div>
            <div className="sm:col-span-3">
              <label className={labelCls}>要望・備考</label>
              <textarea name="notes" rows={2} placeholder="ワンオーナー希望。事故歴なし。" className={field} />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-500/20 hover:bg-brand-600">
                オーダーを送信
              </button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* 自分のオーダー一覧 */}
      <Card>
        <CardHeader title="オーダー履歴" action={<span className="text-xs text-slate-400">{orders.length} 件</span>} />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">オーダーID</th>
                <th className="px-5 py-3 font-medium">車両</th>
                <th className="px-5 py-3 font-medium">予算</th>
                <th className="px-5 py-3 font-medium">ステータス</th>
                <th className="px-5 py-3 font-medium">依頼日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    <ShoppingCart className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                    まだオーダーがありません。上のフォームから依頼できます。
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">{o.order_number ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-700">
                    {[o.maker, o.car_model, o.year].filter(Boolean).join(' ')}
                  </td>
                  <td className="px-5 py-3 text-slate-700">{o.budget_yen ? yen(o.budget_yen) : '—'}</td>
                  <td className="px-5 py-3"><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                  <td className="px-5 py-3 text-slate-500">{new Date(o.created_at).toLocaleDateString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  )
}
