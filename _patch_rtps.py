from pathlib import Path
import json


root = Path(__file__).resolve().parent


def replace_lines(path: Path, start_line: int, end_line: int, new_block: str) -> None:
    lines = path.read_text(encoding="utf-8").splitlines()
    lines[start_line - 1:end_line] = new_block.splitlines()
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def replace_first(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        return
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


game_path = root / "game.js"
replace_lines(
    game_path,
    32,
    50,
    """        const LANG_STORAGE_KEY = 'cyber_spire_language';
        const LANGUAGE_TEXT = {
            en: {
                startTitle: 'CYBER SPIRE',
                startSubtitle: 'TPS Deckbuilder inspired by Slay the Spire',
                startButton: 'Connect to the Network',
                helpButton: 'Help / Manual',
                languageLabel: 'Language'
            },
            ja: {
                startTitle: 'CYBER SPIRE',
                startSubtitle: 'Slay the Spire風 TPS デッキビルダー',
                startButton: 'ネットワークへ接続',
                helpButton: 'ヘルプ / 操作説明',
                languageLabel: '言語'
            }
        };
        let currentLanguage = localStorage.getItem(LANG_STORAGE_KEY) || 'ja';
        if (!LANGUAGE_TEXT[currentLanguage]) currentLanguage = 'ja';""",
)
replace_first(
    game_path,
    """        function setLanguage(lang) {
            if (!LANGUAGE_TEXT[lang]) return;
            currentLanguage = lang;
            localStorage.setItem(LANG_STORAGE_KEY, lang);
            document.documentElement.lang = lang;
            updateStartScreenLanguage();
        }""",
    """        function setLanguage(lang) {
            if (!LANGUAGE_TEXT[lang]) return;
            currentLanguage = lang;
            localStorage.setItem(LANG_STORAGE_KEY, lang);
            document.documentElement.lang = lang;
            updateStartScreenLanguage();
            if (window.applyJapanesePatch) window.applyJapanesePatch(lang);
        }""",
)
replace_first(
    game_path,
    """                    corruption: { id: 'corruption', name: 'Corruption', cost: 1, type: 'curse', text: 'A contaminated card that clogs your hand.', colorClass: 'border-violet-500 text-violet-400 bg-violet-950/20', rarity: 'common', poolType: [], effect: { kind: 'status_playable_junk' } }""",
    """                    corruption: { id: 'corruption', name: 'Corruption', cost: 1, type: 'curse', text: 'A contaminated card that can be purified for a small amount of energy.', colorClass: 'border-violet-500 text-violet-400 bg-violet-950/20', rarity: 'common', poolType: [], effect: { kind: 'status_corruption_cleanse' } }""",
)
replace_first(
    game_path,
    """            const putInHand = preferHand && battleState.hand.length < 4;
            if (putInHand) {
                battleState.hand.push(card);
                handleDrawnCard(card);
            } else {
                battleState.drawPile.push(card);
                shuffleArray(battleState.drawPile);
            }

            updateBattleStatsUI();
            renderHandUI();
            console.log(`[DEBUG-ENEMY-SPECIAL] Added corruption card: ${card.name} (${putInHand ? 'hand' : 'draw pile'})`);
            return true;""",
    """            const putInHand = battleState.hand.length < 4;
            if (putInHand) {
                battleState.hand.push(card);
                handleDrawnCard(card);
            } else if (battleState.hand.length > 0) {
                const discardIndex = Math.floor(Math.random() * battleState.hand.length);
                const discarded = battleState.hand.splice(discardIndex, 1)[0];
                battleState.discardPile.push(discarded);
                battleState.hand.push(card);
                handleDrawnCard(card);
                showToast(`${discarded.name} was pushed into the discard pile.`);
            } else {
                battleState.drawPile.push(card);
                shuffleArray(battleState.drawPile);
            }

            updateBattleStatsUI();
            renderHandUI();
            console.log(`[DEBUG-ENEMY-SPECIAL] Added corruption card: ${card.name} (${putInHand ? 'hand' : 'draw pile'})`);
            return true;""",
)
replace_first(
    game_path,
    """                case 'status_blank':
                case 'status_exhaust':
                case 'status_end_damage':
                case 'status_playable_junk':
                case 'status_energy_loss':
                case 'curse_start_hand':
                    return true;""",
    """                case 'status_blank':
                case 'status_exhaust':
                case 'status_end_damage':
                case 'status_playable_junk':
                case 'status_corruption_cleanse':
                    if (card.id === 'corruption') {
                        const handIndex = battleState.hand.indexOf(card);
                        if (handIndex >= 0) {
                            battleState.hand.splice(handIndex, 1);
                        }
                        const cleanseCost = Math.max(1, Math.ceil(player.maxEnergy * 0.34));
                        const actualCost = Math.min(cleanseCost, player.energy);
                        player.energy = Math.max(0, player.energy - actualCost);
                        const deckIndex = player.deck.indexOf(card);
                        if (deckIndex >= 0) {
                            player.deck.splice(deckIndex, 1);
                        }
                        showToast(`Corruption purified. Energy -${actualCost}.`);
                        updateBattleStatsUI();
                        renderHandUI();
                        return true;
                    }
                case 'status_energy_loss':
                case 'curse_start_hand':
                    return true;""",
)
replace_first(
    game_path,
    "const geom = new THREE.SphereGeometry(1.6, 16, 16);",
    "const geom = new THREE.SphereGeometry(0.8, 16, 16);",
)
replace_first(
    game_path,
    """            window.addEventListener('mousemove', (e) => {
                if (gameState === 'battle' && !isAutoMode) {
                    if (isMouseDown) {
                        cameraTargetYaw -= e.movementX * 0.003;
                        cameraTargetPitch = Math.max(-0.4, Math.min(0.8, cameraTargetPitch - e.movementY * 0.003));
                    }
                }
            });""",
    """            window.addEventListener('mousemove', (e) => {
                if (gameState === 'battle' && !isAutoMode) {
                    if (isMouseDown) {
                        cameraTargetYaw -= e.movementX * 0.003;
                    }
                }
            });""",
)
replace_first(
    game_path,
    """            const camDist = 7.5;
            const targetCamX = playerMesh.position.x - Math.sin(cameraTargetYaw) * camDist;
            const targetCamZ = playerMesh.position.z - Math.cos(cameraTargetYaw) * camDist;
            const targetCamY = playerMesh.position.y + 3.0 + cameraTargetPitch * camDist;

            camera.position.set(targetCamX, targetCamY, targetCamZ);
            const lookTarget = new THREE.Vector3().copy(playerMesh.position).add(
                new THREE.Vector3(Math.sin(cameraTargetYaw) * 3, 0.5, Math.cos(cameraTargetYaw) * 3)
            );
            camera.lookAt(lookTarget);

            if (!isAutoMode) {
                playerMesh.rotation.y = playerMesh.userData.facingAngle;
            } else {
                playerMesh.rotation.y = cameraTargetYaw; // Face the aim direction while moving in auto mode
            }""",
    """            if (keys['arrowup']) {
                cameraTargetPitch = Math.min(0.8, cameraTargetPitch + 0.02);
            }
            if (keys['arrowdown']) {
                cameraTargetPitch = Math.max(-0.4, cameraTargetPitch - 0.02);
            }

            const camDist = 7.5;
            const targetCamX = playerMesh.position.x - Math.sin(cameraTargetYaw) * camDist;
            const targetCamZ = playerMesh.position.z - Math.cos(cameraTargetYaw) * camDist;
            const targetCamY = playerMesh.position.y + 3.0 + cameraTargetPitch * camDist;

            camera.position.set(targetCamX, targetCamY, targetCamZ);
            const lookTarget = new THREE.Vector3().copy(playerMesh.position).add(
                new THREE.Vector3(Math.sin(cameraTargetYaw) * 3, 0.5, Math.cos(cameraTargetYaw) * 3)
            );
            camera.lookAt(lookTarget);

            if (!isAutoMode) {
                playerMesh.rotation.y = playerMesh.userData.facingAngle;
            } else {
                playerMesh.rotation.y = cameraTargetYaw; // Face the aim direction while moving in auto mode
            }""",
)

data_path = root / "data.js"
replace_first(
    data_path,
    '"specialCardId":"corruption","specialChance":0.35,"specialLabel":"Inject Corruption"',
    '"specialCardId":"corruption","specialChance":0.0,"specialLabel":null',
)
replace_first(data_path, '"baseHp":40', '"baseHp":20')
replace_first(data_path, '"amountBase":10,"amountUpgraded":16', '"amountBase":5,"amountUpgraded":8')

index_path = root / "index.html"
index = index_path.read_text(encoding="utf-8")
if 'ja_patch.js' not in index:
    index = index.replace('<script src="game.js">', '<script src="ja_patch.js"></script>\n  <script src="game.js">')
    index_path.write_text(index, encoding="utf-8")

ja_patch_path = root / "ja_patch.js"
ja_patch_path.write_text("""window.RTPS_JA_TEXT = {
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
""", encoding="utf-8")
