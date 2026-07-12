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
    maid01.png
    maid02.png
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
```

## 使い方

`index.html` をSafariで開くと動作します。GitHub Pagesでは、このフォルダをそのまま公開してください。

iPadでは縦向きで使用してください。横向きの場合は案内メッセージを表示し、演出開始を止めます。

## メイドの追加・削除

`config.js` だけを編集します。

```javascript
const maidConfig = [
  { id: "maid01", name: "ひなた", image: "img/maids/maid01.png" },
  { id: "maid02", name: "みるく", image: "img/maids/maid02.png" }
];
```

画像は背景透過PNG、縦長、1000 x 1600px前後がおすすめです。画像が読み込めない場合は名前入りの仮カードを表示します。

## 管理者設定

待機画面上部のタイトル部分を5回連続でタップすると管理者設定を開けます。

管理者設定では、登録人数、登録名、効果音ON/OFF、スキップON/OFF、現在の履歴、演出テストを確認できます。スキップ機能は初期状態でONです。

## 履歴

履歴は現在のご主人様分だけ `localStorage` に保存します。「次のご主人様」を押して確認すると履歴を削除し、回数を0に戻します。

## 演出

ガチャボタン押下時に抽選結果を1回だけ確定し、演出中の連打を無効にします。ハンドル回転、内部カプセル攪拌、排出口への落下、受け皿バウンド、中央への注目、開封、アクキー登場、結果メッセージの順で再生します。

効果音ファイルが無い場合やSafariで再生に失敗した場合でも、演出は止まりません。
