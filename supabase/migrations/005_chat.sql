-- =====================================================================
-- Carbey Portal — Phase 2: チャット (本部 ⇄ 加盟店の個別連絡)
-- =====================================================================
-- 会話(conversation)は加盟店ごとに1つ。メッセージ(message)が紐づく。
-- 本部スタッフ(is_staff)は全会話、加盟店は自分の会話のみ。
-- Supabase Realtime で chat_messages の INSERT を配信する。
-- 冪等化のため if exists / or replace を併用。
-- =====================================================================

create table if not exists portal.chat_conversations (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null unique references portal.members(id) on delete cascade,
  last_message_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_chat_conv_member on portal.chat_conversations(member_id);

create table if not exists portal.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references portal.chat_conversations(id) on delete cascade,
  sender_id       uuid references auth.users(id) on delete set null,
  sender_role     text not null check (sender_role in ('admin', 'member', 'crm_staff', 'chat_only')),
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_chat_msg_conv on portal.chat_messages(conversation_id, created_at);

-- 会話の last_message_at を更新
create or replace function portal.touch_conversation()
returns trigger language plpgsql security definer set search_path = portal as $$
begin
  update portal.chat_conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return null;
end;
$$;

drop trigger if exists trg_chat_touch_conv on portal.chat_messages;
create trigger trg_chat_touch_conv
  after insert on portal.chat_messages
  for each row execute function portal.touch_conversation();

-- 加盟店の会話を取得 or 作成（本部・加盟店どちらからでも）
create or replace function portal.get_or_create_conversation(p_member_id uuid)
returns uuid language plpgsql security definer set search_path = portal as $$
declare v_id uuid;
begin
  select id into v_id from portal.chat_conversations where member_id = p_member_id;
  if v_id is null then
    insert into portal.chat_conversations (member_id) values (p_member_id) returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.portal_get_or_create_conversation(p_member_id uuid)
returns uuid language sql security definer set search_path = public, portal as $$
  select portal.get_or_create_conversation(p_member_id);
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table portal.chat_conversations enable row level security;
alter table portal.chat_messages      enable row level security;

-- 会話: 本部は全件、加盟店は自分の会話のみ
drop policy if exists portal_chat_conv_read on portal.chat_conversations;
create policy portal_chat_conv_read on portal.chat_conversations
  for select using (
    portal.is_staff(auth.uid())
    or member_id = portal.current_member_id(auth.uid())
  );
drop policy if exists portal_chat_conv_staff_write on portal.chat_conversations;
create policy portal_chat_conv_staff_write on portal.chat_conversations
  for all using (portal.is_staff(auth.uid())) with check (portal.is_staff(auth.uid()));

-- メッセージ: 自分が参加する会話のメッセージのみ閲覧
drop policy if exists portal_chat_msg_read on portal.chat_messages;
create policy portal_chat_msg_read on portal.chat_messages
  for select using (
    exists (
      select 1 from portal.chat_conversations c
      where c.id = conversation_id
        and (portal.is_staff(auth.uid()) or c.member_id = portal.current_member_id(auth.uid()))
    )
  );

-- メッセージ送信: 本部 or 当該会話の加盟店本人
drop policy if exists portal_chat_msg_insert on portal.chat_messages;
create policy portal_chat_msg_insert on portal.chat_messages
  for insert with check (
    exists (
      select 1 from portal.chat_conversations c
      where c.id = conversation_id
        and (portal.is_staff(auth.uid()) or c.member_id = portal.current_member_id(auth.uid()))
    )
  );

-- 既読更新（read_at）: 会話の参加者
drop policy if exists portal_chat_msg_update on portal.chat_messages;
create policy portal_chat_msg_update on portal.chat_messages
  for update using (
    exists (
      select 1 from portal.chat_conversations c
      where c.id = conversation_id
        and (portal.is_staff(auth.uid()) or c.member_id = portal.current_member_id(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------
-- Realtime: chat_messages の変更を配信対象に追加
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'portal' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table portal.chat_messages;
  end if;
exception when undefined_object then
  -- supabase_realtime publication が無い環境では何もしない
  null;
end $$;
