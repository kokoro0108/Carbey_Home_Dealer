import { MEMBER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/portal/labels'
import type { MemberStatus, PaymentStatus, PlanRow, MemberRow } from '@/types/database'

const field =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none'
const label = 'mb-1 block text-sm font-medium text-slate-700'

/** 会員フォームの入力欄 (要求書 5.2 登録・管理項目)。new(member=null) と edit で共用。 */
export default function MemberFormFields({
  plans,
  member = null,
  showPaymentStatus = false,
}: {
  plans: PlanRow[]
  member?: MemberRow | null
  showPaymentStatus?: boolean
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">基本情報</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>氏名 *</label>
            <input name="member_name" required defaultValue={member?.member_name ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>会社名</label>
            <input name="company_name" defaultValue={member?.company_name ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>メールアドレス</label>
            <input name="email" type="email" defaultValue={member?.email ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>携帯番号</label>
            <input name="phone_mobile" defaultValue={member?.phone_mobile ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>固定電話番号</label>
            <input name="phone_landline" defaultValue={member?.phone_landline ?? ''} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>住所</label>
            <input name="address" defaultValue={member?.address ?? ''} className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">陸送先</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>陸送先名</label>
            <input name="delivery_name" defaultValue={member?.delivery_name ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>陸送先連絡先</label>
            <input name="delivery_contact" defaultValue={member?.delivery_contact ?? ''} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>陸送先住所</label>
            <input name="delivery_address" defaultValue={member?.delivery_address ?? ''} className={field} />
          </div>
        </div>
      </section>

      {/* 出金（引き出し）の振込先。申請時はこの口座が使われる（migration 044） */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">振込先口座（出金用）</h2>
        <p className="mb-4 text-xs text-slate-500">出金申請時にこの口座が使用されます。未登録の場合、加盟店は出金申請できません。</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>金融機関名</label>
            <input name="bank_name" defaultValue={member?.bank_name ?? ''} placeholder="○○銀行" className={field} />
          </div>
          <div>
            <label className={label}>支店名</label>
            <input name="bank_branch" defaultValue={member?.bank_branch ?? ''} placeholder="○○支店" className={field} />
          </div>
          <div>
            <label className={label}>口座種別</label>
            <select name="bank_account_type" defaultValue={member?.bank_account_type ?? ''} className={field}>
              <option value="">選択</option>
              <option value="普通">普通</option>
              <option value="当座">当座</option>
            </select>
          </div>
          <div>
            <label className={label}>口座番号</label>
            <input name="bank_account_number" defaultValue={member?.bank_account_number ?? ''} placeholder="1234567" className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>口座名義（カナ）</label>
            <input name="bank_account_holder" defaultValue={member?.bank_account_holder ?? ''} placeholder="カ）カーベイ" className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">契約情報</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>プラン</label>
            <select name="plan_id" defaultValue={member?.plan_id ?? ''} className={field}>
              <option value="">未設定</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>契約日<span className="ml-1 text-xs font-normal text-slate-400">（稼働中にする場合は必須）</span></label>
            <input name="contract_date" type="date" defaultValue={member?.contract_date ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>契約ステータス</label>
            <select name="status" defaultValue={member?.status ?? 'pending'} className={field}>
              {(Object.keys(MEMBER_STATUS_LABEL) as MemberStatus[]).map((s) => (
                <option key={s} value={s}>
                  {MEMBER_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          {showPaymentStatus && (
            <div>
              <label className={label}>支払ステータス</label>
              <select name="payment_status" defaultValue={member?.payment_status ?? 'unpaid'} className={field}>
                {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* ④ 運用方式の権限：プランのプルダウンとは独立した別設定。
             セミオート／フルオート／両方 の3パターンを割り当てる。 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">運用方式の権限</h2>
        <p className="mb-4 text-xs text-slate-500">
          セミオートとフルオートは運用方式が異なるため、プランとは別に割り当てます。
          両方を割り当てると、加盟店は両方を利用でき、フローの切り替えも可能になります。
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <input type="checkbox" name="grant_semi" defaultChecked={member ? member.grant_semi : true}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400" />
            <span>
              <span className="block text-sm font-medium text-slate-800">セミオート（半自動売買）</span>
              <span className="block text-xs text-slate-500">加盟者が仕入れオーダーを送り、自身で販売する運用</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <input type="checkbox" name="grant_auto" defaultChecked={member ? member.grant_auto : false}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400" />
            <span>
              <span className="block text-sm font-medium text-slate-800">フルオート（自動売買）</span>
              <span className="block text-xs text-slate-500">本部主導で仕入れ〜販売まで運用</span>
            </span>
          </label>
        </div>

        {/* ㉕ オンボーディング未完了でも取引を許可する特例（本部の手動付与） */}
        <label className="mt-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <input type="checkbox" name="trading_override" defaultChecked={member ? member.trading_override : false}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400" />
          <span>
            <span className="block text-sm font-medium text-slate-800">
              オンボーディング未完了でも仕入れオーダーを許可する（特例）
            </span>
            <span className="block text-xs text-slate-600">
              通常はオンボーディングを全て完了すると自動で解放されます。本部の判断で先に取引を開始させたい場合のみ有効にしてください。
            </span>
            <span className="mt-1 block text-xs text-amber-700">
              ※ 古物商許可の猶予を超過している場合は、この特例でも取引は再開されません（許可証の提出・承認が必要です）。
            </span>
          </span>
        </label>

        {/* ⑦ 自動売買の枠：保有枠数・1枠あたり運用資金（本部が加盟者ごとに設定） */}
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>自動売買 保有枠数<span className="ml-1 text-xs font-normal text-slate-400">（最大10）</span></label>
            <input name="auto_slots" type="number" min="0" max="10" defaultValue={member ? member.auto_slots : 0} className={field} />
            <p className="mt-1 text-xs text-slate-500">プラン既定＋購入分＋本部調整。同時に運用できる車両数の上限。</p>
          </div>
          <div>
            <label className={label}>1枠あたり運用資金 (円)</label>
            <input name="capital_per_slot_yen" type="number" min="0" step="100000" defaultValue={member ? member.capital_per_slot_yen : 4000000} className={field} />
            <p className="mt-1 text-xs text-slate-500">既定400万。預かり金でまかなえる枠数の判定に使用（不足分は受注不可）。</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">財務情報</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>加盟金 (円)</label>
            <input name="joining_fee_yen" type="number" min="0" defaultValue={member?.joining_fee_yen ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>月額費用 (円)</label>
            <input name="monthly_fee_yen" type="number" min="0" defaultValue={member?.monthly_fee_yen ?? ''} className={field} />
          </div>
          <div>
            <label className={label}>運転資金 (円)</label>
            <input name="working_capital_yen" type="number" min="0" defaultValue={member?.working_capital_yen ?? ''} className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">管理メモ (内部)</h2>
        <textarea
          name="admin_notes"
          rows={3}
          defaultValue={member?.admin_notes ?? ''}
          placeholder="例: 資金調達支援を希望。AIパッケージに関心あり。"
          className={field}
        />
      </section>
    </div>
  )
}
