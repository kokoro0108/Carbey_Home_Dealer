import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import { requireMember } from '@/lib/auth/session'
import { getMemberByUserId } from '@/lib/portal/members'
import { getDeal, DEAL_STAGE_LABEL, getSettlementPreview, DEFAULT_FROM_PREF } from '@/lib/portal/deals'
import { listDealCosts } from '@/lib/portal/deal-costs'
import { PREFECTURES } from '@/lib/portal/prefectures'
import { yen } from '@/lib/portal/labels'
import { DarkCard, DarkCardHeader, DarkCardBody } from '@/components/portal-dark/DarkUI'
import DealBoard from '@/components/portal-dark/DealBoard'
import DealCostEditor from '@/components/portal-dark/DealCostEditor'
import { setDestinationAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMember()
  const { id } = await params
  const [deal, member] = await Promise.all([getDeal(id), getMemberByUserId(session.userId)])
  if (!deal || !member || deal.member_id !== member.id) notFound()

  const [costs, preview] = await Promise.all([listDealCosts(id), getSettlementPreview(id, DEFAULT_FROM_PREF)])
  const costTotal = costs.reduce((s, c) => s + (c.amount_yen ?? 0), 0)
  const editable = deal.status !== 'delivered' // 取引終了後は編集不可

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/portal/orders" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> 仕入れオーダーへ戻る
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <Package className="h-5 w-5 text-brand-400" />
          {[deal.maker, deal.car_model, deal.year].filter(Boolean).join(' ') || '車両案件'}
        </h1>
        <p className="text-sm text-slate-400">
          ステータス：{DEAL_STAGE_LABEL[deal.status]} ／ 発注金額 {deal.order_amount_yen ? yen(deal.order_amount_yen) : '—'}
        </p>
      </div>

      {/* 進捗ボード（受領・商品化中の操作もここから） */}
      {deal.status !== 'delivered' && (
        <DarkCard>
          <DarkCardHeader title="進捗" />
          <DarkCardBody className="space-y-4">
            <DealBoard deal={deal} />
            {/* 陸送先（着地県）— 陸送費の自動計算に使用 */}
            <form action={setDestinationAction} className="flex flex-wrap items-end gap-2 border-t border-carbon-700 pt-3">
              <input type="hidden" name="deal_id" value={deal.id} />
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">陸送先（着地の都道府県）</label>
                <select name="to_pref" defaultValue={deal.to_pref ?? ''} className="rounded-lg border border-carbon-600 bg-carbon-900 px-2.5 py-1.5 text-sm text-slate-100">
                  <option value="" disabled>選択</option>
                  {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <button className="rounded-lg border border-carbon-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/5">設定</button>
              <span className="pb-1 text-[11px] text-slate-500">設定すると受領時に陸送費が自動計算されます（発地：{DEFAULT_FROM_PREF}）。</span>
            </form>
          </DarkCardBody>
        </DarkCard>
      )}

      {/* 費用内訳（動的費目） */}
      <DarkCard>
        <DarkCardHeader title="費用内訳" action={<span className="text-xs text-slate-500">合計 {yen(costTotal)}</span>} />
        <DarkCardBody>
          <DealCostEditor dealId={deal.id} costs={costs} editable={editable} />
        </DarkCardBody>
      </DarkCard>

      {/* 精算プレビュー（受領時に自動確定） */}
      <DarkCard>
        <DarkCardHeader title={deal.settled ? '精算結果' : '精算プレビュー'} />
        <DarkCardBody>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">仕入れ資金（預かり金）</dt><dd className="font-medium text-slate-100">{yen(preview.balance)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">費用合計（登録済み）</dt><dd className="font-medium text-rose-400">− {yen(preview.costTotal)}</dd></div>
            {/* 自動計算される陸送費（費目に未登録のとき） */}
            {preview.shippingType === 'auto' && (
              <div className="flex justify-between"><dt className="text-slate-400">陸送費（自動計算・{deal.to_pref}）</dt><dd className="font-medium text-rose-400">− {yen(preview.shippingAmount)}</dd></div>
            )}
            <div className="mt-2 flex justify-between border-t border-carbon-700 pt-2">
              <dt className="font-semibold text-white">{deal.settled ? '精算後の預かり残金' : '預かり残金（見込み）'}</dt>
              <dd className={`text-lg font-bold ${preview.remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {yen(deal.settled ? (deal.remaining_yen ?? 0) : preview.remaining)}
              </dd>
            </div>
          </dl>

          {/* 個別見積が必要な場合の警告 */}
          {!deal.settled && (preview.shippingType === 'special' || preview.shippingType === 'unset') && preview.blockReason && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {preview.blockReason}
            </div>
          )}

          <p className="mt-2 text-[11px] text-slate-500">
            {deal.settled
              ? '※ この取引は精算済みです。残金は仕入れ資金の残高に繰り越されています。'
              : '※ 受領（受け取り完了）時に自動精算し、残金を次回の仕入れ資金に繰り越します。'}
          </p>
        </DarkCardBody>
      </DarkCard>
    </div>
  )
}
