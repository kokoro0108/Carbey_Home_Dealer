-- =====================================================================
-- Carbey Portal — 自動売買 フェーズ5：枠購入の清算連携
-- =====================================================================
-- 確定ルール：1枠=10万円。入金消込が完了（invoices.status='paid'）したら
--   members.auto_slots を購入枠数だけ自動加算（最大10）。
--   請求・消込は既存の invoices（kind='slot_fee'）＋自動集計トリガを活用する。
--
--   invoices に slot_count（購入枠数）と slots_applied（加算済みフラグ・冪等化）を追加し、
--   paid になった時点で1回だけ加算する。
-- 冪等（if not exists / create or replace）。
-- =====================================================================

alter table portal.invoices add column if not exists slot_count    int;                    -- 購入枠数（slot_fee のみ）
alter table portal.invoices add column if not exists slots_applied boolean not null default false; -- 枠加算済み

comment on column portal.invoices.slot_count is '枠購入の枠数（kind=slot_fee）。paid で members.auto_slots に加算';
comment on column portal.invoices.slots_applied is '枠加算済みフラグ（二重加算防止）';

-- ---------------------------------------------------------------------
-- 消込完了（paid）で枠を自動加算するトリガ
--   kind=slot_fee かつ status=paid かつ未加算 かつ slot_count>0 のとき、
--   members.auto_slots += slot_count（最大10）し、slots_applied=true にする。
--   AFTER UPDATE。自身の slots_applied 更新で再発火しても未加算条件で停止（無限ループなし）。
-- ---------------------------------------------------------------------
create or replace function portal.apply_slot_purchase()
returns trigger language plpgsql security definer set search_path = portal as $$
begin
  if new.kind = 'slot_fee'
     and new.status = 'paid'
     and coalesce(new.slots_applied, false) = false
     and coalesce(new.slot_count, 0) > 0 then
    update portal.members
       set auto_slots = least(10, auto_slots + new.slot_count)
     where id = new.member_id;
    update portal.invoices set slots_applied = true where id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_invoices_apply_slots on portal.invoices;
create trigger trg_invoices_apply_slots
  after update on portal.invoices
  for each row execute function portal.apply_slot_purchase();
