-- =====================================================================
-- Carbey Portal — Phase 2: チャット添付ファイル (画像 / PDF / 文書)
-- =====================================================================
-- chat_messages に添付情報を持たせ、body を nullable 化（ファイルのみ送信を許可）。
-- ファイル本体は Supabase Storage の private バケット chat-attachments に保存し、
-- 表示時にサーバーで短期の署名URLを発行する（アプリ側で実装）。
-- 冪等化のため if exists / if not exists を併用。
-- =====================================================================

-- 添付カラム
alter table portal.chat_messages add column if not exists attachment_path text;   -- Storage 内パス
alter table portal.chat_messages add column if not exists attachment_name text;   -- 元ファイル名
alter table portal.chat_messages add column if not exists attachment_type text;   -- MIME
alter table portal.chat_messages add column if not exists attachment_size int;    -- バイト

-- body: ファイルのみ送信を許可するため nullable に。
-- ただし body か attachment のどちらかは必須。
alter table portal.chat_messages alter column body drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chat_messages_body_or_attachment'
  ) then
    alter table portal.chat_messages
      add constraint chat_messages_body_or_attachment
      check (body is not null or attachment_path is not null);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Storage: private バケット chat-attachments
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

-- Storage RLS: サーバー(service_role)は RLS をバイパスするため、
-- 保存・署名URL発行はアプリのサーバーアクション経由で行う想定。
-- 直接の匿名アクセスは禁止（public=false のため URL 直叩き不可）。
-- 認証ユーザーが自分の会話の添付を読めるよう、念のため select ポリシーを付ける。
drop policy if exists chat_attachments_read on storage.objects;
create policy chat_attachments_read on storage.objects
  for select using (
    bucket_id = 'chat-attachments'
    and auth.uid() is not null
  );

-- ---------------------------------------------------------------------
-- 通知トリガーを更新：ファイルのみのメッセージでもスニペットが空にならないように
-- ---------------------------------------------------------------------
create or replace function portal.notify_on_chat_message()
returns trigger language plpgsql security definer set search_path = portal as $$
declare
  v_member_uid  uuid;
  v_member_name text;
  v_snippet     text;
begin
  select m.user_id, coalesce(m.company_name, m.member_name)
    into v_member_uid, v_member_name
    from portal.chat_conversations c
    join portal.members m on m.id = c.member_id
   where c.id = new.conversation_id;

  v_snippet := coalesce(left(new.body, 60), '📎 ' || coalesce(new.attachment_name, 'ファイル'));

  if new.sender_role = 'member' then
    insert into portal.notifications (audience, kind, title, message)
    values ('admin', 'chat', v_member_name || ' さんからメッセージ', v_snippet);
  else
    if v_member_uid is not null then
      insert into portal.notifications (user_id, audience, kind, title, message)
      values (v_member_uid, 'user', 'chat', '本部からメッセージが届きました', v_snippet);
    end if;
  end if;

  return null;
end;
$$;
