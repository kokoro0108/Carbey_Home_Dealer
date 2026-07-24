'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireFeature } from '@/lib/auth/session'
import { createMember, updateMember, getMember, findMemberByEmail } from '@/lib/portal/members'
import { notifyAdmin } from '@/lib/portal/notifications'
import { issueMemberCredentials } from '@/lib/portal/invite'
import type { MemberStatus, PaymentStatus } from '@/types/database'

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}
function num(v: FormDataEntryValue | null): number | null {
  const s = str(v)
  return s == null ? null : Number(s)
}

export async function createMemberAction(formData: FormData) {
  await requireFeature('members')
  const member_name = str(formData.get('member_name'))
  if (!member_name) redirect('/admin/members/new?error=name_required')

  // active（稼働開始）にするなら契約日は必須（古物商猶予の起算日になるため）
  const status = (str(formData.get('status')) ?? 'pending') as MemberStatus
  const contract_date = str(formData.get('contract_date'))
  if (status === 'active' && !contract_date) redirect('/admin/members/new?error=contract_date_required')

  // ㉛ active にするなら契約プラン必須（未設定を許さない）
  const plan_id = str(formData.get('plan_id'))
  if (status === 'active' && !plan_id) redirect('/admin/members/new?error=plan_required')

  // ④ 運用方式の権限はプランと独立。active にするなら最低1つ必要（何も使えない状態を防ぐ）
  const grant_semi = formData.get('grant_semi') === 'on'
  const grant_auto = formData.get('grant_auto') === 'on'
  if (status === 'active' && !grant_semi && !grant_auto) redirect('/admin/members/new?error=grant_required')
  // ㉕ オンボーディング未完了でも取引を許可する特例（本部の手動付与）
  const trading_override = formData.get('trading_override') === 'on'

  // メール重複防止（1メール=1会員。ログイン発行時の衝突を未然に防ぐ）
  const email = str(formData.get('email'))
  if (email && (await findMemberByEmail(email))) redirect('/admin/members/new?error=email_duplicate')

  const m = await createMember({
    member_name,
    company_name: str(formData.get('company_name')),
    email,
    phone_mobile: str(formData.get('phone_mobile')),
    phone_landline: str(formData.get('phone_landline')),
    address: str(formData.get('address')),
    delivery_name: str(formData.get('delivery_name')),
    delivery_address: str(formData.get('delivery_address')),
    bank_name: str(formData.get('bank_name')),
    bank_branch: str(formData.get('bank_branch')),
    bank_account_type: str(formData.get('bank_account_type')),
    bank_account_number: str(formData.get('bank_account_number')),
    bank_account_holder: str(formData.get('bank_account_holder')),
    delivery_contact: str(formData.get('delivery_contact')),
    plan_id,
    contract_date,
    status,
    grant_semi,
    grant_auto,
    trading_override,
    auto_slots: Math.min(10, Math.max(0, num(formData.get('auto_slots')) ?? 0)),
    capital_per_slot_yen: num(formData.get('capital_per_slot_yen')) ?? 4000000,
    joining_fee_yen: num(formData.get('joining_fee_yen')),
    monthly_fee_yen: num(formData.get('monthly_fee_yen')),
    working_capital_yen: num(formData.get('working_capital_yen')),
    admin_notes: str(formData.get('admin_notes')),
  })

  await notifyAdmin('member_registered', '新規会員登録', `${member_name} を登録しました`)
  revalidatePath('/admin/members')

  // 登録と同時にログイン発行（⑤⑥）。チェックあり＆メール登録済みのときだけ。
  const issueNow = formData.get('issue_login') === 'on'
  if (issueNow && email) {
    const pwInput = str(formData.get('password'))
    try {
      const { password } = await issueMemberCredentials(m, pwInput ? { password: pwInput } : undefined)
      redirect(`/admin/members/${m.id}?cred=issued&pw=${encodeURIComponent(password)}`)
    } catch (e) {
      if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e
      const msg = e instanceof Error ? e.message : 'unknown'
      redirect(`/admin/members/${m.id}?cred=error&msg=${encodeURIComponent(msg)}`)
    }
  }
  if (issueNow && !email) {
    // 発行したいがメール未登録 → 詳細画面で案内
    redirect(`/admin/members/${m.id}?cred=no_email`)
  }
  redirect(`/admin/members/${m.id}`)
}

