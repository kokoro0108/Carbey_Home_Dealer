-- =====================================================================
-- Carbey Portal — 運転資金の出金（引き出し／ウィズドロー）機能
-- =====================================================================
-- クライアント確定ルール（2026-07-21〜22）:
--   ・自動売買／半自動売買のいずれも「オーダー中」「仕入れ中」の案件があると申請不可（ロック）
--   ・申請から入金（出金処理）までは最大14日以内（設定値）
--   ・1年契約の中で出金回数をチケット制で管理（契約日起算の1年）。契約期間・残チケットで制御
--   ・出金手数料 5,000円を差し引く（設定値）
--   ・多重申請の防止：未処理（申請中／承認済）の申請がある間は新規申請不可
--
--   金額の扱い： amount_yen（申請額＝預かり金から減算する額）
--                fee_yen  （出金手数料）
--                net_yen  （実際の振込額＝ amount_yen − fee_yen）
--   ※「申請額を全額振込み、手数料は別途控除」に変える場合は net_yen の算出のみ変更する。
--
--   振込完了時に ledger_entries(kind='withdraw') を作成して預かり金から減算する。
-- 冪等（if not exists / on conflict）。
-- =====================================================================

-- 1) 振込先口座（会員マスタに事前登録し、申請時は選ぶだけ） ---------------
alter table portal.members add column if not exists bank_name           text;
alter table portal.members add column if not exists bank_branch         text;
alter table portal.members add column if not exists bank_account_type   text;  -- 普通/当座
alter table portal.members add column if not exists bank_account_number text;
alter table portal.members add column if not exists bank_account_holder text;

comment on column portal.members.bank_name is '出金の振込先：金融機関名';
comment on column portal.members.bank_account_holder is '出金の振込先：口座名義（カナ）';

-- 2) 出金申請 -----------------------------------------------------------
create table if not exists portal.withdrawal_requests (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references portal.members(id) on delete cascade,
  status        text not null default 'requested'
                  check (status in ('requested', 'approved', 'paid', 'rejected', 'cancelled')),
  amount_yen    bigint not null check (amount_yen > 0),  -- 申請額（預かり金から減算する額）
  fee_yen       bigint not null default 0,               -- 出金手数料
  net_yen       bigint not null,                         -- 実際の振込額（= amount_yen − fee_yen）
  -- 申請時点の振込先スナップショット（後から口座が変わっても記録が残る）
  bank_name           text,
  bank_branch         text,
  bank_account_type   text,
  bank_account_number text,
  bank_account_holder text,
  requested_at  timestamptz not null default now(),
  due_date      date,                                    -- 入金期限（申請日 + 設定日数・既定14日）
  approved_at   timestamptz,
  approved_by   uuid,
  paid_at       timestamptz,
  paid_by       uuid,
  reject_reason text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_withdrawal_member on portal.withdrawal_requests(member_id, created_at desc);
create index if not exists idx_withdrawal_status on portal.withdrawal_requests(status, requested_at);

drop trigger if exists trg_withdrawal_touch on portal.withdrawal_requests;
create trigger trg_withdrawal_touch
  before update on portal.withdrawal_requests
  for each row execute function portal.touch_updated_at();

-- 3) 設定値（本部が調整。チケット枚数は要確定のため暫定値） ---------------
insert into portal.system_settings (key, value_int, note) values
  ('withdrawal_fee_yen',         5000, '出金手数料（申請額から差し引く）'),
  ('withdrawal_due_days',          14, '出金申請から入金までの期限（日数・最大14日）'),
  ('withdrawal_tickets_per_year',  12, '1年契約あたりの出金チケット枚数【要確定・暫定値】'),
  ('withdrawal_min_yen',            0, '最低出金額（0=制限なし）')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- RLS：本部は全件、加盟店は自分の申請を閲覧・作成。確定操作は本部。
-- ---------------------------------------------------------------------
alter table portal.withdrawal_requests enable row level security;

drop policy if exists portal_withdrawal_read on portal.withdrawal_requests;
create policy portal_withdrawal_read on portal.withdrawal_requests
  for select using (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()));

drop policy if exists portal_withdrawal_insert on portal.withdrawal_requests;
create policy portal_withdrawal_insert on portal.withdrawal_requests
  for insert with check (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()));

drop policy if exists portal_withdrawal_update on portal.withdrawal_requests;
create policy portal_withdrawal_update on portal.withdrawal_requests
  for update using (portal.can_crm(auth.uid()) or member_id = portal.current_member_id(auth.uid()))
  with check (portal.can_crm(auth.uid()) or member_id = portal.current_member_id(auth.uid()));

drop policy if exists portal_withdrawal_delete on portal.withdrawal_requests;
create policy portal_withdrawal_delete on portal.withdrawal_requests
  for delete using (portal.can_crm(auth.uid()));

grant select, insert, update, delete on portal.withdrawal_requests to authenticated;
grant all on portal.withdrawal_requests to service_role;
