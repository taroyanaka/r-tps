window.RTPS_JA_TEXT = {
  ui: {
    playerStatus: 'プレイヤーステータス',
    block: 'ブロック:',
    deck: 'デッキ:',
    networkNode: 'ネットワークノード',
    energy: 'エナジー',
    drawPile: '山札:',
    discardPile: '捨て札:',
    helpTitle: 'ヘルプ / 操作説明',
    helpBasic: '基本操作',
    helpP: 'Pキー',
    helpMouseDrag: 'マウスドラッグ',
    helpLeftClick: '左クリック',
    helpCards: '1, 2, 3, 4キー',
    helpDescription: 'このゲームはサイバーパンク風のTPSデッキビルダーです。移動と視点変更を使い分けて、カードで敵を突破します。',
    startTitle: 'CYBER SPIRE',
    startSubtitle: 'Slay the Spire風 TPS デッキビルダー',
    startButton: 'ネットワークへ接続',
    helpButton: 'ヘルプ / 操作説明',
    paramTitle: 'param.txt 調整テスト',
    loading: '読み込み中...',
    loadingSector: 'セクターを読み込み中...',
    languageLabel: '言語',
    manual: '手動',
    auto: '自動',
    currentStage: 'ステージ',
    sector: 'セクター',
    campTitle: 'セーフハウス端末',
    rewardTitle: 'システム報酬',
    shopTitle: 'ブラックマーケット拠点',
    gameOverTitle: 'システム障害 (ゲームオーバー)',
    victoryTitle: 'コア侵害 (勝利)',
    cancel: 'キャンセル',
    skip: 'スキップ',
    return: 'ネットワークへ戻る',
    heal: 'HPを30%回復',
    upgrade: 'モジュール強化',
    continue: '続行'
  }
};

window.applyJapanesePatch = function(lang) {
  if (lang !== 'ja') return;
  const text = window.RTPS_JA_TEXT.ui;
  const mapping = [
    ['player-status-label', text.playerStatus],
    ['block-label', text.block],
    ['deck-label', text.deck],
    ['node-label', text.networkNode],
    ['energy-label', text.energy],
    ['draw-label', text.drawPile],
    ['discard-label', text.discardPile],
    ['help-modal-title', text.helpTitle],
    ['help-basic-title', text.helpBasic],
    ['help-p-label', text.helpP],
    ['help-mouse-drag-label', text.helpMouseDrag],
    ['help-left-click-label', text.helpLeftClick],
    ['help-cards-label', text.helpCards],
    ['help-description', text.helpDescription],
    ['curtain-text', text.loadingSector],
    ['language-label', text.languageLabel],
    ['start-title', text.startTitle],
    ['start-subtitle', text.startSubtitle],
    ['start-game-btn', text.startButton],
    ['help-btn', text.helpButton]
  ];
  mapping.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && value) el.textContent = value;
  });
};
