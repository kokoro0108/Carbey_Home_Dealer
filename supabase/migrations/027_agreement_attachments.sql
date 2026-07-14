-- =====================================================================
-- Carbey Portal — 利用規約に付随する各種料金表（別添）
-- =====================================================================
-- クライアント要件（2026-07-14）:
--   利用規約に付随して「各種料金表」を別添として同居させたい。
--   今後の追加を想定し、本部が自由に追加・編集できる形（テキスト入力）。
--   料金表の内容も含めて利用規約の同意を求める（規約と一体で再同意・確定 2026-07-14）。
--
--   agreement_attachments: 規約に紐づく別添（料金表など）。title + body(テキスト) + sort_order。
--   規約ページで規約本文と同居表示。料金表を変更したら規約を新版発行して再同意を求める運用。
-- 冪等化のため if exists を併用。
-- =====================================================================

create table if not exists portal.agreement_attachments (
  id           uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references portal.agreements(id) on delete cascade,
  title        text not null,               -- 例：各種料金表 / 陸送料金表
  body         text not null default '',     -- 料金表の内容（テキスト・改行そのまま）
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_agreement_attachments_agreement on portal.agreement_attachments(agreement_id, sort_order);

drop trigger if exists trg_agreement_attachments_touch on portal.agreement_attachments;
create trigger trg_agreement_attachments_touch
  before update on portal.agreement_attachments
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS：閲覧はログインユーザー全員（公開規約の別添）／編集は本部
-- ---------------------------------------------------------------------
alter table portal.agreement_attachments enable row level security;

drop policy if exists portal_agr_attach_read on portal.agreement_attachments;
create policy portal_agr_attach_read on portal.agreement_attachments
  for select using (auth.uid() is not null);

drop policy if exists portal_agr_attach_write on portal.agreement_attachments;
create policy portal_agr_attach_write on portal.agreement_attachments
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

grant select, insert, update, delete on portal.agreement_attachments to authenticated;
grant all on portal.agreement_attachments to service_role;
