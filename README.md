# カーベイホームディーラー（CARBAY Home Dealer）

> 中古車FC加盟店プラットフォーム — 本部と加盟店をつなぐ運用基盤。
> 加盟店のオンボーディングから半自動売買の取引ライフサイクルまでを、**本部の手作業を最小化して自動で流れる**形で提供します。

本アプリケーションは、既存の [Carbey](../Carbey)（中古車市場分析ツール）と同一の Supabase プロジェクトに相乗りし、
専用スキーマ `portal` でデータを分離した独立アプリケーションです。

**設計方針:** 「加盟者が勝手に先行できない・飛ばせない・登録しないとビジネスを開始できない・自動化する」

---

## 技術スタック

| 領域 | 採用技術 |
| --- | --- |
| フレームワーク | Next.js 15（App Router） / React 19 / TypeScript |
| スタイリング | Tailwind CSS |
| 認証・DB | Supabase（Auth + PostgreSQL / RLS / Storage） |
| メール送信 | nodemailer（自前 SMTP・スタッフ招待／パスワードリセット） |
| AI（将来） | Anthropic / OpenAI / Google GenAI SDK |
| テスト | Vitest |

---

## セットアップ

```bash
npm install
cp .env.example .env          # 値を埋める（下表参照）
npm run dev                   # http://localhost:3000
```

DB の初期化（全マイグレーション適用・PostgREST スキーマ公開）は、
[`supabase/migrations/SETUP_ALL.sql`](supabase/migrations/SETUP_ALL.sql) を Supabase SQL Editor で実行してください。
これは `001` 〜 `027` の全マイグレーションを冪等にまとめたファイルです。手順の詳細は
[`supabase/migrations/README.md`](supabase/migrations/README.md) を参照。

### 環境変数

| 変数 | 用途 | 必須 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開（anon）キー | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー専用キー（RLS をバイパス） | ✅ |
| `NEXT_PUBLIC_SITE_URL` | メールリンクの遷移先 | ✅ |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_SECURE` | スタッフ招待・パスワードリセットメール | 任意（未設定時は該当機能を無効化） |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENAI_API_KEY` | AI 機能（将来フェーズ） | 任意 |

---

## 権限モデル

メール＋パスワード認証。アクセス制御は 4 ロールで行い、権限マトリクスは
[`lib/auth/permissions.ts`](lib/auth/permissions.ts) に単一の真実として集約しています。
各画面は `requireAdmin` / `requireStaff` / `requireFeature(feature)` でガードされ、権限外はログイン画面へリダイレクトされます。

| ロール | 概要 |
| --- | --- |
| `admin` | 管理者（本部）— 全機能 |
| `crm_staff` | CRM 入力担当 — 会員・CRM・オーダー・チャット |
| `chat_only` | チャット専用 |
| `member` | 加盟店 — 自分のデータのみ（本部画面 `/admin` には入れない） |

加盟店の**利用可能機能はプラン・フローに連動して自動制御**されます。ロールごとの固定権限ではなく、
プランの保有モデル（半自動 / 自動）・オンボーディング完了状況・古物商猶予から動的に決定されます。

---

## 主要機能

### 本部（`/admin`）

- **ダッシュボード** — 加盟店数・有効契約・今月の入金・新規オーダー・未読チャット・オンボーディング進捗（すべて実データ集計）
- **加盟店管理** — 一覧／登録／詳細。登録と同時にログイン発行（本部がパスワードを直接発行）。`active` 化時はプラン・契約日が必須。プラン/フロー・進捗・オーダー状況・利用可能機能・提出書類・資金管理・同意履歴を1画面に集約
- **資金管理** — 全加盟店の預かり金残高・加盟金支払状況の一覧集計（個別管理は会員詳細）
- **オンボーディング管理** — 進捗の監視ダッシュボード。停滞加盟店へチャットでリマインド送信
- **CRM** — 購入者顧客の管理（顧客・購入履歴・商談・対応履歴）。担当加盟店と連動
- **プラン管理** — プラン編集＋保有モデル（半自動 / 自動）設定。加盟店数から会員一覧へ双方向連動
- **権限管理** — 本部スタッフのロール割り当て・招待・利用状態の切り替え
- **利用規約設定** — 規約の版管理・公開。付随する各種料金表（別添）を自由に追加・編集
- **実践マニュアル** — フロー別（半自動 / 自動 / 共通）マニュアルの CMS。動画URL・添付資料の埋め込み
- **本部サポート** — サポート項目の管理（古物商取得業者の紹介 等）
- **陸送費設定** — 発地×着地の料金マスタ、特殊車（個別見積）メーカー管理
- **お知らせ配信 / 通知** — 全加盟店への一斉配信・既読管理

### 加盟店（`/portal`）

- **ダッシュボード** — 半自動売買の進捗ボード（横軸）・「次にやること」導線・オンボーディング進捗・オーダー集計・お知らせ
- **オンボーディング** — ゲート式フローチャート（飛ばせない・実体の完了で自動進行）。本人確認・古物商のエビデンス提出（D&D）、資金準備の分岐、利用規約同意、実践マニュアル修了
- **トレーニング** — 実践マニュアルの動画・資料を個別に閲覧
- **仕入れオーダー** — 半自動売買フローのみ。オンボーディング完了・預かり残高内でのみ発注可能
- **取引（案件）詳細** — 進捗ボード、費用内訳（動的費目・エビデンス）、精算プレビュー、受領（自動精算）
- **利用規約 / チャット / プロフィール**

