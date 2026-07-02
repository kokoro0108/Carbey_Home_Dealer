import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser, isStaff } from '@/lib/auth/session'
import { getAttachmentForViewer } from '@/lib/portal/chat'

/**
 * チャット添付ファイルのプレビュー/ダウンロード。
 * サーバーが権限（会話参加者）を確認し、Storage から取得した実体をそのまま返す
 * （署名URLへリダイレクトしない＝ブラウザに Storage の公開URLを露出させない）。
 *   GET /api/chat/attachment/<messageId>            → プレビュー（inline）
 *   GET /api/chat/attachment/<messageId>?download=1 → ダウンロード（attachment）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await getSessionUser()
  if (!session) return new NextResponse('unauthorized', { status: 401 })

  const { messageId } = await params
  const download = request.nextUrl.searchParams.get('download') === '1'

  const file = await getAttachmentForViewer(messageId, {
    userId: session.userId,
    isStaff: isStaff(session.role),
  })
  if (!file) return new NextResponse('not found', { status: 404 })

  const buffer = Buffer.from(await file.data.arrayBuffer())
  // ファイル名を RFC5987 でエンコード（日本語ファイル名対応）
  const encodedName = encodeURIComponent(file.name)
  const disposition = `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodedName}`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': file.type,
      'Content-Disposition': disposition,
      // 認証必須・ブラウザキャッシュは private（共有キャッシュに残さない）
      'Cache-Control': 'private, no-store',
    },
  })
}
