import { Bot, Package, Store, CheckCircle2, Clock, Gauge, Lock, Paperclip } from 'lucide-react'
import { requireMember } from '@/lib/auth/session'
import { getMemberByUserId } from '@/lib/portal/members'
import { getOwnAutoCapacity, getMemberWaitingPosition } from '@/lib/portal/auto-trading'
import { getMgmtFeePreview } from '@/lib/portal/mgmt-fee'
import { listOwnAutoDeals } from '@/lib/portal/deals'
import ReserveButton from '@/components/portal-dark/ReserveButton'
import { yen } from '@/lib/portal/labels'
import type { DealStatusStage, VehicleDealRow } from '@/types/database'

export const dynamic = 'force-dynamic'

// 全自動フローの進捗列（仕入れ中 → 販売中 → 精算完了）。
//   現フェーズでは「販売中・精算完了」の2段階のみ運用（active）。
//   「仕入れ中」は第二フェーズから拡張（preview 表示・案件は個別表示しない）。ロジックは全段階を構築済み。
const FLOW_STAGES: { key: DealStatusStage; label: string; icon: typeof Package; tone: string; accent: string; active: boolean }[] = [
  { key: 'sourcing', label: '仕入れ中', icon: Package, tone: 'text-slate-400', accent: 'border-carbon-700', active: false },
  { key: 'listing', label: '販売中', icon: Store, tone: 'text-violet-300', accent: 'border-violet-500/40', active: true },
  { key: 'sold', label: '精算完了', icon: CheckCircle2, tone: 'text-emerald-300', accent: 'border-emerald-500/40', active: true },
]

function fmtDate(v: string | null): string {
  return v ? new Date(v).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '—'
}

