// --- Parameter system ---
        // Read the parameter name from the URL query string
        const _urlParams = new URLSearchParams(window.location.search);
        const _paramName = _urlParams.get('param') || null;
        const _autoStart = _urlParams.get('mode') === 'auto';

        // Default values synced with the first regulation row.
        const PARAMS = {
            paramName: 'default',
            playerHp: 80,
            playerMaxHp: 80,
            playerEnergy: 10.0,
            playerMaxEnergy: 10,
            playerGold: 99,
            energyRecoveryPerFrame: 0.006,
            energyRecoveryOnHit: 0.15,
            autoModeSpeedMult: 10,
            enemyCountMult: 1.0,
            enemyHpMult: 1.0,
            enemyDamageMult: 1.0
        };

        let CARD_DATA = null;
        let CARDS = {};
        let UPGRADES = {};
        let INITIAL_DECK = [];
        let REWARD_POOL = [];
        let SHOP_POOL = [];
        let ENEMY_DEFS = null;
        const RARITY_WEIGHTS = { common: 60, uncommon: 30, rare: 10 };

        async function loadParams() {
            if (!_paramName) {
                return;
            }

            try {
                const configs = Array.isArray(window.RTPS_PARAM_LIST) ? window.RTPS_PARAM_LIST : [];
                const config = configs.find(c => c.paramName === _paramName);
                if (config) {
                    for (const key in config) {
                        if (PARAMS.hasOwnProperty(key)) {
                            const raw = config[key];
                            PARAMS[key] = isNaN(raw) ? raw : Number(raw);
                        }
                    }
                    console.log(`[PARAM] Applied regulation set: ${_paramName}`);
                } else {
                    console.log(`[PARAM] Settings not found: ${_paramName}`);
                }
            } catch(e) {
                console.log(`[PARAM] Parameter load error: ${e}`);
            }
        }

        function cloneCardDefinition(cardId, upgraded = false) {
            const base = CARDS[cardId];
            if (!base) return null;

            const card = { ...base, upgraded };
            if (upgraded) {
                const upgrade = base.upgrade || UPGRADES[cardId];
                if (upgrade) {
                    card.name = upgrade.name ?? card.name;
                    if (upgrade.cost !== undefined) card.cost = upgrade.cost;
                    card.text = upgrade.text ?? card.text;
                }
            }
            return card;
        }

        function refreshLocalizedCardInstances() {
            const refreshCard = (card) => {
                if (!card || !card.id) return card;
                const localized = cloneCardDefinition(card.id, !!card.upgraded);
                if (!localized) return card;
                Object.assign(card, localized);
                return card;
            };

            player.deck = player.deck.map(refreshCard);
            battleState.drawPile = battleState.drawPile.map(refreshCard);
            battleState.hand = battleState.hand.map(refreshCard);
            battleState.discardPile = battleState.discardPile.map(refreshCard);
        }

        window.refreshLocalizedCardInstances = refreshLocalizedCardInstances;

        function buildInitialDeck() {
            const fixedDeck = [
                { id: 'strike', upgraded: false },
                { id: 'strike', upgraded: false },
                { id: 'strike', upgraded: false },
                { id: 'strike', upgraded: false }
            ];
            const excluded = new Set(['strike']);
            const pool = Object.keys(CARDS).filter(cardId => {
                const card = CARDS[cardId];
                return card && card.type !== 'curse' && card.type !== 'defense' && !excluded.has(cardId);
            });
            const randomAdds = [];
            while (randomAdds.length < 4 && pool.length > 0) {
                const cardId = pool[Math.floor(Math.random() * pool.length)];
                randomAdds.push({ id: cardId, upgraded: false });
            }
            return fixedDeck.concat(randomAdds);
        }

        function getPoolForType(poolType) {
            return Object.keys(CARDS).filter(cardId => {
                const poolTypes = Array.isArray(CARDS[cardId].poolType) ? CARDS[cardId].poolType : [];
                return poolTypes.includes(poolType);
            });
        }

        function pickWeightedCardId(poolType) {
            const pool = getPoolForType(poolType);
            if (pool.length === 0) return null;

            const weighted = [];
            pool.forEach(cardId => {
                const rarity = CARDS[cardId].rarity || 'common';
                const weight = RARITY_WEIGHTS[rarity] || RARITY_WEIGHTS.common;
                for (let i = 0; i < weight; i++) weighted.push(cardId);
            });

            return weighted[Math.floor(Math.random() * weighted.length)];
        }

        function pickRandomCardFromPool(poolType, upgradedChance = 0) {
            const cardId = pickWeightedCardId(poolType);
            if (!cardId) return null;
            return cloneCardDefinition(cardId, Math.random() < upgradedChance);
        }

        function buildCardTemplate(cardId = 'new_card') {
            return {
                id: cardId,
                name: 'New Card',
                cost: 1,
                type: 'attack',
                text: 'Describe the card effect here.',
                colorClass: 'border-cyan-500 text-cyan-400 bg-cyan-950/20',
                rarity: 'common',
                poolType: ['reward'],
                effect: {
                    kind: 'custom_effect_kind'
                },
                upgrade: {
                    name: 'New Card+',
                    cost: 1,
                    text: 'Describe the upgraded effect here.'
                }
            };
        }

        window.getCardTemplate = buildCardTemplate;

        async function loadCardData() {
            try {
                CARD_DATA = window.RTPS_CARD_DATA || null;
                if (!CARD_DATA) throw new Error('RTPS_CARD_DATA is missing');
                ENEMY_DEFS = window.RTPS_ENEMY_DEFS || {};
                if (!ENEMY_DEFS.glitch) throw new Error('RTPS_ENEMY_DEFS is missing');
                if (!ENEMY_DEFS.scout) {
                    ENEMY_DEFS.scout = {
                        id: 'scout',
                        name: 'Scout Drone',
                        type: 'scout',
                        geometry: { kind: 'octahedron', size: 0.55 },
                        color: 0x7dd3fc,
                        baseHp: 8,
                        speed: 0.09,
                        radius: 0.75,
                        specialCardId: null,
                        specialChance: 0,
                        specialLabel: null
                    };
                }

                CARDS = CARD_DATA.cards || {};
                UPGRADES = {};
                for (const [cardId, card] of Object.entries(CARDS)) {
                    if (card.upgrade) {
                        UPGRADES[cardId] = card.upgrade;
                    }
                }
                if (!CARDS.overclock) {
                    CARDS.overclock = {
                        id: 'overclock',
                        name: 'Overclock',
                        cost: 1,
                        type: 'skill',
                        text: 'Increase energy recovery for a short time.',
                        colorClass: 'border-indigo-500 text-indigo-400 bg-indigo-950/20',
                        rarity: 'uncommon',
                        poolType: ['reward', 'shop'],
                        effect: { kind: 'energy_recovery_boost', recoveryBonus: 0.01, durationFrames: 180, toast: 'Energy recovery boosted!' },
                        upgrade: { name: 'Overclock+', cost: 0, text: 'Increase energy recovery more for a short time.' }
                    };
                    UPGRADES.overclock = CARDS.overclock.upgrade;
                }
                if (!REWARD_POOL.includes('overclock')) REWARD_POOL.push('overclock');
                if (!SHOP_POOL.includes('overclock')) SHOP_POOL.push('overclock');
                REWARD_POOL = Array.isArray(CARD_DATA.rewardPool) && CARD_DATA.rewardPool.length > 0
                    ? CARD_DATA.rewardPool
                    : getPoolForType('reward');
                SHOP_POOL = Array.isArray(CARD_DATA.shopPool) && CARD_DATA.shopPool.length > 0
                    ? CARD_DATA.shopPool
                    : getPoolForType('shop');
                    console.log('[CARD] Card data loaded');
            } catch (e) {
                console.log(`[CARD] Card data load error: ${e}`);
                CARDS = {
                    strike: { id: 'strike', name: 'Strike', cost: 1, type: 'attack', text: 'Fire a cyan laser 3 times for 6 damage each.', colorClass: 'border-cyan-500 text-cyan-400 bg-cyan-950/20' },
                    shotgun: { id: 'shotgun', name: 'Shotgun Burst', cost: 2, type: 'attack', text: 'Fire 8 spread shots at close range. Devastating damage up close.', colorClass: 'border-pink-500 text-pink-400 bg-pink-950/20' },
                    defend: { id: 'defend', name: 'Defense Shield', cost: 1, type: 'defense', text: 'Gain +10 block. Deploy an electromagnetic dome around the player.', colorClass: 'border-blue-500 text-blue-400 bg-blue-950/20' },
                    limit: { id: 'limit', name: 'Limit Break', cost: 3, type: 'power', text: 'Increase all card damage by +100% until the end of battle.', colorClass: 'border-amber-500 text-amber-400 bg-amber-950/20' },
                    overclock: { id: 'overclock', name: 'Overclock', cost: 1, type: 'skill', text: 'Increase energy recovery for a short time.', colorClass: 'border-indigo-500 text-indigo-400 bg-indigo-950/20', rarity: 'uncommon', poolType: ['reward', 'shop'], effect: { kind: 'energy_recovery_boost', recoveryBonus: 0.01, durationFrames: 180, toast: 'Energy recovery boosted!' }, upgrade: { name: 'Overclock+', cost: 0, text: 'Increase energy recovery more for a short time.' } },
                    corruption: { id: 'corruption', name: 'Corruption', cost: 1, type: 'curse', text: 'A contaminated card that can be purified for a small amount of energy.', colorClass: 'border-violet-500 text-violet-400 bg-violet-950/20', rarity: 'common', poolType: [], effect: { kind: 'status_corruption_cleanse' } }
                };
                UPGRADES = {
                    strike: { name: 'Strike+', text: 'Fire a cyan laser 3 times for 10 damage each.' },
                    shotgun: { name: 'Shotgun Burst+', cost: 1, text: 'Low cost. Fire 8 spread shots at close range.' },
                    defend: { name: 'Defense Shield+', text: 'Gain +16 block.' },
                    limit: { name: 'Limit Break+', cost: 2, text: 'Low cost. Increase all card damage by +100%.' }
                };
                REWARD_POOL = getPoolForType('reward');
                SHOP_POOL = getPoolForType('shop');
            }
        }

        
