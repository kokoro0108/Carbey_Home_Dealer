-- =====================================================================
-- Carbey Portal — 半自動売買フェーズ1: 預かり金台帳（仕入れ資金）
-- =====================================================================
-- クライアント要件（2026-07-13 / docs/semi-auto-trading-design.md）:
--   CRM内で加盟金・仕入れ資金（預かり金）を個別管理＋全体管理。
--   預かり金残高は、後続の「超過オーダー制限」「自動精算」の土台になる。
--
--   member_ledger  : 加盟店ごとの預かり金残高（1行）
--   ledger_entries : 入出金・精算の明細（deposit/withdraw/settlement/adjust）
--   残高は entries から自動再計算（トリガ）。整合性を保証。
--
-- 加盟金/月額は既存 payments を活用。ここは「仕入れ資金（預かり金）」に特化。
-- 冪等化のため if exists / on conflict を併用。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) member_ledger：加盟店ごとの預かり金残高
-- ---------------------------------------------------------------------
create table if not exists portal.member_ledger (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null unique references portal.members(id) on delete cascade,
  balance_yen  bigint not null default 0,   -- 預かり金残高（entries から自動再計算）
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_member_ledger_member on portal.member_ledger(member_id);

drop trigger if exists trg_member_ledger_touch on portal.member_ledger;
create trigger trg_member_ledger_touch
  before update on portal.member_ledger
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- 2) ledger_entries：入出金・精算の明細
--    kind: deposit(入金/デポジット) / withdraw(出金) /
--          settlement(取引精算での相殺) / adjust(調整)
--    amount_yen は符号付き（+=入金/戻し, -=出金/精算引き）。
-- ---------------------------------------------------------------------
create table if not exists portal.ledger_entries (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references portal.members(id) on delete cascade,
  kind         text not null check (kind in ('deposit', 'withdraw', 'settlement', 'adjust')),
  amount_yen   bigint not null,                 -- 符号付き（+入金 / -出金）
  note         text,
  -- 後続フェーズで案件精算に紐付ける（今は null 可）
  deal_id      uuid,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_ledger_entries_member on portal.ledger_entries(member_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3) 残高の自動再計算：entries の変更で member_ledger.balance_yen を更新
-- ---------------------------------------------------------------------
create or replace function portal.recompute_ledger_balance(p_member_id uuid)
returns void language plpgsql security definer set search_path = portal as $$
declare
  v_sum bigint;
begin
  select coalesce(sum(amount_yen), 0) into v_sum
    from portal.ledger_entries where member_id = p_member_id;
  insert into portal.member_ledger (member_id, balance_yen)
    values (p_member_id, v_sum)
    on conflict (member_id) do update set balance_yen = excluded.balance_yen, updated_at = now();
end;
$$;

create or replace function portal.trg_ledger_recompute()
returns trigger language plpgsql security definer set search_path = portal as $$
begin
  perform portal.recompute_ledger_balance(coalesce(new.member_id, old.member_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ledger_entries_recompute on portal.ledger_entries;
create trigger trg_ledger_entries_recompute
  after insert or update or delete on portal.ledger_entries
  for each row execute function portal.trg_ledger_recompute();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table portal.member_ledger enable row level security;
alter table portal.ledger_entries enable row level security;

-- 台帳・明細：本部は全件、加盟店は自分の分を閲覧
drop policy if exists portal_member_ledger_read on portal.member_ledger;
create policy portal_member_ledger_read on portal.member_ledger
  for select using (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()));

drop policy if exists portal_ledger_entries_read on portal.ledger_entries;
create policy portal_ledger_entries_read on portal.ledger_entries
  for select using (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()));

-- 入出金の登録・調整は本部（can_crm）のみ。加盟店は閲覧のみ。
drop policy if exists portal_ledger_entries_write on portal.ledger_entries;
create policy portal_ledger_entries_write on portal.ledger_entries
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

-- GRANT
grant select on portal.member_ledger to authenticated;
grant select, insert, update, delete on portal.ledger_entries to authenticated;
grant all on portal.member_ledger, portal.ledger_entries to service_role;
