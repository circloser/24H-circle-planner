// Japanese landing content for /ja/ (native copy — refine anytime).
// NOTE: the interactive app dictionary (src/i18n/dict/ja.ts) is still partial,
// so once the JS loads the UI falls back to English for untranslated keys.
export default {
  lang: 'ja',
  ogLocale: 'ja_JP',
  title: '24Houring · 円形24時間プランナー（一日の予定を時計で）',
  description:
    '一日を時計のように一目で見渡せる、無料の円形24時間プランナー。ドラッグでブロックを編集し、12/24時間表示を切り替え、予定を画像として保存・共有できます。登録不要、ブラウザですぐ、オフラインでも動作します。',
  ogTitle: '24Houring · 円形24時間プランナー',
  ogDescription: '編集・保存・共有できる、無料の円形24時間プランナー。',
  twTitle: '24Houring · 円形24時間プランナー',
  twDescription: '編集・保存・共有できる、無料の円形24時間プランナー。',
  ogImageAlt: '24Houring — 円形の24時間時間割',
  alternateName: '円形24時間プランナー',
  webAppDescription:
    '一日を時計のように可視化し、オフラインでも動作する登録不要・無料のデイリープランナー。ドラッグでブロックを編集し、12/24時間表示を切り替え、画像として保存・共有できます。',
  faq: [
    { q: '24Houringとは何ですか？', a: '24Houringは、24時間の一日を時計のように一目で見せる無料のWebプランナーです。登録もインストールも不要でブラウザですぐに使え、データは端末内にのみ保存されるためオフラインでも動作します。' },
    { q: '24Houringは無料ですか？', a: 'はい。中核のプランナーは登録不要で完全に無料です。任意のPro（月0.99ドル、1か月無料体験、自動更新なし）でクラウド同期・無制限保存・統計レポート・広告非表示を追加できます。' },
    { q: '12時間（時計）表示に切り替えられますか？', a: 'はい。上部の切り替えで24時間 → 昼（06–18）→ 夜（18–06）を切り替えられ、どの表示も同じ一日と連動します。' },
    { q: '作った時間割を保存・共有できますか？', a: 'はい。PNG・PDF・JSONで書き出すか、共有ボタンで時間割の画像をInstagramなどにそのまま共有できます。全体のバックアップと復元にも対応しています。' },
    { q: '対応言語は？', a: '英語・韓国語・ドイツ語・日本語・中国語・フランス語・スペイン語・ロシア語の8言語に対応しています。' },
  ],
  howtoName: '24Houringで一日の時間割を作る',
  howtoDescription: '円形の24時間時間割に一日の予定を作る方法。',
  howto: [
    { name: '始める', text: 'プリセット（学生・会社員など）を選ぶか、空の一日から始めます。' },
    { name: 'ブロックを編集', text: '円をクリックして時間帯を分割し、名前・色・アイコンを設定して、境界をドラッグして時間を調整します。' },
    { name: '保存・共有', text: 'PNG・PDF・JSONで書き出すか、共有ボタンで画像を共有します。' },
  ],
  mainHtml: `      <main style="max-width:760px;margin:0 auto;padding:40px 20px;font-family:'Pretendard',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:#1f2430;line-height:1.65">
        <h1 style="font-size:30px;font-weight:800;letter-spacing:-0.5px;margin:0 0 8px">24Houring — 一日を一目で、円形24時間プランナー</h1>
        <p style="font-size:17px;color:#3a4150;margin:0 0 20px">
          24Houringは、24時間の一日を時計のように可視化する<strong>無料</strong>のWebプランナーです。
          登録もインストールも不要でブラウザですぐに使え、データは端末内にのみ保存されるので<strong>オフライン</strong>でも動作します。
        </p>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">主な機能</h2>
        <ul style="padding-left:20px;margin:0 0 8px">
          <li>円形の24時間時間割と12時間の時計表示（昼06–18 · 夜18–06）の切り替え — どの表示も同じ一日と連動</li>
          <li>ドラッグで時間を調整、ワンクリックで時間帯を分割・結合</li>
          <li>ライフスタイル・プリセットと複数日（マルチデイ）の時間割</li>
          <li>PNG・PDF・JSONの書き出し、全体のバックアップ・復元</li>
          <li>時間割を画像で共有（Instagram・KakaoTalkなど）</li>
          <li>8言語対応、オフライン動作、ホーム画面に追加可能</li>
        </ul>

        <p style="font-size:15px;color:#3a4150;margin:8px 0 0">
          長期休みの計画表、生活リズムのルーティン、円形時間割、一日のスケジュールなど幅広く使えます。
        </p>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">使い方</h2>
        <ol style="padding-left:20px;margin:0 0 8px">
          <li>プリセットを選ぶか、空の一日から始めます。</li>
          <li>円をクリックして時間帯を分割し、名前・色・アイコンを設定して、境界をドラッグして時間を調整します。</li>
          <li>PNG・PDF・JSONで書き出すか、共有ボタンで画像を共有します。</li>
        </ol>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">よくある質問</h2>
        <h3 style="font-size:16px;font-weight:700;margin:14px 0 2px">24Houringは無料ですか？</h3>
        <p style="margin:0 0 8px">はい — 中核のプランナーは登録不要で完全に無料です。任意のPro（月0.99ドル、1か月無料体験、自動更新なし）でクラウド同期・無制限保存・統計レポート・広告非表示を追加できます。</p>
        <h3 style="font-size:16px;font-weight:700;margin:14px 0 2px">12時間（時計）表示に切り替えられますか？</h3>
        <p style="margin:0 0 8px">はい — 上部の切り替えで24時間 → 昼（06–18）→ 夜（18–06）に切り替えられ、どの表示も同じ一日と連動します。</p>
        <h3 style="font-size:16px;font-weight:700;margin:14px 0 2px">作ったものを保存・共有できますか？</h3>
        <p style="margin:0 0 8px">はい — PNG・PDF・JSONで書き出すか、時間割の画像をInstagramなどにそのまま共有できます。</p>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">なぜ円形の時間割なのか</h2>
        <p style="margin:0 0 8px">一日は直線ではなく円のように巡ります。真夜中から真夜中へ続く時計の上に予定を置くと、リスト表示では見えにくい<strong>睡眠と起きている時間のバランス、空いている時間、重なり</strong>が一目で分かります。各時間帯の面積が、そのまま活動に使う時間の割合です。</p>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">こんな方に</h2>
        <ul style="padding-left:20px;margin:0 0 8px">
          <li>試験や長期休みに備える<strong>学生</strong>、子どもと一緒に計画を立てる保護者</li>
          <li>昼夜が入れ替わる<strong>シフト勤務者</strong>、自分で一日の区切りを引く<strong>フリーランス・在宅ワーカー</strong></li>
          <li>集中（ディープワーク）の時間を確保したい<strong>会社員</strong>、朝・夜のルーティンを整えたい方</li>
        </ul>

        <h2 style="font-size:20px;font-weight:700;margin:24px 0 8px">活用のヒント</h2>
        <p style="margin:0 0 8px">はじめてなら、状況別の<a href="/templates/">テンプレート</a>から始めて自分に合わせて調整するのが近道です。時間の分け方に迷ったら、タイムブロッキング・タイムオーディット・朝夜のルーティンの<a href="/guides/">ガイド</a>が手順を案内します。</p>

        <p style="margin:24px 0 0;font-size:15px;color:#7e8aa0">インタラクティブなプランナーを読み込み中… <strong>24houring.com</strong></p>

        <hr style="border:none;border-top:1px solid #e3e6ec;margin:28px 0 14px" />
        <nav style="font-size:14px;color:#7e8aa0">
          <a href="/about" style="color:#7e8aa0;margin-right:14px">概要 · About</a>
          <a href="/privacy" style="color:#7e8aa0;margin-right:14px">プライバシー · Privacy</a>
          <a href="/contact" style="color:#7e8aa0">お問い合わせ · Contact</a>
          <div style="margin-top:8px">© 2026 Circloser · <a href="mailto:singlena@gmail.com" style="color:#7e8aa0">singlena@gmail.com</a></div>
        </nav>
      </main>`,
};
