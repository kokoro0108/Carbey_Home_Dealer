import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, KeyRound, ShieldCheck, Eye, Download, Clock, XCircle, Wallet, Lock, ScrollText, ShoppingCart, ChevronRight } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { getMember, listPayments } from '@/lib/portal/members'
import { listPlans } from '@/lib/portal/plans'
import { listEvidences } from '@/lib/portal/evidence'
import { getFunding, LOAN_STEPS } from '@/lib/portal/funding'
import { getMemberOrderSummary } from '@/lib/portal/orders'
import { getMemberCapabilities } from '@/lib/portal/capabilities'
import { getLedgerBalance, listLedgerEntries } from '@/lib/portal/ledger'
import { getMemberDealSummary, DEAL_STAGE_LABEL } from '@/lib/portal/deals'
import { getSalesSummary } from '@/lib/portal/sales'
import { listInvoices, listInvoicePayments, INVOICE_KIND_LABEL, INVOICE_STATUS_LABEL } from '@/lib/portal/billing'
import { listConsentLog } from '@/lib/portal/agreements'
import { MEMBER_STATUS_LABEL, yen } from '@/lib/portal/labels'
import { Badge } from '@/components/ui/Badge'
import { updateMemberAction, issueCredentialsAction } from '../actions'
import { reviewEvidenceAction } from '../evidence-actions'
import { confirmSelfAction, setAdminStepAction } from '../funding-actions'
import { addLedgerEntryAction, deleteLedgerEntryAction } from '../ledger-actions'
import { createInvoiceAction, createSlotPurchaseAction, runMemberMgmtFeeAction, recordPaymentAction, markBilledAction, cancelInvoiceAction, deleteInvoiceAction } from '../billing-actions'
import { getMgmtFeePreview, listMgmtFeeRuns } from '@/lib/portal/mgmt-fee'
import MemberFormFields from '../MemberFormFields'

const INVOICE_STATUS_TONE: Record<string, string> = {
  unbilled: 'bg-slate-100 text-slate-600',
  billed: 'bg-info-50 text-info-700',
  partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-400 line-through',
}

const LEDGER_KIND_LABEL: Record<string, string> = {
  deposit: '入金（デポジット）',
  withdraw: '出金',
  settlement: '取引精算',
  adjust: '調整',
  mgmt_fee: '月額管理手数料',
}

