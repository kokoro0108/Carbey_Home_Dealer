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
import { listConsentLog } from '@/lib/portal/agreements'
import { MEMBER_STATUS_LABEL, yen } from '@/lib/portal/labels'
import { Badge } from '@/components/ui/Badge'
import { updateMemberAction, issueCredentialsAction } from '../actions'
import { reviewEvidenceAction } from '../evidence-actions'
import { confirmSelfAction, setAdminStepAction } from '../funding-actions'
import { addLedgerEntryAction, deleteLedgerEntryAction } from '../ledger-actions'
import MemberFormFields from '../MemberFormFields'

const LEDGER_KIND_LABEL: Record<string, string> = {
  deposit: '入金（デポジット）',
  withdraw: '出金',
  settlement: '取引精算',
  adjust: '調整',
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
  const [funding, consents, orderSummary, capabilities, ledgerBalance, ledgerEntries] = await Promise.all([
    getFunding(member.id), listConsentLog(member.id), getMemberOrderSummary(member.id), getMemberCapabilities(member.id),
    getLedgerBalance(member.id), listLedgerEntries(member.id),
  ])

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
          契約ステータスを「稼働中（active）」にするには契約プランの選択が必須です（半自動／自動／両方のいずれか）。プランを選択して保存してください。
        </div>
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
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">プラン / フロー</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {member.plan ? (
              <Badge tone={member.plan.code?.includes('full') || member.plan.name?.includes('フル') ? 'brand' : 'slate'}>
                {member.plan.name}
              </Badge>
            ) : (
              <span className="text-sm font-semibold text-amber-600">未割当</span>
            )}
            {member.active_flow && (
              <span className="rounded bg-info-50 px-1.5 py-0.5 text-[10px] font-medium text-info-700">
                {member.active_flow === 'auto' ? '自動売買' : '半自動売買'}
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

      {/* ===== 利用可能機能（プラン・フロー連動で自動制御／㉕） ===== */}
      {capabilities && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <KeyRound className="h-4 w-4 text-brand-500" /> 利用可能機能（プラン連動・自動制御）
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            プラン・売買フロー・オンボーディング完了状況・古物商猶予に応じて自動で制御されます（手動設定ではありません）。
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

      {/* 入金履歴 */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">入金履歴（加盟金・月額）</h2>
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
