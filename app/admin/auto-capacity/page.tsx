import Link from 'next/link'
import { Gauge, Package, ChevronRight, CheckCircle2, XCircle, Clock, ArrowUp, ArrowDown } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { getGlobalAutoCapacity, getAutoSettings, listAutoMembers, listWaitingReservations } from '@/lib/portal/auto-trading'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { yen } from '@/lib/portal/labels'
import { getMgmtFeeUnit, getConsumptionTaxPct } from '@/lib/portal/mgmt-fee'
import { updateAutoSettingsAction, updateMgmtFeeSettingsAction, moveReservationAction, cancelReservationAction, assignReservationAction, runAllMgmtFeeAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function AutoCapacityPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireFeature('reports')
  const sp = await searchParams
  const [global, settings, members, reservations, feeUnit, taxPct] = await Promise.all([
    getGlobalAutoCapacity(),
    getAutoSettings(),
    listAutoMembers(),
    listWaitingReservations(),
    getMgmtFeeUnit(),
    getConsumptionTaxPct(),
  ])
  const usagePct = global.total > 0 ? Math.round((global.active / global.total) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Gauge className="h-5 w-5 text-brand-500" /> 自動売買 キャパ・受注管理
          </h1>
          <p className="text-sm text-slate-500">自動売買の同時運用台数（全体上限）と、加盟者ごとの枠・稼働・受注可否を一元管理します。</p>
        </div>
        <form action={runAllMgmtFeeAction}>
          <button className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100">
            月額管理手数料を一括実行
          </button>
        </form>
      </div>
      {sp.msg && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{sp.msg}</div>}

      {/* 全体キャパ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="稼働台数" value={`${global.active}台`} icon={<Package className="h-4 w-4" />} tone="brand" sub="仕入れ中〜販売中" />
        <StatCard label="全体上限" value={`${global.total}台`} icon={<Gauge className="h-4 w-4" />} tone="slate" sub="設定で拡張可" />
        <StatCard label="残キャパ" value={`${global.available}台`} icon={<Package className="h-4 w-4" />} tone={global.available > 0 ? 'green' : 'blue'} />
        <StatCard label="使用率" value={`${usagePct}%`} icon={<Gauge className="h-4 w-4" />} tone={usagePct >= 100 ? 'blue' : 'green'} />
      </div>

      {/* 使用率バー */}
      <Card>
        <CardBody>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>全体稼働 {global.active} / {global.total} 台</span>
            <span>{usagePct}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${usagePct >= 100 ? 'bg-red-500' : usagePct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, usagePct)}%` }} />
          </div>
          {global.available <= 0 && (
            <p className="mt-2 text-xs text-red-600">全体の運用上限に達しています。新規の自動売買受注はできません（予約待ちになります）。</p>
          )}
        </CardBody>
      </Card>

      {/* 受注待ち（予約）— 先着順＋本部の手動並替。次に誰へ割り当てるか判断 */}
      <Card>
        <CardHeader title={`受注待ち（予約）${reservations.length > 0 ? `：${reservations.length}件` : ''}`} />
        <CardBody className="p-0">
          {reservations.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">受注待ちはありません。</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {reservations.map((r, i) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Link href={`/admin/members/${r.memberId}`} className="font-medium text-slate-800 hover:text-brand-600 hover:underline">
                        {r.companyName ?? r.memberName}
                      </Link>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Clock className="h-3 w-3" /> {new Date(r.requestedAt).toLocaleDateString('ja-JP')}</span>
                    </div>
                    {r.note && <div className="text-[11px] text-slate-500">{r.note}</div>}
                  </div>
                  {/* 手動並替 */}
                  <form action={moveReservationAction}>
                    <input type="hidden" name="id" value={r.id} /><input type="hidden" name="direction" value="up" />
                    <button disabled={i === 0} className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30" title="上へ"><ArrowUp className="h-3.5 w-3.5" /></button>
                  </form>
                  <form action={moveReservationAction}>
                    <input type="hidden" name="id" value={r.id} /><input type="hidden" name="direction" value="down" />
                    <button disabled={i === reservations.length - 1} className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30" title="下へ"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </form>
                  {/* 割当（起票へ）・取消 */}
                  <Link href={`/admin/vehicles?member=${r.memberId}`} className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50">この加盟者を起票へ</Link>
                  <form action={assignReservationAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700" title="起票済みとして予約を消化">割当済みにする</button>
                  </form>
                  <form action={cancelReservationAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-md px-2 py-1.5 text-xs text-slate-400 hover:text-red-600">取消</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">
            ※ 全体上限に達すると受注待ちに入ります。割当順は先着ですが、資金の都合などで上下ボタンから手動で順番を入れ替えられます。空き枠が出たら先頭の加盟者を起票してください。
          </p>
        </CardBody>
      </Card>

      {/* 加盟者別の枠・稼働・受注可否 */}
      <Card>
        <CardHeader title="加盟者別の枠・稼働状況" />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">加盟者</th>
                  <th className="px-5 py-3 font-medium">保有枠</th>
                  <th className="px-5 py-3 font-medium">有効枠</th>
                  <th className="px-5 py-3 font-medium">稼働</th>
                  <th className="px-5 py-3 font-medium">空き枠</th>
                  <th className="px-5 py-3 font-medium">預かり金</th>
                  <th className="px-5 py-3 font-medium">受注</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">自動売買の権限を持つ加盟者がいません。</td></tr>
                )}
                {members.map((m) => (
                  <tr key={m.memberId} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-800">{m.companyName ?? m.memberName}</td>
                    <td className="px-5 py-3 text-slate-600">{m.ownedSlots}</td>
                    <td className="px-5 py-3 text-slate-600">{m.effectiveSlots}</td>
                    <td className="px-5 py-3 text-slate-600">{m.activeCount}</td>
                    <td className={`px-5 py-3 font-medium ${m.availableSlots > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{m.availableSlots}</td>
                    <td className="px-5 py-3 text-slate-600">{yen(m.autoBalance)}</td>
                    <td className="px-5 py-3">
                      {m.canAccept ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> 可</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><XCircle className="h-3.5 w-3.5" /> 不可</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/admin/vehicles?member=${m.memberId}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-info-600 hover:underline">
                        車両 <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* 全体設定（本部が調整。200→400等の拡張・最低預かり金） */}
      <Card>
        <CardHeader title="全体設定" />
        <CardBody>
          <form action={updateAutoSettingsAction} className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">同時運用の全体上限（台）</label>
              <input name="auto_capacity_total" type="number" min="1" defaultValue={settings.capacityTotal} className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <p className="mt-1 text-[11px] text-slate-400">インフラ拡張・業務提携で増やせます（例：200→400）。</p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">受注に必要な最低預かり金（円）</label>
              <input name="auto_min_deposit" type="number" min="0" step="100000" defaultValue={settings.minDeposit} className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <p className="mt-1 text-[11px] text-slate-400">これ未満は自動売買の受注をロック（既定100万）。</p>
            </div>
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">保存</button>
          </form>
        </CardBody>
      </Card>

      {/* 月額管理手数料の設定（1枠単価・消費税率） */}
      <Card>
        <CardHeader title="月額管理手数料の設定" />
        <CardBody>
          <form action={updateMgmtFeeSettingsAction} className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">1枠あたり単価（円・税抜）</label>
              <input name="mgmt_fee_per_slot_yen" type="number" min="0" step="10000" defaultValue={feeUnit} className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <p className="mt-1 text-[11px] text-slate-400">月額 =（保有枠数 − 1）× 単価（既定10万）。</p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">消費税率（％）</label>
              <input name="consumption_tax_pct" type="number" min="0" max="100" defaultValue={taxPct} className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <p className="mt-1 text-[11px] text-slate-400">税抜額に加算（法改正時に変更）。</p>
            </div>
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">保存</button>
          </form>
          <p className="mt-3 text-[11px] text-slate-500">
            例）3枠 → 税抜 {yen(2 * feeUnit)} ＋ 消費税{taxPct}% {yen(Math.floor(2 * feeUnit * taxPct / 100))} ＝ <span className="font-medium text-slate-700">税込 {yen(2 * feeUnit + Math.floor(2 * feeUnit * taxPct / 100))}</span> / 月
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
