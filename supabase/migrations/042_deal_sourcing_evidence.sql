-- =====================================================================
-- Carbey Portal — 自動売買 進捗フロー：仕入れエビデンス（販売中に本部が添付）
-- =====================================================================
-- クライアント確定 2026-07-21：
--   自動売買の進捗フローは現フェーズでは「販売中・精算完了」の2段階のみ運用
--   （仕入れ中は第二フェーズから拡張・予告表示）。ロジックは全段階を構築済みにする。
--   「販売中」で、何を販売しているかが分かるよう【本部が】仕入れデータのエビデンスを
--   1案件1ファイル（画像/PDF）添付できる。加盟店は閲覧のみ。
--
--   ストレージは既存の 'deal-evidences' バケットを流用（deal_costs と共用）。
--   vehicle_deals に添付のパス/ファイル名/日時を保持（1案件1点）。
-- 冪等（if not exists）。
-- =====================================================================

alter table portal.vehicle_deals add column if not exists sourcing_evidence_path text;        -- ストレージのパス（deal-evidences バケット）
alter table portal.vehicle_deals add column if not exists sourcing_evidence_name text;        -- 元ファイル名（表示・ダウンロード用）
alter table portal.vehicle_deals add column if not exists sourcing_evidence_at   timestamptz; -- 添付日時

comment on column portal.vehicle_deals.sourcing_evidence_path is '仕入れエビデンス（販売中に本部が添付）のストレージパス。deal-evidences バケット';
comment on column portal.vehicle_deals.sourcing_evidence_name is '仕入れエビデンスの元ファイル名';
comment on column portal.vehicle_deals.sourcing_evidence_at   is '仕入れエビデンスの添付日時';
