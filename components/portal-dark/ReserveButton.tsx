'use client'

import { useState, useTransition } from 'react'
import { Clock, Loader2 } from 'lucide-react'
import { requestReservationAction } from '@/app/portal/reserve-actions'

/** 全体上限で受注不可のとき、加盟者が受注待ちに申し込むボタン。 */
export default function ReserveButton() {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  return (
    <div className="mt-2">
      <button
        disabled={pending}
        onClick={() => { setError(''); start(async () => { const r = await requestReservationAction(); if (!r.ok) setError(r.error ?? '') }) }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />} 受注待ちに申し込む
      </button>
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  )
}
