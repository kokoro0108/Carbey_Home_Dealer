import Link from 'next/link'
import { ArrowLeft, Package, Wrench, CheckCircle2, Check } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { listOrders } from '@/lib/portal/orders'
import { getMember } from '@/lib/portal/members'
import { mapDealsByOrderId, getAdminDealSummary, DEAL_STAGE_LABEL } from '@/lib/portal/deals'
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, yen } from '@/lib/portal/labels'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { OrderStatus, DealStatusStage, VehicleDealRow } from '@/types/database'
import { setOrderStatusAction } from './actions'
import { adminMoveToPreppingAction } from './deal-actions'

export const dynamic = 'force-dynamic'

const STATUSES: OrderStatus[] = ['received', 'in_progress', 'completed', 'cancelled']
/** 半自動売買の進捗ステージ（オーダー送信後の案件ライフサイクル）。 */
const STAGES: DealStatusStage[] = ['sourcing', 'prepping', 'delivered']
const field = 'rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-brand-400 focus:outline-none'

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; member?: string; stage?: string }>
}) {
  await requireFeature('orders')
  const sp = await searchParams
  const filter = STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined
  const stageFilter = STAGES.includes(sp.stage as DealStatusStage) ? (sp.stage as DealStatusStage) : undefined
  const memberId = sp.member || undefined

  const [allOrders, member, dealSummary] = await Promise.all([
    listOrders({ status: filter, memberId }),
    memberId ? getMember(memberId) : Promise.resolve(null),
    getAdminDealSummary(),
  ])
  // 各オーダーに紐づく案件（＝半自動売買の進捗）を取得して突合
  const deals = await mapDealsByOrderId(allOrders.map((o) => o.id))
  const orders = stageFilter ? allOrders.filter((o) => deals.get(o.id)?.status === stageFilter) : allOrders

  const hrefWith = (patch: { status?: OrderStatus | null; stage?: DealStatusStage | null }) => {
    const params = new URLSearchParams()
    const nextStatus = patch.status === null ? undefined : (patch.status ?? filter)
    const nextStage = patch.stage === null ? undefined : (patch.stage ?? stageFilter)
    if (nextStatus) params.set('status', nextStatus)
    if (nextStage) params.set('stage', nextStage)
    if (memberId) params.set('member', memberId)
    const qs = params.toString()
    return `/admin/orders${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div>
        {member && (
          <Link href={`/admin/members/${member.id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> {member.company_name ?? member.member_name} の詳細へ
          </Link>
        )}
        <h1 className="text-xl font-bold text-slate-900">オーダー管理{member ? `：${member.company_name ?? member.member_name}` : ''}</h1>
        <p className="text-sm text-slate-500">加盟店からの仕入れ依頼と、半自動売買の進捗を一元管理します。</p>
      </div>

      {/* ===== 進捗サマリ（全加盟店の案件をステージ別に集計） ===== */}
      <div className="grid grid-cols-3 gap-4">
        <StageSummary icon={<Package className="h-5 w-5" />} label={DEAL_STAGE_LABEL.sourcing} count={dealSummary.sourcing}
          tone="sky" href={hrefWith({ stage: 'sourcing' })} active={stageFilter === 'sourcing'} />
        <StageSummary icon={<Wrench className="h-5 w-5" />} label={DEAL_STAGE_LABEL.prepping} count={dealSummary.prepping}
          tone="amber" href={hrefWith({ stage: 'prepping' })} active={stageFilter === 'prepping'} />
        <StageSummary icon={<CheckCircle2 className="h-5 w-5" />} label={DEAL_STAGE_LABEL.delivered} count={dealSummary.delivered}
          tone="green" href={hrefWith({ stage: 'delivered' })} active={stageFilter === 'delivered'} />
      </div>

      {/* フィルタ（オーダー状態／進捗ステージ。member 絞り込みは維持） */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">オーダー状態</span>
          <FilterTab label="すべて" href={hrefWith({ status: null })} active={!filter} />
          {STATUSES.map((s) => (
            <FilterTab key={s} label={ORDER_STATUS_LABEL[s]} href={hrefWith({ status: s })} active={filter === s} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">売買進捗</span>
          <FilterTab label="すべて" href={hrefWith({ stage: null })} active={!stageFilter} />
          {STAGES.map((s) => (
            <FilterTab key={s} label={DEAL_STAGE_LABEL[s]} href={hrefWith({ stage: s })} active={stageFilter === s} />
          ))}
        </div>
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
                <th className="px-5 py-3 font-medium">売買進捗</th>
                <th className="px-5 py-3 font-medium">オーダー状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">該当するオーダーがありません。</td></tr>
              )}
              {orders.map((o) => {
                const deal = deals.get(o.id)
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">
                      {/* ③ 個別詳細（車両進捗管理）へ遷移 */}
                      {deal ? (
                        <Link href={`/admin/vehicles/${deal.id}`} className="text-brand-600 hover:underline">{o.order_number ?? '—'}</Link>
                      ) : (
                        <span className="text-slate-700">{o.order_number ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {o.member ? (
                        <Link href={`/admin/members/${o.member.id}`} className="text-slate-700 hover:text-brand-600 hover:underline">
                          {o.member.company_name ?? o.member.member_name}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {deal ? (
                        <Link href={`/admin/vehicles/${deal.id}`} className="hover:text-brand-600 hover:underline">{[o.maker, o.car_model, o.year].filter(Boolean).join(' ')}</Link>
                      ) : [o.maker, o.car_model, o.year].filter(Boolean).join(' ')}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{o.budget_yen ? yen(o.budget_yen) : '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{new Date(o.created_at).toLocaleDateString('ja-JP')}</td>

                    {/* 半自動売買の進捗（仕入れ中 → 商品化中 → 納品完了）＋個別詳細への導線 */}
                    <td className="px-5 py-3">
                      <DealProgress deal={deal} />
                      {deal && (
                        <Link href={`/admin/vehicles/${deal.id}`} className="mt-1 inline-block text-[11px] font-medium text-brand-600 hover:underline">費用・詳細 →</Link>
                      )}
                    </td>

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
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-slate-400">
        ※ 進捗はオーダー送信で「仕入れ中」に自動遷移します。整備・修理が発生した場合のみ「商品化中へ」で移行してください。
        「納品完了」は加盟店が車両受け取り後に「受け取り完了」を押すと自動精算とあわせて反映されます。
      </p>
    </div>
  )
}

/** 案件の進捗ステッパー（仕入れ中 → 商品化中 → 納品完了）＋本部の商品化移行ボタン。 */
function DealProgress({ deal }: { deal: VehicleDealRow | undefined }) {
  if (!deal) {
    return <span className="text-xs text-slate-400">案件なし</span>
  }
  const idx = deal.status === 'delivered' ? 2 : deal.status === 'prepping' ? 1 : 0
  const settled = deal.status === 'delivered' && deal.settled

  return (
    <div className="min-w-[210px]">
      {/* ステッパー */}
      <div className="flex items-center">
        {STAGES.map((stage, i) => {
          const done = i < idx || (i === idx && deal.status === 'delivered')
          const current = i === idx && deal.status !== 'delivered'
          return (
            <div key={stage} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  done ? 'bg-green-500 text-white'
                    : current ? 'border-2 border-brand-500 bg-brand-50 text-brand-600'
                    : 'border-2 border-slate-200 bg-white text-slate-300'
                }`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={`mt-1 whitespace-nowrap text-[10px] ${
                  current ? 'font-semibold text-brand-600' : done ? 'text-green-600' : 'text-slate-400'
                }`}>
                  {DEAL_STAGE_LABEL[stage]}
                </span>
              </div>
              {i < STAGES.length - 1 && <div className={`mx-1 mb-4 h-0.5 flex-1 ${i < idx ? 'bg-green-500' : 'bg-slate-200'}`} />}
            </div>
          )
        })}
      </div>

      {/* 本部の操作・精算結果 */}
      <div className="mt-1.5 flex items-center gap-2">
        {deal.status === 'sourcing' && (
          <form action={adminMoveToPreppingAction}>
            <input type="hidden" name="deal_id" value={deal.id} />
            <button className="rounded-md border border-amber-300 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-50">
              商品化中へ
            </button>
          </form>
        )}
        {deal.status === 'prepping' && (
          <span className="text-[10px] text-slate-400">加盟店の受け取り完了待ち</span>
        )}
        {settled && deal.remaining_yen !== null && (
          <span className="text-[10px] text-slate-500">精算済み・残金 {yen(deal.remaining_yen)}</span>
        )}
      </div>
    </div>
  )
}

function StageSummary({ icon, label, count, tone, href, active }: {
  icon: React.ReactNode; label: string; count: number
  tone: 'sky' | 'amber' | 'green'; href: string; active: boolean
}) {
  const tones = {
    sky: { text: 'text-info-600', ring: 'ring-info-400' },
    amber: { text: 'text-amber-600', ring: 'ring-amber-400' },
    green: { text: 'text-emerald-600', ring: 'ring-emerald-400' },
  }[tone]
  return (
    <Link href={href} className={`rounded-xl border bg-white p-4 transition hover:bg-slate-50 ${active ? `border-transparent ring-2 ${tones.ring}` : 'border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <span className={tones.text}>{icon}</span>
        <span className="text-2xl font-bold text-slate-900">{count}</span>
      </div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </Link>
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
