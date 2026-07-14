import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { AgreementRow, AgreementConsentRow, AgreementAttachmentRow } from '@/types/database'

/** 規約に紐づく別添（各種料金表）の一覧（並び順）。 */
export async function listAttachments(agreementId: string): Promise<AgreementAttachmentRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('agreement_attachments')
    .select('*')
    .eq('agreement_id', agreementId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AgreementAttachmentRow[]
}

/** 別添（料金表）を保存（新規/更新）。 */
export async function saveAttachment(input: { id?: string; agreementId: string; title: string; body: string }): Promise<void> {
  const supabase = createServiceRoleClient()
  if (input.id) {
    const { error } = await supabase.from('agreement_attachments').update({ title: input.title, body: input.body } as never).eq('id', input.id)
    if (error) throw new Error(error.message)
  } else {
    const { data: last } = await supabase.from('agreement_attachments').select('sort_order').eq('agreement_id', input.agreementId).order('sort_order', { ascending: false }).limit(1).maybeSingle<{ sort_order: number }>()
    const sort = (last?.sort_order ?? 0) + 10
    const { error } = await supabase.from('agreement_attachments').insert({ agreement_id: input.agreementId, title: input.title, body: input.body, sort_order: sort } as never)
    if (error) throw new Error(error.message)
  }
}

/** 別添（料金表）を削除。 */
export async function deleteAttachment(id: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('agreement_attachments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** 現在有効な（公開中・最新の）利用規約を取得。 */
export async function getActiveAgreement(): Promise<AgreementRow | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('agreements')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<AgreementRow>()
  if (error) throw new Error(error.message)
  return data ?? null
}

/** すべての規約（本部設定画面用・新しい順）。 */
export async function listAgreements(): Promise<AgreementRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.from('agreements').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AgreementRow[]
}

/**
 * 規約を保存。
 * 証拠保全・再同意の一貫性のため「公開済み規約は不変」とする（⑥-3）:
 *   - 未公開の下書き(id あり) → その行を更新
 *   - 公開済みの規約を編集 → 新バージョンとして新規発行（既存加盟店の再同意対象になる）
 *   - id 無し → 新規発行
 * 公開すると他は自動で非公開化（有効規約は常に1件）。
 */
export async function saveAgreement(input: {
  id?: string
  title: string
  body: string
  published: boolean
  authorId: string
}): Promise<void> {
  const supabase = createServiceRoleClient()

  // 既存行が「公開済み」なら不変扱い → 新バージョンを発行する
  let editableId = input.id
  if (input.id) {
    const { data: existing } = await supabase
      .from('agreements')
      .select('published')
      .eq('id', input.id)
      .maybeSingle<{ published: boolean }>()
    if (existing?.published) editableId = undefined // 公開済みは編集せず新版
  }

  if (editableId) {
    // 未公開の下書きを更新
    const { error } = await supabase
      .from('agreements')
      .update({ title: input.title, body: input.body, published: input.published } as never)
      .eq('id', editableId)
    if (error) throw new Error(error.message)
  } else {
    // version は既存最大+1
    const { data: last } = await supabase.from('agreements').select('version').order('version', { ascending: false }).limit(1).maybeSingle<{ version: number }>()
    const version = (last?.version ?? 0) + 1
    const { error } = await supabase
      .from('agreements')
      .insert({ title: input.title, body: input.body, version, published: input.published, author_id: input.authorId } as never)
    if (error) throw new Error(error.message)
  }

  // 公開したものが1つだけになるように、他を非公開化
  if (input.published) {
    const { data: latest } = await supabase.from('agreements').select('id').eq('published', true).order('created_at', { ascending: false }).limit(1).maybeSingle<{ id: string }>()
    if (latest) {
      await supabase.from('agreements').update({ published: false } as never).eq('published', true).neq('id', latest.id)
    }
  }
}

/** 加盟店の同意履歴（証拠保全ログ・新しい順）。本部の確認用。 */
export async function listConsentLog(memberId: string): Promise<AgreementConsentRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('agreement_consents')
    .select('*')
    .eq('member_id', memberId)
    .order('agreed_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AgreementConsentRow[]
}

/** 規約を削除（本部）。 */
export async function deleteAgreement(id: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('agreements').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** 加盟店が現在有効な規約に同意しているか。 */
export async function hasConsented(userId: string): Promise<{ agreement: AgreementRow | null; consented: boolean }> {
  const supabase = createServiceRoleClient()
  const agreement = await getActiveAgreement()
  if (!agreement) return { agreement: null, consented: false }

  const { data: member } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  if (!member) return { agreement, consented: false }

  const { data } = await supabase
    .from('agreement_consents')
    .select('id')
    .eq('member_id', member.id)
    .eq('agreement_id', agreement.id)
    .maybeSingle<{ id: string }>()
  return { agreement, consented: !!data }
}

/** 加盟店が現在有効な規約に同意する。 */
export async function consentToActive(userId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const agreement = await getActiveAgreement()
  if (!agreement) throw new Error('公開中の利用規約がありません')
  const { data: member } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  if (!member) throw new Error('会員情報が紐付いていません')

  const { error } = await supabase
    .from('agreement_consents')
    .upsert({ member_id: member.id, agreement_id: agreement.id } as never, { onConflict: 'member_id,agreement_id' })
  if (error) throw new Error(error.message)
}