// --- Game state variables ---
        let gameState = 'start'; // start, map, battle, reward, camp, shop, gameover, victory, battle_end
        let currentStage = 1; 
        const totalStages = 8;
        let selectedNode = null;
        let isAutoMode = false; // Auto mode flag
        let autoProgressToken = 0; // Invalidates delayed auto-actions after a panel transition

        function debugState(prefix, extra = '') {
            const battleInfo = ` hand=${battleState.hand.length} draw=${battleState.drawPile.length} discard=${battleState.discardPile.length} enemies=${battleState.enemies.length}`;
            const playerInfo = ` hp=${player.hp.toFixed(1)}/${player.maxHp} energy=${player.energy.toFixed(1)}/${player.maxEnergy} shield=${player.shield.toFixed(1)} gold=${player.gold}`;
            console.log(`${prefix} state=${gameState} stage=${currentStage}/${totalStages} auto=${isAutoMode ? 'on' : 'off'}${playerInfo}${battleInfo}${extra ? ` ${extra}` : ''}`);
        }

        // Playwright / external runner can poll this to detect completion.
        window.__runState = 'idle'; // idle, running, victory, gameover
        window.__runResult = null;   // victory or gameover

        // Player data
        const player = {
            hp: 80,
            maxHp: 80,
            shield: 0,
            energy: 10.0,
            maxEnergy: 10,
            gold: 99,
            deck: [], 
            damageMult: 1.0 
        };

        // Temporary battle state
        const battleState = {
            drawPile: [],
            hand: [],
            discardPile: [],
            enemies: [],
            projectiles: [],
            particles: [],
            limitBreakCount: 0,
            tempDamageBuffs: [],
            drawLockFrames: 0,
            pendingEnergyBonus: 0,
            energyRegenBuffs: [],
            pendingRetaliation: null,
            onHitShieldGain: null,
            shieldTimer: 0,
            invulnTimer: 0 
        };

        
