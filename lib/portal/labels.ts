import type { MemberStatus, UserRole, PaymentStatus, DealStatus, OrderStatus } from '@/types/database'

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  pending: '申込中',
  active: '有効',
  suspended: '停止',
  cancelled: '解約',
}

export const MEMBER_STATUS_STYLE: Record<MemberStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  active: 'bg-green-50 text-green-700',
  suspended: 'bg-orange-50 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

// 要求書 5.1 権限区分
export const ROLE_LABEL: Record<UserRole, string> = {
  admin: '管理者',
  member: '加盟店',
  crm_staff: 'CRM入力担当',
  chat_only: 'チャット専用',
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: '未払い',
  paid: '支払済み',
  overdue: '滞納',
}

export const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  unpaid: 'bg-gray-100 text-gray-600',
  paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700',
}

// オーダー (仕入れ依頼) ステータス
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  received: '受付中',
  in_progress: '対応中',
  completed: '完了',
  cancelled: 'キャンセル',
}

export const ORDER_STATUS_TONE: Record<OrderStatus, 'amber' | 'blue' | 'green' | 'slate'> = {
  received: 'amber',
  in_progress: 'blue',
  completed: 'green',
  cancelled: 'slate',
}

// CRM 商談ステータス (要求書 5.12)
export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  lead: '見込み',
  negotiating: '商談中',
  quoted: '見積提示',
  won: '成約',
  lost: '失注',
}

export const DEAL_STATUS_ORDER: DealStatus[] = ['lead', 'negotiating', 'quoted', 'won', 'lost']

export const DEAL_STATUS_STYLE: Record<DealStatus, string> = {
  lead: 'bg-blue-50 text-blue-700',
  negotiating: 'bg-indigo-50 text-indigo-700',
  quoted: 'bg-purple-50 text-purple-700',
  won: 'bg-green-50 text-green-700',
  lost: 'bg-gray-100 text-gray-500',
}

export function yen(n: number | null | undefined): string {
  if (n == null) return '—'
  return `¥${n.toLocaleString()}`
}
