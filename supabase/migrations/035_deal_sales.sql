-- =====================================================================
-- Carbey Portal — Phase 3 ①: 販売実績の記録基盤（要件 5.5〜5.7 / ㉓）
-- =====================================================================
-- 目的:
--   これまで案件（vehicle_deals）は「納品完了（＝加盟店への引き渡し）＋仕入費用の精算」
--   までを扱い、その後の "実際の販売"（販売価格・売却日・粗利益）が未記録だった。
--   販売実績・月次レポート・利益グラフ（Phase 3 の②③）の土台として、
--   案件に販売結果を持たせ、粗利益を自動算出する。
--
--   登録主体（クライアント確認 2026-07-15：フローで自動分け）:
--     半自動 → 納品完了後、加盟店が自分の売却結果を報告（本部も代理入力可）
--     全自動 → 本部が販売〜清算まで記録
--
--   ステージ（要件定義書 5.5）:
--     半自動: sourcing(仕入れ中) → prepping(商品化中) → delivered(納品完了) → sold(売却済み)
--     全自動: sourcing(仕入れ中) → prepping(商品化中) → listing(販売中) → sold(清算済み)
--     → 既存の check に listing / sold を追加する。
--
--   粗利益 = 販売価格 − 費用合計（仕入＋整備＋陸送 等）
--     費用合計は販売登録時のスナップショット cost_total_yen に保存し、
--     gross_profit_yen を生成列（自動算出）にする。集計を高速・確定にするため。
-- 冪等（if not exists / drop constraint if exists）。
-- =====================================================================

-- ステージに listing（販売中）/ sold（売却・清算済み）を追加
alter table portal.vehicle_deals drop constraint if exists vehicle_deals_status_check;
alter table portal.vehicle_deals
  add constraint vehicle_deals_status_check
  check (status in ('ordered', 'sourcing', 'prepping', 'listing', 'delivered', 'sold'));

-- 販売関連カラム
alter table portal.vehicle_deals add column if not exists listed_at      timestamptz;      -- 販売中に移行した日時（全自動）
alter table portal.vehicle_deals add column if not exists sale_price_yen bigint;           -- 販売価格
alter table portal.vehicle_deals add column if not exists sold_at        timestamptz;      -- 売却日
alter table portal.vehicle_deals add column if not exists sold_by        uuid references auth.users(id) on delete set null; -- 記録者
alter table portal.vehicle_deals add column if not exists cost_total_yen bigint;           -- 販売時点の費用合計スナップショット

-- 粗利益（自動算出）：販売価格 − 費用合計
alter table portal.vehicle_deals
  add column if not exists gross_profit_yen bigint
  generated always as (coalesce(sale_price_yen, 0) - coalesce(cost_total_yen, 0)) stored;

comment on column portal.vehicle_deals.sale_price_yen is '販売価格（売却時に登録）';
comment on column portal.vehicle_deals.cost_total_yen is '販売時点の費用合計（仕入＋整備＋陸送 等）のスナップショット';
comment on column portal.vehicle_deals.gross_profit_yen is '粗利益（自動算出）＝販売価格−費用合計';

-- 売却済みの集計・並び替え用インデックス
create index if not exists idx_vehicle_deals_sold on portal.vehicle_deals(member_id, sold_at) where status = 'sold';
