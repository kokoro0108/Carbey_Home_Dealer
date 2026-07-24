-- =====================================================================
-- Carbey Portal — 自動売買 フェーズ2：案件のフロー種別（受注可否の土台）
-- =====================================================================
-- 200台キャパ・枠は「自動売買のみ」の概念のため、案件が自動売買か半自動かを判別する。
--   半自動：加盟店の仕入れオーダーから起票（order_id あり）
--   自動  ：本部が起票（createManualDeal・order_id なし）
-- 既存案件は order_id の有無で振り分ける（order_id あり=semi / なし=auto）。
-- 冪等（if not exists / drop constraint）。
-- =====================================================================

alter table portal.vehicle_deals add column if not exists flow text not null default 'semi';
alter table portal.vehicle_deals drop constraint if exists vehicle_deals_flow_check;
alter table portal.vehicle_deals add constraint vehicle_deals_flow_check check (flow in ('semi', 'auto'));

comment on column portal.vehicle_deals.flow is '案件のフロー種別。semi=半自動（オーダー起票）/ auto=自動売買（本部起票）。200台キャパ・枠は auto のみが対象';

-- 既存案件の振り分け：オーダー由来=semi、本部起票=auto
update portal.vehicle_deals set flow = 'semi' where order_id is not null;
update portal.vehicle_deals set flow = 'auto' where order_id is null;

-- 稼働台数集計用インデックス（auto かつ 稼働中）
create index if not exists idx_vehicle_deals_flow_status on portal.vehicle_deals(flow, status);
