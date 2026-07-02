-- =====================================================================
-- Carbey Portal — Phase 2: チャット受信通知
-- =====================================================================
-- chat_messages の INSERT 時に、受信者向けの notification を自動作成する。
--   加盟店 → 本部 : audience='admin' の通知
--   本部   → 加盟店: その加盟店の user_id 宛て通知 (audience='user')
-- 既存の notifications テーブル・通知ベルにそのまま乗せる。
-- notifications を Realtime 配信対象に追加し、ベルの未読数を即時更新できるようにする。
-- 冪等化のため or replace / if exists を併用。
-- =====================================================================

create or replace function portal.notify_on_chat_message()
returns trigger language plpgsql security definer set search_path = portal as $$
declare
  v_member_id   uuid;
  v_member_uid  uuid;
  v_member_name text;
  v_snippet     text;
begin
  -- 会話の加盟店を特定
  select c.member_id, m.user_id, coalesce(m.company_name, m.member_name)
    into v_member_id, v_member_uid, v_member_name
    from portal.chat_conversations c
    join portal.members m on m.id = c.member_id
   where c.id = new.conversation_id;

  -- 本文スニペット (通知一覧用に短く)
  v_snippet := left(new.body, 60);

  if new.sender_role = 'member' then
    -- 加盟店発 → 本部宛て
    insert into portal.notifications (audience, kind, title, message)
    values ('admin', 'chat', v_member_name || ' さんからメッセージ', v_snippet);
  else
    -- 本部発 → 加盟店宛て (user_id があるときのみ)
    if v_member_uid is not null then
      insert into portal.notifications (user_id, audience, kind, title, message)
      values (v_member_uid, 'user', 'chat', '本部からメッセージが届きました', v_snippet);
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_chat_notify on portal.chat_messages;
create trigger trg_chat_notify
  after insert on portal.chat_messages
  for each row execute function portal.notify_on_chat_message();

-- ---------------------------------------------------------------------
-- notifications を Realtime 配信対象に追加（ベルの即時更新用）
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'portal' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table portal.notifications;
  end if;
exception when undefined_object then
  null;
end $$;
