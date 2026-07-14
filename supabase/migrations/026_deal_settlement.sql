-- =====================================================================
-- Carbey Portal — 半自動売買フェーズ6: 受領時の自動精算＋残金繰越
-- =====================================================================
-- クライアント確定（2026-07-14 / docs/semi-auto-trading-design.md §8）:
--   Q5/Q6: 受領（受け取り完了）→ 自動精算 → 取引履歴 → 進捗リセット → 残金繰越 → 新規オーダー可能。
--   Q7: 残金 = 預かり金 − Σ費目（仕入・商品化・陸送・その他）。
--   陸送費は着地県から自動計算（フェーズ5）。特殊車/未設定は個別見積。
--
--   vehicle_deals に精算フィールドを追加:
--     to_pref         : 陸送先（着地都道府県）— 陸送費の自動計算に使用
--     settled         : 精算済みフラグ
--     settled_amount  : 精算した費用合計
--     remaining_yen   : 精算後の預かり残金（記録用）
--   精算処理（費用の ledger 記帳・残高減算）はアプリ側 settleDeal で実行。
-- 冪等化のため if not exists を使用。
-- =====================================================================

alter table portal.vehicle_deals add column if not exists to_pref text;              -- 陸送先（着地県）
alter table portal.vehicle_deals add column if not exists settled boolean not null default false;
alter table portal.vehicle_deals add column if not exists settled_amount_yen bigint; -- 精算した費用合計
alter table portal.vehicle_deals add column if not exists remaining_yen bigint;      -- 精算後の預かり残金

comment on column portal.vehicle_deals.to_pref is '陸送先（着地都道府県）。陸送費の自動計算に使用';
comment on column portal.vehicle_deals.settled is '受領時に精算済みか';
comment on column portal.vehicle_deals.remaining_yen is '精算後の預かり残金（繰越額の記録）';
