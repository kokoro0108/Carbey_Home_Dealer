-- =====================================================================
-- Carbey Portal — 月額管理手数料モデル改定（2026-07-21 クライアント確定）
-- =====================================================================
-- 旧: 案件清算(sold)時に「経過月数 × プラン固定額」を差し引き（Phase6）→ 撤去。
-- 新: 枠数連動の【毎月課金】。本部が月次で相殺を実行（cronなし）。
--     月額 =（auto_slots − 1）× 単価（system_settings.mgmt_fee_per_slot_yen = 10万）。
--       エコノミー(1枠)=0。上位=2枠デフォルト(=10万)〜10枠(=90万)。
--     起算=枠取得日(mgmt_fee_anchor)・満了月（completedMonths）。前回課金〜現在の
--       満了月数ぶんを課金。預かり金(運転資金)から可能分を相殺し、不足は請求
--       (kind=management_fee)＋通知を発行（受注は継続）。
-- 冪等（if not exists / on conflict）。
-- =====================================================================

-- 1) 月額管理手数料の1枠あたり単価（将来変更可） --------------------------
insert into portal.system_settings (key, value_int, note) values
  ('mgmt_fee_per_slot_yen', 100000, '月額管理手数料の1枠あたり単価。月額=(枠数-1)×単価')
on conflict (key) do nothing;

-- 2) members：課金の起算日・課金済み満了月数 ----------------------------
alter table portal.members add column if not exists mgmt_fee_anchor        date;                 -- 枠取得日（課金起算日）
alter table portal.members add column if not exists mgmt_fee_billed_months int not null default 0; -- 起算日からの課金済み満了月数

comment on column portal.members.mgmt_fee_anchor is '月額管理手数料の起算日（枠取得日）。本部が調整可。NULL=初回課金時に当日で起算';
comment on column portal.members.mgmt_fee_billed_months is '月額管理手数料の課金済み満了月数（二重課金防止）';

-- 既存の上位プラン自動売買加盟者は、当機能の開始日（適用日）を起算にする（遡及課金しない）
update portal.members m
   set mgmt_fee_anchor = current_date
  from portal.plans p
 where m.plan_id = p.id
   and m.grant_auto = true
   and coalesce(p.default_auto_slots, 0) >= 2
   and m.mgmt_fee_anchor is null;

-- 3) 月次課金の実行履歴（監査・可視化） ---------------------------------
create table if not exists portal.member_mgmt_fee_runs (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references portal.members(id) on delete cascade,
  months           int  not null,                 -- 今回課金した満了月数
  slots            int  not null,                 -- 課金時の枠数
  unit_yen         int  not null,                 -- 1枠あたり単価
  gross_yen        bigint not null,               -- 請求総額 =(枠数-1)×単価×月数
  from_deposit_yen bigint not null default 0,     -- 預かり金から相殺した額
  invoiced_yen     bigint not null default 0,     -- 不足で請求した額
  invoice_id       uuid references portal.invoices(id) on delete set null,
  ran_by           uuid,
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_mgmt_fee_runs_member on portal.member_mgmt_fee_runs(member_id, created_at desc);

alter table portal.member_mgmt_fee_runs enable row level security;

drop policy if exists portal_mgmt_fee_runs_read on portal.member_mgmt_fee_runs;
create policy portal_mgmt_fee_runs_read on portal.member_mgmt_fee_runs
  for select using (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()));

drop policy if exists portal_mgmt_fee_runs_write on portal.member_mgmt_fee_runs;
create policy portal_mgmt_fee_runs_write on portal.member_mgmt_fee_runs
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

grant select, insert, update, delete on portal.member_mgmt_fee_runs to authenticated;
grant all on portal.member_mgmt_fee_runs to service_role;
