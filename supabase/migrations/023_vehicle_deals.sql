-- =====================================================================
-- Carbey Portal — 半自動売買フェーズ3: 車両案件ライフサイクル
-- =====================================================================
-- クライアント確定（2026-07-14 / docs/semi-auto-trading-design.md §8）:
--   進捗4段（一件ごとに手動運用せず自動遷移）:
--     ordered(車両オーダー) → sourcing(仕入れ中) → prepping(商品化中・任意) → delivered(納品完了)
--   - オーダー送信で deal を生成し sourcing（仕入れ中）に自動遷移。
--   - 商品化中(prepping)は加盟者/本部どちらでも手動で移行（クロスセル）。
--   - 受領（受け取り完了スイッチ）で delivered → 取引終了・履歴反映・進捗リセット。
--   「仕入れ中」は全仕入進捗を一本化。
--
-- 費用内訳（動的費目）・自動精算はフェーズ4/6で肉付け。ここは案件と遷移の骨格。
-- 冪等化のため if exists を併用。
-- =====================================================================

create table if not exists portal.vehicle_deals (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references portal.members(id) on delete cascade,
  order_id     uuid references portal.orders(id) on delete set null,  -- 元オーダー
  status       text not null default 'sourcing'
                 check (status in ('ordered', 'sourcing', 'prepping', 'delivered')),
  -- 車両情報（オーダーからコピー・表示用）
  maker        text,
  car_model    text,
  year         text,
  order_amount_yen bigint,          -- 発注金額（オーダー予算）
  -- 進捗の各日付
  ordered_at   timestamptz not null default now(),
  sourcing_at  timestamptz,
  prepping_at  timestamptz,
  delivered_at timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_vehicle_deals_member on portal.vehicle_deals(member_id, status);
create index if not exists idx_vehicle_deals_order on portal.vehicle_deals(order_id);

drop trigger if exists trg_vehicle_deals_touch on portal.vehicle_deals;
create trigger trg_vehicle_deals_touch
  before update on portal.vehicle_deals
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS：本部は全件、加盟店は自分の案件
-- ---------------------------------------------------------------------
alter table portal.vehicle_deals enable row level security;

drop policy if exists portal_vehicle_deals_read on portal.vehicle_deals;
create policy portal_vehicle_deals_read on portal.vehicle_deals
  for select using (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()));

-- 加盟店：自分の案件を更新（商品化移行・受領）
drop policy if exists portal_vehicle_deals_member_update on portal.vehicle_deals;
create policy portal_vehicle_deals_member_update on portal.vehicle_deals
  for update using (member_id = portal.current_member_id(auth.uid())) with check (member_id = portal.current_member_id(auth.uid()));

-- 本部：全件の作成・更新
drop policy if exists portal_vehicle_deals_staff_all on portal.vehicle_deals;
create policy portal_vehicle_deals_staff_all on portal.vehicle_deals
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

grant select, insert, update on portal.vehicle_deals to authenticated;
grant all on portal.vehicle_deals to service_role;
