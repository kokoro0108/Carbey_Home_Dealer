'use client'

import { useTransition } from 'react'
import { CheckCheck } from 'lucide-react'
import { markAllReadAction } from './actions'

/**
 * 「すべて既読」ボタン。既読アクション成功後、同ブラウザ内の RealtimeBell に
 * 既読イベントを発火してヘッダーのバッジを即 0 にする。
 */
export default function MarkAllReadButton() {
  const [pending, start] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markAllReadAction()
          window.dispatchEvent(new CustomEvent('notifications:read', { detail: { scope: 'admin' } }))
        })
      }
      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
    >
      <CheckCheck className="h-4 w-4" />
      すべて既読
    </button>
  )
}
