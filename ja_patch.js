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
    helpDescription: 'このゲームはサイバーパンク風のTPSデッキビルダーです。カードと視点操作を使って敵を突破します。',
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

const CARD_JA = {
  strike: { name: 'ストライク', text: 'シアンのレーザーを3連射し、それぞれ6ダメージを与える。', upgrade: { name: 'ストライク+', text: 'シアンのレーザーを3連射し、それぞれ10ダメージを与える。' } },
  shotgun: { name: 'ショットガンバースト', text: '近距離で8発の拡散射撃を放つ。至近距離で大ダメージ。', upgrade: { name: 'ショットガンバースト+', text: '低コスト。近距離で8発の拡散射撃を放つ。' } },
  defend: { name: '防御シールド', text: '+10ブロックを得る。プレイヤーの周囲に電磁ドームを展開する。', upgrade: { name: '防御シールド+', text: '+16ブロックを得る。' } },
  dodge: { name: '回避パルス', text: '向いている方向へ素早くダッシュする。0.5秒の無敵を得て、1枚引く。', upgrade: { name: '回避パルス+', text: 'コストなし。ダッシュして無敵になり、1枚引く。' } },
  poison: { name: '酸ガス', text: 'まっすぐ毒弾を放つ。命中時に腐食性の緑のガスドームを展開する。', upgrade: { name: '酸ガス+', text: 'より強力な毒攻撃。着弾地点をさらに強く腐食させる。' } },
  limit: { name: '限界突破', text: '戦闘終了まで全カードのダメージを+100%する。', upgrade: { name: '限界突破+', text: '低コスト。戦闘終了まで全カードのダメージを+100%する。' } },
  shrug_it_off: { name: 'やり過ごし', text: '+8ブロックを得る。1枚引く。', upgrade: { name: 'やり過ごし+', text: '+11ブロックを得る。1枚引く。' } },
  backflip: { name: 'バク転', text: '後方へダッシュし、+5ブロックを得て、2枚引く。', upgrade: { name: 'バク転+', text: '後方へダッシュし、+8ブロックを得て、2枚引く。' } },
  inflame: { name: '激昂', text: '戦闘終了まで全カードのダメージを+50%する。', upgrade: { name: '激昂+', text: '戦闘終了まで全カードのダメージを+100%する。' } },
  flex: { name: 'フレックス', text: '一時的なダメージ強化を得る。', upgrade: { name: 'フレックス+', text: 'より大きな一時ダメージ強化を得る。' } },
  adrenaline: { name: 'アドレナリン', text: '1エナジーを得て、2枚引く。', upgrade: { name: 'アドレナリン+', text: '2エナジーを得て、2枚引く。' } },
  turbo: { name: 'ターボ', text: '今すぐ2エナジーを得るが、一時的なデメリットがある。', upgrade: { name: 'ターボ+', text: '今すぐ3エナジーを得るが、一時的なデメリットがある。' } },
  prepared: { name: '準備完了', text: '2枚引く。', upgrade: { name: '準備完了+', text: '2枚引く。' } },
  sweeping_beam: { name: 'スイーピングビーム', text: '広範囲のビームを放ち、1枚引く。', upgrade: { name: 'スイーピングビーム+', text: 'より広いビームを放ち、1枚引く。' } },
  cleave: { name: 'なぎ払い', text: '前方の広い範囲を攻撃する。', upgrade: { name: 'なぎ払い+', text: 'より広い前方範囲を攻撃する。' } },
  whirlwind: { name: 'ワールウィンド', text: '周囲すべてを攻撃する。', upgrade: { name: 'ワールウィンド+', text: 'さらに激しく周囲を攻撃する。' } },
  immolate: { name: '焼き尽くす', text: '燃えさかる爆風を解き放つ。', upgrade: { name: '焼き尽くす+', text: 'さらに強力な燃えさかる爆風を解き放つ。' } },
  consecrate: { name: '聖別', text: '低コストの衝撃波を放つ。', upgrade: { name: '聖別+', text: 'より強力な低コスト衝撃波を放つ。' } },
  reaper: { name: '死神', text: '近くの敵にダメージを与え、命中ごとにHPを回復する。', upgrade: { name: '死神+', text: '近くの敵にダメージを与え、より多くHPを回復する。' } },
  flame_barrier: { name: '炎の障壁', text: 'シールドを得て、被弾時に反撃する。', upgrade: { name: '炎の障壁+', text: 'より多くのシールドを得て、被弾時に反撃する。' } },
  battle_trance: { name: '戦闘のトランス', text: '3枚引き、その後しばらくドローが封じられる。', upgrade: { name: '戦闘のトランス+', text: '3枚引き、その後しばらくドローが封じられる。' } },
  double_energy: { name: 'ダブルエナジー', text: '次のサイクルに持ち越すボーナスエナジーを2得る。', upgrade: { name: 'ダブルエナジー+', text: '次のサイクルに持ち越すボーナスエナジーを3得る。' } },
  rage: { name: '激怒', text: 'しばらくの間、攻撃を当てるとシールドを得る。', upgrade: { name: '激怒+', text: 'より多くのシールドを得る。' } },
  spot_weakness: { name: '弱点発見', text: '敵が攻撃中なら、一時的なダメージ強化を得る。', upgrade: { name: '弱点発見+', text: 'さらに大きな一時ダメージ強化を得る。' } },
  wound: { name: '傷', text: '役に立たないノイズカード。' },
  dazed: { name: 'ディズド', text: '自動で消滅する。' },
  burn: { name: '炎上', text: '引いたときにダメージを受ける。' },
  slimed: { name: 'スライム', text: '1エナジーを消費して何もしない。' },
  void: { name: '虚無', text: '引いたときに1エナジー失う。' },
  ascenders_bane: { name: 'アセンダーの災い', text: '自動で消滅する。' },
  curse_of_the_bell: { name: '鐘の呪い', text: 'ただの厄介者。' },
  injury: { name: '負傷', text: 'ただの厄介者。' },
  clumsy: { name: '不器用', text: '自動で消滅する。' },
  decay: { name: '腐敗', text: '引いたときにダメージを受ける。' },
  writhe: { name: 'うねり', text: '開幕手札を圧迫する空振りカード。' },
  corruption: { name: 'コラプション', text: '少量のエナジーで浄化できる汚染カード。' },
  overclock: { name: 'オーバークロック', text: '短時間、エナジー回復速度を上げる。', upgrade: { name: 'オーバークロック+', text: 'より強く短時間、エナジー回復速度を上げる。' } }
};

function localizeCards() {
  if (!window.CARDS) return;
  Object.entries(CARD_JA).forEach(([id, ja]) => {
    const card = window.CARDS[id];
    if (!card) return;
    card.name = ja.name || card.name;
    if (ja.text) card.text = ja.text;
    if (ja.upgrade && card.upgrade) {
      card.upgrade.name = ja.upgrade.name || card.upgrade.name;
      if (ja.upgrade.text) card.upgrade.text = ja.upgrade.text;
    }
  });
  const overclock = window.CARDS.overclock;
  if (overclock && overclock.upgrade) {
    overclock.upgrade.name = 'オーバークロック+';
    overclock.upgrade.text = 'より強く短時間、エナジー回復速度を上げる。';
  }
}

window.applyJapanesePatch = function(lang) {
  if (lang !== 'ja') return;
  const text = window.RTPS_JA_TEXT.ui;
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