function DealCard({ deal }: { deal: VehicleDealRow }) {
  const title = [deal.maker, deal.car_model].filter(Boolean).join(' ') || '車両案件'
  return (
    <div className="rounded-xl border border-carbon-700 bg-carbon-800/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-white">{title}</div>
        {deal.year && <span className="shrink-0 rounded bg-carbon-700 px-1.5 py-0.5 text-[10px] text-slate-400">{deal.year}</span>}
      </div>
      {deal.status === 'sold' ? (
        <dl className="mt-2 space-y-1 text-[11px]">
          <div className="flex justify-between"><dt className="text-slate-500">販売価格</dt><dd className="font-medium text-slate-200">{yen(deal.sale_price_yen)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">粗利益</dt><dd className={`font-semibold ${(deal.gross_profit_yen ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{yen(deal.gross_profit_yen)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">売却日</dt><dd className="text-slate-400">{fmtDate(deal.sold_at)}</dd></div>
        </dl>
      ) : (
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>予算 {yen(deal.order_amount_yen)}</span>
          <span>掲載 {fmtDate(deal.listed_at)}</span>
        </div>
      )}
      {deal.sourcing_evidence_path && (
        <a
          href={`/api/portal/deal-sourcing-evidence/${deal.id}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-300 hover:underline"
        >
          <Paperclip className="h-3 w-3" /> 仕入れエビデンス
        </a>
      )}
    </div>
  )
}

export default async function PortalAutoPage() {
  const session = await requireMember()
  const member = await getMemberByUserId(session.userId)
  const capacity = await getOwnAutoCapacity(session.userId) // 自動売買権限が無ければ null

  if (!member || !capacity) {
    return (
      <div className="rounded-2xl border border-carbon-700 bg-carbon-900/60 p-8 text-center">
        <Bot className="mx-auto mb-3 h-8 w-8 text-slate-500" />
        <h1 className="text-lg font-semibold text-white">自動売買</h1>
        <p className="mt-2 text-sm text-slate-400">現在、自動売買の権限が付与されていません。ご利用をご希望の場合は本部までお問い合わせください。</p>
      </div>
    )
  }

  const [deals, waitingPos, mgmtFee] = await Promise.all([
    listOwnAutoDeals(session.userId),
    getMemberWaitingPosition(member.id),
    getMgmtFeePreview(member.id),
  ])
  const canReserve = !capacity.canAccept && !capacity.depositLocked && capacity.availableSlots > 0 && capacity.globalAvailable <= 0
  const byStage = (key: DealStatusStage) => deals.filter((d) => d.status === key)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-brand-400" />
        <h1 className="text-xl font-bold text-white">自動売買</h1>
      </div>

      {/* 枠・受注状況 */}
      <div className="rounded-2xl border border-carbon-700 bg-carbon-900/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Gauge className="h-4 w-4 text-brand-400" /> 枠・受注状況</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${capacity.canAccept ? 'bg-brand-500/20 text-brand-300' : 'bg-carbon-700 text-slate-400'}`}>
            {capacity.canAccept ? '受注可能' : '受注不可'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-carbon-700 bg-carbon-800/40 p-3 text-center">
            <div className="text-2xl font-bold text-white">{capacity.effectiveSlots}</div>
            <div className="text-[11px] text-slate-400">有効枠（保有{capacity.ownedSlots}）</div>
          </div>
          <div className="rounded-xl border border-carbon-700 bg-carbon-800/40 p-3 text-center">
            <div className="text-2xl font-bold text-white">{capacity.activeCount}</div>
            <div className="text-[11px] text-slate-400">稼働中</div>
          </div>
          <div className="rounded-xl border border-carbon-700 bg-carbon-800/40 p-3 text-center">
            <div className="text-2xl font-bold text-brand-300">{capacity.availableSlots}</div>
            <div className="text-[11px] text-slate-400">空き枠</div>
          </div>
          <div className="rounded-xl border border-carbon-700 bg-carbon-800/40 p-3 text-center">
            <div className="text-2xl font-bold text-white">{capacity.globalAvailable}</div>
            <div className="text-[11px] text-slate-400">全体の空き（/{capacity.globalTotal}台）</div>
          </div>
        </div>
        {!capacity.canAccept && capacity.blockReason && <p className="mt-2 text-xs text-amber-300">{capacity.blockReason}</p>}
        {waitingPos ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            <Clock className="h-4 w-4" /> 受注待ちに登録済みです（現在 <span className="font-bold">{waitingPos.position}</span> 番目 / 全 {waitingPos.total} 件）。空き枠が出次第、本部からご案内します。
          </div>
        ) : canReserve ? <ReserveButton /> : null}
      </div>

      {/* 月額管理手数料（枠数連動・毎月）— 上位プランのみ */}
      {mgmtFee.eligible && (
        <div className="rounded-2xl border border-carbon-700 bg-carbon-900/60 p-5">
          <h2 className="mb-2 text-sm font-semibold text-white">月額管理手数料</h2>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-bold text-white">{yen(mgmtFee.monthlyFee)}<span className="ml-1 text-sm font-normal text-slate-400">/月</span></span>
            <span className="text-xs text-slate-400">（枠数 {mgmtFee.slots} − 1）× {yen(mgmtFee.unit)}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            毎月、預かり金（運転資金）から相殺されます。残高が不足した場合は不足分の請求（デポジットのお願い）を発行しますので、ご入金をお願いします。枠を増やすと月額も増えます。
          </p>
        </div>
      )}

      {/* 進捗フロー（現フェーズは「販売中・精算完了」の2段階のみ運用） */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-white">案件の進捗フロー</h2>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
            現在は「販売中・精算完了」の2段階で管理します（「仕入れ中」は第二フェーズから拡張します）
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FLOW_STAGES.map((col) => {
            const Icon = col.icon
            // 仕入れ中（未対応）は予告のみ・案件は個別表示しない
            if (!col.active) {
              return (
                <div key={col.key} className={`relative rounded-2xl border border-dashed ${col.accent} bg-carbon-900/20 p-3 opacity-70`}>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${col.tone}`}><Icon className="h-4 w-4" /> {col.label}</span>
                    <Lock className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <div className="flex flex-col items-center gap-1 px-1 py-6 text-center">
                    <span className="rounded-full bg-carbon-700 px-2 py-0.5 text-[10px] text-slate-400">第二フェーズから拡張します</span>
                    <p className="text-[11px] text-slate-600">この段階の進捗管理は今後のアップデートで対応予定です。</p>
                  </div>
                </div>
              )
            }
            const items = byStage(col.key)
            return (
              <div key={col.key} className={`rounded-2xl border ${col.accent} bg-carbon-900/40 p-3`}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${col.tone}`}><Icon className="h-4 w-4" /> {col.label}</span>
                  <span className="rounded-full bg-carbon-700 px-2 py-0.5 text-[11px] text-slate-300">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="px-1 py-4 text-center text-[11px] text-slate-600">なし</p>
                  ) : items.map((d) => <DealCard key={d.id} deal={d} />)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
