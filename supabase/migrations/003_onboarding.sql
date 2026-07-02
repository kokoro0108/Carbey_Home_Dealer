-- =====================================================================
-- Carbey Portal — Phase 2: オンボーディング (スタートアップ進捗)
-- =====================================================================
-- 加盟店ごとのオンボーディングタスクを保持する。
-- ステップ(step_key)でグルーピングし、本部が進捗を管理、加盟店は閲覧する。
-- members.onboarding_total / onboarding_done はトリガで自動同期する
-- （既存ダッシュボードの集計表示をそのまま使い続けるため）。
-- 冪等化のため drop ... if exists を併用。
-- =====================================================================

create table if not exists portal.onboarding_tasks (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references portal.members(id) on delete cascade,
  step_key    text not null,        -- contract | funding | documents | training | launch
  step_label  text not null,        -- ステップ表示名
  title       text not null,        -- タスク名
  status      text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  sort_order  int not null default 0,
  due_date    date,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_onboarding_tasks_member on portal.onboarding_tasks(member_id);
create index if not exists idx_onboarding_tasks_order  on portal.onboarding_tasks(member_id, sort_order);

drop trigger if exists trg_onboarding_tasks_touch on portal.onboarding_tasks;
create trigger trg_onboarding_tasks_touch
  before update on portal.onboarding_tasks
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- members の集計カラムを onboarding_tasks から同期する
-- ---------------------------------------------------------------------
create or replace function portal.sync_onboarding_progress()
returns trigger language plpgsql security definer set search_path = portal as $$
declare
  v_member uuid := coalesce(new.member_id, old.member_id);
  v_total int;
  v_done  int;
begin
  select count(*), count(*) filter (where status = 'done')
    into v_total, v_done
    from portal.onboarding_tasks where member_id = v_member;

  update portal.members
     set onboarding_total = greatest(v_total, 1),
         onboarding_done  = v_done
   where id = v_member;

  return null;
end;
$$;

drop trigger if exists trg_onboarding_sync on portal.onboarding_tasks;
create trigger trg_onboarding_sync
  after insert or update or delete on portal.onboarding_tasks
  for each row execute function portal.sync_onboarding_progress();

-- ---------------------------------------------------------------------
-- 既定タスクの生成（加盟店ごと。重複生成しない）
-- ---------------------------------------------------------------------
create or replace function portal.seed_onboarding_tasks(p_member_id uuid)
returns void language plpgsql security definer set search_path = portal as $$
begin
  -- 既にタスクがあれば何もしない（冪等）
  if exists (select 1 from portal.onboarding_tasks where member_id = p_member_id) then
    return;
  end if;

  insert into portal.onboarding_tasks (member_id, step_key, step_label, title, sort_order) values
    (p_member_id, 'contract',  '契約・初期設定', '加盟契約の締結',                 10),
    (p_member_id, 'contract',  '契約・初期設定', 'アカウント発行・初回ログイン',   20),
    (p_member_id, 'contract',  '契約・初期設定', 'プロフィール（連絡先・陸送先）の登録', 30),
    (p_member_id, 'funding',   '資金調達',       '資金調達申請',                   40),
    (p_member_id, 'funding',   '資金調達',       '事業計画書の提出',               50),
    (p_member_id, 'funding',   '資金調達',       '銀行口座情報の登録',             60),
    (p_member_id, 'funding',   '資金調達',       '融資審査の完了',                 70),
    (p_member_id, 'documents', '必要書類の提出', '本人確認書類',                   80),
    (p_member_id, 'documents', '必要書類の提出', '古物商許可証',                   90),
    (p_member_id, 'documents', '必要書類の提出', '販売店情報の登録',              100),
    (p_member_id, 'training',  'トレーニング',   '市場の見方を学ぶ',              110),
    (p_member_id, 'training',  'トレーニング',   'AI壁打ちで候補整理を体験',      120),
    (p_member_id, 'training',  'トレーニング',   '出品ルールの確認',              130),
    (p_member_id, 'launch',    '運用開始',       '初回仕入れオーダー',            140),
    (p_member_id, 'launch',    '運用開始',       '初回出品',                      150),
    (p_member_id, 'launch',    '運用開始',       '全機能の解放',                  160);
end;
$$;

-- public ラッパー（スキーマ未公開でも RPC で叩けるように）
create or replace function public.portal_seed_onboarding_tasks(p_member_id uuid)
returns void language sql security definer set search_path = public, portal as $$
  select portal.seed_onboarding_tasks(p_member_id);
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table portal.onboarding_tasks enable row level security;

-- 閲覧: 本部スタッフは全件、加盟店は自分のタスクのみ
drop policy if exists portal_onboarding_read on portal.onboarding_tasks;
create policy portal_onboarding_read on portal.onboarding_tasks
  for select using (
    portal.is_staff(auth.uid())
    or member_id = portal.current_member_id(auth.uid())
  );

-- 編集（タスク完了など）: 本部のみ（オンボーディングは本部主導）
drop policy if exists portal_onboarding_admin_write on portal.onboarding_tasks;
create policy portal_onboarding_admin_write on portal.onboarding_tasks
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

-- ---------------------------------------------------------------------
-- 既存の全加盟店に既定タスクを生成（初回適用時）
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select id from portal.members loop
    perform portal.seed_onboarding_tasks(r.id);
  end loop;
end $$;
