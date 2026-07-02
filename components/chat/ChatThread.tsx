'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Send, Paperclip, X, FileText, Download, Eye, ImageIcon,
  Search, Pencil, Trash2, Check, CheckCheck, AlertCircle, RotateCcw,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  sendChatMessageAction, editMessageAction, deleteMessageAction, searchMessagesAction,
  markChatNotificationsReadAction,
} from '@/app/portal/chat/actions'
import type { ChatMessageRow } from '@/types/database'

/** チャット通知を既読化し、ヘッダーのバッジを即 0 にする。 */
async function markChatReadAndClearBadge() {
  try {
    const { scope } = await markChatNotificationsReadAction()
    window.dispatchEvent(new CustomEvent('notifications:read', { detail: { scope } }))
  } catch {
    /* 既読化失敗はチャット表示を妨げない */
  }
}

type PendingState = 'sending' | 'error'
// 楽観表示や送信状態を付与したメッセージ
type UiMessage = ChatMessageRow & { _pending?: PendingState; _tempId?: string }

/**
 * リアルタイムチャットスレッド（フル機能）。
 * 送信者名 / 日付区切り / 既読 / 編集・削除 / 送信前プレビュー / 検索 /
 * タイピング中インジケータ / 送信失敗リトライ / 添付プレビュー(サイト内)に対応。
 */
