import Link from 'next/link'
import { FileText, ChevronRight, Bot, Hand } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { listMembers } from '@/lib/portal/members'
import { MEMBER_STATUS_LABEL, PAYMENT_STATUS_LABEL, yen } from '@/lib/portal/labels'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import type { MemberStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<MemberStatus, 'green' | 'amber' | 'red' | 'slate'> = {
  active: 'green', pending: 'amber', suspended: 'red', cancelled: 'slate',
}

/**
 * 契約管理（全加盟店の契約一覧・横断ビュー / 要件 A-05・PLAN-05）。
 * 契約日・プラン・契約ステータス・月額費用・支払・運用方式を一覧。個別編集は会員詳細。
 */
export default async function AdminContractsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireFeature('members')
  const sp = await searchParams
  const all = await listMembers()
  const filter = (['active', 'pending', 'suspended', 'cancelled'] as MemberStatus[]).includes(sp.status as MemberStatus)
    ? (sp.status as MemberStatus)
    : undefined
  const rows = filter ? all.filter((m) => m.status === filter) : all
  const count = (s: MemberStatus) => all.filter((m) => m.status === s).length
  const monthlyTotal = all.filter((m) => m.status === 'active').reduce((s, m) => s + (m.monthly_fee_yen ?? 0), 0)

  const flowLabel = (m: (typeof all)[number]) =>
    m.grant_auto && m.grant_semi ? '両方' : m.grant_auto ? '自動売買' : m.grant_semi ? '半自動' : '—'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <FileText className="h-5 w-5 text-brand-500" /> 契約管理
        </h1>
        <p className="text-sm text-slate-500">全加盟店の契約情報（プラン・契約日・ステータス・月額費用）を横断で確認します。個別の編集は各加盟店の詳細画面から行います。</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="加盟店数" value={`${all.length}`} icon={<FileText className="h-4 w-4" />} tone="brand" />
        <StatCard label="稼働中" value={`${count('active')}`} icon={<FileText className="h-4 w-4" />} tone="green" />
        <StatCard label="保留中" value={`${count('pending')}`} icon={<FileText className="h-4 w-4" />} tone="amber" />
        <StatCard label="停止・解約" value={`${count('suspended') + count('cancelled')}`} icon={<FileText className="h-4 w-4" />} tone="slate" />
        <StatCard label="月額合計（稼働中）" value={yen(monthlyTotal)} icon={<FileText className="h-4 w-4" />} tone="blue" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/contracts" className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!filter ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>すべて（{all.length}）</Link>
        {(['active', 'pending', 'suspended', 'cancelled'] as MemberStatus[]).map((s) => (
          <Link key={s} href={`/admin/contracts?status=${s}`} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === s ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {MEMBER_STATUS_LABEL[s]}（{count(s)}）
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title={`契約一覧${filter ? `：${MEMBER_STATUS_LABEL[filter]}` : ''}`} action={<span className="text-xs text-slate-400">{rows.length} 件</span>} />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">加盟店</th>
                  <th className="px-5 py-3 font-medium">プラン</th>
                  <th className="px-5 py-3 font-medium">運用方式</th>
                  <th className="px-5 py-3 font-medium">契約ステータス</th>
                  <th className="px-5 py-3 font-medium">契約日</th>
                  <th className="px-5 py-3 font-medium">月額費用</th>
                  <th className="px-5 py-3 font-medium">支払</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">該当する加盟店はありません。</td></tr>
                )}
                {rows.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{m.company_name ?? m.member_name}</div>
                      {m.company_name && <div className="text-xs text-slate-400">{m.member_name}</div>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{m.plan?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                        {m.grant_auto && <Bot className="h-3.5 w-3.5 text-brand-500" />}
                        {m.grant_semi && <Hand className="h-3.5 w-3.5 text-emerald-500" />}
                        {flowLabel(m)}
                      </span>
                    </td>
                    <td className="px-5 py-3"><Badge tone={STATUS_TONE[m.status]}>{MEMBER_STATUS_LABEL[m.status]}</Badge></td>
                    <td className="px-5 py-3 text-slate-600">{m.contract_date ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-700">{yen(m.monthly_fee_yen)}</td>
                    <td className="px-5 py-3 text-slate-600">{PAYMENT_STATUS_LABEL[m.payment_status]}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/admin/members/${m.id}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-info-600 hover:underline">
                        詳細 <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
