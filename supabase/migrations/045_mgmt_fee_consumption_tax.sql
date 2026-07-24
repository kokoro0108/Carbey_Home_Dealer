-- =====================================================================
-- Carbey Portal — 月額管理手数料の消費税対応（2026-07-23 クライアント確定）
-- =====================================================================
-- 月額管理手数料（枠数連動）は【税抜】。上に消費税を加算して請求・相殺する。
--   消費税率は本部管理画面で設定可能（法改正に備え可変）。既定10%。
--   税込 = 税抜 +（税抜 × 税率）。預かり金からは税込額を相殺し、不足は税込で請求。
--   member_mgmt_fee_runs に税額・適用税率を記録（監査・可視化）。gross_yen は従来どおり【税抜】。
-- 冪等（if not exists / on conflict）。
-- =====================================================================

-- 消費税率（％）。本部が設定可（system_settings）。
insert into portal.system_settings (key, value_int, note) values
  ('consumption_tax_pct', 10, '消費税率（％）。月額管理手数料などに加算。法改正時は本部が変更')
on conflict (key) do nothing;

-- 実行履歴に税額・適用税率を追加（gross_yen=税抜。差引総額=gross_yen+tax_yen）
alter table portal.member_mgmt_fee_runs add column if not exists tax_yen      bigint not null default 0;  -- 消費税額
alter table portal.member_mgmt_fee_runs add column if not exists tax_rate_pct int    not null default 0;  -- 適用税率（％）

comment on column portal.member_mgmt_fee_runs.tax_yen is '消費税額（差引総額 = gross_yen 税抜 + tax_yen）';
comment on column portal.member_mgmt_fee_runs.tax_rate_pct is '適用した消費税率（％）';
