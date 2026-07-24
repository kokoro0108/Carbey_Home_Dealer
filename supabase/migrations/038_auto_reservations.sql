-- =====================================================================
-- Carbey Portal — 自動売買 フェーズ4：受注待ち（予約）
-- =====================================================================
-- 確定ルール（docs/auto-trading-slots-design.md）:
--   キャパ超過時は「受注待ち（予約）」に入る。割当順は申込が早い順（先着）だが、
--   本部が手動で順番を入れ替え可能（運転資金の都合で先送りするため）。
--   清算で枠が空いたら、予約列の先頭（本部が並べた順）へ割り当てる。
--
--   auto_reservations:
--     status = 'waiting'(受注待ち) / 'assigned'(割当済み=起票へ) / 'cancelled'(取消)
--     sort_order = 本部の手動並替キー（小さいほど先。既定は申込順）
-- 冪等（if not exists）。
-- =====================================================================

create table if not exists portal.auto_reservations (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references portal.members(id) on delete cascade,
  status       text not null default 'waiting'
                 check (status in ('waiting', 'assigned', 'cancelled')),
  sort_order   int not null default 0,      -- 本部の手動並替（小さいほど先）
  requested_at timestamptz not null default now(),
  assigned_at  timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_auto_reservations_waiting
  on portal.auto_reservations(status, sort_order, requested_at);
create index if not exists idx_auto_reservations_member
  on portal.auto_reservations(member_id);

drop trigger if exists trg_auto_reservations_touch on portal.auto_reservations;
create trigger trg_auto_reservations_touch
  before update on portal.auto_reservations
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS：本部は全件、加盟店は自分の予約を閲覧。編集は本部（can_crm）。
-- ---------------------------------------------------------------------
alter table portal.auto_reservations enable row level security;

drop policy if exists portal_auto_reservations_read on portal.auto_reservations;
create policy portal_auto_reservations_read on portal.auto_reservations
  for select using (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()));

drop policy if exists portal_auto_reservations_write on portal.auto_reservations;
create policy portal_auto_reservations_write on portal.auto_reservations
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

grant select on portal.auto_reservations to authenticated;
grant insert, update, delete on portal.auto_reservations to authenticated;
grant all on portal.auto_reservations to service_role;
