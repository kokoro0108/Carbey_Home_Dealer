import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Package, Wrench, Store, Truck, CheckCircle2 } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { getDeal, getSettlementPreview, DEAL_STAGE_LABEL, DEFAULT_FROM_PREF } from '@/lib/portal/deals'
import { listDealCosts } from '@/lib/portal/deal-costs'
import { getMember } from '@/lib/portal/members'
import { PREFECTURES } from '@/lib/portal/prefectures'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { yen } from '@/lib/portal/labels'
import AdminDealCostEditor from '@/components/admin/AdminDealCostEditor'
import AdminSourcingEvidence from '@/components/admin/AdminSourcingEvidence'
import { dealToPreppingAction, dealToListingAction, recordSaleAction, settleDealAction, setDestinationAction, cancelSettlementAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function AdminDealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; settled?: string; cancelled?: string }>
}) {
  await requireFeature('reports')
  const { id } = await params
  const sp = await searchParams
  const deal = await getDeal(id)
  if (!deal) notFound()
  const [member, costs, preview] = await Promise.all([
    getMember(deal.member_id),
    listDealCosts(id),
    getSettlementPreview(id, DEFAULT_FROM_PREF),
  ])
  const costTotal = costs.reduce((s, c) => s + (c.amount_yen ?? 0), 0)
  // 費目の編集は「精算前かつ売却前」まで（仕入れ中／商品化中／販売中）
  const costEditable = !deal.settled && deal.status !== 'sold'
  const vehicle = [deal.maker, deal.car_model, deal.year].filter(Boolean).join(' ') || '車両案件'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/vehicles" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> 車両進捗管理へ
      </Link>

      {sp.settled && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> 精算しました。諸費用を預かり金から差し引き、残金を繰り越しました。
        </div>
      )}
      {sp.cancelled && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <CheckCircle2 className="h-4 w-4" /> 精算を取り消しました。預かり金を元に戻し、費用を訂正できる状態にしました。
        </div>
      )}
      {sp.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">処理できませんでした：{sp.error}</div>
      )}

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Package className="h-5 w-5 text-brand-500" /> {vehicle}
        </h1>
        <p className="text-sm text-slate-500">
          {member && <Link href={`/admin/members/${member.id}`} className="text-brand-600 hover:underline">{member.company_name ?? member.member_name}</Link>}
          <span className="mx-2 text-slate-300">|</span>
          ステータス：{DEAL_STAGE_LABEL[deal.status]}
          <span className="mx-2 text-slate-300">|</span>
          発注金額 {deal.order_amount_yen ? yen(deal.order_amount_yen) : '—'}
        </p>
      </div>

      {/* ステージ操作（本部代理） */}
      {deal.status !== 'sold' && (
        <Card>
          <CardHeader title="進捗の操作" />
          <CardBody className="flex flex-wrap items-center gap-2">
            {deal.status === 'sourcing' && (
              <form action={dealToPreppingAction}>
                <input type="hidden" name="deal_id" value={deal.id} />
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"><Wrench className="h-4 w-4" /> 商品化中へ</button>
              </form>
            )}
            {deal.status === 'prepping' && (
              <form action={dealToListingAction}>
                <input type="hidden" name="deal_id" value={deal.id} />
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"><Store className="h-4 w-4" /> 販売中へ</button>
              </form>
            )}
            {!deal.settled && (deal.status === 'prepping' || deal.status === 'sourcing') && (
              <form action={settleDealAction}>
                <input type="hidden" name="deal_id" value={deal.id} />
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"><Truck className="h-4 w-4" /> 費用を確定して精算（納品）</button>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      {/* 費用内訳（本部が諸費用・代行手数料を自由に追加） */}
      <Card>
        <CardHeader title="費用内訳（諸費用・代行手数料）" action={<span className="text-xs text-slate-400">合計 {yen(costTotal)}</span>} />
        <CardBody>
          <p className="mb-3 text-xs text-slate-500">
            仕入れ中・商品化中の段階で、発生する費用（仕入価格・整備費・代行手数料など）を自由に追加できます。
            合計は精算時に加盟店の預かり金から自動で差し引かれ、後からの請求は不要です。
          </p>
          <AdminDealCostEditor dealId={deal.id} costs={costs} editable={costEditable} />
        </CardBody>
      </Card>

      {/* 精算プレビュー（預かり金 − 諸費用 = 残） */}
      <Card>
        <CardHeader title={deal.settled ? '精算結果' : '精算プレビュー（自動計算）'} />
        <CardBody>
          {/* 陸送先（陸送費の自動計算に使用） */}
          {!deal.settled && (
            <form action={setDestinationAction} className="mb-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="deal_id" value={deal.id} />
              <div>
                <label className="mb-1 block text-xs text-slate-500">陸送先（着地県）</label>
                <select name="to_pref" defaultValue={deal.to_pref ?? ''} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
                  <option value="" disabled>選択</option>
                  {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">設定</button>
              <span className="pb-1 text-[11px] text-slate-400">設定すると精算時に陸送費を自動計算（発地：{DEFAULT_FROM_PREF}）</span>
            </form>
          )}
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">仕入れ資金（預かり金）</dt><dd className="font-medium text-slate-900">{yen(preview.balance)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">諸費用合計（登録済み）</dt><dd className="font-medium text-red-600">− {yen(preview.costTotal)}</dd></div>
            {preview.shippingType === 'auto' && (
              <div className="flex justify-between"><dt className="text-slate-500">陸送費（自動計算・{deal.to_pref}）</dt><dd className="font-medium text-red-600">− {yen(preview.shippingAmount)}</dd></div>
            )}
            <div className="mt-2 flex justify-between border-t border-slate-100 pt-2">
              <dt className="font-semibold text-slate-900">{deal.settled ? '精算後の預かり残金' : '預かり残金（見込み）'}</dt>
              <dd className={`text-lg font-bold ${(deal.settled ? (deal.remaining_yen ?? 0) : preview.remaining) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {yen(deal.settled ? (deal.remaining_yen ?? 0) : preview.remaining)}
              </dd>
            </div>
          </dl>
          {!deal.settled && preview.blockReason && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{preview.blockReason}</div>
          )}
          <p className="mt-2 text-[11px] text-slate-400">
            {deal.settled
              ? '※ 精算済みです。諸費用は預かり金から差し引かれ、残金は次回の仕入れ資金に繰り越されています。'
              : '※「費用を確定して精算」で、諸費用（代行手数料含む）を預かり金から自動で差し引き、残金を繰り越します。'}
          </p>

          {/* ① 精算の取消・訂正（売却前のみ）。預かり金を元に戻し、費用を修正できる状態に戻す。 */}
          {deal.settled && deal.status !== 'sold' && (
            <form action={cancelSettlementAction} className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
              <input type="hidden" name="deal_id" value={deal.id} />
              <button className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50">
                精算を取り消して訂正する
              </button>
              <span className="text-[11px] text-slate-400">預かり金を精算前に戻し、費用を再編集できます。</span>
            </form>
          )}
        </CardBody>
      </Card>

      {/* 販売実績（納品完了・販売中で本部が代理記録） */}
      {/* 仕入れエビデンス（自動売買・販売中に本部が添付／加盟店は閲覧のみ） */}
      {deal.flow === 'auto' && (deal.status === 'listing' || deal.status === 'sold') && (
        <Card>
          <CardHeader title="仕入れエビデンス（販売中）" />
          <CardBody>
            <p className="mb-2 text-xs text-slate-500">販売中の車両について、何を販売しているかが分かる仕入れデータのエビデンスを1点添付します（加盟店の自動売買画面に表示されます）。</p>
            <AdminSourcingEvidence dealId={deal.id} evidenceName={deal.sourcing_evidence_name} evidenceAt={deal.sourcing_evidence_at} />
          </CardBody>
        </Card>
      )}

      {(deal.status === 'delivered' || deal.status === 'listing' || deal.status === 'sold') && (
        <Card>
          <CardHeader title="販売実績" />
          <CardBody>
            {deal.status === 'sold' ? (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><dt className="text-xs text-slate-500">販売価格</dt><dd className="font-semibold text-slate-900">{yen(deal.sale_price_yen)}</dd></div>
                <div><dt className="text-xs text-slate-500">費用合計</dt><dd className="font-semibold text-slate-900">{yen(deal.cost_total_yen)}</dd></div>
                <div><dt className="text-xs text-slate-500">粗利益</dt><dd className={`font-semibold ${(deal.gross_profit_yen ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{yen(deal.gross_profit_yen)}</dd></div>
                <div><dt className="text-xs text-slate-500">売却日</dt><dd className="font-semibold text-slate-900">{deal.sold_at ? new Date(deal.sold_at).toLocaleDateString('ja-JP') : '—'}</dd></div>
              </dl>
            ) : (
              <>
                <form action={recordSaleAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="deal_id" value={deal.id} />
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">販売価格（円）*</label>
                    <input name="sale_price" required inputMode="numeric" placeholder="1500000" className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">売却日</label>
                    <input type="date" name="sold_at" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600" />
                  </div>
                  <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">売却を記録</button>
                </form>
                {deal.flow === 'auto' && (
                  <p className="mt-2 text-xs text-slate-500">
                    ※ 月額管理手数料は案件清算時ではなく、枠数に応じた月次課金です（会員詳細の「月額管理手数料（月次）」で本部が相殺／請求します）。諸経費は売却の粗利で相殺されます。
                  </p>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
