# 仕入れ即メモ

スマホで素早く支出を記録するための、軽量な静的Webアプリです。

## 配置方針

`humandoll26.github.io` 配下のサブフォルダアプリとして公開する想定です。

- 公開フォルダ名: `shiire-soku-memo`
- 想定URL: `https://humandoll26.github.io/shiire-soku-memo/`

## できること

- 日付と市場を選んで支出入力
- `品目 価格` / `品目価格` の雑入力
- 市場ごとの手数料設定
- 手数料込み合計の自動表示
- 入力履歴の一覧表示と削除
- CSV保存
- `LocalStorage` による端末内保存

## ファイル構成

- `shiire-soku-memo/index.html`
- `shiire-soku-memo/styles.css`
- `shiire-soku-memo/app.js`

## GitHub Pages で公開する

1. `humandoll26.github.io` リポジトリに push
2. GitHub の `Settings`
3. `Pages`
4. `Deploy from a branch`
5. `main` または `master` の `/root` を選択

公開後は `shiire-soku-memo` フォルダ配下の `index.html` がそのまま配信されます。
