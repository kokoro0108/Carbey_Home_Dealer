/**
 * Carbey Portal の DB 型 (portal スキーマ, 要求事項定義書 v1.2 準拠)。
 * supabase gen types を導入したら差し替える。
 */

// 要求書 5.1: 管理者 / 加盟店 / CRM入力担当 / チャット専用
export type UserRole = 'admin' | 'member' | 'crm_staff' | 'chat_only'
export type UserStatus = 'active' | 'suspended'
export type MemberStatus = 'pending' | 'active' | 'suspended' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'overdue'
export type PlanType = 'semi_auto' | 'full_auto'
export type DealStatus = 'lead' | 'negotiating' | 'quoted' | 'won' | 'lost'
/** 加盟店が実行するフロー種別（レビュー⑳）。semi=半自動売買 / auto=自動売買 */
export type FlowType = 'semi' | 'auto'

export type PlanRow = {
  id: string
  code: string
  name: string
  plan_type: PlanType
  /** 半自動売買モデルを保有するか（レビュー⑳） */
  has_semi: boolean
  /** 自動売買モデルを保有するか（レビュー⑳） */
  has_auto: boolean
  monthly_fee_yen: number
  /** 自動売買の初期枠数（⑦・migration 036）。economy=1, 上位=2, 半自動=0 */
  default_auto_slots: number
  /** 自動売買の月額管理手数料（⑦・migration 036）。上位プランで設定 */
  mgmt_fee_monthly_yen: number
  joining_fee_yen: number
  display_order: number
  description: string | null
  features: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}
export type PlanInsert = {
  code: string
  name: string
  plan_type: PlanType
  has_semi?: boolean
  has_auto?: boolean
  monthly_fee_yen?: number
  default_auto_slots?: number
  mgmt_fee_monthly_yen?: number
  joining_fee_yen?: number
  display_order?: number
  description?: string | null
  features?: string[]
  is_active?: boolean
}

export type PortalUserRow = {
  id: string
  name: string | null
  email: string | null
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
}

export type MemberRow = {
  id: string
  user_id: string | null
  company_name: string | null
  member_name: string
  phone_mobile: string | null
  phone_landline: string | null
  email: string | null
  address: string | null
  delivery_name: string | null
  delivery_address: string | null
  delivery_contact: string | null
  plan_id: string | null
  contract_date: string | null
  status: MemberStatus
  /** 実行中フロー（semi/auto）。null=保有権限から既定導出（レビュー⑳） */
  active_flow: FlowType | null
  /** セミオート（半自動売買）の利用権限。プランとは独立して本部が割当（レビュー④） */
  grant_semi: boolean
  /** フルオート（自動売買）の利用権限。プランとは独立して本部が割当（レビュー④） */
  grant_auto: boolean
  /** オンボーディング未完了でも取引を許可する特例（本部の手動付与・レビュー㉕） */
  trading_override: boolean
  /** 自動売買の保有枠数（⑦・migration 036）。最大10 */
  auto_slots: number
  /** 1枠あたり必要運用資金（⑦・migration 036）。既定400万・本部が加盟者ごと設定可 */
  capital_per_slot_yen: number
  /** 月額管理手数料の起算日＝枠取得日（migration 043）。NULL=初回課金時に当日で起算 */
  mgmt_fee_anchor: string | null
  /** 月額管理手数料の課金済み満了月数（migration 043・二重課金防止） */
  mgmt_fee_billed_months: number
  // 出金の振込先（migration 044）
  bank_name: string | null
  bank_branch: string | null
  bank_account_type: string | null
  bank_account_number: string | null
  bank_account_holder: string | null
  joining_fee_yen: number | null
  monthly_fee_yen: number | null
  working_capital_yen: number | null
  payment_status: PaymentStatus
  registration_date: string
  last_login_at: string | null
  onboarding_total: number
  onboarding_done: number
  admin_notes: string | null
  created_at: string
  updated_at: string
}
export type MemberInsert = {
  user_id?: string | null
  company_name?: string | null
  member_name: string
  phone_mobile?: string | null
  phone_landline?: string | null
  email?: string | null
  address?: string | null
  delivery_name?: string | null
  delivery_address?: string | null
  delivery_contact?: string | null
  plan_id?: string | null
  contract_date?: string | null
  status?: MemberStatus
  active_flow?: FlowType | null
  grant_semi?: boolean
  grant_auto?: boolean
  trading_override?: boolean
  auto_slots?: number
  capital_per_slot_yen?: number
  mgmt_fee_anchor?: string | null
  mgmt_fee_billed_months?: number
  bank_name?: string | null
  bank_branch?: string | null
  bank_account_type?: string | null
  bank_account_number?: string | null
  bank_account_holder?: string | null
  joining_fee_yen?: number | null
  monthly_fee_yen?: number | null
  working_capital_yen?: number | null
  payment_status?: PaymentStatus
  registration_date?: string
  admin_notes?: string | null
}