// --- 3D graphics state (Three.js) ---
        let scene, camera, renderer;
        let playerMesh;
        let terrainGrid;
        let ambientLight, dirLight;
        const keys = {}; 

        // View controls
        let mouseX = 0, mouseY = 0;
        let cameraTargetPitch = 0.8; 
        let cameraTargetYaw = 0;   
        let isMouseDown = false;   
        let isFiring = false; 
        let normalShootCooldown = 0; 
        let warningLineMesh = null; // Enemy warning line

        
// --- Startup initialization ---
        document.addEventListener('DOMContentLoaded', async () => {
            await loadParams();
            await loadCardData();

            // Apply PARAMS to the player defaults
            player.hp = PARAMS.playerHp;
            player.maxHp = PARAMS.playerMaxHp;
            player.energy = PARAMS.playerEnergy;
            player.maxEnergy = PARAMS.playerMaxEnergy;
            player.gold = PARAMS.playerGold;

            // Auto-start flag
            if (_autoStart) {
                isAutoMode = true;
            }

            initThree();
            setupInitialDeck();

            if (_autoStart) {
                startGame();
            } else {
                showPanel('start');
            }

            // Keyboard handlers
            window.addEventListener('keydown', (e) => {
                keys[e.key.toLowerCase()] = true;
                
                // Toggle manual / auto mode with the P key
                if (e.key.toLowerCase() === 'p') {
                    toggleAutoMode();
                }

                if (gameState === 'battle') {
                    const key = e.key.toLowerCase();
                    if (key === 'i') useCardIndex(0);
                    if (key === 'k') useCardIndex(1);
                    if (key === 'r') {
                        if (typeof window.redrawHand === 'function') window.redrawHand();
                    }
                    if (key === 'j' || key === 'l' || key === 'i' || key === 'k' || key === 'r') {
                        e.preventDefault();
                    }
                }
            });
            window.addEventListener('keyup', (e) => {
                keys[e.key.toLowerCase()] = false;
            });

            // Mouse controls
            window.addEventListener('mousedown', (e) => {
                if (gameState === 'battle') {
                    if (!e.target.closest || !e.target.closest('#hand-cards')) {
                        if (e.button === 0) {
                            if (typeof window.useCardIndex === 'function') window.useCardIndex(0);
                        } else if (e.button === 2) {
                            if (typeof window.useCardIndex === 'function') window.useCardIndex(1);
                        }
                    }
                }
                isMouseDown = true;
            });
            window.addEventListener('contextmenu', (e) => {
                if (gameState === 'battle') {
                    if (!e.target.closest || !e.target.closest('#hand-cards')) {
                        e.preventDefault();
                    }
                }
            });

            window.addEventListener('mouseup', (e) => {
                isMouseDown = false;
            });

            window.addEventListener('mousemove', (e) => {
                if (gameState === 'battle' && !isAutoMode) {
                    cameraTargetYaw -= e.movementX * 0.003;
                }
            });

            // Start the main loop
            requestAnimationFrame(gameLoop);
        });

        
