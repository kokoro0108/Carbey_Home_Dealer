-- =====================================================================
-- Carbey Portal — 半自動売買フェーズ4: 案件の費用内訳（動的費目）＋エビデンス
-- =====================================================================
-- クライアント確定（2026-07-14 / docs/semi-auto-trading-design.md §8）:
--   Q7: 精算は固定4費目でなく「動的費目リスト」。陸送費の右に任意費目を追加でき、
--       すべての費目名称を変更できる（label 自由・並べ替え可）。
--   Q2: 仕入費は手入力＋「エビデンス取込」の2手段。計算書・整備明細を格納。
--
--   deal_costs: 案件ごとの費目。kind(分類)＋label(名称・変更可)＋amount＋エビデンス。
--     kind: sourcing(仕入) / prepping(商品化) / shipping(陸送) / other(その他・追加費目)
--   残金 = 預かり金 − Σ(deal_costs.amount_yen)。精算はフェーズ6。
--
-- エビデンスは private バケット deal-evidences（金銭情報のため機微）＋プロキシDL。
-- 冪等化のため if exists / on conflict を併用。
-- =====================================================================

create table if not exists portal.deal_costs (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references portal.vehicle_deals(id) on delete cascade,
  member_id    uuid not null references portal.members(id) on delete cascade,  -- RLS用
  kind         text not null default 'other'
                 check (kind in ('sourcing', 'prepping', 'shipping', 'other')),
  label        text not null,                 -- 費目名（変更可）例：仕入価格 / 整備費 / 陸送費
  amount_yen   bigint not null default 0,     -- 金額（正=費用）
  sort_order   int not null default 0,
  note         text,
  -- エビデンス（計算書・整備明細）private バケット
  attachment_path text,
  attachment_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_deal_costs_deal on portal.deal_costs(deal_id, sort_order);
create index if not exists idx_deal_costs_member on portal.deal_costs(member_id);

drop trigger if exists trg_deal_costs_touch on portal.deal_costs;
create trigger trg_deal_costs_touch
  before update on portal.deal_costs
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- Storage: private バケット deal-evidences（計算書・整備明細）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('deal-evidences', 'deal-evidences', false)
on conflict (id) do nothing;

drop policy if exists deal_evidences_rw on storage.objects;
create policy deal_evidences_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'deal-evidences' and auth.uid() is not null)
  with check (bucket_id = 'deal-evidences' and auth.uid() is not null);

-- ---------------------------------------------------------------------
-- RLS：本部は全件、加盟店は自分の案件費目を閲覧・編集
-- ---------------------------------------------------------------------
alter table portal.deal_costs enable row level security;

drop policy if exists portal_deal_costs_read on portal.deal_costs;
create policy portal_deal_costs_read on portal.deal_costs
  for select using (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()));

drop policy if exists portal_deal_costs_member_write on portal.deal_costs;
create policy portal_deal_costs_member_write on portal.deal_costs
  for all using (member_id = portal.current_member_id(auth.uid())) with check (member_id = portal.current_member_id(auth.uid()));

drop policy if exists portal_deal_costs_staff_write on portal.deal_costs;
create policy portal_deal_costs_staff_write on portal.deal_costs
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

grant select, insert, update, delete on portal.deal_costs to authenticated;
grant all on portal.deal_costs to service_role;
