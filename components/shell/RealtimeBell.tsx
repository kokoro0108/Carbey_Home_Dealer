'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * リアルタイム通知ベル。
 * 初期未読数をサーバーから受け取り、notifications の INSERT を購読して
 * 自分宛て（admin向け or 自分の user_id 宛て）の新着で未読数を増やす。
 */
export default function RealtimeBell({
  href,
  initialUnread,
  scope,
  userId,
}: {
  href: string
  initialUnread: number
  /** 'admin' = audience='admin' を購読 / 'user' = user_id=自分 を購読 */
  scope: 'admin' | 'user'
  userId: string
}) {
  const [unread, setUnread] = useState(initialUnread)

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    async function subscribe() {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) supabase.realtime.setAuth(token)
      if (cancelled) return

      const filter = scope === 'admin' ? 'audience=eq.admin' : `user_id=eq.${userId}`
      channel = supabase
        .channel(`notif:${scope}:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'portal', table: 'notifications', filter },
          () => setUnread((n) => n + 1),
        )
        .subscribe((status, err) => {
          if (status !== 'SUBSCRIBED') console.warn('[notif realtime]', status, err ?? '')
        })
    }
    void subscribe()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [scope, userId])

  // 既読化ページ（チャット/通知一覧）を開いたら、その scope のバッジを即 0 にする
  useEffect(() => {
    const onRead = (e: Event) => {
      const detail = (e as CustomEvent<{ scope: 'admin' | 'user' }>).detail
      if (detail?.scope === scope) setUnread(0)
    }
    window.addEventListener('notifications:read', onRead)
    return () => window.removeEventListener('notifications:read', onRead)
  }, [scope])

  return (
    <Link href={href} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="通知">
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
