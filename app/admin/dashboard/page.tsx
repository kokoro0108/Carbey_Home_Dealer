import Link from 'next/link'
import {
  Store,
  FileText,
  CircleDollarSign,
  TrendingUp,
  ClipboardList,
  MessageSquare,
  ArrowRight,
  Plus,
  ShieldCheck,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { getAdminStats } from '@/lib/portal/dashboard'
import { yen, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/portal/labels'
import { listOrders } from '@/lib/portal/orders'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LineChart, DonutChart } from '@/components/charts/MiniCharts'

export const dynamic = 'force-dynamic'

/* ===== ダミーデータ (Phase 2 UI 先行。実データ接続時に差し替え) ===== */
const TREND_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const TREND_REVENUE = [820, 960, 1040, 1180, 1120, 1350, 1480, 1420, 1610, 1550, 1720, 1860]
const TREND_PROFIT = [310, 360, 400, 470, 440, 520, 560, 540, 620, 600, 660, 720]

const VEHICLE_COLUMNS = [
  {
    title: '仕入れ',
    count: 28,
    accent: 'text-brand-600',
    items: [
      { name: 'トヨタ ハリアー', year: '2021年', km: '2.1万km', priceLabel: '仕入価格', price: '¥2,450,000', date: '仕入日 : 2025/05/01' },
      { name: '日産 エクストレイル', year: '2020年', km: '3.5万km', priceLabel: '仕入価格', price: '¥1,980,000', date: '仕入日 : 2025/04/29' },
    ],
  },
  {
    title: '商品化中',
    count: 18,
    accent: 'text-amber-600',
    items: [
      { name: 'ホンダ ヴェゼル', year: '2021年', km: '2.4万km', priceLabel: '整備費 (概算)', price: '¥410,000', date: '完了予定 : 5/20' },
      { name: 'マツダ CX-5', year: '2020年', km: '2.3万km', priceLabel: '整備費 (概算)', price: '¥350,000', date: '完了予定 : 5/18' },
    ],
  },
  {
    title: '販売中',
    count: 32,
    accent: 'text-info-600',
    items: [
      { name: 'トヨタ アルファード', year: '2021年', km: '1.5万km', priceLabel: '販売価格', price: '¥4,980,000', date: '掲載日 : 2025/05/05' },
      { name: 'BMW 320d', year: '2019年', km: '2.7万km', priceLabel: '販売価格', price: '¥3,250,000', date: '掲載日 : 2025/05/04' },
    ],
  },
  {
    title: '清算済み',
    count: 15,
    accent: 'text-emerald-600',
    items: [
      { name: 'トヨタ ランドクルーザー', year: '2020年', km: '2.6万km', priceLabel: '清算額', price: '¥5,250,000', date: '清算日 : 2025/05/07', profit: '+24.6%' },
      { name: 'レクサス NX', year: '2021年', km: '1.9万km', priceLabel: '清算額', price: '¥4,150,000', date: '清算日 : 2025/05/05', profit: '+21.2%' },
    ],
  },
]

const ONBOARDING_STEPS = [
  { label: '未開始', count: 46, pct: '14%', tone: 'bg-brand-500' },
  { label: '進行中', count: 158, pct: '49%', tone: 'bg-info-600' },
  { label: '審査中', count: 48, pct: '15%', tone: 'bg-amber-500' },
  { label: '完了', count: 116, pct: '36%', tone: 'bg-emerald-500' },
]
const ARROW_COLORS = ['text-brand-500', 'text-info-600', 'text-amber-500']

const NOTICES = [
  { title: 'システムメンテナンスのお知らせ', date: '2025/05/10' },
  { title: '新機能リリース：AI分析機能が追加されました', date: '2025/05/08' },
  { title: '【重要】請求書の送付スケジュール変更について', date: '2025/05/01' },
]

const AI_TOP_MODELS = [
  { model: 'トヨタ ハリアー', demand: '高', margin: '24.6%', conf: '88%' },
  { model: 'レクサス NX', demand: '高', margin: '22.1%', conf: '86%' },
  { model: 'マツダ CX-5', demand: '中', margin: '19.8%', conf: '82%' },
  { model: 'トヨタ プリウス', demand: '高', margin: '18.7%', conf: '80%' },
]

const ORDERS = [
  { id: 'ORD-202505-001', member: '山田モーターズ', car: 'ハリアー', status: '受付中', date: '2025/05/10', tone: 'amber' as const },
  { id: 'ORD-202505-002', member: 'ABC自動車', car: 'エクストレイル', status: '対応中', date: '2025/05/10', tone: 'blue' as const },
  { id: 'ORD-202505-003', member: 'DEFカーズ', car: 'ヴェゼル', status: '対応中', date: '2025/05/09', tone: 'blue' as const },
  { id: 'ORD-202505-004', member: 'GHIオート', car: 'CX-5', status: '完了', date: '2025/05/08', tone: 'green' as const },
  { id: 'ORD-202505-005', member: 'JKLモーターズ', car: 'NX', status: '対応中', date: '2025/05/08', tone: 'blue' as const },
]

const CHATS = [
  { name: '山田モーターズ 佐藤様', msg: '見積もりありがとうございます！', time: '10:32', unread: true },
  { name: 'ABC自動車 鈴木様', msg: '車両の件、確認しました。', time: '10:15', unread: true },
  { name: '本部サポート', msg: 'オンボーディング書類のご...', time: '昨日', unread: false },
  { name: 'DEFカーズ 田中様', msg: '価格について相談です。', time: '昨日', unread: false },
  { name: 'GHIオート 伊藤様', msg: 'AI分析レポートの見方を教...', time: '5/9', unread: false },
]

const DONUT_COLORS = ['#fb2c1d', '#1d5cf0', '#06b6d4', '#f59e0b', '#94a3b8']

export default async function AdminDashboardPage() {
  const [stats, recentOrders] = await Promise.all([getAdminStats(), listOrders()])
  const m = stats.members
  const totalContracts = stats.planDistribution.reduce((s, p) => s + p.count, 0)

  // 実オーダーがあれば実データ、無ければデモ用ダミーを表示
  const orderRows = recentOrders.length > 0
    ? recentOrders.slice(0, 5).map((o) => ({
        id: o.order_number ?? o.id.slice(0, 8),
        member: o.member?.company_name ?? o.member?.member_name ?? '—',
        car: [o.maker, o.car_model].filter(Boolean).join(' '),
        status: ORDER_STATUS_LABEL[o.status],
        tone: ORDER_STATUS_TONE[o.status],
      }))
    : ORDERS
  const planSlices = stats.planDistribution
    .filter((p) => p.count > 0)
    .map((p, i) => ({ label: p.name, value: p.count, color: DONUT_COLORS[i % DONUT_COLORS.length] }))

  return (
    <div className="space-y-6">
      {/* ===== ヘッダー (タイトル) ===== */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">ダッシュボード</h1>
        <p className="text-sm text-slate-500">本部管理者ビュー</p>
      </div>

      {/* ===== KPI 6枚 ===== */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="加盟店数" value={m.total} icon={<Store className="h-4 w-4" />} tone="brand" href="/admin/members" delta={{ value: 12, dir: 'up' }} sub="前月比 +3.8%" />
        <StatCard label="有効契約数" value={totalContracts} icon={<FileText className="h-4 w-4" />} tone="blue" delta={{ value: 18, dir: 'up' }} ring={89} sub="契約継続率" />
        <StatCard label="今月の売上高" value={yen(stats.monthlyRevenueYen || 28600000)} icon={<CircleDollarSign className="h-4 w-4" />} tone="green" delta={{ value: '18.6%', dir: 'up' }} sub="前月比" />
        <StatCard label="今月の粗利益" value={yen(6240000)} icon={<TrendingUp className="h-4 w-4" />} tone="brand" delta={{ value: '14.2%', dir: 'up' }} sub="利益率 21.8%" />
        <StatCard label="オンボーディング" value={m.pending || 12} icon={<ClipboardList className="h-4 w-4" />} tone="slate" badge={{ label: '要対応', tone: 'amber' }} href="/admin/members?status=pending" sub="未完了加盟店" />
        <StatCard label="未読チャット" value={31} icon={<MessageSquare className="h-4 w-4" />} tone="blue" delta={{ value: 8, dir: 'up' }} sub="未読メッセージ" />
      </div>

      {/* ===== 推移 + プラン別 ===== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="売上・利益の推移" action={<span className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500">今年</span>} />
          <CardBody>
            <LineChart
              labels={TREND_LABELS}
              series={[
                { name: '売上高 (万円)', color: '#1d5cf0', data: TREND_REVENUE },
                { name: '粗利益 (万円)', color: '#fb2c1d', data: TREND_PROFIT },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="プラン別加盟店数" action={<Link href="/admin/plans" className="text-xs text-info-600 hover:underline">プラン管理</Link>} />
          <CardBody>
            {planSlices.length > 0 ? (
              <DonutChart slices={planSlices} centerLabel="合計" centerValue={totalContracts} />
            ) : (
              <DonutChart
                centerLabel="合計"
                centerValue={320}
                slices={[
                  { label: 'エコノミー', value: 85, color: DONUT_COLORS[0] },
                  { label: 'ブロンズ', value: 110, color: DONUT_COLORS[1] },
                  { label: 'プラチナ', value: 75, color: DONUT_COLORS[2] },
                  { label: 'ゴールド', value: 50, color: DONUT_COLORS[3] },
                ]}
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* ===== 車両進捗管理 (カンバン) ===== */}
      <Card>
        <CardHeader
          title="車両進捗管理"
          action={
            <button className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
              <Plus className="h-3.5 w-3.5" /> 車両を追加
            </button>
          }
        />
        <CardBody>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {VEHICLE_COLUMNS.map((col) => (
              <div key={col.title} className="rounded-xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className={`text-sm font-semibold ${col.accent}`}>{col.title} ({col.count}台)</span>
                </div>
                <div className="space-y-2">
                  {col.items.map((v) => (
                    <div key={v.name} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="text-[13px] font-semibold text-slate-800">{v.name}</div>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{v.year} ・ {v.km}</div>
                      <div className="mt-2 flex items-end justify-between">
                        <div>
                          <div className="text-[10px] text-slate-400">{v.priceLabel}</div>
                          <div className="text-sm font-bold text-slate-900">{v.price}</div>
                        </div>
                        {'profit' in v && v.profit && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">利益 {v.profit}</span>
                        )}
                      </div>
                      <div className="mt-1.5 text-[10px] text-slate-400">{v.date}</div>
                    </div>
                  ))}
                  <button className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 py-2 text-[11px] text-slate-400 hover:bg-white">
                    他 {col.count - col.items.length} 台 <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* ===== オンボーディング進捗 + お知らせ ===== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="オンボーディング進捗状況" />
          <CardBody>
            <div className="flex items-start justify-between">
              {ONBOARDING_STEPS.map((s, i) => (
                <div key={s.label} className="flex flex-1 items-start last:flex-none">
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${s.tone} text-white`}>
                      {s.label === '完了' ? <CheckCircle2 className="h-6 w-6" /> : <ClipboardList className="h-5 w-5" />}
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-700">{s.label}</div>
                    <div className="mt-0.5 text-lg font-bold text-slate-900">
                      {s.count} <span className="text-xs font-normal text-slate-400">({s.pct})</span>
                    </div>
                  </div>
                  {i < ONBOARDING_STEPS.length - 1 && (
                    <ArrowRight className={`mt-3.5 h-5 w-5 shrink-0 ${ARROW_COLORS[i]}`} />
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="お知らせ" action={<Link href="/admin/notifications" className="text-xs text-info-600 hover:underline">すべて見る</Link>} />
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {NOTICES.map((n) => (
                <li key={n.title} className="flex items-start gap-2 px-5 py-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-slate-700">{n.title}</div>
                    <div className="text-[11px] text-slate-400">{n.date}</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* ===== AI分析インサイト + オーダー + チャット ===== */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* AI分析インサイト */}
        <Card>
          <CardHeader title="AI分析インサイト" />
          <CardBody>
            <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
              <span className="flex-1 rounded-md bg-white py-1 text-center font-medium text-slate-700 shadow-sm">市場分析</span>
              <span className="flex-1 py-1 text-center text-slate-500">相場分析</span>
              <span className="flex-1 py-1 text-center text-slate-500">車種分析</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Insight title="需要" value="高い" tone="text-emerald-600" sub="前月比 +12.4%" />
              <Insight title="相場" value="上昇傾向" tone="text-info-600" sub="前月比 +5.3%" />
              <Insight title="在庫リスク" value="低い" tone="text-amber-600" sub="前月比 -2.1%" />
            </div>
            <p className="mt-4 mb-2 text-[11px] font-semibold text-slate-500">利益ポテンシャル上位車種 (予測)</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="py-1 text-left font-medium">車種</th>
                  <th className="py-1 text-center font-medium">需要</th>
                  <th className="py-1 text-right font-medium">平均利益率</th>
                  <th className="py-1 text-right font-medium">信頼度</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {AI_TOP_MODELS.map((r) => (
                  <tr key={r.model}>
                    <td className="py-1.5 text-slate-700">{r.model}</td>
                    <td className="py-1.5 text-center text-slate-500">{r.demand}</td>
                    <td className="py-1.5 text-right font-medium text-slate-900">{r.margin}</td>
                    <td className="py-1.5 text-right text-slate-500">{r.conf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 rounded-lg bg-info-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              AIは意思決定を支援するものであり、最終的な判断はユーザーの責任で行ってください。
            </div>
          </CardBody>
        </Card>

        {/* オーダー管理 */}
        <Card>
          <CardHeader title="オーダー管理" action={<Link href="/admin/orders" className="text-xs text-info-600 hover:underline">すべて見る</Link>} />
          <CardBody className="p-0">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-400">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">オーダーID</th>
                  <th className="px-2 py-2 text-left font-medium">加盟店名</th>
                  <th className="px-2 py-2 text-left font-medium">車種</th>
                  <th className="px-2 py-2 text-center font-medium">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orderRows.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{o.id}</td>
                    <td className="px-2 py-2.5 text-slate-600">{o.member}</td>
                    <td className="px-2 py-2.5 text-slate-600">{o.car}</td>
                    <td className="px-2 py-2.5 text-center"><Badge tone={o.tone}>{o.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        {/* チャット */}
        <Card>
          <CardHeader title="チャット" action={<Link href="/admin/chat" className="text-xs text-info-600 hover:underline">すべて見る</Link>} />
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {CHATS.map((c) => (
                <li key={c.name} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                    {c.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-[13px] font-medium text-slate-800">{c.name}</span>
                      <span className="text-[11px] text-slate-400">{c.time}</span>
                    </div>
                    <div className="truncate text-[12px] text-slate-500">{c.msg}</div>
                  </div>
                  {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* ===== 価値訴求バー ===== */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-navy-900 p-6 text-white sm:grid-cols-2 lg:grid-cols-4">
        <Value icon={<TrendingUp className="h-5 w-5" />} title="車両を一元管理" desc="仕入れから清算まで、すべての進捗を可視化・効率的に管理できます。" />
        <Value icon={<ShieldCheck className="h-5 w-5" />} title="AIで意思決定を加速" desc="市場データとAI分析で、仕入れの判断を強力にサポートします。" />
        <Value icon={<CircleDollarSign className="h-5 w-5" />} title="利益を最大化" desc="データ分析で利益率向上のポイントを特定し、収益を最大化します。" />
        <Value icon={<Clock className="h-5 w-5" />} title="本部の安心サポート" desc="充実したサポート体制で、加盟店の成長を支えます。" />
      </div>
    </div>
  )
}

function Insight({ title, value, tone, sub }: { title: string; value: string; tone: string; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-3">
      <div className="text-[11px] text-slate-400">{title}</div>
      <div className={`mt-1 text-sm font-bold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[10px] text-slate-400">{sub}</div>
    </div>
  )
}

function Value({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-400">{icon}</span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{desc}</div>
      </div>
    </div>
  )
}