// --- Auto mode toggle ---
        function toggleAutoMode() {
            isAutoMode = !isAutoMode;
            console.log(`[DEBUG-MODE] Mode switch: ${isAutoMode ? "AUTO (automated battle)" : "MANUAL (manual control)"}`);
            debugState('[DEBUG-MODE-STATE]');
            showToast(isAutoMode ? "Auto battle enabled: enemy HP reduced to 1/10." : "Manual battle enabled: enemy HP restored to normal.");

            // In battle, scale enemy HP dynamically.
            if (gameState === 'battle' && battleState.enemies) {
                battleState.enemies.forEach(enemy => {
            if (isAutoMode) {
                // Reduce HP to 1/10
                enemy.userData.hp = Math.max(1, enemy.userData.hp / 10);
                enemy.userData.maxHp = Math.max(1, enemy.userData.maxHp / 10);
                console.log(`[DEBUG-AI] Enemy weakened (HP 1/10): ${enemy.userData.name} (HP: ${enemy.userData.hp.toFixed(1)}/${enemy.userData.maxHp.toFixed(1)})`);
                debugState('[DEBUG-AI-STATE]', `enemy=${enemy.userData.name} mode=weaken`);
            } else {
                // Restore HP by 10x
                enemy.userData.hp *= 10;
                enemy.userData.maxHp *= 10;
                console.log(`[DEBUG-AI] Enemy HP restored (10x): ${enemy.userData.name} (HP: ${enemy.userData.hp.toFixed(1)}/${enemy.userData.maxHp.toFixed(1)})`);
                debugState('[DEBUG-AI-STATE]', `enemy=${enemy.userData.name} mode=restore`);
            }
                    updateEnemyIntentUI(enemy);
                });
            }

            updateModeIndicator();
        }

        // Update the mode indicator visuals
        function updateModeIndicator() {
            const indicator = document.getElementById('mode-indicator');
            if (indicator) {
                if (isAutoMode) {
                    indicator.textContent = "AUTO MODE (P)";
                    indicator.className = "text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono mt-1.5 inline-block animate-pulse font-bold";
                } else {
                    indicator.textContent = "MANUAL MODE (P)";
                    indicator.className = "text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono mt-1.5 inline-block";
                }
            }
        }

        
