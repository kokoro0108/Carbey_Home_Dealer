import Link from 'next/link'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { listMembers } from '@/lib/portal/members'
import { MEMBER_STATUS_LABEL } from '@/lib/portal/labels'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { MemberStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminOnboardingPage() {
  await requireFeature('members')
  const members = await listMembers()

  const withProgress = members.map((m) => {
    const total = m.onboarding_total || 1
    const pct = Math.round((m.onboarding_done / total) * 100)
    return { ...m, pct }
  })

  const inProgress = withProgress.filter((m) => m.pct < 100).length
  const completed = withProgress.filter((m) => m.pct >= 100).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">オンボーディング管理</h1>
        <p className="text-sm text-slate-500">加盟店ごとのスタートアップ進捗を確認・更新します。</p>
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Summary label="加盟店数" value={members.length} />
        <Summary label="進行中" value={inProgress} tone="text-brand-600" />
        <Summary label="完了" value={completed} tone="text-emerald-600" />
      </div>

      {/* 一覧 */}
      <Card>
        <div className="overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">加盟店</th>
                <th className="px-5 py-3 font-medium">ステータス</th>
                <th className="px-5 py-3 font-medium">進捗</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {withProgress.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">加盟店がいません。</td></tr>
              )}
              {withProgress.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{m.company_name ?? m.member_name}</div>
                    <div className="text-xs text-slate-500">{m.member_name}</div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={m.status === 'active' ? 'green' : m.status === 'pending' ? 'amber' : m.status === 'suspended' ? 'red' : 'slate'}>
                      {MEMBER_STATUS_LABEL[m.status as MemberStatus]}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${m.pct >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${m.pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-600">{m.onboarding_done}/{m.onboarding_total}（{m.pct}%）</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/onboarding/${m.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-info-600 hover:underline">
                      管理 <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Summary({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <ClipboardList className="h-4 w-4 text-slate-400" />
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  )
}
