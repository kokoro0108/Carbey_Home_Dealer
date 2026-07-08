// 本部管理者ユーザーを作成する一回限りのスクリプト (REST 直叩き、依存なし)。
//   1. Auth Admin API で auth.users にユーザー作成 (email 確認済み扱い)
//   2. portal.bootstrap_admin RPC で admin メンバーシップに昇格
// 使い方: node --env-file=.env scripts/create-admin.mjs <email> <password> [name]

const [email, password, name = '本部管理者'] = process.argv.slice(2)
if (!email || !password) {
  console.error('usage: node --env-file=.env scripts/create-admin.mjs <email> <password> [name]')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function findUserByEmail(targetEmail) {
  // GoTrue admin: フィルタ付きで検索
  const res = await fetch(
    `${url}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers },
  )
  if (!res.ok) throw new Error(`listUsers failed: ${res.status} ${await res.text()}`)
  const body = await res.json()
  const users = body.users ?? body
  return users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase())
}

// 1. ユーザー作成
let userId
const createRes = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ email, password, email_confirm: true }),
})

if (createRes.ok) {
  const user = await createRes.json()
  userId = user.id
  console.log(`auth user created: ${userId}`)
} else {
  const text = await createRes.text()
  if (/already.*registered|exists|been registered/i.test(text)) {
    const found = await findUserByEmail(email)
    if (!found) throw new Error(`user exists but not found: ${text}`)
    userId = found.id
    console.log(`auth user already existed: ${userId}`)
  } else {
    throw new Error(`createUser failed: ${createRes.status} ${text}`)
  }
}

// 2. 管理者に昇格。Exposed schemas の状態に依存しないよう 2 段構えで試す:
//    (a) portal.bootstrap_admin を直接 (portal が公開されている場合)
//    (b) public.portal_bootstrap_admin ラッパー (public が公開されている場合)
async function callRpc(fnName, profile) {
  return fetch(`${url}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Profile': profile, 'Accept-Profile': profile },
    body: JSON.stringify({ p_user_id: userId, p_name: name, p_email: email }),
  })
}

let rpcRes = await callRpc('bootstrap_admin', 'portal')
if (!rpcRes.ok) {
  rpcRes = await callRpc('portal_bootstrap_admin', 'public')
}
if (!rpcRes.ok) {
  throw new Error(`bootstrap_admin failed: ${rpcRes.status} ${await rpcRes.text()}`)
}

console.log(`✅ ${email} を管理者(admin)として登録しました (user_id=${userId})`)
