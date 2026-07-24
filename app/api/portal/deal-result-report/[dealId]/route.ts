import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser, isStaff } from '@/lib/auth/session'
import { getDealResultReportForViewer } from '@/lib/portal/deal-costs'

/** 結果報告書のプレビュー/ダウンロード。本部 or 案件の本人のみ（署名URL非露出）。 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ dealId: string }> }) {
  const session = await getSessionUser()
  if (!session) return new NextResponse('unauthorized', { status: 401 })
  const { dealId } = await params
  const download = request.nextUrl.searchParams.get('download') === '1'
  const file = await getDealResultReportForViewer(dealId, { userId: session.userId, isStaff: isStaff(session.role) })
  if (!file) return new NextResponse('not found', { status: 404 })
  const buffer = Buffer.from(await file.data.arrayBuffer())
  const encodedName = encodeURIComponent(file.name)
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': file.type,
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