export const dynamic = 'force-dynamic'

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ msg?: string; cred?: string; pw?: string; error?: string }>
}) {
  await requireFeature('members')
  const { id } = await params
  const sp = await searchParams
  const [member, plans, payments, evidences] = await Promise.all([
    getMember(id), listPlans(false), listPayments(id), listEvidences(id),
  ])
  if (!member) notFound()
  const [funding, consents, orderSummary, capabilities, ledgerBalance, ledgerEntries, invoices, dealSummary, memberSales, mgmtFee, mgmtFeeRuns] = await Promise.all([
    getFunding(member.id), listConsentLog(member.id), getMemberOrderSummary(member.id), getMemberCapabilities(member.id),
    getLedgerBalance(member.id), listLedgerEntries(member.id), listInvoices(member.id),
    getMemberDealSummary(member.id), getSalesSummary(member.id),
    getMgmtFeePreview(member.id), listMgmtFeeRuns(member.id),
  ])
  // 各請求の消込内訳（入金明細）
  const invoicePayments = await Promise.all(invoices.map((inv) => listInvoicePayments(inv.id)))
  const billingTotals = invoices.reduce(
    (acc, inv) => {
      if (inv.status === 'cancelled' || inv.status === 'unbilled') return acc
      acc.billed += inv.amount_yen
      acc.paid += inv.paid_yen
      if (inv.status === 'overdue') acc.overdue++
      return acc
    },
    { billed: 0, paid: 0, overdue: 0 },
  )
  const outstanding = Math.max(0, billingTotals.billed - billingTotals.paid)

  const onboardingPct = member.onboarding_total
    ? Math.round((member.onboarding_done / member.onboarding_total) * 100)
    : 0

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/members" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        加盟店一覧へ
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-lg font-semibold text-white">
          {member.member_name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{member.member_name}</h1>
            <Badge tone={member.status === 'active' ? 'green' : member.status === 'pending' ? 'amber' : member.status === 'suspended' ? 'red' : 'slate'}>
              {MEMBER_STATUS_LABEL[member.status]}
            </Badge>
          </div>
          {member.company_name && <p className="text-sm text-slate-500">{member.company_name}</p>}
        </div>
      </div>

      {/* 結果バナー */}
      {sp.cred === 'issued' && sp.pw && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
            <CheckCircle2 className="h-4 w-4" /> ログイン情報を発行しました
          </div>
          <p className="mt-1 text-xs text-green-700">下記の認証情報を加盟店へお伝えください。このパスワードは再表示できません。</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-green-200 bg-white px-3 py-2">
              <div className="text-[11px] text-slate-500">メールアドレス（ログインID）</div>
              <div className="font-mono text-sm text-slate-900">{member.email}</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-white px-3 py-2">
              <div className="text-[11px] text-slate-500">パスワード</div>
              <div className="font-mono text-sm font-semibold text-slate-900">{sp.pw}</div>
            </div>
          </div>
        </div>
      )}
      {sp.cred === 'no_email' && (
        <div className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          ログイン発行にはメールアドレスが必要です。上部フォームでメールアドレスを登録してください。
        </div>
      )}
      {sp.cred === 'error' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">発行に失敗しました{sp.msg ? `: ${sp.msg}` : ''}</div>
      )}
      {sp.error === 'contract_date_required' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          契約ステータスを「稼働中（active）」にするには契約日が必須です（古物商許可の6ヶ月猶予の起算日になります）。契約日を入力して保存してください。
        </div>
      )}
      {sp.error === 'email_duplicate' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          このメールアドレスは既に別の会員に登録されています。会員ごとに異なるメールアドレスを設定してください（1メール＝1会員）。
        </div>
      )}
      {sp.error === 'plan_required' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          契約ステータスを「稼働中（active）」にするには契約プランの選択が必須です。プランを選択して保存してください。
        </div>
      )}
      {sp.error === 'grant_required' && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          契約ステータスを「稼働中（active）」にするには、運用方式の権限（セミオート／フルオート／両方）を1つ以上割り当ててください。
        </div>
      )}
      {sp.error && !['contract_date_required', 'email_duplicate', 'plan_required', 'grant_required'].includes(sp.error) && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{sp.error}</div>
      )}
      {sp.msg && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{sp.msg}</div>
      )}

      {/* ===== ログイン発行（本部が直接パスワードを発行する発行型フロー） ===== */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold text-slate-900">ログイン発行・権限</h2>
          {member.user_id ? (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> アカウント連携済み</span>
          ) : (
            <span className="ml-auto text-xs text-slate-400">未発行</span>
          )}
        </div>

        {member.email ? (
          <form action={issueCredentialsAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={member.id} />
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">パスワード（空欄で自動生成）</label>
              <input name="password" placeholder="自動生成する場合は空欄" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">権限</label>
              <select disabled className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                <option>加盟店（member）</option>
              </select>
            </div>
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              {member.user_id ? 'パスワードを再発行' : 'ログイン情報を発行'}
            </button>
          </form>
        ) : (
          <p className="text-xs text-slate-400">発行にはメールアドレスの登録が必要です。</p>
        )}

        <p className="mt-2 text-xs text-slate-400">
          発行後、メール・パスワードを加盟店へ共有すると、加盟店はそのままログインできます。
        </p>
      </div>

      {/* サマリ行 */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* ④ プラン（契約）と 運用方式の権限（セミ/フル）は別設定。実効フローも併記する。 */}
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">プラン / 権限 / フロー</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {member.plan ? (
              <Badge tone="slate">{member.plan.name}</Badge>
            ) : (
              <span className="text-sm font-semibold text-amber-600">プラン未割当</span>
            )}
            {member.grant_semi && (
              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">セミオート</span>
            )}
            {member.grant_auto && (
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">フルオート</span>
            )}
            {!member.grant_semi && !member.grant_auto && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">運用権限なし</span>
            )}
            {/* ㉕ オンボーディング未完了でも取引可の特例 */}
            {member.trading_override && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800" title="オンボーディング未完了でも仕入れオーダーを許可しています">
                取引 特例許可
              </span>
            )}
            {/* 実効フロー（active_flow 未設定でも権限から導出される） */}
            {capabilities && (member.grant_semi || member.grant_auto) && (
              <span className="rounded bg-info-50 px-1.5 py-0.5 text-[10px] font-medium text-info-700">
                現在：{capabilities.flow === 'auto' ? '自動売買' : '半自動売買'}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">登録日</div>
          <div className="text-sm font-semibold text-slate-900">{member.registration_date}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">月額</div>
          <div className="text-sm font-semibold text-slate-900">{yen(member.monthly_fee_yen)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">契約日</div>
          <div className="text-sm font-semibold text-slate-900">{member.contract_date ?? '—'}</div>
        </div>
      </div>

      {/* オンボーディング進捗 + オーダー状況（可視化） */}
      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 進捗バー */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">オンボーディング進捗</span>
            <span className="text-sm font-bold text-slate-900">{onboardingPct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${onboardingPct >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${onboardingPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{member.onboarding_done}/{member.onboarding_total} タスク完了</span>
            <Link href={`/admin/onboarding/${member.id}`} className="flex items-center gap-0.5 font-medium text-brand-600 hover:underline">
              進捗を管理 <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* オーダー状況 */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <ShoppingCart className="h-4 w-4 text-brand-500" /> オーダー状況
            </span>
            <div className="flex items-center gap-3">
              <Link href={`/admin/crm?member=${member.id}`} className="flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:underline">
                CRM顧客 <ChevronRight className="h-3 w-3" />
              </Link>
              <Link href={`/admin/orders?member=${member.id}`} className="flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:underline">
                オーダー管理 <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 py-2">
              <div className="text-lg font-bold text-slate-900">{orderSummary.total}</div>
              <div className="text-[10px] text-slate-500">合計</div>
            </div>
            <div className="rounded-lg bg-amber-50 py-2">
              <div className="text-lg font-bold text-amber-700">{orderSummary.received}</div>
              <div className="text-[10px] text-slate-500">受付</div>
            </div>
            <div className="rounded-lg bg-sky-50 py-2">
              <div className="text-lg font-bold text-sky-700">{orderSummary.in_progress}</div>
              <div className="text-[10px] text-slate-500">対応中</div>
            </div>
            <div className="rounded-lg bg-emerald-50 py-2">
              <div className="text-lg font-bold text-emerald-700">{orderSummary.completed}</div>
              <div className="text-[10px] text-slate-500">完了</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 担当車両サマリ（㉓ 全体連携：車両進捗管理と連動） ===== */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShoppingCart className="h-4 w-4 text-brand-500" /> 担当車両（進捗・販売実績）
          </h2>
          <Link href={`/admin/vehicles?member=${member.id}`} className="flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:underline">
            車両進捗管理 <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
          {(['sourcing', 'prepping', 'listing', 'delivered', 'sold'] as const).map((s) => (
            <div key={s} className="rounded-lg bg-slate-50 py-2">
              <div className="text-lg font-bold text-slate-900">{dealSummary[s]}</div>
              <div className="text-[10px] text-slate-500">{DEAL_STAGE_LABEL[s]}</div>
            </div>
          ))}
        </div>
        {memberSales.count > 0 && (
          <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span>売上 <span className="font-semibold text-slate-900">{yen(memberSales.revenueYen)}</span></span>
            <span>粗利益 <span className="font-semibold text-emerald-700">{yen(memberSales.profitYen)}</span></span>
            <span>利益率 <span className="font-semibold text-slate-900">{memberSales.marginPct}%</span></span>
          </div>
        )}
      </div>

      {/* ===== 利用可能機能（権限・フロー連動で自動制御／㉕・④） ===== */}
      {capabilities && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <KeyRound className="h-4 w-4 text-brand-500" /> 利用可能機能（権限連動・自動制御）
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            運用方式の権限・売買フロー・オンボーディング完了状況・古物商猶予に応じて自動で制御されます（ここでの手動設定ではありません）。
            現在のフロー：<span className="font-medium text-slate-700">{capabilities.flow === 'auto' ? '自動売買' : '半自動売買'}</span>
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {capabilities.capabilities.map((c) => (
              <li key={c.key} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${c.allowed ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100 bg-slate-50'}`}>
                {c.allowed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                )}
                <div className="min-w-0">
                  <div className={c.allowed ? 'text-slate-800' : 'text-slate-500'}>{c.label}</div>
                  {!c.allowed && c.reason && <div className="text-[11px] text-slate-400">{c.reason}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ===== エビデンス確認（本人確認・古物商） ===== */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-brand-500" /> 提出書類の確認
        </h2>
        {evidences.length === 0 ? (
          <p className="text-xs text-slate-400">まだ書類が提出されていません。</p>
        ) : (
          <ul className="space-y-2">
            {evidences.map((ev) => {
              const kindLabel = ev.kind === 'identity' ? '本人確認' : ev.kind === 'antique_license' ? '古物商許可証' : 'その他'
              const docLabel: Record<string, string> = { license: '運転免許証', mynumber: 'マイナンバー', passport: 'パスポート', antique: '古物商許可証', other: 'その他' }
              const url = `/api/portal/evidence/${ev.id}`
              const isImage = ev.file_type?.startsWith('image/')
              return (
                <li key={ev.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    {/* ㉘ 画像はサムネイルをインライン表示（本部の確認用） */}
                    {isImage && (
                      <a href={url} target="_blank" rel="noopener noreferrer" title="クリックで拡大" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={ev.file_name} className="h-12 w-12 rounded object-cover ring-1 ring-slate-200" loading="lazy" />
                      </a>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900">
                        {kindLabel}{ev.doc_type ? `・${docLabel[ev.doc_type]}` : ''}
                      </div>
                      <div className="truncate text-xs text-slate-500">{ev.file_name} ・ {new Date(ev.created_at).toLocaleDateString('ja-JP')}</div>
                    </div>
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      ev.status === 'approved' ? 'bg-green-50 text-green-700' : ev.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {ev.status === 'approved' ? <CheckCircle2 className="h-3 w-3" /> : ev.status === 'rejected' ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {ev.status === 'approved' ? '承認済み' : ev.status === 'rejected' ? '却下' : '確認待ち'}
                    </span>
                    <a href={url} target="_blank" rel="noopener noreferrer" title="プレビュー" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><Eye className="h-4 w-4" /></a>
                    <a href={`${url}?download=1`} title="ダウンロード" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><Download className="h-4 w-4" /></a>
                  </div>
                  {ev.status === 'pending' && (
                    <form action={reviewEvidenceAction} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="evidence_id" value={ev.id} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <input name="note" placeholder="却下理由（任意）" className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none" />
                      <button name="status" value="approved" className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">承認</button>
                      <button name="status" value="rejected" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">却下</button>
                    </form>
                  )}
                  {ev.status === 'rejected' && ev.note && <p className="mt-1 text-xs text-red-600">却下理由：{ev.note}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ===== 資金準備の確認（自己資金 / 資金調達） ===== */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Wallet className="h-4 w-4 text-brand-500" /> 資金準備の確認
        </h2>
        {!funding?.method ? (
          <p className="text-xs text-slate-400">加盟店がまだ資金準備の方法を選択していません。</p>
        ) : funding.method === 'self' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Badge tone="slate">自己資金</Badge>
              <span className="font-semibold text-slate-900">{yen(funding.self_amount_yen)}</span>
              {funding.self_confirmed && <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> 確認済み</span>}
            </div>
            {funding.self_amount_yen == null ? (
              <p className="text-xs text-slate-400">加盟店による自己資金額の登録待ちです。</p>
            ) : (
              <form action={confirmSelfAction} className="flex items-center gap-2">
                <input type="hidden" name="member_id" value={member.id} />
                {funding.self_confirmed ? (
                  <button name="confirmed" value="0" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">確認を取消</button>
                ) : (
                  <button name="confirmed" value="1" className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">自己資金を確認</button>
                )}
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="mb-1 flex items-center gap-2 text-sm">
              <Badge tone="slate">資金調達</Badge>
              {funding.status === 'completed' && <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> 完了</span>}
            </div>
            <ol className="space-y-1.5">
              {LOAN_STEPS.map((step, i) => {
                const done = funding.step_status?.[step.key] === 'done'
                const prevDone = LOAN_STEPS.slice(0, i).every((s) => funding.step_status?.[s.key] === 'done')
                const isAdmin = step.actor === 'admin'
                return (
                  <li key={step.key} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${done ? 'bg-brand-500 text-white' : 'border border-slate-300 text-slate-400'}`}>
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className={`flex-1 text-sm ${done ? 'text-slate-500' : 'text-slate-800'}`}>{step.label}</span>
                    <span className="text-[11px] text-slate-400">{isAdmin ? '本部' : '加盟店'}</span>
                    {isAdmin ? (
                      <form action={setAdminStepAction}>
                        <input type="hidden" name="member_id" value={member.id} />
                        <input type="hidden" name="step_key" value={step.key} />
                        {done ? (
                          <button name="done" value="0" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">取消</button>
                        ) : prevDone ? (
                          <button name="done" value="1" className="rounded-md bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-600">完了にする</button>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400"><Lock className="h-3 w-3" /> 前工程待ち</span>
                        )}
                      </form>
                    ) : (
                      <span className={`text-[11px] ${done ? 'text-green-600' : 'text-slate-400'}`}>{done ? '完了' : '加盟店対応'}</span>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>

      {/* ===== 利用規約 同意履歴（証拠保全ログ） ===== */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ScrollText className="h-4 w-4 text-brand-500" /> 利用規約 同意履歴
        </h2>
        {consents.length === 0 ? (
          <p className="text-xs text-slate-400">まだ同意記録がありません。</p>
        ) : (
          <ul className="space-y-1.5">
            {consents.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                <span className="flex-1 text-slate-800">
                  {c.agreement_title ?? '（規約）'}
                  {c.agreement_version != null && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">v{c.agreement_version}</span>}
                </span>
                <span className="text-xs text-slate-500">{new Date(c.agreed_at).toLocaleString('ja-JP')}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-slate-400">同意記録は改ざん防止のため保全されます（規約が更新・削除されても履歴は残ります）。</p>
      </div>

      {/* 編集フォーム */}
      <form action={updateMemberAction}>
        <input type="hidden" name="id" value={member.id} />
        <MemberFormFields plans={plans} member={member} showPaymentStatus />
        <div className="mt-6 flex justify-end">
          <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            変更を保存
          </button>
        </div>
      </form>

      {/* ===== 資金管理（仕入れ資金・預かり金台帳／半自動売買フェーズ1） ===== */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Wallet className="h-4 w-4 text-brand-500" /> 仕入れ資金（預かり金）
          </h2>
          <div className="text-right">
            <div className="text-[11px] text-slate-500">預かり残高</div>
            <div className={`text-lg font-bold ${ledgerBalance > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>{yen(ledgerBalance)}</div>
          </div>
        </div>

        {/* 加盟金 支払状況（既存 payment_status を表示） */}
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <span className="text-slate-500">加盟金 支払状況：</span>
          <Badge tone={member.payment_status === 'paid' ? 'green' : member.payment_status === 'overdue' ? 'red' : 'amber'}>
            {member.payment_status === 'paid' ? '支払済み' : member.payment_status === 'overdue' ? '延滞' : '未払い'}
          </Badge>
          <span className="text-slate-400">加盟金：{yen(member.joining_fee_yen)}</span>
        </div>

        {/* 入出金の登録 */}
        <form action={addLedgerEntryAction} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="member_id" value={member.id} />
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">種別</label>
            <select name="kind" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
              <option value="deposit">入金（デポジット）</option>
              <option value="withdraw">出金</option>
              <option value="adjust">調整（＋）</option>
              <option value="settlement">取引精算（－）</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">金額（円）</label>
            <input name="amount" inputMode="numeric" placeholder="1000000" className="w-36 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[11px] text-slate-500">メモ（任意）</label>
            <input name="note" placeholder="仕入れ資金デポジット 等" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          </div>
          <button className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600">登録</button>
        </form>

        {/* 入出金履歴 */}
        {ledgerEntries.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {ledgerEntries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-28 text-xs text-slate-500">{new Date(e.created_at).toLocaleDateString('ja-JP')}</span>
                <span className="w-32 text-xs text-slate-600">{LEDGER_KIND_LABEL[e.kind] ?? e.kind}</span>
                <span className={`w-28 font-medium ${e.amount_yen >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {e.amount_yen >= 0 ? '+' : ''}{yen(e.amount_yen)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{e.note ?? ''}</span>
                <form action={deleteLedgerEntryAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="member_id" value={member.id} />
                  <button className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="取消"><XCircle className="h-4 w-4" /></button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ===== 請求・入金消込（要件 5.2 消込機能 / PAY-01〜04） ===== */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Wallet className="h-4 w-4 text-brand-500" /> 請求・入金消込
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500">請求 <span className="font-semibold text-slate-800">{yen(billingTotals.billed)}</span></span>
            <span className="text-slate-500">入金 <span className="font-semibold text-green-700">{yen(billingTotals.paid)}</span></span>
            <span className="text-slate-500">未収 <span className={`font-semibold ${outstanding > 0 ? 'text-amber-700' : 'text-slate-800'}`}>{yen(outstanding)}</span></span>
            {billingTotals.overdue > 0 && (
              <span className="rounded bg-red-50 px-2 py-0.5 font-semibold text-red-700">遅延 {billingTotals.overdue}件</span>
            )}
          </div>
        </div>

        {/* 自動売買の枠購入（3枠目以降・1枠=10万円）— 消込完了で auto_slots が自動加算（⑦フェーズ5 / 2026-07-21 改定） */}
        {member.grant_auto && (() => {
          const currentSlots = member.auto_slots ?? 0
          const planDefault = member.plan?.default_auto_slots ?? 0
          const purchasable = planDefault >= 2 // エコノミー等（既定1枠）は枠固定で追加購入不可
          const remainingSlots = Math.max(0, 10 - currentSlots)
          if (!purchasable) {
            return (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                このプランは枠数が固定（1枠）のため、追加の枠購入はできません。枠の追加は上位プラン（既定2枠・3枠目以降が購入対象）で可能です。
              </div>
            )
          }
          return (
            <form action={createSlotPurchaseAction} className="mb-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
              <input type="hidden" name="member_id" value={member.id} />
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">販売可能枠を購入</span>
                <span className="text-xs text-slate-500">1枠=100,000円／保有 {currentSlots} 枠・上限10枠（3枠目以降が購入対象）</span>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">購入枠数 *</label>
                  <input
                    name="slot_count"
                    type="number"
                    min={1}
                    max={remainingSlots || 1}
                    defaultValue={remainingSlots > 0 ? 1 : ''}
                    disabled={remainingSlots === 0}
                    className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </div>
                <button
                  disabled={remainingSlots === 0}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  枠購入を請求
                </button>
                <p className="text-xs text-slate-500">
                  {remainingSlots === 0
                    ? '既に上限（10枠）に達しています。'
                    : '請求を発行し、入金消込が完了すると自動的に枠が付与されます。枠数に応じて月額管理手数料も増減します。'}
                </p>
              </div>
            </form>
          )
        })()}

        {/* 月額管理手数料（枠数連動・本部が月次で相殺／請求）— 2026-07-21 改定 */}
        {member.grant_auto && mgmtFee.eligible && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">月額管理手数料（月次）</span>
              <span className="text-xs text-slate-500">月額 =（枠数−1）× {yen(mgmtFee.unit)} ／ 現在 {mgmtFee.slots}枠 = <span className="font-semibold text-amber-700">{yen(mgmtFee.monthlyFee)}</span>/月</span>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
              <div>起算日<div className="font-medium text-slate-800">{mgmtFee.anchor ?? '未設定'}</div></div>
              <div>課金済み<div className="font-medium text-slate-800">{mgmtFee.billedMonths} か月</div></div>
              <div>今回課金可能<div className="font-medium text-slate-800">{mgmtFee.dueMonths} か月 = {yen(mgmtFee.dueGross)}</div></div>
              <div>預かり金残高<div className="font-medium text-slate-800">{yen(mgmtFee.balance)}</div></div>
            </div>
            <form action={runMemberMgmtFeeAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="member_id" value={member.id} />
              <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">今月分を相殺／請求する</button>
              <span className="text-xs text-slate-500">満了月分を預かり金から相殺し、不足は請求（デポジット依頼）＋通知します。</span>
            </form>
            {mgmtFeeRuns.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-amber-100 pt-2">
                <div className="text-[11px] font-medium text-slate-500">実行履歴</div>
                {mgmtFeeRuns.slice(0, 6).map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-600">
                    <span className="text-slate-400">{new Date(r.created_at).toLocaleDateString('ja-JP')}</span>
                    <span>{r.months}か月・{r.slots}枠</span>
                    <span>総額 {yen(r.gross_yen)}</span>
                    <span className="text-green-700">預かり金 {yen(r.from_deposit_yen)}</span>
                    {r.invoiced_yen > 0 && <span className="text-amber-700">請求 {yen(r.invoiced_yen)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 請求を作成 */}
        <form action={createInvoiceAction} className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input type="hidden" name="member_id" value={member.id} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">費目 *</label>
              <select name="kind" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {Object.entries(INVOICE_KIND_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">請求額（円）*</label>
              <input name="amount" inputMode="numeric" required placeholder="100000" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">支払期限</label>
              <input type="date" name="due_date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">件名（任意）</label>
              <input name="title" placeholder="2026年7月分 など" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" name="requested" defaultChecked className="h-4 w-4 rounded border-slate-300 text-brand-500" />
              作成と同時に「請求済」にする（加盟店に表示されます）
            </label>
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">請求を追加</button>
          </div>
        </form>

        {/* 請求一覧（消込状況） */}
        <div className="space-y-3">
          {invoices.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">請求はまだありません。</p>
          )}
          {invoices.map((inv, i) => {
            const remaining = Math.max(0, inv.amount_yen - inv.paid_yen)
            const pct = inv.amount_yen > 0 ? Math.min(100, Math.round((inv.paid_yen / inv.amount_yen) * 100)) : 0
            const done = inv.status === 'paid' || inv.status === 'cancelled'
            return (
              <div key={inv.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{INVOICE_KIND_LABEL[inv.kind]}</span>
                  {inv.title && <span className="text-xs text-slate-500">{inv.title}</span>}
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${INVOICE_STATUS_TONE[inv.status]}`}>{INVOICE_STATUS_LABEL[inv.status]}</span>
                  {inv.due_date && (
                    <span className={`text-[11px] ${inv.status === 'overdue' ? 'font-semibold text-red-600' : 'text-slate-400'}`}>期限 {inv.due_date}</span>
                  )}
                  <span className="ml-auto text-sm text-slate-700">
                    <span className="font-semibold text-green-700">{yen(inv.paid_yen)}</span> / {yen(inv.amount_yen)}
                    {remaining > 0 && inv.status !== 'cancelled' && <span className="ml-2 text-amber-700">残 {yen(remaining)}</span>}
                  </span>
                </div>

                {/* 消込プログレス */}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${inv.status === 'overdue' ? 'bg-red-400' : done ? 'bg-green-500' : 'bg-brand-400'}`} style={{ width: `${pct}%` }} />
                </div>

                {/* 消込内訳（入金明細） */}
                {invoicePayments[i].length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {invoicePayments[i].map((p) => (
                      <li key={p.id} className="flex items-center gap-2 text-xs text-slate-500">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> {p.payment_date} 入金 <span className="font-medium text-slate-700">{yen(p.amount_yen)}</span>
                        {p.note && <span className="text-slate-400">（{p.note}）</span>}
                      </li>
                    ))}
                  </ul>
                )}

                {/* 操作：消込（入金記録）・請求発行・取消 */}
                {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                  <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                    <form action={recordPaymentAction} className="flex items-end gap-2">
                      <input type="hidden" name="invoice_id" value={inv.id} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <div>
                        <label className="mb-0.5 block text-[11px] text-slate-500">入金額（消込）</label>
                        <input name="amount" inputMode="numeric" required defaultValue={remaining || ''} placeholder="金額" className="w-32 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-slate-500">入金日</label>
                        <input type="date" name="payment_date" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
                      </div>
                      <button className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">消込する</button>
                    </form>
                    {inv.status === 'unbilled' && (
                      <form action={markBilledAction}>
                        <input type="hidden" name="id" value={inv.id} />
                        <input type="hidden" name="member_id" value={member.id} />
                        <button className="rounded-lg border border-info-300 px-3 py-1.5 text-xs font-medium text-info-700 hover:bg-info-50">請求を発行</button>
                      </form>
                    )}
                    <form action={cancelInvoiceAction} className="ml-auto">
                      <input type="hidden" name="id" value={inv.id} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <button className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-600">取消</button>
                    </form>
                  </div>
                )}
                {(inv.status === 'cancelled' || inv.status === 'paid') && (
                  <div className="mt-2 flex justify-end border-t border-slate-100 pt-2">
                    <form action={deleteInvoiceAction}>
                      <input type="hidden" name="id" value={inv.id} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <button className="text-xs text-slate-400 hover:text-red-600">削除</button>
                    </form>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* 入金履歴 */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">入金履歴（すべての入金）</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">日付</th>
                <th className="px-4 py-2 font-medium">種別</th>
                <th className="px-4 py-2 font-medium">金額</th>
                <th className="px-4 py-2 font-medium">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    入金履歴はありません。
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-slate-700">{p.payment_date}</td>
                  <td className="px-4 py-2 text-slate-700">{p.kind}</td>
                  <td className="px-4 py-2 text-slate-900">{yen(p.amount_yen)}</td>
                  <td className="px-4 py-2 text-slate-700">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
