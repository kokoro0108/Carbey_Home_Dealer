-- =====================================================================
-- Carbey Portal — 自動売買 フェーズ6：月額管理手数料の経過精算
-- =====================================================================
-- 確定ルール（クライアント確認 2026-07-21）：
--   自動売買（flow='auto'）の車両を清算（売却=sold）した時点で、
--   運用開始（仕入れ中 sourcing_at）〜清算（sold_at）の【満了月数】を数え、
--   手数料 = 満了月数 × プランの mgmt_fee_monthly_yen を
--   預かり金（ledger_entries）から差し引く（kind='mgmt_fee'）。
--   端数月は課金しない（満了月のみ・最短0か月）。履歴を可視化する。
--
--   ・ledger_entries.kind に 'mgmt_fee' を追加（符号は－：出金系）。
--   ・vehicle_deals に mgmt_fee_yen / mgmt_fee_months を保持（可視化＋二重課金防止）。
-- 冪等（if exists / if not exists）。
-- =====================================================================

-- ledger_entries.kind に mgmt_fee を追加 -----------------------------------
alter table portal.ledger_entries drop constraint if exists ledger_entries_kind_check;
alter table portal.ledger_entries
  add constraint ledger_entries_kind_check
  check (kind in ('deposit', 'withdraw', 'settlement', 'adjust', 'mgmt_fee'));

-- vehicle_deals に管理手数料の記録列 --------------------------------------
alter table portal.vehicle_deals add column if not exists mgmt_fee_yen    int; -- 清算時に差し引いた月額管理手数料（可視化＋冪等）
alter table portal.vehicle_deals add column if not exists mgmt_fee_months int; -- 手数料算出に使った満了月数

comment on column portal.vehicle_deals.mgmt_fee_yen is '清算時に預かり金から差し引いた月額管理手数料（自動売買）。NULL=未課金';
comment on column portal.vehicle_deals.mgmt_fee_months is '月額管理手数料の算出に用いた満了月数（運用開始〜清算）';
