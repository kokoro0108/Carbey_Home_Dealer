import Link from 'next/link'
import { ArrowLeft, Package, Wrench, Store, CheckCircle2, Truck, Plus } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { listAllDeals, DEAL_STAGE_LABEL, type DealWithMember } from '@/lib/portal/deals'
import { listMembers, getMember } from '@/lib/portal/members'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { yen } from '@/lib/portal/labels'
import type { DealStatusStage } from '@/types/database'
import { createDealAction, dealToPreppingAction, dealToListingAction, recordSaleAction } from './actions'

export const dynamic = 'force-dynamic'

// カンバンの列（要件 5.5：仕入れ→商品化→販売中→納品完了→売却済み）
const COLUMNS: { key: DealStatusStage; icon: typeof Package; tone: string }[] = [
  { key: 'sourcing', icon: Package, tone: 'text-info-600' },
  { key: 'prepping', icon: Wrench, tone: 'text-amber-600' },
  { key: 'listing', icon: Store, tone: 'text-violet-600' },
  { key: 'delivered', icon: Truck, tone: 'text-sky-600' },
  { key: 'sold', icon: CheckCircle2, tone: 'text-emerald-600' },
]

export default async function AdminVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; error?: string; created?: string }>
}) {
  await requireFeature('reports')
  const sp = await searchParams
  const memberId = sp.member || undefined
  const [deals, members, filterMember] = await Promise.all([
    listAllDeals(memberId),
    listMembers(),
    memberId ? getMember(memberId) : Promise.resolve(null),
  ])
  // 全自動起票の対象＝自動権限を持つ稼働中の加盟店
  const autoMembers = members.filter((m) => m.grant_auto)
  const byStage = (s: DealStatusStage) => deals.filter((d) => d.status === s)

  return (
    <div className="space-y-6">
      <div>
        {filterMember && (
          <Link href="/admin/vehicles" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> すべての車両へ
          </Link>
        )}
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Package className="h-5 w-5 text-brand-500" /> 車両進捗管理{filterMember ? `：${filterMember.company_name ?? filterMember.member_name}` : ''}
        </h1>
        <p className="text-sm text-slate-500">
          仕入れ〜売却までの車両を、ステージ別に一元管理します（半自動＝オーダーから自動起票／全自動＝本部が起票）。
        </p>
      </div>

      {sp.created && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">車両を起票しました（仕入れ中）。</div>
      )}
      {sp.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">起票できませんでした：{sp.error}</div>
      )}

      {/* 全自動：車両の起票 */}
      <Card>
        <CardHeader title="全自動フローの車両を起票" />
        <CardBody>
          {autoMembers.length === 0 ? (
            <p className="text-xs text-slate-400">全自動（フルオート）の権限を持つ加盟店がいません。加盟店の編集画面で権限を割り当ててください。</p>
          ) : (
            <form action={createDealAction} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <select name="member_id" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" defaultValue={memberId ?? ''}>
                <option value="" disabled>加盟店を選択</option>
                {autoMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.company_name ?? m.member_name}</option>
                ))}
              </select>
              <input name="maker" placeholder="メーカー" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="car_model" placeholder="車種" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="order_amount" inputMode="numeric" placeholder="予算(円)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="sm:col-span-5 flex justify-end">
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                  <Plus className="h-4 w-4" /> 起票する
                </button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      {/* カンバン */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = byStage(col.key)
          const Icon = col.icon
          return (
            <div key={col.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <Icon className={`h-4 w-4 ${col.tone}`} /> {DEAL_STAGE_LABEL[col.key]}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && <p className="py-4 text-center text-xs text-slate-400">なし</p>}
                {items.map((d) => <DealCard key={d.id} deal={d} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DealCard({ deal }: { deal: DealWithMember }) {
  const vehicle = [deal.maker, deal.car_model, deal.year].filter(Boolean).join(' ') || '車両案件'
  const profit = deal.gross_profit_yen ?? 0
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <Link href={`/admin/vehicles/${deal.id}`} className="text-sm font-medium text-slate-800 hover:text-brand-600 hover:underline">{vehicle}</Link>
      <div className="mt-0.5 text-xs text-slate-500">
        {deal.member ? (
          <Link href={`/admin/members/${deal.member.id}`} className="hover:text-brand-600 hover:underline">
            {deal.member.company_name ?? deal.member.member_name}
          </Link>
        ) : '—'}
      </div>
      {deal.order_amount_yen != null && <div className="mt-1 text-xs text-slate-400">予算 {yen(deal.order_amount_yen)}</div>}
      <Link href={`/admin/vehicles/${deal.id}`} className="mt-1 inline-block text-[11px] font-medium text-brand-600 hover:underline">費用・詳細 →</Link>

      {/* ステージ別アクション */}
      <div className="mt-2 border-t border-slate-100 pt-2">
        {deal.status === 'sourcing' && (
          <form action={dealToPreppingAction}>
            <input type="hidden" name="deal_id" value={deal.id} />
            <button className="w-full rounded-md border border-amber-300 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50">商品化中へ →</button>
          </form>
        )}
        {deal.status === 'prepping' && (
          <form action={dealToListingAction}>
            <input type="hidden" name="deal_id" value={deal.id} />
            <button className="w-full rounded-md border border-violet-300 px-2 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50">販売中へ →</button>
          </form>
        )}
        {(deal.status === 'listing' || deal.status === 'delivered') && (
          <form action={recordSaleAction} className="space-y-1.5">
            <input type="hidden" name="deal_id" value={deal.id} />
            <input name="sale_price" inputMode="numeric" required placeholder="販売価格(円)" className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px]" />
            <input type="date" name="sold_at" className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600" />
            <button className="w-full rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700">売却を記録</button>
          </form>
        )}
        {deal.status === 'sold' && (
          <div className="text-[11px]">
            <div className="flex justify-between"><span className="text-slate-400">販売</span><span className="text-slate-700">{yen(deal.sale_price_yen)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">粗利益</span><span className={profit >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-red-600'}>{yen(profit)}</span></div>
          </div>
        )}
      </div>
    </div>
  )
}
