import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getLedgerBalance } from '@/lib/portal/ledger'

/**
 * フェーズ7：預かり金の予算振り分け（自動売買用／半自動用）。
 *
 * 判定モデル（既定はフロー全体プール）:
 *   - 片方フローのみの加盟者 … 全額そのフローに割当（振り分け不可）。
 *   - 両フロー保有者で未設定 … 各フローとも預かり残高の全額で判定（従来どおり・オプトイン）。
 *   - 両フロー保有者で設定済み … auto_allocated を上限（現残高でクランプ）に自動売買、残りを半自動へ。
 *     （預かり金は単一プールのため、割当は「受注可否の判定しきい値」であり実際の分離口座ではない）
 */
export type FlowBudgets = {
  balance: number
  grantAuto: boolean
  grantSemi: boolean
  isDual: boolean
  hasAllocation: boolean
  autoBudget: number
  semiBudget: number
  autoAllocated: number // 保存値（設定時点のスナップショット）
  semiAllocated: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** 加盟者の各フロー予算を算出する。 */
export async function getFlowBudgets(memberId: string): Promise<FlowBudgets> {
  const supabase = createServiceRoleClient()
  const [{ data: member }, balance, { data: alloc }] = await Promise.all([
    supabase.from('members').select('grant_auto, grant_semi').eq('id', memberId).maybeSingle<{ grant_auto: boolean; grant_semi: boolean }>(),
    getLedgerBalance(memberId),
    supabase.from('member_budget_alloc').select('auto_allocated_yen, semi_allocated_yen').eq('member_id', memberId).maybeSingle<{ auto_allocated_yen: number; semi_allocated_yen: number }>(),
  ])
  const grantAuto = member?.grant_auto ?? false
  const grantSemi = member?.grant_semi ?? false
  const isDual = grantAuto && grantSemi

  // 片方フローのみ：全額そのフロー
  if (!isDual) {
    return {
      balance, grantAuto, grantSemi, isDual: false, hasAllocation: false,
      autoBudget: grantAuto ? balance : 0,
      semiBudget: grantSemi ? balance : 0,
      autoAllocated: grantAuto ? balance : 0,
      semiAllocated: grantSemi ? balance : 0,
    }
  }

  // 両フロー・未設定：各フロー全額（従来どおり）
  if (!alloc) {
    return {
      balance, grantAuto, grantSemi, isDual: true, hasAllocation: false,
      autoBudget: balance, semiBudget: balance, autoAllocated: 0, semiAllocated: 0,
    }
  }

  // 両フロー・設定済み：auto をクランプ、残りを semi（合計＝現残高）
  const autoBudget = clamp(alloc.auto_allocated_yen, 0, balance)
  const semiBudget = balance - autoBudget
  return {
    balance, grantAuto, grantSemi, isDual: true, hasAllocation: true,
    autoBudget, semiBudget,
    autoAllocated: alloc.auto_allocated_yen,
    semiAllocated: alloc.semi_allocated_yen,
  }
}

/** ユーザーIDから自分のフロー予算を取得。会員未紐付けは null。 */
export async function getOwnFlowBudgets(userId: string): Promise<FlowBudgets | null> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle<{ id: string }>()
  if (!member) return null
  return getFlowBudgets(member.id)
}

/**
 * 加盟者が自動売買用の割当額を設定する（残りは自動的に半自動用）。
 * 両フロー保有者のみ。0 〜 現在の預かり残高 の範囲。
 */
export async function setAutoAllocation(memberId: string, autoAllocatedYen: number): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data: member } = await supabase.from('members').select('grant_auto, grant_semi').eq('id', memberId).maybeSingle<{ grant_auto: boolean; grant_semi: boolean }>()
  if (!member?.grant_auto || !member?.grant_semi) {
    throw new Error('予算の振り分けは、自動売買・半自動の両方の権限を持つ加盟者のみ設定できます。')
  }
  const balance = await getLedgerBalance(memberId)
  const auto = Math.round(autoAllocatedYen)
  if (auto < 0 || auto > balance) {
    throw new Error(`自動売買用の割当は 0 〜 ${balance.toLocaleString()}円（現在の預かり残高）の範囲で入力してください。`)
  }
  const semi = balance - auto
  const { error } = await supabase
    .from('member_budget_alloc')
    .upsert({ member_id: memberId, auto_allocated_yen: auto, semi_allocated_yen: semi } as never, { onConflict: 'member_id' })
  if (error) throw new Error(error.message)
}
