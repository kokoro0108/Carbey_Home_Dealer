-- =====================================================================
-- Carbey Portal — 半自動売買フェーズ5: 陸送費マスタ＋特殊車個別見積
-- =====================================================================
-- クライアント確定（2026-07-14 / docs/semi-auto-trading-design.md §8）:
--   Q3: 一律でなく「発地×着地を個別に設定できるマスタ」。都道府県ペアで料金設定。
--       未設定ペアはデフォルト or 個別見積。
--   Q4: 高級車・規格外車は「個別見積もり」に切替。初期メーカー7社＋随時追加。
--   Q8: 外部連携は将来。当面は本部が都道府県ペア料金を手設定。
--
--   shipping_rates: (from_pref, to_pref) → amount_yen の料金マスタ
--   special_vehicle_makers: 個別見積対象のメーカー
--   陸送費は案件の陸送先（着地県）から自動計算。特殊車は個別見積フラグ。
-- 冪等化のため if exists / on conflict を併用。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) shipping_rates：発地×着地の料金マスタ
-- ---------------------------------------------------------------------
create table if not exists portal.shipping_rates (
  id          uuid primary key default gen_random_uuid(),
  from_pref   text not null,               -- 発地（都道府県）
  to_pref     text not null,               -- 着地（都道府県）
  amount_yen  bigint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (from_pref, to_pref)
);

create index if not exists idx_shipping_rates_pair on portal.shipping_rates(from_pref, to_pref);

drop trigger if exists trg_shipping_rates_touch on portal.shipping_rates;
create trigger trg_shipping_rates_touch
  before update on portal.shipping_rates
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- 2) special_vehicle_makers：個別見積対象メーカー
-- ---------------------------------------------------------------------
create table if not exists portal.special_vehicle_makers (
  id          uuid primary key default gen_random_uuid(),
  maker       text not null unique,        -- メーカー名（maker 文字列一致で判定）
  note        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RLS：閲覧はログインユーザー全員、編集は本部
-- ---------------------------------------------------------------------
alter table portal.shipping_rates enable row level security;
alter table portal.special_vehicle_makers enable row level security;

drop policy if exists portal_shipping_rates_read on portal.shipping_rates;
create policy portal_shipping_rates_read on portal.shipping_rates
  for select using (auth.uid() is not null);
drop policy if exists portal_shipping_rates_write on portal.shipping_rates;
create policy portal_shipping_rates_write on portal.shipping_rates
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

drop policy if exists portal_special_makers_read on portal.special_vehicle_makers;
create policy portal_special_makers_read on portal.special_vehicle_makers
  for select using (auth.uid() is not null);
drop policy if exists portal_special_makers_write on portal.special_vehicle_makers;
create policy portal_special_makers_write on portal.special_vehicle_makers
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

grant select, insert, update, delete on portal.shipping_rates to authenticated;
grant select, insert, update, delete on portal.special_vehicle_makers to authenticated;
grant all on portal.shipping_rates, portal.special_vehicle_makers to service_role;

-- ---------------------------------------------------------------------
-- 初期の特殊車メーカー（個別見積対象）— 空なら投入
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from portal.special_vehicle_makers) then
    insert into portal.special_vehicle_makers (maker) values
      ('フェラーリ'), ('ベントレー'), ('ポルシェ'), ('ランボルギーニ'),
      ('ロールスロイス'), ('マクラーレン'), ('アストンマーティン');
  end if;
end $$;