export type PaymentRow = {
  id: string
  member_id: string
  amount_yen: number
  payment_date: string
  kind: 'joining' | 'monthly' | 'other'
  status: 'pending' | 'confirmed' | 'failed'
  note: string | null
  invoice_id: string | null // 消込：紐づく請求（028）
  created_at: string
}

// 請求・入金消込（要件 5.2 / PAY-01〜04・migration 028）
export type InvoiceKind =
  | 'joining' | 'system_fee' | 'monthly' | 'royalty'
  | 'management_fee' | 'slot_fee' | 'sourcing_fund' | 'other'
export type InvoiceStatus = 'unbilled' | 'billed' | 'partial' | 'paid' | 'overdue' | 'cancelled'
export type InvoiceRow = {
  id: string
  member_id: string
  kind: InvoiceKind
  title: string | null
  amount_yen: number
  paid_yen: number
  due_date: string | null
  status: InvoiceStatus
  billed_at: string | null
  note: string | null
  /** 枠購入の枠数（kind=slot_fee・⑦フェーズ5・migration 039） */
  slot_count: number | null
  /** 枠加算済みフラグ（二重加算防止・migration 039） */
  slots_applied: boolean
  created_at: string
  updated_at: string
}

// CRM (要求書 5.12): エンドユーザー(購入者)・購入履歴・商談
export type CrmCustomerRow = {
  id: string
  member_id: string | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  note: string | null
  created_at: string
  updated_at: string
}
export type CrmCustomerInsert = {
  member_id?: string | null
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  note?: string | null
}

export type CrmPurchaseRow = {
  id: string
  customer_id: string
  vehicle_name: string | null
  price_yen: number | null
  purchased_at: string | null
  note: string | null
  created_at: string
}

export type CrmDealRow = {
  id: string
  customer_id: string
  title: string | null
  status: DealStatus
  amount_yen: number | null
  assigned_to: string | null
  created_at: string
  updated_at: string
}
export type CrmDealInsert = {
  customer_id: string
  title?: string | null
  status?: DealStatus
  amount_yen?: number | null
}

export type CrmDealNoteRow = {
  id: string
  deal_id: string
  author_id: string | null
  body: string
  created_at: string
}

export type NotificationRow = {
  id: string
  user_id: string | null
  audience: 'user' | 'admin'
  kind: string
  title: string
  message: string | null
  is_read: boolean
  created_at: string
}

export type AnnouncementRow = {
  id: string
  title: string
  body: string
  level: 'info' | 'important'
  published: boolean
  author_id: string | null
  created_at: string
  updated_at: string
}

export type ChatConversationRow = {
  id: string
  member_id: string
  last_message_at: string | null
  created_at: string
}

export type ChatMessageRow = {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_role: UserRole
  sender_name: string | null
  body: string | null
  attachment_path: string | null
  attachment_name: string | null
  attachment_type: string | null
  attachment_size: number | null
  read_at: string | null
  edited_at: string | null
  deleted_at: string | null
  created_at: string
}

export type FundingMethod = 'self' | 'loan'

export type FundingRow = {
  id: string
  member_id: string
  method: FundingMethod | null
  self_amount_yen: number | null
  self_confirmed: boolean
  step_status: Record<string, 'todo' | 'done'>
  status: 'in_progress' | 'completed'
  created_at: string
  updated_at: string
}

export type AgreementRow = {
  id: string
  title: string
  body: string
  version: number
  published: boolean
  author_id: string | null
  created_at: string
  updated_at: string
}

export type AgreementConsentRow = {
  id: string
  member_id: string
  agreement_id: string | null
  agreed_at: string
  /** 同意時点のスナップショット（証拠保全） */
  agreement_version: number | null
  agreement_title: string | null
  user_id: string | null
}

