-- =====================================================================
-- Carbey Portal — Phase 2: オーダー (仕入れ依頼)
-- =====================================================================
-- 加盟店が本部に車両の仕入れを依頼する。
-- 加盟店は自分のオーダーを作成・閲覧、本部(can_crm)が全件を処理する。
-- order_number は ORD-YYYYMM-#### 形式で自動採番。
-- 冪等化のため if exists / or replace を併用。
-- =====================================================================

create table if not exists portal.orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text unique,
  member_id     uuid not null references portal.members(id) on delete cascade,
  -- 依頼内容
  maker         text,                 -- メーカー
  car_model     text not null,        -- 車種
  year          text,                 -- 年式
  budget_yen    integer,              -- 予算
  preferred_color text,               -- 希望色
  mileage_max   integer,              -- 走行距離上限(km)
  notes         text,                 -- 要望・備考
  -- 進行
  status        text not null default 'received'
                  check (status in ('received', 'in_progress', 'completed', 'cancelled')),
  admin_notes   text,                 -- 本部メモ
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_orders_member on portal.orders(member_id);
create index if not exists idx_orders_status on portal.orders(status);
create index if not exists idx_orders_created on portal.orders(created_at desc);

drop trigger if exists trg_orders_touch on portal.orders;
create trigger trg_orders_touch
  before update on portal.orders
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- order_number の自動採番 (ORD-YYYYMM-#### ：その月の連番)
-- ---------------------------------------------------------------------
create or replace function portal.set_order_number()
returns trigger language plpgsql security definer set search_path = portal as $$
declare
  v_prefix text := 'ORD-' || to_char(now(), 'YYYYMM') || '-';
  v_seq int;
begin
  if new.order_number is not null then
    return new;
  end if;
  select count(*) + 1 into v_seq
    from portal.orders
   where order_number like v_prefix || '%';
  new.order_number := v_prefix || lpad(v_seq::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_orders_number on portal.orders;
create trigger trg_orders_number
  before insert on portal.orders
  for each row execute function portal.set_order_number();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table portal.orders enable row level security;

-- 閲覧: 本部スタッフは全件、加盟店は自分のオーダーのみ
drop policy if exists portal_orders_read on portal.orders;
create policy portal_orders_read on portal.orders
  for select using (
    portal.is_staff(auth.uid())
    or member_id = portal.current_member_id(auth.uid())
  );

-- 作成: 加盟店は自分の member_id でのみ作成可
drop policy if exists portal_orders_member_insert on portal.orders;
create policy portal_orders_member_insert on portal.orders
  for insert with check (
    member_id = portal.current_member_id(auth.uid())
  );

-- 更新/削除(処理): 本部(can_crm)のみ
drop policy if exists portal_orders_admin_write on portal.orders;
create policy portal_orders_admin_write on portal.orders
  for update using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));
drop policy if exists portal_orders_admin_delete on portal.orders;
create policy portal_orders_admin_delete on portal.orders
  for delete using (portal.is_admin(auth.uid()));
