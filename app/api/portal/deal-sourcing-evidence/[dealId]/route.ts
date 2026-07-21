import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser, isStaff } from '@/lib/auth/session'
import { getDealSourcingEvidenceForViewer } from '@/lib/portal/deal-costs'

/**
 * 販売中の仕入れエビデンス（自動売買）のプレビュー/ダウンロード。
 * サーバーが権限（本部 or 案件の本人）を確認し、実体を返す（署名URL非露出）。
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ dealId: string }> }) {
  const session = await getSessionUser()
  if (!session) return new NextResponse('unauthorized', { status: 401 })

  const { dealId } = await params
  const download = request.nextUrl.searchParams.get('download') === '1'

  const file = await getDealSourcingEvidenceForViewer(dealId, { userId: session.userId, isStaff: isStaff(session.role) })
  if (!file) return new NextResponse('not found', { status: 404 })

  const buffer = Buffer.from(await file.data.arrayBuffer())
  const encodedName = encodeURIComponent(file.name)
  const disposition = `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodedName}`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': file.type,
      'Content-Disposition': disposition,
      'Cache-Control': 'private, no-store',
    },
  })
}