export default function ChatThread({
  conversationId,
  initialMessages,
  currentUserId,
  isStaffViewer,
}: {
  conversationId: string
  initialMessages: ChatMessageRow[]
  currentUserId: string
  isStaffViewer: boolean
}) {
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages)
  const [sending, setSending] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ChatMessageRow | null>(null)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null)
  const [typingName, setTypingName] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Realtime 購読（メッセージ INSERT/UPDATE + タイピング broadcast）
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function subscribe() {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) supabase.realtime.setAuth(token)
      if (cancelled) return

      const channel = supabase
        .channel(`chat:${conversationId}`, { config: { broadcast: { self: false } } })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'portal', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const row = payload.new as ChatMessageRow
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
            // 相手からの新着なら、開いている間は即既読化してバッジを増やさない
            if (row.sender_id !== currentUserId) void markChatReadAndClearBadge()
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'portal', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const row = payload.new as ChatMessageRow
            setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)))
          },
        )
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          setTypingName(payload?.name ?? '相手')
          if (typingTimer.current) clearTimeout(typingTimer.current)
          typingTimer.current = setTimeout(() => setTypingName(null), 3000)
        })
        .subscribe((status, err) => {
          if (status !== 'SUBSCRIBED') console.warn('[chat realtime]', status, err ?? '')
        })
      channelRef.current = channel
    }
    void subscribe()

    return () => {
      cancelled = true
      if (channelRef.current) void supabase.removeChannel(channelRef.current)
    }
  }, [conversationId, currentUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // スレッドを開いた時点で、自分宛てのチャット通知を既読化しバッジを 0 に
  useEffect(() => {
    void markChatReadAndClearBadge()
  }, [conversationId])

  // タイピング通知（自分が入力したら broadcast）
  const notifyTyping = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { name: isStaffViewer ? '本部' : '加盟店' } })
  }, [isStaffViewer])

  const doSend = useCallback(async (formData: FormData, tempId: string) => {
    try {
      await sendChatMessageAction(formData)
      // 成功：楽観行を消す（Realtime INSERT で本物が入る）
      setMessages((prev) => prev.filter((m) => m._tempId !== tempId))
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信に失敗しました')
      setMessages((prev) => prev.map((m) => (m._tempId === tempId ? { ...m, _pending: 'error' } : m)))
    }
  }, [])

  const handleSubmit = async () => {
    if (!text.trim() && !selectedFile) return
    setSending(true)
    setError('')
    const fd = new FormData()
    if (isStaffViewer) fd.set('conversation_id', conversationId)
    if (text.trim()) fd.set('body', text.trim())
    if (selectedFile) fd.set('file', selectedFile)

    // 楽観表示（テキストのみ・添付は「送信中」チップ）
    const tempId = `temp_${Date.now()}`
    const optimistic: UiMessage = {
      id: tempId, _tempId: tempId, _pending: 'sending',
      conversation_id: conversationId, sender_id: currentUserId,
      sender_role: isStaffViewer ? 'admin' : 'member',
      sender_name: isStaffViewer ? '本部' : '自分',
      body: text.trim() || null,
      attachment_path: selectedFile ? 'pending' : null,
      attachment_name: selectedFile?.name ?? null,
      attachment_type: selectedFile?.type ?? null,
      attachment_size: selectedFile?.size ?? null,
      read_at: null, edited_at: null, deleted_at: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setText('')
    setSelectedFile(null)
    setImgPreview(null)
    if (fileRef.current) fileRef.current.value = ''

    await doSend(fd, tempId)
    setSending(false)
  }

  const retry = async (m: UiMessage) => {
    // 添付付きの再送はファイルが失われるためテキストのみ再送可
    const fd = new FormData()
    if (isStaffViewer) fd.set('conversation_id', conversationId)
    if (m.body) fd.set('body', m.body)
    setMessages((prev) => prev.map((x) => (x._tempId === m._tempId ? { ...x, _pending: 'sending' } : x)))
    if (m._tempId) await doSend(fd, m._tempId)
  }

  const submitEdit = async () => {
    if (!editing) return
    const { id, body } = editing
    const res = await editMessageAction(id, body)
    if (res.ok) setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body, edited_at: new Date().toISOString() } : m)))
    setEditing(null)
  }

  const doDelete = async (id: string) => {
    const res = await deleteMessageAction(id)
    if (res.ok) setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body: null, deleted_at: new Date().toISOString() } : m)))
  }

  const onFileChange = (f: File | null) => {
    setSelectedFile(f)
    setImgPreview(f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-card">
      {/* ヘッダー：検索トグル */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <SearchBar open={searchOpen} onToggle={() => setSearchOpen((v) => !v)} conversationId={conversationId} />
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 space-y-1 overflow-y-auto p-5 scrollbar-slim">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-400">まだメッセージがありません。最初の一通を送ってみましょう。</p>
        )}
        {messages.map((m, i) => (
          <div key={m.id}>
            <DateDivider prev={messages[i - 1]?.created_at} cur={m.created_at} />
            <MessageBubble
              m={m}
              mine={m.sender_id === currentUserId}
              onPreview={() => setPreview(m)}
              onEdit={() => setEditing({ id: m.id, body: m.body ?? '' })}
              onDelete={() => doDelete(m.id)}
              onRetry={() => retry(m)}
            />
          </div>
        ))}
        {typingName && (
          <p className="px-1 pt-1 text-[11px] italic text-slate-400">{typingName} が入力中...</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 送信前プレビュー */}
      {selectedFile && (
        <div className="flex items-center gap-3 border-t border-slate-200 px-3 pt-2">
          {imgPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgPreview} alt="" className="h-12 w-12 rounded object-cover ring-1 ring-slate-200" />
          ) : (
            <FileText className="h-6 w-6 text-slate-400" />
          )}
          <span className="flex-1 truncate text-xs text-slate-600">{selectedFile.name}</span>
          <span className="text-[11px] text-slate-400">{fmtSize(selectedFile.size)}</span>
          <button type="button" onClick={() => onFileChange(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="ファイルを外す">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {error && <div className="px-3 pt-2 text-xs text-red-600">{error}</div>}

      {/* 入力 */}
      <form
        ref={formRef}
        onSubmit={(e) => { e.preventDefault(); void handleSubmit() }}
        className="flex items-end gap-2 border-t border-slate-200 p-3"
      >
        <input
          ref={fileRef} type="file" name="file" className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <button type="button" onClick={() => fileRef.current?.click()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50" aria-label="ファイルを添付">
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); notifyTyping() }}
          rows={1}
          placeholder="メッセージを入力..."
          className="max-h-32 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit() }
          }}
        />
        <button type="submit" disabled={sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50" aria-label="送信">
          <Send className="h-4 w-4" />
        </button>
      </form>

      {/* 編集モーダル */}
      {editing && (
        <EditModal
          value={editing.body}
          onChange={(v) => setEditing((e) => (e ? { ...e, body: v } : e))}
          onSave={submitEdit}
          onClose={() => setEditing(null)}
        />
      )}

      {/* 添付プレビューモーダル */}
      {preview && <PreviewModal message={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

/* ---------- 日付区切り ---------- */
function DateDivider({ prev, cur }: { prev?: string; cur: string }) {
  const curDay = new Date(cur).toDateString()
  if (prev && new Date(prev).toDateString() === curDay) return null
  const d = new Date(cur)
  const today = new Date().toDateString()
  const yst = new Date(Date.now() - 86400000).toDateString()
  const label = curDay === today ? '今日' : curDay === yst ? '昨日' : d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <div className="my-3 flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-100" />
      <span className="rounded-full bg-slate-100 px-3 py-0.5 text-[11px] text-slate-500">{label}</span>
      <span className="h-px flex-1 bg-slate-100" />
    </div>
  )
}

/* ---------- メッセージ吹き出し ---------- */
function MessageBubble({
  m, mine, onPreview, onEdit, onDelete, onRetry,
}: {
  m: UiMessage; mine: boolean
  onPreview: () => void; onEdit: () => void; onDelete: () => void; onRetry: () => void
}) {
  const deleted = !!m.deleted_at
  return (
    <div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[75%]">
        {/* 送信者名（相手のみ・連投時も出す） */}
        {!mine && !deleted && <div className="mb-0.5 px-1 text-[11px] font-medium text-slate-500">{m.sender_name ?? '—'}</div>}
        {/* 自分のメッセージ：吹き出しの上に編集/削除（ホバー表示） */}
        {mine && !deleted && !m._pending && (
          <div className="mb-0.5 flex justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
            {m.body != null && (
              <button onClick={onEdit} className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200" title="編集" aria-label="編集">
                <Pencil className="h-3 w-3" /> 編集
              </button>
            )}
            <button onClick={onDelete} className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-red-100 hover:text-red-600" title="削除" aria-label="削除">
              <Trash2 className="h-3 w-3" /> 削除
            </button>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <div className={`rounded-2xl px-4 py-2 text-sm ${deleted ? 'bg-slate-100 text-slate-400 italic' : mine ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-800'}`}>
            {deleted ? (
              <span className="text-xs">このメッセージは削除されました</span>
            ) : (
              <>
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                {m.attachment_path && <Attachment message={m} mine={mine} onPreview={onPreview} />}
              </>
            )}
            <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>
              {m.edited_at && !deleted && <span>編集済</span>}
              <span>{new Date(m.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
              {mine && !deleted && !m._pending && (m.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
              {m._pending === 'sending' && <span>送信中...</span>}
              {m._pending === 'error' && (
                <button onClick={onRetry} className="flex items-center gap-0.5 text-red-200 hover:text-white" title="再送">
                  <AlertCircle className="h-3 w-3" /> <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- 添付チップ ---------- */
function Attachment({ message, mine, onPreview }: { message: ChatMessageRow; mine: boolean; onPreview: () => void }) {
  const isImage = message.attachment_type?.startsWith('image/')
  const downloadUrl = `/api/chat/attachment/${message.id}?download=1`
  const name = message.attachment_name ?? '添付ファイル'
  const btn = mine ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
  const pending = message.attachment_path === 'pending'

  return (
    <div className={`mt-1.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${mine ? 'bg-white/15 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
      {isImage ? <ImageIcon className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs">{name}</div>
        {message.attachment_size != null && <div className={`text-[10px] ${mine ? 'text-white/60' : 'text-slate-400'}`}>{fmtSize(message.attachment_size)}</div>}
      </div>
      {!pending && (
        <>
          <button type="button" onClick={onPreview} title="プレビュー" aria-label="プレビュー" className={`flex h-7 w-7 items-center justify-center rounded-md transition ${btn}`}>
            <Eye className="h-3.5 w-3.5" />
          </button>
          <a href={downloadUrl} title="ダウンロード" aria-label="ダウンロード" className={`flex h-7 w-7 items-center justify-center rounded-md transition ${btn}`}>
            <Download className="h-3.5 w-3.5" />
          </a>
        </>
      )}
    </div>
  )
}

/* ---------- 検索バー ---------- */
function SearchBar({ open, onToggle, conversationId }: { open: boolean; onToggle: () => void; conversationId: string }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ChatMessageRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    if (!q.trim()) { setResults(null); return }
    setLoading(true)
    try { setResults(await searchMessagesAction(conversationId, q)) } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-1 items-center gap-2">
      <button onClick={onToggle} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" aria-label="検索">
        <Search className="h-4 w-4" /> メッセージ検索
      </button>
      {open && (
        <div className="relative flex flex-1 items-center gap-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void run() }}
            placeholder="キーワード..." autoFocus
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
          />
          <button onClick={run} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">検索</button>
          {results && (
            <div className="absolute left-0 right-0 top-10 z-20 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg scrollbar-slim">
              {loading && <p className="p-2 text-xs text-slate-400">検索中...</p>}
              {!loading && results.length === 0 && <p className="p-2 text-xs text-slate-400">該当なし</p>}
              {results.map((r) => (
                <div key={r.id} className="border-b border-slate-50 px-2 py-1.5 last:border-0">
                  <div className="text-[11px] text-slate-400">{r.sender_name} ・ {new Date(r.created_at).toLocaleString('ja-JP')}</div>
                  <div className="truncate text-xs text-slate-700">{r.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- 編集モーダル ---------- */
function EditModal({ value, onChange, onSave, onClose }: { value: string; onChange: (v: string) => void; onSave: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">メッセージを編集</h3>
        <textarea
          value={value} onChange={(e) => onChange(e.target.value)} rows={4} autoFocus
          className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">キャンセル</button>
          <button onClick={onSave} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">保存</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- 添付プレビューモーダル ---------- */
function PreviewModal({ message, onClose }: { message: ChatMessageRow; onClose: () => void }) {
  const url = `/api/chat/attachment/${message.id}`
  const downloadUrl = `${url}?download=1`
  const name = message.attachment_name ?? '添付ファイル'
  const type = message.attachment_type ?? ''
  const isImage = type.startsWith('image/')
  const isPdf = type === 'application/pdf'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center gap-3 pb-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="flex-1 truncate text-sm font-medium">{name}</span>
        <a href={downloadUrl} className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25">
          <Download className="h-3.5 w-3.5" /> ダウンロード
        </a>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25" aria-label="閉じる">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="max-h-full max-w-full rounded-lg object-contain" />
        ) : isPdf ? (
          <iframe src={url} title={name} className="h-full w-full max-w-4xl rounded-lg bg-white" />
        ) : (
          <div className="rounded-xl bg-white px-8 py-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-600">この形式はブラウザでプレビューできません。</p>
            <a href={downloadUrl} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              <Download className="h-4 w-4" /> ダウンロードして開く
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