export async function updateMemberAction(formData: FormData) {
  await requireFeature('members')
  const id = str(formData.get('id'))
  if (!id) redirect('/admin/members')

  const status = (str(formData.get('status')) ?? undefined) as MemberStatus | undefined
  const contract_date = str(formData.get('contract_date'))
  const plan_id = str(formData.get('plan_id'))
  // active（稼働開始）にするなら契約日・プランは必須。フォーム未入力でも既存に入っていればOK。
  if (status === 'active' && (!contract_date || !plan_id)) {
    const current = await getMember(id)
    if (!contract_date && !current?.contract_date) redirect(`/admin/members/${id}?error=contract_date_required`)
    if (!plan_id && !current?.plan_id) redirect(`/admin/members/${id}?error=plan_required`) // ㉛
  }

  // ④ 運用方式の権限（プランと独立）。active にするなら最低1つ必要。
  const grant_semi = formData.get('grant_semi') === 'on'
  const grant_auto = formData.get('grant_auto') === 'on'
  if (status === 'active' && !grant_semi && !grant_auto) redirect(`/admin/members/${id}?error=grant_required`)
  // ㉕ オンボーディング未完了でも取引を許可する特例（本部の手動付与）
  const trading_override = formData.get('trading_override') === 'on'

  // メール重複防止（自分自身は除外）。他会員が同じメールを使っていれば拒否。
  const email = str(formData.get('email'))
  if (email && (await findMemberByEmail(email, id))) redirect(`/admin/members/${id}?error=email_duplicate`)

  await updateMember(id, {
    member_name: str(formData.get('member_name')) ?? undefined,
    company_name: str(formData.get('company_name')),
    email,
    phone_mobile: str(formData.get('phone_mobile')),
    phone_landline: str(formData.get('phone_landline')),
    address: str(formData.get('address')),
    delivery_name: str(formData.get('delivery_name')),
    delivery_address: str(formData.get('delivery_address')),
    bank_name: str(formData.get('bank_name')),
    bank_branch: str(formData.get('bank_branch')),
    bank_account_type: str(formData.get('bank_account_type')),
    bank_account_number: str(formData.get('bank_account_number')),
    bank_account_holder: str(formData.get('bank_account_holder')),
    delivery_contact: str(formData.get('delivery_contact')),
    plan_id,
    contract_date,
    status,
    grant_semi,
    grant_auto,
    trading_override,
    auto_slots: Math.min(10, Math.max(0, num(formData.get('auto_slots')) ?? 0)),
    capital_per_slot_yen: num(formData.get('capital_per_slot_yen')) ?? 4000000,
    payment_status: (str(formData.get('payment_status')) ?? undefined) as PaymentStatus | undefined,
    joining_fee_yen: num(formData.get('joining_fee_yen')),
    monthly_fee_yen: num(formData.get('monthly_fee_yen')),
    working_capital_yen: num(formData.get('working_capital_yen')),
    admin_notes: str(formData.get('admin_notes')),
  })

  revalidatePath(`/admin/members/${id}`)
  redirect(`/admin/members/${id}`)
}

/**
 * 本部が加盟店のログイン認証情報を発行する（発行型フロー）。
 * パスワード未入力なら自動生成。発行後、パスワードを画面に1回だけ表示する。
 */
export async function issueCredentialsAction(formData: FormData) {
  await requireFeature('members')
  const id = str(formData.get('id'))
  if (!id) redirect('/admin/members')

  const member = await getMember(id)
  if (!member) redirect('/admin/members')
  if (!member.email) redirect(`/admin/members/${id}?cred=no_email`)

  const pwInput = str(formData.get('password'))
  try {
    const { password } = await issueMemberCredentials(member, pwInput ? { password: pwInput } : undefined)
    await notifyAdmin('member_registered', 'ログイン発行', `${member.member_name} のログイン情報を発行しました`)
    revalidatePath(`/admin/members/${id}`)
    // パスワードは1回だけ画面表示（URLで受け渡し）
    redirect(`/admin/members/${id}?cred=issued&pw=${encodeURIComponent(password)}`)
  } catch (e) {
    if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e
    const msg = e instanceof Error ? e.message : 'unknown'
    redirect(`/admin/members/${id}?cred=error&msg=${encodeURIComponent(msg)}`)
  }
}