---

## 半自動売買の業務フロー（自動化）

本部の一件ごとの手作業を排し、受発注が自動で流れる仕組みです。

```
仕入れ資金デポジット（本部が台帳に記帳）
  → オーダー（発注 < 預かり残高でのみ送信可）→ 案件が「仕入れ中」に自動遷移
  → （任意）商品化中に手動移行・費用内訳を動的に記録＋計算書エビデンス格納
  → 陸送先（着地県）設定 → 受領（受け取り完了）ボタン
  → 自動精算：陸送費を自動計算（特殊車は個別見積）→ 残金 = 預かり金 − Σ費用
  → 取引履歴に記録・残金は次回に繰越 → 新規オーダー可能に復元（リループ）
```

フローチャートは初回はオンボーディング用、以降は半自動売買の進捗管理として何度でもリループします。

---

## ディレクトリ構成

```
app/
  admin/        本部向け画面（ダッシュボード・会員・資金・CRM・プラン・権限・規約・
                マニュアル・サポート・陸送費・オンボーディング・オーダー・チャット）
  portal/       加盟店向け画面（ダッシュボード・オンボーディング・トレーニング・
                オーダー・案件・利用規約・チャット・プロフィール）
  api/          API ルート（登録・認証・エビデンス/添付のプロキシ配信）
components/
  ui/ shell/ charts/ auth/ chat/   共通 UI
  portal-dark/  加盟店向けダークテーマ UI（進捗ボード・費目エディタ 等）
lib/
  auth/         セッション・権限マトリクス
  portal/       業務ロジック（members / plans / crm / onboarding / flow /
                trading / funding / ledger / deals / deal-costs / shipping /
                agreements / manual / capabilities ほか）
  supabase/     Supabase クライアント（ブラウザ／サーバー／サービスロール）
  email/        SMTP 送信・メールテンプレート
supabase/migrations/   DB スキーマ（portal・001〜027）＋ SETUP_ALL.sql
docs/                  設計指針・レビュー対応ログ
```

---

## スクリプト

```bash
npm run dev     # 開発サーバー（http://localhost:3000）
npm run build   # 本番ビルド
npm run start   # 本番起動
npm run lint    # ESLint
npm run test    # Vitest

# 本部管理者を作成（DB 初期化時）
node --env-file=.env scripts/create-admin.mjs '<email>' '<password>' '<氏名>'
```

---

## データベース

`portal` スキーマに業務データを保持し、RLS でロール別アクセスを制御します。主なテーブル群:

| 分類 | テーブル |
| --- | --- |
| 基盤 | `users` / `members` / `plans` / `payments` |
| オンボーディング | `onboarding_tasks` / `evidences` / `agreements` / `agreement_consents` / `agreement_attachments` / `manual_sections` / `manual_progress` / `funding_applications` |
| 業務 | `orders` / `crm_customers` / `crm_purchases` / `crm_deals` / `announcements` / `chat_*` / `support_items` |
| 半自動売買 | `member_ledger` / `ledger_entries` / `vehicle_deals` / `deal_costs` / `shipping_rates` / `special_vehicle_makers` |

マイグレーションは番号順に冪等で適用でき、`SETUP_ALL.sql` に全量がまとめられています。

---

## ドキュメント

| ファイル | 内容 |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | 設計指針・フェーズ構成（要求事項定義書 v1.2 準拠） |
| [`docs/review-log.md`](docs/review-log.md) | クライアントレビュー ①〜㉝ の対応ログ |
| [`docs/onboarding-redesign.md`](docs/onboarding-redesign.md) | オンボーディング再設計（レビュー ⑨〜⑳） |
| [`docs/semi-auto-trading-design.md`](docs/semi-auto-trading-design.md) | 半自動売買 業務フロー システム化 設計 |

---

## 実装状況

| 区分 | 内容 | 状態 |
| --- | --- | --- |
| 基盤 | 認証・権限・加盟店管理・CRM・チャット・お知らせ | ✅ |
| オンボーディング | ゲート式フロー・エビデンス・資金・規約・マニュアル・完全自動化 | ✅ |
| プラン連動 | 保有モデル・自動/半自動の二系統フロー・利用可能機能の可視化 | ✅ |
| 半自動売買 | 預かり金台帳・超過オーダー制限・案件ライフサイクル・自動精算・陸送費マスタ | ✅ |
| 車両進捗（本部カンバン） | 案件データと連動した本部側の一覧・カンバン | 予定 |
| AI 市場分析・壁打ち | 意思決定支援（既存 Carbey からの移植） | 予定 |

AI 機能は `lib/ai/` に集約予定です。既存 Carbey の実装（クライアント／プロバイダ／ツール／会話履歴）を、
依存する Supabase クライアント・関連 API ルートとセットで移植します。詳細は [`docs/architecture.md`](docs/architecture.md) を参照してください。
