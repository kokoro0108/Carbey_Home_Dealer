-- =====================================================================
-- Carbey Portal — 自動売買 枠・キャパ・受注管理 フェーズ1：データモデル基盤
-- =====================================================================
-- 確定業務ルール（クライアント 2026-07-21・docs/auto-trading-slots-design.md）:
--   枠の初期値＝プラン既定：エコノミー1枠／ブロンズ・プラチナ・ゴールド2枠／半自動0。
--   1枠=販売10万円、1加盟者 最大10枠、追加枠は手動。
--   運用資金：預かり金<100万で受注ロック。1枠=運用資金400万（本部が加盟者ごと設定可）。
--   200台上限は自動売買のみ（設定値で400等に拡張可）。
--   月額管理手数料は上位プランでプラン設定に金額を持つ（将来変更前提）。
-- 冪等（if not exists / on conflict）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) plans：プランごとの初期枠数・月額管理手数料
-- ---------------------------------------------------------------------
alter table portal.plans add column if not exists default_auto_slots   int not null default 0;   -- 初期枠数
alter table portal.plans add column if not exists mgmt_fee_monthly_yen  int not null default 0;   -- 月額管理手数料（自動売買）

comment on column portal.plans.default_auto_slots is '自動売買の初期枠数（加盟時に付与）。economy=1, bronze/platinum/gold=2, 半自動=0';
comment on column portal.plans.mgmt_fee_monthly_yen is '自動売買の月額管理手数料。上位プランで設定（将来変更前提・本部が調整）';

-- プラン既定枠を反映（金額は本部が後から設定）
update portal.plans set default_auto_slots = 1 where code = 'economy';
update portal.plans set default_auto_slots = 2 where code in ('bronze', 'platinum', 'gold');
update portal.plans set default_auto_slots = 0 where code = 'home_dealer';

-- ---------------------------------------------------------------------
-- 2) members：保有枠数・1枠あたり必要運用資金
-- ---------------------------------------------------------------------
alter table portal.members add column if not exists auto_slots           int not null default 0;         -- 保有枠数（最大10）
alter table portal.members add column if not exists capital_per_slot_yen int not null default 4000000;   -- 1枠あたり必要運用資金

comment on column portal.members.auto_slots is '自動売買の保有枠数（プラン既定＋購入＋本部調整）。最大10。本部都合の操作は加盟者に非可視化';
comment on column portal.members.capital_per_slot_yen is '1枠あたり必要運用資金（既定400万・本部が加盟者ごとに設定可）';

-- 既存加盟者へプラン既定枠を反映（自動売買権限の有無に関わらずプラン既定を入れておく）
update portal.members m
   set auto_slots = coalesce(p.default_auto_slots, 0)
  from portal.plans p
 where m.plan_id = p.id
   and m.auto_slots = 0;

-- ---------------------------------------------------------------------
-- 3) system_settings：全体設定（本部が調整。キャパ拡張・受注ロック閾値）
-- ---------------------------------------------------------------------
create table if not exists portal.system_settings (
  key         text primary key,
  value_int   int,
  note        text,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_system_settings_touch on portal.system_settings;
create trigger trg_system_settings_touch
  before update on portal.system_settings
  for each row execute function portal.touch_updated_at();

insert into portal.system_settings (key, value_int, note) values
  ('auto_capacity_total', 200, '自動売買の同時運用車両の全体上限（インフラ上限。400等に拡張可）'),
  ('auto_min_deposit',    1000000, '自動売買の受注に必要な最低預かり金。これ未満は受注ロック')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- RLS：system_settings は閲覧＝ログインユーザー全員（加盟店のキャパ表示用）、編集＝本部
-- ---------------------------------------------------------------------
alter table portal.system_settings enable row level security;

drop policy if exists portal_system_settings_read on portal.system_settings;
create policy portal_system_settings_read on portal.system_settings
  for select using (auth.uid() is not null);

drop policy if exists portal_system_settings_write on portal.system_settings;
create policy portal_system_settings_write on portal.system_settings
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

grant select on portal.system_settings to authenticated;
grant insert, update, delete on portal.system_settings to authenticated;
grant all on portal.system_settings to service_role;
