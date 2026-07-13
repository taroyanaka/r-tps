function getJapaneseUIText() {
  const fallback = {
    playerStatus: 'プレイヤーステータス',
    block: 'ブロック:',
    deck: 'デッキ:',
    networkNode: 'ネットワークノード',
    energy: 'エナジー',
    drawPile: 'ドローパイル:',
    discardPile: '捨て札:',
    helpTitle: 'ヘルプ / マニュアル',
    helpBasic: '基本操作',
    helpP: 'Pキー',
    helpMouseDrag: 'マウスドラッグ',
    helpLeftClick: '左クリック',
    helpCards: '1, 2, 3, 4キー',
    helpDescription: 'このゲームはサイバーパンク風のデッキビルダーTPSです。サイドステップ、ダッシュ、強力なカードスキルを使ってウイルス防衛を突破します。',
    startTitle: 'CYBER SPIRE',
    startSubtitle: 'Slay the Spire風 TPS デッキビルダー',
    startButton: 'ネットワークへ接続',
    helpButton: 'ヘルプ / マニュアル',
    paramTitle: 'param.txt 設定テスト',
    loading: '読み込み中...',
    loadingSector: 'セクターを読み込み中...',
    languageLabel: '言語',
    manual: 'マニュアル',
    auto: '自動',
    currentStage: 'ステージ',
    sector: 'セクター',
    campTitle: 'セーフハウス端末',
    rewardTitle: 'システム報酬',
    shopTitle: 'ブラックマーケット拠点',
    gameOverTitle: 'システム異常 (ゲームオーバー)',
    victoryTitle: 'コア侵入 (勝利)',
    cancel: 'キャンセル',
    skip: 'スキップ',
    return: 'ネットワークへ戻る',
    heal: 'HPを30%回復',
    upgrade: 'モジュール強化',
    continue: '続行'
  };

  const fromTextJson = window.RTPS_TEXT_DATA && window.RTPS_TEXT_DATA.ja && window.RTPS_TEXT_DATA.ja.ui;
  return fromTextJson ? { ...fallback, ...fromTextJson } : fallback;
}

function localizeCards() {
  if (!window.CARDS) return;
  const cardData = window.RTPS_TEXT_DATA && window.RTPS_TEXT_DATA.ja && window.RTPS_TEXT_DATA.ja.cards;
  if (!cardData) return;

  Object.entries(cardData).forEach(([id, ja]) => {
    const card = window.CARDS[id];
    if (!card) return;
    if (ja.name) card.name = ja.name;
    if (ja.text) card.text = ja.text;
    if (ja.upgrade && card.upgrade) {
      if (ja.upgrade.name) card.upgrade.name = ja.upgrade.name;
      if (ja.upgrade.text) card.upgrade.text = ja.upgrade.text;
    }
  });

  if (window.refreshLocalizedCardInstances) {
    window.refreshLocalizedCardInstances();
  }
}

window.applyJapanesePatch = function(lang) {
  if (lang !== 'ja') return;

  const text = getJapaneseUIText();
  const ids = {
    'player-status-label': text.playerStatus,
    'block-label': text.block,
    'deck-label': text.deck,
    'node-label': text.networkNode,
    'energy-label': text.energy,
    'draw-label': text.drawPile,
    'discard-label': text.discardPile,
    'help-modal-title': text.helpTitle,
    'help-basic-title': text.helpBasic,
    'help-p-label': text.helpP,
    'help-mouse-drag-label': text.helpMouseDrag,
    'help-left-click-label': text.helpLeftClick,
    'help-cards-label': text.helpCards,
    'help-description': text.helpDescription,
    'curtain-text': text.loadingSector,
    'language-label': text.languageLabel,
    'start-title': text.startTitle,
    'start-subtitle': text.startSubtitle,
    'start-game-btn': text.startButton,
    'help-btn': text.helpButton
  };

  Object.entries(ids).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  if (window.CARDS) localizeCards();
  if (window.updateBattleStatsUI) window.updateBattleStatsUI();
  if (window.renderHandUI) window.renderHandUI();
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  window.applyJapanesePatch('ja');
} else {
  window.addEventListener('DOMContentLoaded', () => window.applyJapanesePatch('ja'));
}
