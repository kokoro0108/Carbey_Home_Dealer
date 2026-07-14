'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth/session'
import { createOwnOrder } from '@/lib/portal/orders'

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}
function num(v: FormDataEntryValue | null): number | null {
  const s = str(v)
  return s == null ? null : Number(s)
}

/** 加盟店が自分の仕入れオーダーを作成する。 */
export async function createOrderAction(formData: FormData) {
  const session = await requireMember()
  const car_model = str(formData.get('car_model'))
  if (!car_model) redirect('/portal/orders?error=model_required')

  try {
    await createOwnOrder(session.userId, {
      maker: str(formData.get('maker')),
      car_model: car_model!,
      year: str(formData.get('year')),
      budget_yen: num(formData.get('budget_yen')),
      preferred_color: str(formData.get('preferred_color')),
      mileage_max: num(formData.get('mileage_max')),
      notes: str(formData.get('notes')),
    })
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes('NEXT_REDIRECT')) throw e
      // ㉚ オンボーディング未完了
      if (e.message.includes('オンボーディング')) redirect('/portal/orders?error=onboarding_incomplete')
      // ㉙ 自動売買フローでは手動オーダー不可
      if (e.message.includes('自動売買')) redirect('/portal/orders?error=auto_flow')
      // フェーズ2 発注金額の入力漏れ・残高超過
      if (e.message.includes('予算（発注金額）を入力')) redirect('/portal/orders?error=budget_required')
      if (e.message.includes('預かり残高')) redirect('/portal/orders?error=over_balance')
      // 古物商猶予の超過などで取引がロックされている場合
      if (e.message.includes('古物商')) redirect('/portal/orders?error=trading_locked')
    }
    throw e
  }

  revalidatePath('/portal/orders')
  redirect('/portal/orders?created=1')
}
