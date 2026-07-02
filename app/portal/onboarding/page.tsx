import Image from 'next/image'
import {
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  ClipboardCheck,
  Wallet,
  FileText,
  GraduationCap,
  Rocket,
} from 'lucide-react'
import { requireMember } from '@/lib/auth/session'
import { getOwnOnboarding } from '@/lib/portal/onboarding'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { DonutChart } from '@/components/charts/MiniCharts'

export const dynamic = 'force-dynamic'

/**
 * 加盟店オンボーディング画面（実データ）。
 * 世界観はログイン画面に統一：未来的なヒーロー背景 + システマティックなグラフ + メカニカルなステップ配列。
 * タスクの完了操作は本部が行う（加盟店は閲覧）。
 */

const STEP_ICON: Record<string, React.ReactNode> = {
  contract: <ClipboardCheck className="h-5 w-5" />,
  funding: <Wallet className="h-5 w-5" />,
  documents: <FileText className="h-5 w-5" />,
  training: <GraduationCap className="h-5 w-5" />,
  launch: <Rocket className="h-5 w-5" />,
}

const STATUS_META = {
  done: { ring: 'bg-emerald-500 text-white', badge: 'bg-emerald-50 text-emerald-700', label: '完了' },
  current: { ring: 'bg-brand-500 text-white ring-4 ring-brand-100', badge: 'bg-brand-50 text-brand-700', label: '進行中' },
  todo: { ring: 'bg-slate-200 text-slate-400', badge: 'bg-slate-100 text-slate-500', label: '未着手' },
} as const

export default async function OnboardingPage() {
  const session = await requireMember()
  const view = await getOwnOnboarding(session.userId)

  if (!view) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        会員情報が紐付いていません。本部にお問い合わせください。
      </div>
    )
  }

  const doneSteps = view.steps.filter((s) => s.status === 'done').length
  const currentStep = view.steps.find((s) => s.status === 'current')

  return (
    <div className="space-y-6">
      {/* ===== ヒーロー（未来的背景・ログイン画面と統一） ===== */}
      <div className="relative overflow-hidden rounded-2xl bg-navy-900 text-white">
        <Image src="/login-hero.png" alt="" fill priority sizes="100vw" className="object-cover object-right opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/90 to-transparent" />
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-400">Onboarding</p>
            <h1 className="mt-1.5 text-2xl font-bold">スタートアップ進捗</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              データと AI で、中古車ビジネスを次のステージへ。
              下のステップを順に完了すると、すべての機能が解放されます。
            </p>
            {currentStep && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm backdrop-blur">
                <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
                現在のステップ：<span className="font-semibold">{currentStep.label}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-5 rounded-xl bg-white/5 p-5 backdrop-blur">
            <ProgressRing pct={view.pct} />
            <div className="text-sm">
              <div className="font-semibold">全体進捗</div>
              <div className="mt-1 text-slate-300">{doneSteps} / {view.steps.length} ステップ完了</div>
              <div className="text-slate-300">{view.doneTasks} / {view.totalTasks} タスク完了</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ===== ステップ タイムライン ===== */}
        <Card className="lg:col-span-2">
          <CardHeader title="スタートアップ ステップ" action={<span className="text-xs text-slate-400">全 {view.steps.length} ステップ</span>} />
          <CardBody>
            <ol className="relative space-y-6 before:absolute before:left-[18px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-slate-200">
              {view.steps.map((step, i) => {
                const meta = STATUS_META[step.status]
                return (
                  <li key={step.key} className="relative flex gap-4">
                    <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.ring}`}>
                      {step.status === 'done' ? <CheckCircle2 className="h-5 w-5" /> : STEP_ICON[step.key] ?? <Circle className="h-5 w-5" />}
                    </span>
                    <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-400">STEP {i + 1}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.badge}`}>{meta.label}</span>
                          </div>
                          <h3 className="mt-0.5 text-sm font-bold text-slate-900">{step.label}</h3>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-slate-400">{step.done}/{step.total}</span>
                      </div>
                      <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {step.tasks.map((t) => (
                          <li key={t.id} className={`flex items-center gap-1.5 text-xs ${t.status === 'done' ? 'text-slate-700' : 'text-slate-400'}`}>
                            {t.status === 'done'
                              ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              : t.status === 'in_progress'
                                ? <Loader2 className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                                : <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                            {t.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardBody>
        </Card>

        {/* ===== サイド：進捗グラフ + 解放される機能 ===== */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="ステップ別の状況" />
            <CardBody>
              <DonutChart
                centerLabel="進捗"
                centerValue={`${view.pct}%`}
                slices={[
                  { label: '完了', value: view.steps.filter((s) => s.status === 'done').length, color: '#10b981' },
                  { label: '進行中', value: view.steps.filter((s) => s.status === 'current').length, color: '#fb2c1d' },
                  { label: '未着手', value: view.steps.filter((s) => s.status === 'todo').length, color: '#cbd5e1' },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="完了で解放される機能" />
            <CardBody className="space-y-2.5">
              {[
                { label: '仕入れオーダー', icon: <Rocket className="h-4 w-4" /> },
                { label: 'AI 壁打ち', icon: <GraduationCap className="h-4 w-4" /> },
                { label: '販売実績の登録', icon: <FileText className="h-4 w-4" /> },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-slate-400">{f.icon}</span>
                    {f.label}
                  </span>
                  {view.pct >= 100 ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Lock className="h-3.5 w-3.5 text-slate-300" />}
                </div>
              ))}
            </CardBody>
          </Card>

          <p className="px-1 text-xs text-slate-400">
            ※ 各ステップの完了は本部が確認・更新します。ご不明点はチャットまたはサポートへ。
          </p>
        </div>
      </div>
    </div>
  )
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 30
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="7" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="#fb2c1d" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} />
      <text x="40" y="44" textAnchor="middle" className="rotate-90 fill-white text-base font-bold" style={{ transformOrigin: '40px 40px' }}>
        {pct}%
      </text>
    </svg>
  )
}
