-- =====================================================================
-- Carbey Portal — 自動売買 フェーズ7：予算振り分け（両フロー保有者）
-- =====================================================================
-- 確定ルール（docs/auto-trading-slots-design.md 3-4）:
--   自動売買・半自動の両方の権限を持つ加盟者は、預かり金（member_ledger）を
--   「自動売買用」「半自動用」に自分で振り分けられる。
--   受注/精算の残高判定は、各フローの割当額に対して行う（既定はフロー全体プール）。
--   片方フローのみの加盟者は全額そのフローに割当（振り分けは両フロー保有者のみ）。
--
--   member_budget_alloc（加盟者ごと1行）:
--     auto_allocated_yen … 自動売買用に割り当てた預かり金
--     semi_allocated_yen … 半自動用に割り当てた預かり金
--     （設定時点の預かり残高を2フローへ分割。行が無い＝未設定＝各フロー全額判定）
-- 冪等（if not exists）。
-- =====================================================================

create table if not exists portal.member_budget_alloc (
  member_id          uuid primary key references portal.members(id) on delete cascade,
  auto_allocated_yen bigint not null default 0,  -- 自動売買用の割当
  semi_allocated_yen bigint not null default 0,  -- 半自動用の割当
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_member_budget_alloc_touch on portal.member_budget_alloc;
create trigger trg_member_budget_alloc_touch
  before update on portal.member_budget_alloc
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS：本部は全件、加盟店は自分の割当を閲覧・操作（自分で振り分けるため）。
-- ---------------------------------------------------------------------
alter table portal.member_budget_alloc enable row level security;

drop policy if exists portal_member_budget_alloc_read on portal.member_budget_alloc;
create policy portal_member_budget_alloc_read on portal.member_budget_alloc
  for select using (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()));

drop policy if exists portal_member_budget_alloc_write on portal.member_budget_alloc;
create policy portal_member_budget_alloc_write on portal.member_budget_alloc
  for all using (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()))
  with check (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()));

grant select, insert, update, delete on portal.member_budget_alloc to authenticated;
grant all on portal.member_budget_alloc to service_role;
