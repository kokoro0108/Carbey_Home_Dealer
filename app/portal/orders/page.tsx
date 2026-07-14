import Link from 'next/link'
import { Plus, CheckCircle2, ShoppingCart, Lock, Repeat, Bot, ClipboardList } from 'lucide-react'
import { requireMember } from '@/lib/auth/session'
import { listOwnOrders, ORDER_ONBOARDING_GATE } from '@/lib/portal/orders'
import { getOwnAntiqueGrace } from '@/lib/portal/trading'
import { getOwnFlow } from '@/lib/portal/flow'
import { getOwnOnboarding } from '@/lib/portal/onboarding'
import { getMemberByUserId } from '@/lib/portal/members'
import { getLedgerBalance } from '@/lib/portal/ledger'
import { listOwnActiveDeals, listOwnDealHistory, DEAL_STAGE_LABEL } from '@/lib/portal/deals'
import DealBoard from '@/components/portal-dark/DealBoard'
import { ORDER_STATUS_LABEL, yen } from '@/lib/portal/labels'
import { DarkCard, DarkCardHeader, DarkCardBody } from '@/components/portal-dark/DarkUI'
import AntiqueGraceBanner from '@/components/portal-dark/AntiqueGraceBanner'
import { createOrderAction } from './actions'
import type { OrderStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

const field =
  'w-full rounded-lg border border-carbon-600 bg-carbon-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
const labelCls = 'mb-1 block text-[13px] font-medium text-slate-400'

const STATUS_STYLE: Record<OrderStatus, string> = {
  received: 'bg-amber-500/15 text-amber-400',
  in_progress: 'bg-sky-500/15 text-sky-400',
  completed: 'bg-brand-500/15 text-brand-400',
  cancelled: 'bg-carbon-700 text-slate-500',
}

export default async function MemberOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>
}) {
  const session = await requireMember()
  const [orders, grace, flowInfo, onboarding, member] = await Promise.all([
    listOwnOrders(session.userId),
    getOwnAntiqueGrace(session.userId),
    getOwnFlow(session.userId),
    getOwnOnboarding(session.userId),
    getMemberByUserId(session.userId),
  ])
  const balance = member ? await getLedgerBalance(member.id) : 0
  const [activeDeals, dealHistory] = await Promise.all([
    listOwnActiveDeals(session.userId),
    listOwnDealHistory(session.userId),
  ])
  const sp = await searchParams
  const graceLocked = grace ? !grace.tradingAllowed : false
  const isSemi = flowInfo?.flow === 'semi'
  const isAuto = flowInfo?.flow === 'auto'
  // ㉜ STEP5：オンボ完了ゲートは今回解放中（ORDER_ONBOARDING_GATE=false）。
  const onboardingComplete = ORDER_ONBOARDING_GATE ? (onboarding?.unlocked ?? false) : true
  // フォームを出せるのは「半自動フロー かつ （ゲート無効 or オンボ完了） かつ 取引ロックなし」
  const canOrder = isSemi && onboardingComplete && !graceLocked

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">仕入れオーダー</h1>
          <p className="text-sm text-slate-400">本部へ車両の仕入れを依頼します。</p>
        </div>
        {/* フェーズ2 仕入れ資金の預かり残高（この範囲内でオーダー可能） */}
        <div className="rounded-xl border border-carbon-700 bg-carbon-800/60 px-4 py-2 text-right">
          <div className="text-[11px] text-slate-400">仕入れ資金 預かり残高</div>
          <div className={`text-lg font-bold ${balance > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{yen(balance)}</div>
        </div>
      </div>

      {/* 古物商猶予の警告（黄=事前 / 赤=超過ロック） */}
      <AntiqueGraceBanner grace={grace} />

      {sp.created && (
        <div className="flex items-center gap-2 rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-300">
          <CheckCircle2 className="h-4 w-4" /> 仕入れオーダーを送信しました。次の仕入れは下のフォームから続けて依頼できます。
        </div>
      )}

      {/* 半自動売買の運用ループ案内（1仕入案ごとに繰り返す） */}
      {canOrder && (
        <div className="flex items-start gap-2 rounded-lg border border-carbon-700 bg-carbon-800/40 px-4 py-3 text-xs text-slate-400">
          <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
          <span>
            半自動売買フローでは、<span className="text-slate-200">1台の仕入れごとにオーダーを作成</span>します。
            1件が完了したら、続けて次の仕入れオーダーを作成して運用を繰り返してください。
          </span>
        </div>
      )}
      {sp.error === 'model_required' && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">車種は必須です。</div>
      )}
      {sp.error === 'trading_locked' && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          古物商許可証の提出期限を超過しているため、オーダーを送信できません。許可証をアップロードしてください。
        </div>
      )}
      {sp.error === 'onboarding_incomplete' && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          オンボーディングが完了していないため、オーダーを送信できません。
        </div>
      )}
      {sp.error === 'auto_flow' && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          自動売買フローでは仕入れが自動化されるため、手動オーダーは利用できません。
        </div>
      )}
      {sp.error === 'budget_required' && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          予算（発注金額）を入力してください。
        </div>
      )}
      {sp.error === 'over_balance' && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          発注金額が仕入れ資金の預かり残高を超えています。残高（{yen(balance)}）の範囲内でオーダーしてください。
        </div>
      )}

      {/* 進行中の案件（進捗ボード・横軸） */}
      {activeDeals.length > 0 && (
        <DarkCard>
          <DarkCardHeader title="進行中の取引" action={<span className="text-xs text-slate-500">{activeDeals.length} 件</span>} />
          <DarkCardBody className="space-y-3">
            {activeDeals.map((d) => (
              <div key={d.id} className="space-y-2">
                <DealBoard deal={d} />
                <div className="text-right">
                  <Link href={`/portal/orders/deal/${d.id}`} className="text-xs font-medium text-brand-400 hover:underline">
                    費用内訳・エビデンスを管理 →
                  </Link>
                </div>
              </div>
            ))}
          </DarkCardBody>
        </DarkCard>
      )}

      {/* 新規オーダーフォーム（㉙半自動のみ／㉚オンボ完了／取引ロックなしのとき） */}
      <DarkCard>
        <DarkCardHeader title={<span className="flex items-center gap-2"><Plus className="h-4 w-4 text-brand-400" /> 新規オーダー</span>} />
        <DarkCardBody>
          {isAuto ? (
            /* ㉙ 自動売買フロー：手動オーダーは非対応（準備中案内） */
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Bot className="h-7 w-7 text-brand-400" />
              <p className="text-sm font-medium text-white">自動売買フロー</p>
              <p className="max-w-md text-xs text-slate-400">
                仕入れはAIにより自動で進められます（自動発注の仕組みは準備中です）。
                手動での仕入れオーダーは、半自動売買フローに切り替えるとご利用いただけます。
              </p>
            </div>
          ) : !onboardingComplete ? (
            /* ㉚ オンボーディング未完了：オーダー不可 */
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <ClipboardList className="h-7 w-7 text-amber-400" />
              <p className="text-sm font-medium text-amber-300">オンボーディングが未完了です</p>
              <p className="max-w-md text-xs text-slate-400">
                すべてのスタートアップステップを完了すると、仕入れオーダーを作成できます。
              </p>
              <Link href="/portal/onboarding" className="mt-1 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
                オンボーディングを進める
              </Link>
            </div>
          ) : graceLocked ? (
            /* 古物商猶予超過：取引停止 */
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Lock className="h-7 w-7 text-rose-400" />
              <p className="text-sm font-medium text-rose-300">取引機能は停止中です</p>
              <p className="max-w-md text-xs text-slate-400">
                古物商許可証の提出期限を超過しています。許可証をアップロードいただくと、仕入れオーダーを再開できます。
              </p>
            </div>
          ) : (
            <form action={createOrderAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div><label className={labelCls}>メーカー</label><input name="maker" placeholder="トヨタ" className={field} /></div>
              <div><label className={labelCls}>車種 *</label><input name="car_model" required placeholder="ハリアー" className={field} /></div>
              <div><label className={labelCls}>年式</label><input name="year" placeholder="2021年" className={field} /></div>
              <div>
                <label className={labelCls}>予算・発注金額（円）*</label>
                <input name="budget_yen" type="number" min="1" required placeholder="2500000" className={field} />
                <p className="mt-1 text-[11px] text-slate-500">預かり残高（{yen(balance)}）より低い金額でオーダーできます。</p>
              </div>
              <div><label className={labelCls}>希望色</label><input name="preferred_color" placeholder="ホワイトパール" className={field} /></div>
              <div><label className={labelCls}>走行距離上限（km）</label><input name="mileage_max" type="number" min="0" placeholder="30000" className={field} /></div>
              <div className="sm:col-span-3"><label className={labelCls}>要望・備考</label><textarea name="notes" rows={2} placeholder="ワンオーナー希望。事故歴なし。" className={field} /></div>
              <div className="sm:col-span-3 flex justify-end">
                <button className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white glow-brand hover:bg-brand-600">
                  オーダーを送信
                </button>
              </div>
            </form>
          )}
        </DarkCardBody>
      </DarkCard>

      {/* 自分のオーダー一覧 */}
      <DarkCard>
        <DarkCardHeader title="オーダー履歴" action={<span className="text-xs text-slate-500">{orders.length} 件</span>} />
        <DarkCardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-carbon-700 bg-carbon-900/50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">オーダーID</th>
                  <th className="px-5 py-3 font-medium">車両</th>
                  <th className="px-5 py-3 font-medium">予算</th>
                  <th className="px-5 py-3 font-medium">ステータス</th>
                  <th className="px-5 py-3 font-medium">依頼日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-700">
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      <ShoppingCart className="mx-auto mb-2 h-6 w-6 text-slate-600" />
                      まだオーダーがありません。上のフォームから依頼できます。
                    </td>
                  </tr>
                )}
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-white/5">
                    <td className="px-5 py-3 font-medium text-slate-200">{o.order_number ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-300">{[o.maker, o.car_model, o.year].filter(Boolean).join(' ')}</td>
                    <td className="px-5 py-3 text-slate-300">{o.budget_yen ? yen(o.budget_yen) : '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{new Date(o.created_at).toLocaleDateString('ja-JP')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DarkCardBody>
      </DarkCard>

      {/* 取引履歴（納品完了・受領済み） */}
      {dealHistory.length > 0 && (
        <DarkCard>
          <DarkCardHeader title="取引履歴（納品完了）" action={<span className="text-xs text-slate-500">{dealHistory.length} 件</span>} />
          <DarkCardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-carbon-700 bg-carbon-900/50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">車両</th>
                    <th className="px-5 py-3 font-medium">発注金額</th>
                    <th className="px-5 py-3 font-medium">ステータス</th>
                    <th className="px-5 py-3 font-medium">納品日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-carbon-700">
                  {dealHistory.map((d) => (
                    <tr key={d.id} className="hover:bg-white/5">
                      <td className="px-5 py-3 text-slate-300">{[d.maker, d.car_model, d.year].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-5 py-3 text-slate-300">{d.order_amount_yen ? yen(d.order_amount_yen) : '—'}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-medium text-brand-400">{DEAL_STAGE_LABEL[d.status]}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{d.delivered_at ? new Date(d.delivered_at).toLocaleDateString('ja-JP') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DarkCardBody>
        </DarkCard>
      )}
    </div>
  )
}
