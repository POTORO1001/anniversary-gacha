# 周年記念 メイドさんアクキーガチャ

iPad縦向きで店舗イベントに使う、HTML/CSS/JavaScriptだけのガチャWebアプリです。画像や音声素材が未配置でも、CSSの仮ガチャマシンと仮メイド表示で動作確認できます。

## ファイル構成

```text
index.html
style.css
script.js
config.js
img/
  gacha/
    machine_body.png
    machine_window.png
    handle.png
    capsule_red.png
    capsule_blue.png
    capsule_yellow.png
    capsule_pink.png
    capsule_closed.png
    capsule_top.png
    capsule_bottom.png
  maids/
    meru.png
    mio.png
    rei.png
    ria.png
    sena.png
    usa.png
audio/
  tap.mp3
  gacha_start.mp3
  click.mp3
  capsule_drop.mp3
  capsule_hit.mp3
  charge.mp3
  capsule_open.mp3
  sparkle.mp3
  result.mp3
google_apps_script.gs
```

## 使い方

`index.html` をSafariで開くと動作します。GitHub Pagesでは、このフォルダをそのまま公開してください。

iPadでは縦向きで使用してください。横向きの場合は案内メッセージを表示し、演出開始を止めます。

## メイドの追加・削除

`config.js` だけを編集します。

```javascript
window.maidConfig = [
  { id: "meru", name: "める", image: "img/maids/meru.png" },
  { id: "mio", name: "みお", image: "img/maids/mio.png" },
  { id: "rei", name: "れい", image: "img/maids/rei.png" },
  { id: "ria", name: "りあ", image: "img/maids/ria.png" },
  { id: "sena", name: "せな", image: "img/maids/sena.png" },
  { id: "usa", name: "うさ", image: "img/maids/usa.png" }
];
```

画像は背景透過PNG、縦長、1000 x 1600px前後がおすすめです。画像が読み込めない場合は名前入りの仮カードを表示します。

## 管理者設定

待機画面上部のタイトル部分を5回連続でタップすると管理者設定を開けます。

管理者設定では、登録人数、登録名、効果音ON/OFF、スキップON/OFF、スプレッドシート連携ON/OFF、送信先URL、現在の履歴、演出テストを確認できます。スキップ機能は初期状態でONです。

## 履歴

ガチャを回す前にポトロパスポートの有無を確認します。お持ちの方は会員証QRを読み取って名前を確認し、お持ちでない方は従来どおり名前を入力します。同じご主人様の連続抽選では受付を繰り返しません。結果画面の「終了する」を押すと、画面の履歴と会員情報・名前をリセットして最初の画面へ戻ります。未送信ログは残ります。

## スプレッドシート連携

ガチャ結果用Apps Scriptに `google_apps_script.gs` と `passport_bridge.gs` の両方を追加して、Webアプリとしてデプロイします。会員連携のサーバー設定と店舗端末の受付キーが必要です。手順は `passport_setup.txt` を確認してください。GitHubへのプッシュだけではApps Scriptは更新されません。

送信される項目は、`resultId / 日時 / ご主人様名 / メイドID / 当選メイド / 回数 / 端末名 / UserAgent` です。通信できない場合は未送信ログとして端末に残り、管理者設定から再送できます。

作成済みの集約先スプレッドシートは以下です。

https://docs.google.com/spreadsheets/d/1Ksbh-pnoJqri0MKAyn0NQZUtPCnUZcWWLIuz5d-B7ys/edit

詳しい設定手順は `spreadsheet_setup.txt` を確認してください。

## ポトロパスポート

会員の当選グッズは管理台帳の「グッズ管理」に数量1・未受取で追加し、既存のパスポート同期APIで反映します。受取済み・取消は既存運用に従います。会員でない方はガチャ結果のみ記録します。登録IDは抽選IDから決めるため、通信失敗後に再送してもグッズは重複しません。サーバーが成功を返すまで未送信ログを保持します。

QR読み取りには同梱した [jsQR 1.4.0](https://github.com/cozmo/jsQR) を利用します。ライセンスは `vendor/jsQR-LICENSE.txt` にあります。カメラはHTTPSで開き、利用を許可してください。会員QRの識別子はサーバーで照合し、ブラウザにはサーバーの秘密キーを配信しません。

サーバー処理の回帰テスト: `node --test tests/passport-bridge.test.cjs`。カメラ受付のブラウザテストは `tests/passport-ui.cjs`（`passport_setup.txt` 参照）。本番の同期確認にはApps Scriptの設定・再デプロイが必要です。

## 演出

ガチャボタン押下時に抽選結果を1回だけ確定し、演出中の連打を無効にします。ハンドル回転、内部カプセル攪拌、排出口への落下、受け皿バウンド、中央への注目、開封、アクキー登場、結果メッセージの順で再生します。

効果音ファイルが無い場合やSafariで再生に失敗した場合でも、演出は止まりません。その場合はブラウザ内蔵の簡易効果音を自動で鳴らします。
