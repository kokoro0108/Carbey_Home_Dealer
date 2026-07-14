import { ScrollText, CheckCircle2, FileText } from 'lucide-react'
import { requireMember } from '@/lib/auth/session'
import { hasConsented, listAttachments } from '@/lib/portal/agreements'
import { DarkCard, DarkCardBody } from '@/components/portal-dark/DarkUI'
import ConsentButton from './ConsentButton'

export const dynamic = 'force-dynamic'

export default async function MemberTermsPage() {
  const session = await requireMember()
  const { agreement, consented } = await hasConsented(session.userId)
  const attachments = agreement ? await listAttachments(agreement.id) : []

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <ScrollText className="h-5 w-5 text-brand-400" /> 利用規約
        </h1>
        <p className="text-sm text-slate-400">内容をご確認のうえ、同意してください。</p>
      </div>

      {!agreement ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          現在、公開中の利用規約がありません。本部にお問い合わせください。
        </div>
      ) : (
        <>
          <DarkCard>
            <DarkCardBody>
              <h2 className="mb-3 text-base font-bold text-white">{agreement.title}<span className="ml-2 text-xs font-normal text-slate-500">v{agreement.version}</span></h2>
              <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-carbon-700 bg-carbon-900/60 p-4 text-sm leading-relaxed text-slate-300 scrollbar-dark">
                {agreement.body}
              </div>
            </DarkCardBody>
          </DarkCard>

          {/* 別添：各種料金表（規約と同居・同意対象） */}
          {attachments.map((att) => (
            <DarkCard key={att.id}>
              <DarkCardBody>
                <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
                  <FileText className="h-4 w-4 text-brand-400" /> {att.title}
                  <span className="rounded bg-carbon-700 px-1.5 py-0.5 text-[10px] font-normal text-slate-400">別添</span>
                </h2>
                <div className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-carbon-700 bg-carbon-900/60 p-4 text-sm leading-relaxed text-slate-300 scrollbar-dark">
                  {att.body || '（内容は準備中です）'}
                </div>
              </DarkCardBody>
            </DarkCard>
          ))}

          {consented ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm font-medium text-brand-300">
              <CheckCircle2 className="h-4 w-4" /> 利用規約{attachments.length > 0 ? '・各種料金表' : ''}に同意済みです。
            </div>
          ) : (
            <>
              {attachments.length > 0 && (
                <p className="text-center text-xs text-slate-400">上記の利用規約および各種料金表の内容をご確認のうえ、同意してください。</p>
              )}
              <ConsentButton />
            </>
          )}
        </>
      )}
    </div>
  )
}
