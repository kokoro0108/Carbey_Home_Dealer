-- =====================================================================
-- Carbey Portal — Phase 3 仕上げ：結果報告書（D&D取込）＋商品化チェックリスト
-- =====================================================================
-- 要求事項定義書 5.5：
--   ・結果報告書：PDF ドラッグ＆ドロップ取込 または 手入力に対応（アップロードで案件完了）
--   ・商品化の状態（点検・清掃・撮影・掲載準備）をチェックリスト化（CAR-05）
--   ※ 販売台数・粗利は集計済。回転率・平均在庫日数は sourcing_at〜sold_at から算出（列追加不要）。
-- ストレージは既存の 'deal-evidences' バケットを流用。冪等（if not exists）。
-- =====================================================================

-- 結果報告書（販売結果報告時に添付。1案件1点） -------------------------
alter table portal.vehicle_deals add column if not exists result_report_path text;
alter table portal.vehicle_deals add column if not exists result_report_name text;
alter table portal.vehicle_deals add column if not exists result_report_at   timestamptz;

comment on column portal.vehicle_deals.result_report_path is '結果報告書のストレージパス（deal-evidences バケット）';

-- 商品化チェックリスト（点検・清掃・撮影・掲載準備） -----------------------
alter table portal.vehicle_deals add column if not exists prep_inspected     boolean not null default false; -- 点検
alter table portal.vehicle_deals add column if not exists prep_cleaned        boolean not null default false; -- 清掃
alter table portal.vehicle_deals add column if not exists prep_photographed   boolean not null default false; -- 撮影
alter table portal.vehicle_deals add column if not exists prep_listed_ready   boolean not null default false; -- 掲載準備

comment on column portal.vehicle_deals.prep_inspected is '商品化チェックリスト：点検';
comment on column portal.vehicle_deals.prep_cleaned is '商品化チェックリスト：清掃';
comment on column portal.vehicle_deals.prep_photographed is '商品化チェックリスト：撮影';
comment on column portal.vehicle_deals.prep_listed_ready is '商品化チェックリスト：掲載準備';
