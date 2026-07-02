-- =====================================================================
-- Carbey Portal — Phase 2: チャット機能強化
-- =====================================================================
-- 送信者名の表示・メッセージの編集/削除に対応するためのカラムを追加。
--   sender_name : 送信時点の表示名（誰が発言したか。本部の複数スタッフ区別に必須）
--   edited_at   : 編集時刻（null=未編集）
--   deleted_at  : 論理削除時刻（null=有効）
-- sender_name は INSERT トリガーで portal.users / members から自動補完する。
-- 冪等化のため if exists / or replace を併用。
-- =====================================================================

alter table portal.chat_messages add column if not exists sender_name text;
alter table portal.chat_messages add column if not exists edited_at   timestamptz;
alter table portal.chat_messages add column if not exists deleted_at  timestamptz;

-- 送信者名を自動補完する（明示指定が無いとき）
create or replace function portal.fill_chat_sender_name()
returns trigger language plpgsql security definer set search_path = portal as $$
declare v_name text;
begin
  if new.sender_name is not null then
    return new;
  end if;

  if new.sender_role = 'member' then
    -- 加盟店：members の担当者名（会社名を優先表示）
    select coalesce(m.member_name, m.company_name)
      into v_name
      from portal.members m where m.user_id = new.sender_id;
  else
    -- 本部スタッフ：portal.users の名前
    select u.name into v_name from portal.users u where u.id = new.sender_id;
  end if;

  new.sender_name := coalesce(v_name, case
    when new.sender_role = 'member' then '加盟店'
    else '本部'
  end);
  return new;
end;
$$;

drop trigger if exists trg_chat_sender_name on portal.chat_messages;
create trigger trg_chat_sender_name
  before insert on portal.chat_messages
  for each row execute function portal.fill_chat_sender_name();

-- 既存メッセージの sender_name を後埋め（初回適用時）
update portal.chat_messages msg
   set sender_name = coalesce(
     (select u.name from portal.users u where u.id = msg.sender_id),
     (select coalesce(m.member_name, m.company_name) from portal.members m where m.user_id = msg.sender_id),
     case when msg.sender_role = 'member' then '加盟店' else '本部' end
   )
 where sender_name is null;