/** 規約に付随する別添（各種料金表など）。 */
export type AgreementAttachmentRow = {
  id: string
  agreement_id: string
  title: string
  body: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type ManualSectionRow = {
  id: string
  title: string
  body: string | null
  note: string | null
  /** このマニュアル項目が属するフロー種別（レビュー⑰）。semi=半自動 / auto=自動 / both=共通 */
  flow: 'semi' | 'auto' | 'both'
  /** マニュアル動画URL（YouTube/Vimeo等・埋め込み再生／㉜） */
  video_url: string | null
  /** マニュアル添付ファイルの Storage パス（manual-media バケット／㉜） */
  attachment_path: string | null
  attachment_name: string | null
  sort_order: number
  published: boolean
  created_at: string
  updated_at: string
}

export type ManualProgressRow = {
  id: string
  member_id: string
  section_id: string
  checked_at: string
}

export type SupportItemRow = {
  id: string
  title: string
  body: string | null
  note: string | null
  sort_order: number
  published: boolean
  created_at: string
  updated_at: string
}

export type EvidenceKind = 'identity' | 'antique_license' | 'other'
export type EvidenceDocType = 'license' | 'mynumber' | 'passport' | 'antique' | 'other'
export type EvidenceStatus = 'pending' | 'approved' | 'rejected'

export type EvidenceRow = {
  id: string
  member_id: string
  kind: EvidenceKind
  doc_type: EvidenceDocType | null
  storage_path: string
  file_name: string
  file_type: string | null
  file_size: number | null
  status: EvidenceStatus
  reviewed_by: string | null
  reviewed_at: string | null
  note: string | null
  created_at: string
}

// 半自動売買フェーズ1: 預かり金台帳（仕入れ資金）
export type LedgerEntryKind = 'deposit' | 'withdraw' | 'settlement' | 'adjust' | 'mgmt_fee'

export type MemberLedgerRow = {
  id: string
  member_id: string
  balance_yen: number
  created_at: string
  updated_at: string
}

export type LedgerEntryRow = {
  id: string
  member_id: string
  kind: LedgerEntryKind
  amount_yen: number // 符号付き（+入金 / -出金）
  note: string | null
  deal_id: string | null
  created_by: string | null
  created_at: string
}

// 半自動売買フェーズ3: 車両案件ライフサイクル
export type DealStatusStage = 'ordered' | 'sourcing' | 'prepping' | 'listing' | 'delivered' | 'sold'

export type VehicleDealRow = {
  id: string
  member_id: string
  order_id: string | null
  /** フロー種別（⑦・migration 037）。semi=半自動 / auto=自動売買（200台キャパ・枠の対象） */
  flow: 'semi' | 'auto'
  status: DealStatusStage
  maker: string | null
  car_model: string | null
  year: string | null
  order_amount_yen: number | null
  ordered_at: string
  sourcing_at: string | null
  prepping_at: string | null
  delivered_at: string | null
  note: string | null
  // フェーズ6 精算
  to_pref: string | null
  settled: boolean
  settled_amount_yen: number | null
  remaining_yen: number | null
  // Phase 3 販売実績（migration 035）
  listed_at: string | null
  sale_price_yen: number | null
  sold_at: string | null
  sold_by: string | null
  cost_total_yen: number | null
  gross_profit_yen: number | null // 自動算出（販売価格−費用合計）
  // フェーズ6 月額管理手数料（自動売買・migration 040）
  mgmt_fee_yen: number | null // 清算時に預かり金から差し引いた管理手数料。NULL=未課金
  mgmt_fee_months: number | null // 算出に用いた満了月数
  // 仕入れエビデンス（販売中に本部が添付・migration 042）
  sourcing_evidence_path: string | null
  sourcing_evidence_name: string | null
  sourcing_evidence_at: string | null
  // 結果報告書 + 商品化チェックリスト（Phase3 仕上げ・migration 046）
  result_report_path: string | null
  result_report_name: string | null
  result_report_at: string | null
  prep_inspected: boolean
  prep_cleaned: boolean
  prep_photographed: boolean
  prep_listed_ready: boolean
  created_at: string
  updated_at: string
}

// 半自動売買フェーズ4: 案件の費用内訳（動的費目）
export type DealCostKind = 'sourcing' | 'prepping' | 'shipping' | 'other'

export type DealCostRow = {
  id: string
  deal_id: string
  member_id: string
  kind: DealCostKind
  label: string
  amount_yen: number
  sort_order: number
  note: string | null
  attachment_path: string | null
  attachment_name: string | null
  created_at: string
  updated_at: string
}

// 半自動売買フェーズ5: 陸送費マスタ＋特殊車
export type ShippingRateRow = {
  id: string
  from_pref: string
  to_pref: string
  amount_yen: number
  created_at: string
  updated_at: string
}

export type SpecialVehicleMakerRow = {
  id: string
  maker: string
  note: string | null
  created_at: string
}

export type OrderStatus = 'received' | 'in_progress' | 'completed' | 'cancelled'

export type OrderRow = {
  id: string
  order_number: string | null
  member_id: string
  maker: string | null
  car_model: string
  year: string | null
  budget_yen: number | null
  preferred_color: string | null
  mileage_max: number | null
  notes: string | null
  status: OrderStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export type OnboardingTaskStatus = 'todo' | 'in_progress' | 'done'

export type OnboardingTaskRow = {
  id: string
  member_id: string
  step_key: string
  step_label: string
  title: string
  status: OnboardingTaskStatus
  completion_type: 'auto' | 'manual'
  /** 実体機能への接続キー（identity/antique_license/funding/terms/manual）。null=手動/自動ボタン */
  link_key: string | null
  /** ゲート対象外（古物商など・未提出でも先へ進める） */
  optional: boolean
  /** 本部が自動判定を上書きした（sync の対象外／テスト・例外運用・レビュー⑪） */
  admin_override: boolean
  sort_order: number
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// 全体設定（⑦・migration 036）
export type SystemSettingRow = {
  key: string
  value_int: number | null
  note: string | null
  updated_at: string
}

// 自動売買の受注待ち（予約・⑦・migration 038）
export type AutoReservationStatus = 'waiting' | 'assigned' | 'cancelled'
export type AutoReservationRow = {
  id: string
  member_id: string
  status: AutoReservationStatus
  sort_order: number
  requested_at: string
  assigned_at: string | null
  note: string | null
  created_at: string
  updated_at: string
}

/** フェーズ7：両フロー保有者の預かり金振り分け（自動売買用／半自動用）。migration 041。 */
export type MemberBudgetAllocRow = {
  member_id: string
  auto_allocated_yen: number
  semi_allocated_yen: number
  created_at: string
  updated_at: string
}

/** 出金申請のステータス（migration 044）。 */
export type WithdrawalStatus = 'requested' | 'approved' | 'paid' | 'rejected' | 'cancelled'

/** 運転資金の出金申請（migration 044）。 */
export type WithdrawalRequestRow = {
  id: string
  member_id: string
  status: WithdrawalStatus
  amount_yen: number // 申請額（預かり金から減算する額）
  fee_yen: number    // 出金手数料
  net_yen: number    // 実際の振込額（= amount_yen − fee_yen）
  bank_name: string | null
  bank_branch: string | null
  bank_account_type: string | null
  bank_account_number: string | null
  bank_account_holder: string | null
  requested_at: string
  due_date: string | null
  approved_at: string | null
  approved_by: string | null
  paid_at: string | null
  paid_by: string | null
  reject_reason: string | null
  note: string | null
  created_at: string
  updated_at: string
}

/** 月額管理手数料の月次課金 実行履歴（migration 043）。 */
export type MemberMgmtFeeRunRow = {
  id: string
  member_id: string
  months: number
  slots: number
  unit_yen: number
  gross_yen: number // 税抜
  tax_yen: number // 消費税額
  tax_rate_pct: number // 適用税率（％）
  from_deposit_yen: number
  invoiced_yen: number
  invoice_id: string | null
  ran_by: string | null
  note: string | null
  created_at: string
}

export type Database = {
  portal: {
    Tables: {
      plans: { Row: PlanRow; Insert: PlanInsert; Update: Partial<PlanInsert> }
      system_settings: { Row: SystemSettingRow; Insert: Partial<SystemSettingRow>; Update: Partial<SystemSettingRow> }
      auto_reservations: { Row: AutoReservationRow; Insert: Partial<AutoReservationRow>; Update: Partial<AutoReservationRow> }
      member_budget_alloc: { Row: MemberBudgetAllocRow; Insert: Partial<MemberBudgetAllocRow>; Update: Partial<MemberBudgetAllocRow> }
      member_mgmt_fee_runs: { Row: MemberMgmtFeeRunRow; Insert: Partial<MemberMgmtFeeRunRow>; Update: Partial<MemberMgmtFeeRunRow> }
      withdrawal_requests: { Row: WithdrawalRequestRow; Insert: Partial<WithdrawalRequestRow>; Update: Partial<WithdrawalRequestRow> }
      users: { Row: PortalUserRow; Insert: Partial<PortalUserRow>; Update: Partial<PortalUserRow> }
      members: { Row: MemberRow; Insert: MemberInsert; Update: Partial<MemberInsert> }
      payments: { Row: PaymentRow; Insert: Partial<PaymentRow>; Update: Partial<PaymentRow> }
      invoices: { Row: InvoiceRow; Insert: Partial<InvoiceRow>; Update: Partial<InvoiceRow> }
      crm_customers: { Row: CrmCustomerRow; Insert: CrmCustomerInsert; Update: Partial<CrmCustomerInsert> }
      crm_purchases: { Row: CrmPurchaseRow; Insert: Partial<CrmPurchaseRow>; Update: Partial<CrmPurchaseRow> }
      crm_deals: { Row: CrmDealRow; Insert: CrmDealInsert; Update: Partial<CrmDealInsert> }
      crm_deal_notes: { Row: CrmDealNoteRow; Insert: Partial<CrmDealNoteRow>; Update: Partial<CrmDealNoteRow> }
      notifications: { Row: NotificationRow; Insert: Partial<NotificationRow>; Update: Partial<NotificationRow> }
      onboarding_tasks: { Row: OnboardingTaskRow; Insert: Partial<OnboardingTaskRow>; Update: Partial<OnboardingTaskRow> }
      orders: { Row: OrderRow; Insert: Partial<OrderRow>; Update: Partial<OrderRow> }
      evidences: { Row: EvidenceRow; Insert: Partial<EvidenceRow>; Update: Partial<EvidenceRow> }
      agreements: { Row: AgreementRow; Insert: Partial<AgreementRow>; Update: Partial<AgreementRow> }
      agreement_attachments: { Row: AgreementAttachmentRow; Insert: Partial<AgreementAttachmentRow>; Update: Partial<AgreementAttachmentRow> }
      agreement_consents: { Row: AgreementConsentRow; Insert: Partial<AgreementConsentRow>; Update: Partial<AgreementConsentRow> }
      manual_sections: { Row: ManualSectionRow; Insert: Partial<ManualSectionRow>; Update: Partial<ManualSectionRow> }
      manual_progress: { Row: ManualProgressRow; Insert: Partial<ManualProgressRow>; Update: Partial<ManualProgressRow> }
      support_items: { Row: SupportItemRow; Insert: Partial<SupportItemRow>; Update: Partial<SupportItemRow> }
      funding_applications: { Row: FundingRow; Insert: Partial<FundingRow>; Update: Partial<FundingRow> }
      member_ledger: { Row: MemberLedgerRow; Insert: Partial<MemberLedgerRow>; Update: Partial<MemberLedgerRow> }
      ledger_entries: { Row: LedgerEntryRow; Insert: Partial<LedgerEntryRow>; Update: Partial<LedgerEntryRow> }
      vehicle_deals: { Row: VehicleDealRow; Insert: Partial<VehicleDealRow>; Update: Partial<VehicleDealRow> }
      deal_costs: { Row: DealCostRow; Insert: Partial<DealCostRow>; Update: Partial<DealCostRow> }
      shipping_rates: { Row: ShippingRateRow; Insert: Partial<ShippingRateRow>; Update: Partial<ShippingRateRow> }
      special_vehicle_makers: { Row: SpecialVehicleMakerRow; Insert: Partial<SpecialVehicleMakerRow>; Update: Partial<SpecialVehicleMakerRow> }
      chat_conversations: { Row: ChatConversationRow; Insert: Partial<ChatConversationRow>; Update: Partial<ChatConversationRow> }
      chat_messages: { Row: ChatMessageRow; Insert: Partial<ChatMessageRow>; Update: Partial<ChatMessageRow> }
      announcements: { Row: AnnouncementRow; Insert: Partial<AnnouncementRow>; Update: Partial<AnnouncementRow> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
}
