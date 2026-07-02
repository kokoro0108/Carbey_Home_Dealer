import Link from 'next/link'
import { requireFeature } from '@/lib/auth/session'
import { listOrders } from '@/lib/portal/orders'
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, yen } from '@/lib/portal/labels'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { OrderStatus } from '@/types/database'
import { setOrderStatusAction } from './actions'

export const dynamic = 'force-dynamic'

const STATUSES: OrderStatus[] = ['received', 'in_progress', 'completed', 'cancelled']
const field = 'rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-brand-400 focus:outline-none'

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireFeature('orders')
  const sp = await searchParams
  const filter = STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined
  const orders = await listOrders(filter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">オーダー管理</h1>
        <p className="text-sm text-slate-500">加盟店からの仕入れ依頼を処理します。</p>
      </div>

      {/* ステータスフィルタ */}
      <div className="flex flex-wrap gap-2">
        <FilterTab label="すべて" href="/admin/orders" active={!filter} />
        {STATUSES.map((s) => (
          <FilterTab key={s} label={ORDER_STATUS_LABEL[s]} href={`/admin/orders?status=${s}`} active={filter === s} />
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">オーダーID</th>
                <th className="px-5 py-3 font-medium">加盟店</th>
                <th className="px-5 py-3 font-medium">車両</th>
                <th className="px-5 py-3 font-medium">予算</th>
                <th className="px-5 py-3 font-medium">依頼日</th>
                <th className="px-5 py-3 font-medium">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">該当するオーダーがありません。</td></tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">{o.order_number ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-700">
                    {o.member?.company_name ?? o.member?.member_name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-700">{[o.maker, o.car_model, o.year].filter(Boolean).join(' ')}</td>
                  <td className="px-5 py-3 text-slate-700">{o.budget_yen ? yen(o.budget_yen) : '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{new Date(o.created_at).toLocaleDateString('ja-JP')}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                      <form action={setOrderStatusAction} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={o.id} />
                        <select name="status" defaultValue={o.status} className={field}>
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                        <button className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">更新</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function FilterTab({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </Link>
  )
}
