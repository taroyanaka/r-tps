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
            if (PARAMS && PARAMS.paramName === 'test_all_cards') {
                return Object.keys(CARDS).filter(id => id !== 'templates' && CARDS[id].type).map(id => ({id, upgraded: false}));
            }
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
            onHpLossBuffs: [],
            nextCardPlayedTwice: false,
            pendingRetaliation: null,
            onHitShieldGain: null,
            shieldTimer: 0,
            invulnTimer: 0,
            hazardZones: [] 
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

        // --- Initial deck setup ---
        function setupInitialDeck() {
            player.deck = buildInitialDeck().map(card => cloneCardDefinition(card.id, card.upgraded));
            updateTopBarUI();
        }

        function getCurrentDamageMultiplier() {
            const tempBuff = battleState.tempDamageBuffs.reduce((sum, buff) => sum + (buff.amount || 0), 0);
            return player.damageMult + tempBuff;
        }

        function addTempDamageBuff(amount, durationFrames, source = 'temp') {
            if (!amount) return;
            battleState.tempDamageBuffs.push({
                amount,
                source,
                life: Math.max(1, durationFrames || 180)
            });
            spawnBuffVFX();
        }

        function addEnergyBonus(amount) {
            if (!amount) return;
            battleState.pendingEnergyBonus = (battleState.pendingEnergyBonus || 0) + amount;
        }

        function cloneCardById(cardId) {
            if (!cardId || !CARDS[cardId]) return null;
            return cloneCardDefinition(cardId, false);
        }

        function insertEnemyCardToPlayer(cardId, preferHand = true) {
            const card = cloneCardById(cardId);
            if (!card) return false;

            const putInHand = battleState.hand.length < 2;
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
            return true;
        }

        function getEnemyDef(enemyType) {
            return ENEMY_DEFS[enemyType] || ENEMY_DEFS.glitch;
        }

        function handleDrawnCard(card) {
            if (!card || !card.effect) return;
            const kind = card.effect.kind;
            if (kind === 'status_exhaust' || kind === 'status_energy_loss' || kind === 'status_end_damage') {
                const idx = battleState.hand.indexOf(card);
                if (idx >= 0) {
                    battleState.hand.splice(idx, 1);
                }
                if (kind === 'status_end_damage') {
                    const dmg = card.effect.amountBase || 2;
                    if (damagePlayer(dmg)) return;
                } else if (kind === 'status_energy_loss') {
                    player.energy = Math.max(0, player.energy - (card.effect.amountBase || 1));
                    updateBattleStatsUI();
                }
                battleState.discardPile.push(card);
            }
        }

        function isStatusCard(card) {
            return !!card && !!card.effect && String(card.effect.kind || '').startsWith('status_');
        }

        function getAttackGraphicInfo(card) {
            const kind = card && card.effect && card.effect.kind ? String(card.effect.kind) : '';
            if (!kind.startsWith('aoe_')) return null;

            const labels = {
                aoe_front: 'FRONT ARC',
                aoe_radial: 'RADIUS',
                aoe_burst_burn: 'BURST',
                aoe_low_cost: 'WAVE',
                aoe_drain: 'DRAIN'
            };

            return {
                label: labels[kind] || 'AOE',
                kind,
                radius: card.effect.radius || 5,
                colorHex: card.effect.colorHex || 0xec4899
            };
        }

        // --- 3D setup ---
        function initThree() {
            const container = document.getElementById('game-canvas');
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x030308, 0.02);

            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            
            renderer = new THREE.WebGLRenderer({ canvas: container, antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

            // Lighting
            ambientLight = new THREE.AmbientLight(0x0f0a20, 1.5);
            scene.add(ambientLight);

            dirLight = new THREE.DirectionalLight(0xec4899, 1.0);
            dirLight.position.set(20, 40, 20);
            scene.add(dirLight);

            // Ground
            const floorGeo = new THREE.PlaneGeometry(100, 100, 20, 20);
            const floorMat = new THREE.MeshBasicMaterial({
                color: 0xec4899,
                wireframe: true,
                transparent: true,
                opacity: 0.15
            });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = 0;
            scene.add(floor);

            // Boundary walls
            const wallGeo = new THREE.BoxGeometry(100, 15, 100);
            const wallEdges = new THREE.EdgesGeometry(wallGeo);
            const wallLine = new THREE.LineSegments(wallEdges, new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.1 }));
            wallLine.position.y = 7.5;
            scene.add(wallLine);

            createPlayerAvatar();

            window.addEventListener('resize', () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            });
        }

        function createPlayerAvatar() {
            const group = new THREE.Group();

            // Head
            const headGeo = new THREE.OctahedronGeometry(0.5);
            const edgesGeo = new THREE.EdgesGeometry(headGeo);
            const headLine = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 }));
            const headCore = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: 0x0891b2, transparent: true, opacity: 0.3 }));
            group.add(headLine);
            group.add(headCore);

            // Body
            const bodyGeo = new THREE.ConeGeometry(0.6, 1.5, 4);
            const bodyEdges = new THREE.EdgesGeometry(bodyGeo);
            const bodyLine = new THREE.LineSegments(bodyEdges, new THREE.LineBasicMaterial({ color: 0x3b82f6 }));
            bodyLine.position.y = -1.0;
            const bodyCore = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.3 }));
            bodyCore.position.y = -1.0;
            group.add(bodyLine);
            group.add(bodyCore);

            // Thruster
            const thrustGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
            const thrust = new THREE.Mesh(thrustGeo, new THREE.MeshBasicMaterial({ color: 0xec4899 }));
            thrust.position.set(0, -1.8, -0.3);
            group.add(thrust);

            group.position.set(0, 2, 0);
            scene.add(group);
            playerMesh = group;

            playerMesh.userData = {
                velocity: new THREE.Vector3(0, 0, 0),
                speed: 0.14 * 1.5,
                facingAngle: 0
            };
        }

        // --- UI switching and screen construction ---
        function showPanel(panelType) {
            console.log(`[DEBUG-PANEL] showPanel: ${panelType}`);
            autoProgressToken++;
            debugState('[DEBUG-PANEL-STATE]', `next=${panelType} token=${autoProgressToken}`);
            gameState = panelType;
            const panel = document.getElementById('main-panel');
            const battleTray = document.getElementById('battle-tray');
            const reticle = document.getElementById('reticle');

            // Initialize rendering state
            panel.innerHTML = '';
            battleTray.classList.add('translate-y-32');
            battleTray.classList.add('pointer-events-none');
            reticle.classList.add('hidden');

            if (panelType === 'start') {
                const temp = document.getElementById('temp-start-screen').cloneNode(true);
                temp.removeAttribute('id');
                panel.appendChild(temp);
                // Render the regulation list dynamically
                setTimeout(() => {
                    if (typeof window._renderParamTestButtons === 'function') {
                        window._renderParamTestButtons();
                    }
                }, 50);
            } 
            else if (panelType === 'map') {
                const temp = document.getElementById('temp-map-screen').cloneNode(true);
                temp.removeAttribute('id');
                panel.appendChild(temp);
                renderMapNodes(temp);
            } 
            else if (panelType === 'reward') {
                const temp = document.getElementById('temp-reward-screen').cloneNode(true);
                temp.removeAttribute('id');
                panel.appendChild(temp);
                setupRewardScreen(temp);
            } 
            else if (panelType === 'camp') {
                const temp = document.getElementById('temp-camp-screen').cloneNode(true);
                temp.removeAttribute('id');
                panel.appendChild(temp);
                
                const upgradeBtn = temp.querySelector('#camp-upgrade-btn');
                if (upgradeBtn) {
                    upgradeBtn.disabled = (player.deck.length === 0);
                }
            } 
            else if (panelType === 'shop') {
                const temp = document.getElementById('temp-shop-screen').cloneNode(true);
                temp.removeAttribute('id');
                panel.appendChild(temp);
                renderShopItems(temp);
            }
            else if (panelType === 'gameover') {
                const temp = document.getElementById('temp-gameover-screen').cloneNode(true);
                temp.removeAttribute('id');
                panel.appendChild(temp);
                
                const stageText = temp.querySelector('#gameover-stage');
                if (stageText) {
                    stageText.textContent = `Sector ${currentStage}`;
                }
                window.__runState = 'gameover';
                window.__runResult = 'gameover';
            }
            else if (panelType === 'victory') {
                const temp = document.getElementById('temp-victory-screen').cloneNode(true);
                temp.removeAttribute('id');
                panel.appendChild(temp);
                window.__runState = 'victory';
                window.__runResult = 'victory';
            }
            else if (panelType === 'battle') {
                battleTray.classList.remove('translate-y-32');
                battleTray.classList.remove('pointer-events-none');
                reticle.classList.remove('hidden');
                initBattlePhase();
            }

            updateTopBarUI();
            updateModeIndicator();

            // --- Auto Progression ---
            if (isAutoMode) {
                console.log(`[DEBUG-AUTO] Scheduling auto progression for ${panelType}`);
                const scheduledToken = autoProgressToken;
                setTimeout(() => {
                    console.log(`[DEBUG-AUTO] Executing auto progression for ${panelType}, gameState is ${gameState}`);
                    debugState('[DEBUG-AUTO-STATE]', `panel=${panelType} token=${scheduledToken}/${autoProgressToken}`);
                    if (scheduledToken !== autoProgressToken || gameState !== panelType) return;
                    try {
                        if (panelType === 'map') {
                            const btns = Array.from(panel.querySelectorAll('#map-nodes-container button:not(.pointer-events-none)'));
                            console.log(`[DEBUG-AUTO] Found ${btns.length} map buttons`);
                            if (btns.length > 0) btns[Math.floor(Math.random() * btns.length)].click();
                        } else if (panelType === 'reward') {
                            const opts = panel.querySelector('#reward-card-options');
                            console.log(`[DEBUG-AUTO] Found reward options: ${opts ? opts.children.length : 0}`);
                            if (opts && opts.children.length > 0) opts.children[0].click();
                        } else if (panelType === 'camp') {
                            const healBtn = panel.querySelector('button[onclick*="campHeal"]');
                            if (healBtn) healBtn.click();
                        } else if (panelType === 'shop') {
                            const leaveBtn = panel.querySelector('button[onclick*="leaveShop"]');
                            if (leaveBtn) leaveBtn.click();
                        }
                    } catch (e) {
                        console.log("Auto progress error:", e);
                    }
                }, 1200);
            }
        }

        function updateTopBarUI() {
            document.getElementById('player-hp-bar').style.width = `${(player.hp / player.maxHp) * 100}%`;
            document.getElementById('player-hp-text').textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
            document.getElementById('player-block').textContent = Math.ceil(player.shield);
            document.getElementById('player-gold').textContent = player.gold;
            document.getElementById('player-deck-size').textContent = `${player.deck.length} cards`;
            document.getElementById('current-stage-text').textContent = `Stage ${currentStage} / ${totalStages}`;
        }

        // --- Map generation system ---
        function renderMapNodes(panelElement) {
            const container = panelElement.querySelector('#map-nodes-container');
            if (!container) return;
            container.innerHTML = '';

            for (let depth = 1; depth <= totalStages; depth++) {
                const row = document.createElement('div');
                row.className = "flex justify-center gap-6 w-full items-center";

                const nodes = MAP_NODE_TYPES[depth];
                nodes.forEach((node, nodeIdx) => {
                    const isAvailable = (depth === currentStage);
                    const isPassed = (depth < currentStage);

                    let icon = "fa-viruses";
                    let borderClass = "border-blue-500/30 text-gray-400 bg-slate-900/40";
                    
                    if (node.type === 'start') {
                        icon = "fa-network-wired";
                        borderClass = "border-cyan-500/50 text-cyan-400 bg-cyan-950/20";
                    } else if (node.type === 'shop') {
                        icon = "fa-cart-shopping";
                        borderClass = "border-amber-500/50 text-amber-400 bg-amber-950/20";
                    } else if (node.type === 'elite') {
                        icon = "fa-shield-heart";
                        borderClass = "border-pink-500/50 text-pink-400 bg-pink-950/20";
                    } else if (node.type === 'camp') {
                        icon = "fa-fire-flame-curved";
                        borderClass = "border-yellow-500/50 text-yellow-400 bg-yellow-950/20";
                    } else if (node.type === 'boss') {
                        icon = "fa-skull";
                        borderClass = "border-red-500/60 text-red-500 bg-red-950/20 animate-pulse";
                    }

                    if (isAvailable) {
                        borderClass += " ring-2 ring-purple-500/50 scale-105 cursor-pointer hover:scale-110 hover:brightness-125 transition-all text-white font-bold";
                    } else if (isPassed) {
                        borderClass += " opacity-40 grayscale pointer-events-none";
                    } else {
                        borderClass += " opacity-60 pointer-events-none";
                    }

                    const nodeBtn = document.createElement('button');
                    nodeBtn.className = `p-3 rounded-xl flex flex-col items-center w-40 text-center border ${borderClass}`;
                    if (isAvailable) {
                        nodeBtn.onclick = () => selectMapNode(node, depth);
                    }

                    nodeBtn.innerHTML = `
                        <i class="fa-solid ${icon} text-lg mb-1"></i>
                        <span class="text-xs font-bold block truncate w-full">${node.label}</span>
                        <span class="text-[8px] text-gray-400 mt-0.5 block truncate w-full">${node.desc}</span>
                    `;

                    row.appendChild(nodeBtn);
                });

                container.appendChild(row);
            }
            setTimeout(() => {
                const activeNode = container.querySelector('.ring-purple-500\\/50');
                if (activeNode) activeNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }

        function selectMapNode(node, depth) {
            selectedNode = node;
            document.getElementById('current-node-name').textContent = node.label;
            
            showCurtain(`Connecting sector...`, () => {
                if (node.type === 'fight' || node.type === 'elite' || node.type === 'boss' || node.type === 'start') {
                    showPanel('battle');
                } else if (node.type === 'camp') {
                    showPanel('camp');
                } else if (node.type === 'shop') {
                    showPanel('shop');
                }
            });
        }

        // --- Shop system ---
        function renderShopItems(panelElement) {
            const container = panelElement.querySelector('#shop-items-container');
            if (!container) return;
            container.innerHTML = '';
            
            // Add Reroll UI
            const rerollCost = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].shopRerollCost) || 1;
            const rerollContainer = panelElement.querySelector('#shop-reroll-container');
            if (rerollContainer) {
                rerollContainer.innerHTML = `
                    <button onclick="rerollShop()" class="flex items-center gap-2 text-xs md:text-sm bg-slate-900 hover:bg-slate-800 text-blue-300 font-bold border border-slate-700 px-4 py-2 rounded-xl transition-colors disabled:opacity-50" ${player.gold < rerollCost ? 'disabled' : ''}>
                        <i class="fa-solid fa-rotate"></i> Reroll (<i class="fa-solid fa-coins text-amber-400"></i> ${rerollCost})
                    </button>
                `;
            }

            const shopSlots = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].shopSlotCount) || 8;
            const shopPool = [];
            for (let i = 0; i < shopSlots - 1; i++) {
                shopPool.push({ card: pickRandomCardFromPool('shop', 0.2), cost: 80 + Math.floor(Math.random() * 40) });
            }
            shopPool.push({ card: null, type: 'heal', cost: 50, label: 'Full System Repair Patch', desc: 'Restore HP to the maximum.' });

            const gridDiv = document.createElement('div');
            gridDiv.className = "grid grid-cols-1 gap-4 w-full";
            container.appendChild(gridDiv);
            let itemContainer = gridDiv;

            shopPool.forEach((item, idx) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = "shop-item bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center gap-4 outline-none focus:ring-2 focus:ring-yellow-400";
                itemDiv.tabIndex = 0;
                
                let title = "";
                let desc = "";
                let costColor = player.gold >= item.cost ? 'text-amber-400' : 'text-rose-500';

                if (item.card) {
                    title = item.card.name + (item.card.upgraded ? '+' : '');
                    desc = item.card.text;
                } else {
                    title = item.label;
                    desc = item.desc;
                }

                itemDiv.innerHTML = `
                    <div class="flex-1 min-w-0 pointer-events-none">
                        <p class="text-sm font-bold text-white break-words">${title}</p>
                        <p class="text-[10px] text-gray-400 mt-1 leading-relaxed break-words whitespace-normal">${desc}</p>
                    </div>
                    <button class="shop-buy-btn flex flex-col items-center justify-center px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 active:scale-95 transition-all w-full md:w-24 flex-shrink-0 md:self-stretch"
                            ${player.gold < item.cost ? 'disabled' : ''}>
                        <span class="text-xs ${costColor} font-bold font-mono"><i class="fa-solid fa-coins mr-1"></i>${item.cost}</span>
                        <span class="text-[9px] text-gray-300 mt-1 font-bold">Buy</span>
                    </button>
                `;

                itemDiv.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        if (player.gold >= item.cost) {
                            buyShopItem(idx, item.cost, item.card);
                        }
                    }
                });

                itemDiv.querySelector('.shop-buy-btn').onclick = (e) => {
                    e.stopPropagation();
                    if (player.gold >= item.cost) {
                        buyShopItem(idx, item.cost, item.card);
                    }
                };

                itemContainer.appendChild(itemDiv);
            });

            const items = Array.from(panelElement.querySelectorAll('.shop-item'));
            if (items.length > 0) items[0].focus();

            panelElement.addEventListener('keydown', (e) => {
                const focused = document.activeElement;
                const idx = items.indexOf(focused);
                if (idx === -1 && e.key === 'ArrowDown') {
                    if (items.length > 0) items[0].focus();
                    return;
                }
                if (e.key === 'ArrowDown') {
                    if (idx < items.length - 1) items[idx + 1].focus();
                } else if (e.key === 'ArrowUp') {
                    if (idx > 0) items[idx - 1].focus();
                }
            });
        }

        window.rerollShop = function() {
            const cost = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].shopRerollCost) || 1;
            if (player.gold >= cost) {
                player.gold -= cost;
                playSFX('shield'); 
                const panel = document.getElementById('main-panel');
                renderShopItems(panel);
                updateTopBarUI();
            }
        };

        window.buyShopItem = function(index, cost, cardData) {
            if (player.gold < cost) return;
            player.gold -= cost;
            playSFX('hit');

            if (cardData) {
                player.deck.push(cardData);
            } else {
                player.hp = player.maxHp;
            }

            const panel = document.getElementById('main-panel');
            renderShopItems(panel);
            updateTopBarUI();
        };

        window.leaveShop = function() {
            currentStage++;
            if (currentStage > totalStages) {
                showPanel('victory');
            } else {
                showPanel('map');
            }
        };

        // --- Camp system ---
        window.campHeal = function() {
            const healAmt = Math.floor(player.maxHp * 0.3);
            player.hp = Math.min(player.maxHp, player.hp + healAmt);
            playSFX('shield');
            
            currentStage++;
            showPanel('map');
        };

        window.openCampUpgradeSelection = function() {
            const panel = document.getElementById('main-panel');
            panel.innerHTML = '';

            const temp = document.getElementById('temp-upgrade-select').cloneNode(true);
            temp.removeAttribute('id');
            panel.appendChild(temp);

            const listContainer = temp.querySelector('#upgrade-deck-list');
            if (!listContainer) return;
            listContainer.innerHTML = '';

            player.deck.forEach((card, idx) => {
                if (card.upgraded) return;

                const btn = document.createElement('button');
                btn.className = "p-3 bg-slate-900 hover:bg-slate-850 rounded-xl border border-slate-800 text-left hover:border-yellow-500/50 transition-all flex justify-between items-center";
                btn.onclick = () => upgradeCard(idx);

                btn.innerHTML = `
                    <div>
                        <p class="text-xs font-bold text-white">${card.name}</p>
                        <p class="text-[9px] text-gray-400 mt-0.5 truncate w-60">${card.text}</p>
                    </div>
                    <i class="fa-solid fa-angles-up text-xs text-yellow-400"></i>
                `;
                listContainer.appendChild(btn);
            });

            if (listContainer.children.length === 0) {
                listContainer.innerHTML = `<p class="text-xs text-gray-500 col-span-2 text-center py-4">No cards are available for upgrade.</p>`;
            }
        };

        function upgradeCard(index) {
            const card = player.deck[index];
            card.upgraded = true;

            const upDef = UPGRADES[card.id] || (CARDS[card.id] && CARDS[card.id].upgrade);
            if (upDef) {
                card.name = upDef.name;
                if (upDef.cost !== undefined) card.cost = upDef.cost;
                card.text = upDef.text;
            }

            playSFX('buff');
            currentStage++;
            showPanel('map');
        }

        window.backToCamp = function() {
            showPanel('camp');
        };

        // --- Draft reward system ---
        function setupRewardScreen(panelElement) {
            const rewardGold = 25 + Math.floor(Math.random() * 15);
            player.gold += rewardGold;
            
            const goldAmtText = panelElement.querySelector('#reward-gold-amount');
            if (goldAmtText) {
                goldAmtText.textContent = rewardGold;
            }

            const container = panelElement.querySelector('#reward-card-options');
            if (!container) return;
            container.innerHTML = '';

            const cardPool = REWARD_POOL.length > 0 ? REWARD_POOL : getPoolForType('reward');
            const rewardCardCount = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].rewardCardCount) || 3;
            const selected = [];
            while (selected.length < rewardCardCount) {
                const rId = pickWeightedCardId('reward') || cardPool[Math.floor(Math.random() * cardPool.length)];
                if (!selected.includes(rId)) {
                    selected.push(rId);
                }
            }

            selected.forEach(cardId => {
                const card = cloneCardDefinition(cardId, false);
                
                const isUpg = Math.random() < 0.3;
                if (isUpg) {
                    const upgradedCard = cloneCardDefinition(cardId, true);
                    if (upgradedCard) Object.assign(card, upgradedCard);
                }

                const cardDiv = document.createElement('div');
                cardDiv.className = `p-4 rounded-2xl border ${card.colorClass} hover:scale-105 active:scale-95 transition-all cursor-pointer flex flex-col justify-between w-full md:w-48 h-64 text-left relative overflow-hidden group`;
                cardDiv.onclick = () => selectRewardCard(card);
                const attackGraphicInfo = getAttackGraphicInfo(card);

                cardDiv.innerHTML = `
                    ${attackGraphicInfo ? `
                        <div class="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-black tracking-[0.2em] border border-white/15 bg-slate-950/80 text-white/90">
                            ${attackGraphicInfo.label}
                        </div>
                    ` : ''}
                    <div class="flex flex-col">
                        <div class="flex justify-between items-start">
                            <span class="text-xs font-mono px-2 py-0.5 rounded bg-slate-950/80 font-bold border border-white/10 text-white">${card.cost}</span>
                            <span class="text-[9px] uppercase tracking-wider text-gray-400 font-bold">${card.type}</span>
                        </div>
                        <h3 class="text-sm font-bold text-white mt-4 tracking-wider">${card.name}</h3>
                        <p class="text-[10px] text-gray-300 mt-2 leading-relaxed">${card.text}</p>
                    </div>

                    <div class="border-t border-white/5 pt-2 flex justify-between items-center mt-auto">
                        <span class="text-[9px] text-gray-400">Optimization module</span>
                        <i class="fa-solid fa-microchip text-xs text-white/40 group-hover:text-white transition-colors"></i>
                    </div>
                `;

                container.appendChild(cardDiv);
            });
        }

        function selectRewardCard(card) {
            console.log(`[DEBUG-PANEL] selectRewardCard called: ${card.name}`);
            debugState('[DEBUG-REWARD-STATE]', `picked=${card.name} cost=${card.cost}`);
            player.deck.push(card);
            playSFX('draw');
            currentStage++;
            
            if (currentStage > totalStages) {
                showPanel('victory');
            } else {
                showPanel('map');
            }
        }

        window.skipReward = function() {
            currentStage++;
            if (currentStage > totalStages) {
                showPanel('victory');
            } else {
                showPanel('map');
            }
        };

        function showCurtain(message, callback) {
            const cur = document.getElementById('curtain');
            const txt = document.getElementById('curtain-text');
            txt.textContent = message;

            cur.style.pointerEvents = 'auto';
            cur.style.opacity = '1';

            setTimeout(() => {
                callback();
                setTimeout(() => {
                    cur.style.opacity = '0';
                    cur.style.pointerEvents = 'none';
                }, 500);
            }, 800);
        }

        // --- Battle phase system (real-time 3D TPS) ---
        function initBattlePhase() {
            console.log(`[DEBUG-INIT] 徴 Battle sector initialized 徴 Deck size: ${player.deck.length} cards`);
            debugState('[DEBUG-BATTLE-INIT]');
            cleanupBattle3D();

            playerMesh.position.set(0, 1.2, 0);
            playerMesh.rotation.set(0, 0, 0);

            battleState.drawPile = [...player.deck];
            shuffleArray(battleState.drawPile);
            battleState.hand = [];
            battleState.discardPile = [];
            battleState.enemies = [];
            battleState.projectiles = [];
            battleState.particles = [];
            battleState.limitBreakCount = 0;
            battleState.shieldTimer = 0;
            battleState.invulnTimer = 0;
            battleState.framesElapsed = 0;
            isFiring = false;
            normalShootCooldown = 0;
            player.shield = 0;
            player.energy = PARAMS.playerEnergy;
            player.damageMult = 1.0;

            spawnEnemiesForStage();

            for (let i = 0; i < 4; i++) {
                drawCard();
            }

            renderHandUI();
            updateBattleStatsUI();
        }

        function spawnEnemiesForStage() {
            let numEnemies = Math.floor(Math.random() * 3) + 1; // Random 1 to 3 enemies for normal nodes
            let speedFactor = 1.0;
            let hpFactor = 1.0;

            if (selectedNode && selectedNode.type === 'elite') {
                numEnemies = 3;
                hpFactor = 1.8;
                speedFactor = 1.1;
            } else if (selectedNode && selectedNode.type === 'boss') {
                numEnemies = 1;
                spawnBoss();
                return;
            }

            numEnemies = Math.max(1, Math.round(numEnemies * PARAMS.enemyCountMult));
            debugState('[DEBUG-SPAWN-PLAN]', `node=${selectedNode ? selectedNode.type : 'none'} enemies=${numEnemies} hpFactor=${hpFactor.toFixed(2)} speedFactor=${speedFactor.toFixed(2)}`);

            for (let i = 0; i < numEnemies; i++) {
                const angle = (i / numEnemies) * Math.PI * 2 + Math.random();
                const distRoll = Math.random();
                let dist = 15;
                if (distRoll < 0.33) dist = 5 + Math.random() * 3; // Close
                else if (distRoll < 0.66) dist = 12 + Math.random() * 4; // Mid
                else dist = 22 + Math.random() * 6; // Far
                const x = Math.cos(angle) * dist;
                const z = Math.sin(angle) * dist;

            const availableEnemies = Object.keys(ENEMY_DEFS).filter(k => ENEMY_DEFS[k].type !== 'boss' && ENEMY_DEFS[k].type !== 'elite');
            const enemyType = availableEnemies.length > 0 ? availableEnemies[Math.floor(Math.random() * availableEnemies.length)] : 'glitch';
            createEnemy3D(x, z, enemyType, hpFactor, speedFactor);
        }
        }

        function createEnemy3D(x, z, type, hpFactor = 1.0, speedFactor = 1.0) {
            const group = new THREE.Group();
            const def = getEnemyDef(type);
            const geometry = def.geometry.kind === 'octahedron'
                ? new THREE.OctahedronGeometry(def.geometry.size)
                : def.geometry.kind === 'icosahedron'
                    ? new THREE.IcosahedronGeometry(def.geometry.radius, def.geometry.detail)
                    : new THREE.BoxGeometry(def.geometry.width, def.geometry.height, def.geometry.depth);
            const color = def.color;
            const name = def.name;
            let maxHp = def.baseHp * hpFactor * PARAMS.enemyHpMult;
            let speed = def.speed * speedFactor;

            if (isAutoMode) maxHp /= 10;

            const wireframe = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({ color: color, linewidth: 2 })
            );
            const core = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.25 }));

            group.add(wireframe);
            group.add(core);
            group.position.set(x, 1.2, z);
            scene.add(group);

            const intentSprite = createIntentSprite(name);
            intentSprite.position.y = 1.6;
            group.add(intentSprite);

            group.userData = {
                id: Math.random().toString(36).substr(2, 9),
                type: def.type,
                defId: def.id,
                name: name,
                hp: maxHp,
                maxHp: maxHp,
                speed: speed,
                shield: 0,
                shootCooldown: 120 + Math.random() * 60,
                intent: 'attack',
                intentTimer: 180,
                specialCooldown: 240 + Math.random() * 120,
                intentSprite: intentSprite,
                radius: def.radius,
                specialCardId: def.specialCardId,
                specialChance: def.specialChance || 0,
                specialLabel: def.specialLabel,
                poison: 0, poisonTimer: 0, vulnerableFrames: 0, weakFrames: 0, slowFrames: 0
            };

            battleState.enemies.push(group);
            console.log(`[DEBUG-SPAWN] Enemy spawned: ${name} (HP: ${maxHp.toFixed(1)}) at [${x.toFixed(1)}, ${z.toFixed(1)}]`);
            debugState('[DEBUG-SPAWN-STATE]', `enemy=${name} type=${type}`);
        }

        function spawnBoss() {
            const def = getEnemyDef('boss');
            const group = new THREE.Group();
            const geometry = new THREE.IcosahedronGeometry(def.geometry.radius, def.geometry.detail);
            const color = def.color; 

            const wireframe = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({ color: color, linewidth: 3 })
            );
            const core = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.3 }));

            group.add(wireframe);
            group.add(core);
            group.position.set(0, 3, 18);
            scene.add(group);

            let maxHp = def.baseHp;
            if (isAutoMode) {
                maxHp /= 10;
            }

            const intentSprite = createIntentSprite(def.name);
            intentSprite.position.y = 3.5;
            group.add(intentSprite);

            group.userData = {
                id: 'boss-core',
                type: def.type,
                defId: def.id,
                name: def.name,
                hp: maxHp,
                maxHp: maxHp,
                speed: def.speed,
                shield: 0,
                shootCooldown: 80,
                intent: 'attack_heavy',
                intentTimer: 200,
                intentSprite: intentSprite,
                radius: def.radius,
                specialCardId: def.specialCardId,
                specialChance: def.specialChance || 0,
                specialLabel: def.specialLabel,
                specialCooldown: 180
            };

            battleState.enemies.push(group);
            console.log(`[DEBUG-SPAWN] Boss spawned: ${def.name} (HP: ${maxHp.toFixed(1)})`);
            debugState('[DEBUG-BOSS-STATE]', `enemy=${def.name}`);
        }

        function createIntentSprite(name) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.fillRect(0, 0, 256, 64);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.strokeRect(2, 2, 252, 60);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(name, 10, 25);

            ctx.fillStyle = '#f43f5e';
            ctx.font = '14px monospace';
            ctx.fillText('Attack: LASER BEAM', 10, 48);

            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(3, 0.75, 1);

            sprite.userData = { ctx: ctx, canvas: canvas, texture: texture };
            return sprite;
        }

        function updateEnemyIntentUI(enemy) {
            const sprite = enemy.userData.intentSprite;
            const ctx = sprite.userData.ctx;
            const canvas = sprite.userData.canvas;
            
            ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
            ctx.fillRect(0, 0, 256, 64);
            ctx.strokeStyle = enemy.userData.type === 'boss' ? '#ef4444' : '#ec4899';
            ctx.lineWidth = 2;
            ctx.strokeRect(2, 2, 252, 60);

            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 15px sans-serif';
            ctx.fillText(`${enemy.userData.name}`, 10, 25);
            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(`HP: ${Math.ceil(enemy.userData.hp)}/${Math.ceil(enemy.userData.maxHp)}`, 150, 25);

            let text = "";
            let color = "#ffffff";
            if (enemy.userData.intent === 'attack') {
                text = "Attack prediction (6 DMG)";
                color = "#f43f5e";
            } else if (enemy.userData.intent === 'attack_heavy') {
                text = "Giga beam round (15 DMG)";
                color = "#ef4444";
            } else if (enemy.userData.intent === 'defense') {
                text = "Barrier load (+10 BLOCK)";
                color = "#3b82f6";
            } else if (enemy.userData.intent === 'special') {
                const cardName = enemy.userData.specialCardId && CARDS[enemy.userData.specialCardId]
                    ? CARDS[enemy.userData.specialCardId].name
                    : "Corruption";
                text = `Special: ${cardName}`;
                color = "#a855f7";
            }

            ctx.fillStyle = color;
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(text, 10, 48);

            sprite.userData.texture.needsUpdate = true;
        }

        function cleanupBattle3D() {
            // Safe removal and resource release (dispose)
            if (battleState.enemies) {
                battleState.enemies.forEach(e => {
                    scene.remove(e);
                    e.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                    });
                });
                battleState.enemies = [];
            }
            if (battleState.projectiles) {
                battleState.projectiles.forEach(p => {
                    scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                });
                battleState.projectiles = [];
            }
            if (battleState.particles) {
                battleState.particles.forEach(p => {
                    scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                });
                battleState.particles = [];
            }
            if (battleState.shieldMesh) {
                scene.remove(battleState.shieldMesh);
                battleState.shieldMesh.geometry.dispose();
                battleState.shieldMesh.material.dispose();
                battleState.shieldMesh = null;
            }

            if (warningLineMesh) {
                scene.remove(warningLineMesh);
                warningLineMesh.geometry.dispose();
                warningLineMesh.material.dispose();
                warningLineMesh = null;
            }
            if (battleState.hazardZones) {
                battleState.hazardZones.forEach(z => {
                    scene.remove(z.mesh);
                    z.mesh.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                    });
                });
                battleState.hazardZones = [];
            }
        }

        // --- Deck build and draw engine ---
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        function drawCard(insertIndex = -1) {
            if (battleState.hand.length >= 2) return false;
            if (battleState.drawLockFrames > 0) return false;

            if (battleState.drawPile.length === 0) {
                if (battleState.discardPile.length === 0) return false;
                battleState.drawPile = [...battleState.discardPile];
                shuffleArray(battleState.drawPile);
                battleState.discardPile = [];
                playSFX('draw');
                console.log("[DEBUG-DECK] Rebuild and shuffle the draw pile from the discard pile");
                debugState('[DEBUG-DECK-RESHUFFLE]');
            }

            const card = battleState.drawPile.pop();
            if (insertIndex >= 0 && insertIndex <= battleState.hand.length) {
                battleState.hand.splice(insertIndex, 0, card);
            } else {
                battleState.hand.push(card);
            }
            playSFX('draw');
            console.log(`[DEBUG-DECK] Card drawn: ${card.name} (Draw pile remaining: ${battleState.drawPile.length} cards)`);
            debugState('[DEBUG-DECK-DRAW]', `card=${card.name} upgraded=${!!card.upgraded}`);
            handleDrawnCard(card);
            return true;
        }

        // --- Card activation system ---
        window.useCardIndex = function(index) {
            if (gameState !== 'battle') return;
            if (index < 0 || index >= battleState.hand.length) return;

            const card = battleState.hand[index];
            if (isNaN(player.energy) || player.energy < card.cost) {
                showToast("Not enough energy!");
                debugState('[DEBUG-PLAY-BLOCKED]', `card=${card.name} cost=${card.cost}`);
                return;
            }

            player.energy -= card.cost;
            console.log(`[DEBUG-PLAY] Card used: ${card.name} (cost: ${card.cost} / remaining energy: ${player.energy.toFixed(1)})`);
            debugState('[DEBUG-PLAY-STATE]', `card=${card.name} slot=${index}`);
            
            if (card.hpLoss || (card.effect && card.effect.hpLoss)) {
                const amount = card.hpLoss || card.effect.hpLoss;
                damagePlayer(amount, null, true);
            }

            triggerCardEffect(card);
            
            if (battleState.nextCardPlayedTwice && card.type !== 'power') {
                battleState.nextCardPlayedTwice = false;
                showToast("Double Tap!");
                setTimeout(() => { triggerCardEffect(card); }, 200);
            }

            battleState.hand.splice(index, 1);
            if (card.type === 'power' || card.exhaust || (card.effect && card.effect.exhaust)) {
                showToast(`${card.name} exhausted!`);
            } else {
                battleState.discardPile.push(card);
            }

            while (battleState.hand.length < 2) {
                if (!drawCard(index)) break;
            }

            renderHandUI();
            updateBattleStatsUI();
        };

        window.redrawHand = function() {
            if (gameState !== 'battle') return;
            const cost = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].redrawCost) || 1;
            if (isNaN(player.energy) || player.energy < cost) {
                showToast("Not enough energy to redraw!");
                return;
            }
            if (battleState.hand.length === 0) return;
            
            player.energy -= cost;
            playSFX('draw');
            
            while (battleState.hand.length > 0) {
                const c = battleState.hand.pop();
                battleState.discardPile.push(c);
            }
            
            while (battleState.hand.length < 2) {
                if (!drawCard()) break;
            }
            
            renderHandUI();
            updateBattleStatsUI();
        };

        function triggerCardEffect(card) {
            if (applyDataDrivenCardEffect(card)) return;

            const mult = getCurrentDamageMultiplier();
            const dmgStrike = card.upgraded ? 10 : 6;
            const dmgShotgun = card.upgraded ? 7 : 5;
            const defAmt = card.upgraded ? 16 : 10;

            console.log(`[DEBUG-EFFECT] ${card.name} activated (Damage multiplier: ${mult.toFixed(1)}x)`);
            debugState('[DEBUG-EFFECT-STATE]', `card=${card.name}`);

            if (card.id === 'strike') {
                playSFX('strike');
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (gameState !== 'battle') return;
                        fireCardBullet(0.0, 0x06b6d4, dmgStrike * mult, 0.35);
                    }, i * 150);
                }
            } 
            else if (card.id === 'shotgun') {
                playSFX('shotgun');
                for (let i = 0; i < 8; i++) {
                    const angleOffset = (Math.random() - 0.5) * 0.3;
                    fireCardBullet(angleOffset, 0xec4899, dmgShotgun * mult, 0.25);
                }
            } 
            else if (card.id === 'defend') {
                playSFX('shield');
                player.shield += defAmt;
                spawnShieldVFX();
            } 
            else if (card.id === 'limit') {
                playSFX('buff');
                player.damageMult += 1.0;
                showToast("All card damage increased by +100%!");
                spawnBuffVFX();
            }
        }

        function applyDataDrivenCardEffect(card) {
            const effect = card.effect;
            if (!effect) return false;

            const upgraded = !!card.upgraded;
            const effectValue = upgraded && effect.amountUpgraded !== undefined ? effect.amountUpgraded : effect.amountBase;
            const mult = getCurrentDamageMultiplier();
            const origin = playerMesh.position.clone();

            if (effect.sfx) {
                playSFX(effect.sfx);
            }

            switch (effect.kind) {
                case 'burst_bullets': {
                    const count = effect.count || 1;
                    const damage = upgraded && effect.damageUpgraded !== undefined ? effect.damageUpgraded : effect.damageBase;
                    for (let i = 0; i < count; i++) {
                        setTimeout(() => {
                            if (gameState !== 'battle') return;
                            fireCardBullet(effect.angleOffset || 0, effect.colorHex || 0xffffff, damage * mult, effect.size || 0.25);
                        }, i * (effect.stepMs || 150));
                    }
                    return true;
                }
                case 'spread_burst': {
                    const count = effect.count || 1;
                    const damage = upgraded && effect.damageUpgraded !== undefined ? effect.damageUpgraded : effect.damageBase;
                    for (let i = 0; i < count; i++) {
                        const angleOffset = (Math.random() - 0.5) * (effect.spread || 0.3);
                        fireCardBullet(angleOffset, effect.colorHex || 0xffffff, damage * mult, effect.size || 0.25);
                    }
                    return true;
                }
                case 'gain_shield':
                    player.shield += effectValue || 0;
                    spawnShieldVFX();
                    return true;
                case 'gain_shield_draw':
                    player.shield += effectValue || 0;
                    spawnShieldVFX();
                    for (let i = 0; i < (effect.drawCount || 1); i++) drawCard();
                    return true;
                case 'dash_shield_draw': {
                    const velX = Math.sin(playerMesh.userData.facingAngle);
                    const velZ = Math.cos(playerMesh.userData.facingAngle);
                    playerMesh.position.x += velX * (effect.dashDistance || 8);
                    playerMesh.position.z += velZ * (effect.dashDistance || 8);
                    battleState.invulnTimer = effect.invulnFrames || 30;
                    player.shield += effectValue || 0;
                    spawnShieldVFX();
                    for (let i = 0; i < (effect.drawCount || 1); i++) drawCard();
                    return true;
                }
                case 'dash_invuln_draw': {
                    const velX = Math.sin(playerMesh.userData.facingAngle);
                    const velZ = Math.cos(playerMesh.userData.facingAngle);
                    playerMesh.position.x += velX * (effect.dashDistance || 8);
                    playerMesh.position.z += velZ * (effect.dashDistance || 8);
                    battleState.invulnTimer = effect.invulnFrames || 30;
                    for (let i = 0; i < (effect.drawCount || 1); i++) drawCard();
                    return true;
                }
                case 'draw_only':
                    for (let i = 0; i < (effect.drawCount || 1); i++) drawCard();
                    return true;
                case 'damage_multiplier':
                    player.damageMult += effectValue || 0;
                    showToast(effect.toast || "All card damage increased!");
                    spawnBuffVFX();
                    return true;
                case 'temp_damage_buff':
                    addTempDamageBuff(effectValue || 0, effect.durationFrames || 180, card.id);
                    showToast(effect.toast || "Temporary damage increased!");
                    return true;
                case 'strength_buff':
                    player.damageMult += effectValue || 0;
                    showToast(effect.toast || "Damage increased!");
                    spawnBuffVFX();
                    return true;
                case 'energy_draw':
                    player.energy = Math.min(player.maxEnergy, player.energy + (effect.energyAmount || effectValue || 0));
                    for (let i = 0; i < (effect.drawCount || 1); i++) drawCard();
                    updateBattleStatsUI();
                    return true;
                case 'energy_with_purge':
                    player.energy = Math.min(player.maxEnergy, player.energy + (effect.energyAmount || effectValue || 0));
                    addTempDamageBuff(-(effect.purgePenalty || 1), effect.durationFrames || 120, 'turbo');
                    updateBattleStatsUI();
                    return true;
                case 'energy_recovery_boost':
                    battleState.energyRegenBuffs.push({
                        amount: effect.recoveryBonus || effectValue || 0.01,
                        life: effect.durationFrames || 180
                    });
                    showToast(effect.toast || 'Energy recovery increased temporarily.');
                    return true;
                case 'spread_beam_draw': {
                    const count = effect.count || 6;
                    const damage = upgraded && effect.damageUpgraded !== undefined ? effect.damageUpgraded : effect.damageBase;
                    for (let i = 0; i < count; i++) {
                        const angleOffset = (Math.random() - 0.5) * (effect.spread || 0.35);
                        fireCardBullet(angleOffset, effect.colorHex || 0xffffff, damage * mult, effect.size || 0.25);
                    }
                    for (let i = 0; i < (effect.drawCount || 1); i++) drawCard();
                    return true;
                }
                                case 'strike_scaling_damage': {
                    const strikeCount = player.deck.filter(c => (c.name || '').toLowerCase().includes('strike')).length;
                    const damage = (effect.damageBase || 0) + strikeCount * (effect.damagePerStrike || 2);
                    const origin = playerMesh.position.clone();
                    spawnAoEAttackVFX('aoe_front', origin, effect.radius || 10, effect.colorHex || 0xffffff);
                    battleState.enemies.forEach(enemy => {
                        if (new THREE.Vector3(enemy.position.x - origin.x, 0, enemy.position.z - origin.z).length() <= (effect.radius || 10)) {
                            enemy.userData.hp -= damage * mult * (enemy.userData.vulnerableFrames > 0 ? 1.5 : 1);
                            spawnHitSpark(enemy.position, effect.colorHex || 0xffffff);
                        }
                    });
                    return true;
                }
                case 'damage_add_wound_to_draw': {
                    const damage = upgraded && effect.damageUpgraded !== undefined ? effect.damageUpgraded : effect.damageBase;
                    fireCardBullet(0, effect.colorHex || 0xffffff, damage * mult, 0.35);
                    battleState.drawPile.push(cloneCardDefinition('wound', false));
                    showToast("Wound added to draw pile!");
                    return true;
                }
                case 'double_tap':
                    battleState.nextCardPlayedTwice = true;
                    showToast("Next attack or skill will be played twice!");
                    return true;
                case 'lose_half_hp_max_energy':
                    damagePlayer(Math.floor(player.hp / 2), null, true);
                    player.energy = player.maxEnergy;
                    updateBattleStatsUI();
                    return true;
                case 'power_rupture_energy':
                    battleState.onHpLossBuffs.push({ type: 'energy_flat', amount: effectValue || 1 });
                    showToast("Blood Energy active!");
                    return true;
                case 'power_rupture_strength':
                    battleState.onHpLossBuffs.push({ type: 'strength', amount: effectValue || 1.0 });
                    showToast("Rupture active!");
                    return true;
                case 'power_speed_up':
                    player.speedMult += effectValue || 0.2;
                    showToast("Movement speed increased!");
                    return true;
                case 'aoe_front':
                case 'aoe_radial':
                case 'aoe_burst_burn':
                case 'aoe_low_cost':
                case 'aoe_drain': {
                    const damage = effect.damageBase !== undefined ? effect.damageBase : effectValue || 0;
                    const radius = effect.radius || 5;
                    const origin = playerMesh.position.clone();
                    spawnAoEAttackVFX(effect.kind, origin, radius, effect.colorHex || 0xec4899);
                    let hitCount = 0;
                    battleState.enemies.forEach(enemy => {
                        const dist = effect.kind === 'aoe_front'
                            ? new THREE.Vector3(enemy.position.x - origin.x, 0, enemy.position.z - origin.z).length()
                            : enemy.position.distanceTo(origin);
                        if (dist <= radius) {
                            const isFront = effect.kind !== 'aoe_front' || (() => {
                                const forward = new THREE.Vector3(Math.sin(playerMesh.rotation.y), 0, Math.cos(playerMesh.rotation.y));
                                const toEnemy = new THREE.Vector3(enemy.position.x - origin.x, 0, enemy.position.z - origin.z).normalize();
                                return forward.dot(toEnemy) > 0.25;
                            })();
                            if (isFront) {
                                enemy.userData.hp -= damage * mult * (enemy.userData.vulnerableFrames > 0 ? 1.5 : 1);
                                spawnHitSpark(enemy.position, effect.colorHex || 0xec4899);
                                hitCount++;
                            }
                        }
                    });
                    if (effect.kind === 'aoe_drain' && hitCount > 0) {
                        // healPerHit in data.js was typically 2 out of 80 (2.5%)
                        // so treat effect.healPerHit as the percentage, or explicitly use 2.5% per default
                        const healPercent = (effect.healPerHit || 2) / 80;
                        const healAmt = Math.floor(player.maxHp * healPercent);
                        player.hp = Math.min(player.maxHp, player.hp + hitCount * healAmt);
                    }
                    if (effect.kind === 'aoe_burst_burn') {
                        showToast("Burning blast!");
                    }
                    if (effect.kind === 'aoe_low_cost') {
                        showToast("Wave released!");
                    }
                    if (effect.kind === 'aoe_radial') {
                        showToast("Whirlwind!");
                    }
                    return true;
                }
                case 'shield_thorns':
                    battleState.pendingRetaliation = {
                        damage: effect.thornsDamage || effectValue || 2,
                        life: effect.durationFrames || 240
                    };
                    spawnShieldVFX();
                    return true;
                case 'draw_lock':
                    for (let i = 0; i < (effect.drawCount || 3); i++) drawCard();
                    battleState.drawLockFrames = effect.lockFrames || 180;
                    return true;
                case 'next_turn_energy':
                    addEnergyBonus(effectValue || 0);
                    showToast("Energy stored for next cycle.");
                    return true;
                case 'attack_grants_shield':
                    battleState.onHitShieldGain = {
                        amount: effectValue || 0,
                        life: effect.durationFrames || 240
                    };
                    return true;
                case 'apply_debuff':
                case 'place_hazard_zone':

                    if (effect.kind === 'apply_debuff') {
                        battleState.enemies.forEach(enemy => {
                            if (enemy.position.distanceTo(origin) <= effect.radius) {
                                const isFront = !effect.isFront || (() => {
                                    const forward = new THREE.Vector3(Math.sin(cameraTargetYaw), 0, Math.cos(cameraTargetYaw));
                                    const toEnemy = new THREE.Vector3(enemy.position.x - origin.x, 0, enemy.position.z - origin.z).normalize();
                                    return forward.dot(toEnemy) > 0.25;
                                })();
                                if (isFront) {
                                    const types = Array.isArray(effect.debuffTypes) ? effect.debuffTypes : (effect.debuffType ? [effect.debuffType] : []);
                                    for (const t of types) {
                                        if (t === 'poison') enemy.userData.poison += effectValue;
                                        else if (t === 'vulnerable') enemy.userData.vulnerableFrames += effectValue;
                                        else if (t === 'weak') enemy.userData.weakFrames += effectValue;
                                        else if (t === 'slow') enemy.userData.slowFrames += effectValue;
                                    }
                                    spawnHitSpark(enemy.position, 0x22c55e);
                                }
                            }
                        });
                        if (effect.gainShieldBase) {
                            const shieldVal = card.upgraded ? effect.gainShieldUpgraded : effect.gainShieldBase;
                            player.shield += shieldVal || 0;
                            spawnShieldVFX();
                        }
                    }
                    if (effect.kind === 'place_hazard_zone') {
                        const effectSizeStr = card.upgraded ? (effect.sizeUpgraded || effect.sizeBase) : (effect.sizeBase || 'medium');
                        const radius = (window.RTPS_HAZARD_ZONE_SIZES && window.RTPS_HAZARD_ZONE_SIZES[effectSizeStr]) || 6.0;
                        const mesh = createHazardZoneMesh(radius, effect.colorHex || 0xff0000);
                        mesh.position.copy(origin);
                        mesh.position.y = 0;
                        scene.add(mesh);
                        battleState.hazardZones.push({
                            mesh: mesh,
                            radius: radius,
                            durationFrames: effect.durationFrames || 300,
                            tickRate: effect.tickRate || 60,
                            hazardEffect: effect.hazardEffect
                        });
                    }

                    return true;
                case 'conditional_temp_damage_buff':
                    if (battleState.enemies.some(enemy => enemy.userData.intent && enemy.userData.intent.startsWith('attack'))) {
                        addTempDamageBuff(effectValue || 0, effect.durationFrames || 180, card.id);
                    }
                    return true;
                case 'status_blank':
                case 'status_exhaust':
                case 'status_end_damage':
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
                    return true;
                default:
                    return false;
            }
        }

        function spawnShieldVFX() {
            battleState.shieldTimer = 180;

            if (battleState.shieldMesh) {
                scene.remove(battleState.shieldMesh);
                battleState.shieldMesh.geometry.dispose();
                battleState.shieldMesh.material.dispose();
            }

            const geom = new THREE.SphereGeometry(0.8, 16, 16);
            const edges = new THREE.EdgesGeometry(geom);
            const mat = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4 });
            const shield = new THREE.LineSegments(edges, mat);
            
            shield.position.copy(playerMesh.position);
            scene.add(shield);
            battleState.shieldMesh = shield;
        }

        function spawnBuffVFX() {
            for (let i = 0; i < 20; i++) {
                const geom = new THREE.BoxGeometry(0.15, 0.15, 0.15);
                const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.copy(playerMesh.position);
                mesh.position.y += (Math.random() - 0.5) * 2;

                battleState.particles.push({
                    mesh: mesh,
                    velocity: new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.1 + Math.random() * 0.1, (Math.random() - 0.5) * 0.1),
                    life: 45
                });
                scene.add(mesh);
            }
        }

        function createHazardZoneMesh(radius, colorHex) {
            const group = new THREE.Group();
            const ringGeom = new THREE.RingGeometry(Math.max(0.15, radius * 0.45), radius, 48);
            const ringMat = new THREE.MeshBasicMaterial({
                color: colorHex,
                transparent: true,
                opacity: 0.26,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.05;
            group.add(ring);

            const edgeGeom = new THREE.TorusGeometry(radius, Math.max(0.04, radius * 0.03), 8, 36);
            const edgeMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.6,
                depthWrite: false
            });
            const edge = new THREE.Mesh(edgeGeom, edgeMat);
            edge.rotation.x = Math.PI / 2;
            edge.position.y = 0.07;
            group.add(edge);

            const outlineGeom = new THREE.EdgesGeometry(new THREE.CylinderGeometry(radius, radius, 0.02, 32));
            const outlineMat = new THREE.LineBasicMaterial({
                color: colorHex,
                transparent: true,
                opacity: 0.45
            });
            const outline = new THREE.LineSegments(outlineGeom, outlineMat);
            outline.position.y = 0.04;
            group.add(outline);

            group.userData = {
                ring,
                edge,
                outline,
                pulseSeed: Math.random() * Math.PI * 2
            };
            return group;
        }

        function spawnAoEAttackVFX(kind, origin, radius, colorHex) {
            let geometry;
            if (kind === 'aoe_front') {
                geometry = new THREE.CircleGeometry(radius, 40, -Math.PI / 3, Math.PI * 2 / 3);
            } else {
                geometry = new THREE.RingGeometry(Math.max(0.15, radius * 0.45), radius, 48);
            }

            const material = new THREE.MeshBasicMaterial({
                color: colorHex,
                transparent: true,
                opacity: 0.28,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(origin);
            mesh.position.y = 0.05;
            mesh.rotation.x = -Math.PI / 2;
            if (kind === 'aoe_front') {
                mesh.rotation.y = playerMesh.rotation.y;
            }
            scene.add(mesh);

            battleState.particles.push({
                mesh,
                velocity: new THREE.Vector3(0, 0, 0),
                life: 24,
                onUpdate: (p) => {
                    p.mesh.material.opacity = Math.max(0, 0.28 * (p.life / 24));
                    p.mesh.scale.setScalar(1 + (24 - p.life) * 0.01);
                }
            });
        }

        // --- Projectile spawning helpers ---
        function fireNormalBullet() {
            playSFX('shoot');
            const targetY = cameraTargetYaw;
            const velocity = new THREE.Vector3(
                Math.sin(targetY) * 0.5,
                0,
                Math.cos(targetY) * 0.5
            );

            const geom = new THREE.SphereGeometry(0.18, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.copy(playerMesh.position);
            mesh.position.y += 0.2;
            scene.add(mesh);

            battleState.projectiles.push({
                type: 'player_normal',
                mesh: mesh,
                velocity: velocity,
                damage: 2,
                life: 60
            });
        }

        function fireCardBullet(angleOffset, colorHex, damage, size) {
            const targetY = cameraTargetYaw + angleOffset;
            const velocity = new THREE.Vector3(
                Math.sin(targetY) * 0.6,
                0,
                Math.cos(targetY) * 0.6
            );

            const geom = new THREE.SphereGeometry(size, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: colorHex });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.copy(playerMesh.position);
            mesh.position.y += 0.2;
            scene.add(mesh);

            battleState.projectiles.push({
                type: 'player_card',
                mesh: mesh,
                velocity: velocity,
                damage: damage,
                life: 60
            });
        }

        function fireEnemyBullet(enemy, damage) {
            playSFX('hit');
            const targetDir = new THREE.Vector3().copy(playerMesh.position).sub(enemy.position).normalize();
            const velocity = targetDir.multiplyScalar(0.18);

            const geom = new THREE.SphereGeometry(0.25, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.copy(enemy.position);
            mesh.position.y = 1.0;
            scene.add(mesh);

            battleState.projectiles.push({
                type: 'enemy_normal',
                mesh: mesh,
                velocity: velocity,
                damage: damage,
                life: 100,
                attacker: enemy
            });
        }

        // --- UI rendering ---
        function renderHandUI() {
            const container = document.getElementById('hand-cards');
            container.innerHTML = '';
            container.oncontextmenu = (e) => e.preventDefault();

            battleState.hand.forEach((card, idx) => {
                const isAffordable = !isNaN(player.energy) && player.energy >= card.cost;
                const opacityClass = isAffordable ? 'opacity-100' : 'opacity-50';

                const cardDiv = document.createElement('div');
                cardDiv.className = `p-3 rounded-xl border ${card.colorClass} ${opacityClass} cursor-pointer hover:-translate-y-4 hover:brightness-110 active:scale-95 transition-all flex flex-col justify-between w-36 h-48 select-none shadow-lg text-left relative`;
                cardDiv.addEventListener('click', (e) => {
                    e.preventDefault();
                    useCardIndex(idx);
                });
                cardDiv.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    useCardIndex(Math.min(1, battleState.hand.length - 1));
                });
                const attackGraphicInfo = getAttackGraphicInfo(card);

                cardDiv.innerHTML = `
                    ${attackGraphicInfo ? `
                        <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[8px] font-black tracking-[0.2em] border border-white/15 bg-slate-950/80 text-white/90">
                            ${attackGraphicInfo.label}
                        </div>
                    ` : ''}
                    <div class="flex flex-col">
                        <div class="flex justify-between items-start">
                            <span class="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-950/80 font-mono border border-white/10">${card.cost}</span>
                            <span class="text-[8px] uppercase tracking-wider text-gray-400 font-bold">${card.type}</span>
                        </div>
                        <h3 class="text-xs font-bold text-white mt-3 tracking-wider">${card.name}</h3>
                        <p class="text-[9px] text-gray-300 mt-1.5 leading-snug">${card.text}</p>
                    </div>

                    <div class="border-t border-white/5 pt-1.5 flex justify-between items-center mt-auto text-[8px] text-gray-400 font-mono">
                        <span>SLOT ${idx === 0 ? 'I' : 'K'}</span>
                        <i class="fa-solid fa-bolt"></i>
                    </div>
                `;

                container.appendChild(cardDiv);
            });
        }

        function updateBattleStatsUI() {
            const nodesContainer = document.getElementById('energy-nodes');
            
            // Extra Battle Stats (Time, Dmg, Buffs)
            let extraStatsDiv = document.getElementById('extra-battle-stats');
            if (!extraStatsDiv) {
                extraStatsDiv = document.createElement('div');
                extraStatsDiv.id = 'extra-battle-stats';
                extraStatsDiv.className = 'absolute top-[-40px] left-4 bg-slate-900/80 p-2 rounded text-xs font-mono text-cyan-300 border border-cyan-500/50 pointer-events-none';
                const tray = document.getElementById('battle-tray');
                if (tray) tray.appendChild(extraStatsDiv);
            }
            if (extraStatsDiv) {
                const timeSec = Math.floor((battleState.framesElapsed || 0) / 60);
                let dmgMult = 1.0;
                if (battleState.enemies.length > 0 && battleState.enemies[0].userData.damageMult) {
                    dmgMult = battleState.enemies[0].userData.damageMult;
                }
                let buffText = "";
                if (battleState.tempDamageBuffs && battleState.tempDamageBuffs.length > 0) {
                    const maxBuffLife = Math.max(...battleState.tempDamageBuffs.map(b => b.life));
                    buffText = `<br>Buff: ${(maxBuffLife/60).toFixed(1)}s`;
                }
                extraStatsDiv.innerHTML = `Time: ${timeSec}s | Enemy DMG: x${dmgMult.toFixed(2)}${buffText}`;
            }
            nodesContainer.innerHTML = '';
            for (let i = 1; i <= player.maxEnergy; i++) {
                const node = document.createElement('div');
                node.className = `w-4 h-4 rounded-md border border-cyan-400/40 ${player.energy >= i ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]' : 'bg-slate-950/80'}`;
                nodesContainer.appendChild(node);
            }

            document.getElementById('energy-text').textContent = `${player.energy.toFixed(1)} / ${player.maxEnergy}`;
            document.getElementById('draw-pile-count').textContent = battleState.drawPile.length;
            document.getElementById('discard-pile-count').textContent = battleState.discardPile.length;
            updateTopBarUI();
            
            const handContainer = document.getElementById('hand-cards');
            if (handContainer && battleState.hand) {
                const cardDivs = handContainer.children;
                battleState.hand.forEach((card, idx) => {
                    if (cardDivs[idx]) {
                        const isAffordable = !isNaN(player.energy) && player.energy >= card.cost;
                        if (isAffordable) {
                            cardDivs[idx].classList.remove('opacity-50');
                            cardDivs[idx].classList.add('opacity-100');
                        } else {
                            cardDivs[idx].classList.remove('opacity-100');
                            cardDivs[idx].classList.add('opacity-50');
                        }
                    }
                });
            }
        }

        let toastEl = document.getElementById('toast');
        let toastTextEl = document.getElementById('toast-text');

        function showToast(message) {
            if (!toastEl || !toastTextEl) {
                toastEl = document.createElement('div');
                toastEl.id = 'toast';
                toastEl.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-slate-900 border border-cyan-500/50 px-6 py-3 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)] z-50 transition-opacity duration-300 opacity-0 pointer-events-none flex items-center gap-3';
                toastTextEl = document.createElement('span');
                toastTextEl.id = 'toast-text';
                toastTextEl.className = 'text-cyan-400 font-bold text-sm tracking-widest';
                const icon = document.createElement('i');
                icon.className = 'fa-solid fa-circle-info text-cyan-400';
                toastEl.appendChild(icon);
                toastEl.appendChild(toastTextEl);
                document.body.appendChild(toastEl);
            }
            toastTextEl.textContent = message;
            toastEl.style.opacity = '1';
            setTimeout(() => {
                toastEl.style.opacity = '0';
            }, 2500);
        }

        // --- Main game loop (3D rendering and logic) ---
        let lastTime = 0;
        function gameLoop(time) {
            requestAnimationFrame(gameLoop);
            
            if (time - lastTime < 16) return;
            lastTime = time;

            if (gameState === 'battle') {
                const iterations = isAutoMode ? PARAMS.autoModeSpeedMult : 1;
                for (let i = 0; i < iterations; i++) {
                    updateBattleLogic();
                }
            }

            renderer.render(scene, camera);
        }

        function updateBattleLogic() {
            if (gameState !== 'battle') return;

            // --- 0. Auto mode AI ---
            if (isAutoMode && battleState.enemies.length > 0) {
                // Find the nearest enemy
                let closestEnemy = null;
                let minDist = Infinity;
                battleState.enemies.forEach(enemy => {
                    const dist = playerMesh.position.distanceTo(enemy.position);
                    if (dist < minDist) {
                        minDist = dist;
                        closestEnemy = enemy;
                    }
                });

                if (closestEnemy) {
                    // 1. Auto-aim toward the enemy (interpolate the camera yaw target)
                    const dx = closestEnemy.position.x - playerMesh.position.x;
                    const dz = closestEnemy.position.z - playerMesh.position.z;
                    const targetYaw = Math.atan2(dx, dz);
                    
                    const yawDiff = targetYaw - cameraTargetYaw;
                    cameraTargetYaw += Math.sin(yawDiff) * 0.12; // Smooth aim tracking

                    // 2. Enable auto basic fire
                    isFiring = true;

                    // 3. Auto-play cards whenever energy is available.
                    // Keep consuming playable cards to avoid random stalls in automation.
                    let playedCard = false;
                    do {
                        playedCard = false;
                        for (let idx = 0; idx < battleState.hand.length; idx++) {
                            const card = battleState.hand[idx];
                            if (!isNaN(player.energy) && player.energy >= card.cost) {
                                console.log(`[DEBUG-AUTO-AI] Auto-play card: ${card.name} (hand slot: ${idx+1})`);
                                useCardIndex(idx);
                                playedCard = true;
                                break;
                            }
                        }
                    } while (playedCard && player.energy > 0 && gameState === 'battle');

                    // 4. Auto-move (circle the enemy clockwise while adjusting range)
                    const toEnemyX = dx / minDist;
                    const toEnemyZ = dz / minDist;

                    const tangentX = -toEnemyZ; // Tangent vector
                    const tangentZ = toEnemyX;

                    const idealDist = 7.0; // Desired distance to the enemy
                    let moveDirX = tangentX * 0.8;
                    let moveDirZ = tangentZ * 0.8;

                    if (minDist > idealDist + 1.0) {
                        // Move closer
                        moveDirX += toEnemyX * 0.4;
                        moveDirZ += toEnemyZ * 0.4;
                    } else if (minDist < idealDist - 1.0) {
                        // Move away
                        moveDirX -= toEnemyX * 0.4;
                        moveDirZ -= toEnemyZ * 0.4;
                    }

                    playerMesh.userData.facingAngle = Math.atan2(moveDirX, moveDirZ);
                    const moveVec = new THREE.Vector3(moveDirX, 0, moveDirZ).normalize().multiplyScalar(playerMesh.userData.speed);
                    playerMesh.position.add(moveVec);
                }
            } else {
                // Auto basic-fire control (manual mode)
                if (normalShootCooldown > 0) {
                    normalShootCooldown--;
                }
                if (normalShootCooldown <= 0) {
                    fireNormalBullet();
                    normalShootCooldown = 12; 
                }

                // Standard manual key movement
                if (keys['j']) {
                    cameraTargetYaw += 0.045;
                }
                if (keys['l']) {
                    cameraTargetYaw -= 0.045;
                }

                let moveX = 0;
                let moveZ = 0;

                if (keys['w'] || keys['s'] || keys['a'] || keys['d']) {
                    const forward = new THREE.Vector3(Math.sin(cameraTargetYaw), 0, Math.cos(cameraTargetYaw));
                    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

                    if (keys['w']) {
                        moveX += forward.x;
                        moveZ += forward.z;
                    }
                    if (keys['s']) {
                        moveX -= forward.x;
                        moveZ -= forward.z;
                    }
                    if (keys['d']) {
                        moveX -= right.x;
                        moveZ -= right.z;
                    }
                    if (keys['a']) {
                        moveX += right.x;
                        moveZ += right.z;
                    }

                    playerMesh.userData.facingAngle = Math.atan2(moveX, moveZ);
                }

                const dir = new THREE.Vector3(moveX, 0, moveZ);
                if (dir.lengthSq() > 0) {
                    dir.normalize().multiplyScalar(playerMesh.userData.speed);
                    playerMesh.position.add(dir);
                }
            }

            // Clamp the player position to the arena bounds
            playerMesh.position.x = Math.max(-48, Math.min(48, playerMesh.position.x));
            playerMesh.position.z = Math.max(-48, Math.min(48, playerMesh.position.z));

            // Camera follow
            const camDist = 7.5;
            if (keys['arrowup']) {
                cameraTargetPitch = Math.min(0.8, cameraTargetPitch + 0.02);
            }
            if (keys['arrowdown']) {
                cameraTargetPitch = Math.max(-0.4, cameraTargetPitch - 0.02);
            }
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
            }

            if (battleState.tempDamageBuffs.length > 0) {
                for (let i = battleState.tempDamageBuffs.length - 1; i >= 0; i--) {
                    battleState.tempDamageBuffs[i].life--;
                    if (battleState.tempDamageBuffs[i].life <= 0) {
                        battleState.tempDamageBuffs.splice(i, 1);
                    }
                }
            }

            if (battleState.drawLockFrames > 0) {
                battleState.drawLockFrames--;
            }

            if (battleState.energyRegenBuffs.length > 0) {
                for (let i = battleState.energyRegenBuffs.length - 1; i >= 0; i--) {
                    battleState.energyRegenBuffs[i].life--;
                    if (battleState.energyRegenBuffs[i].life <= 0) {
                        battleState.energyRegenBuffs.splice(i, 1);
                    }
                }
            }

            if (battleState.pendingRetaliation) {
                battleState.pendingRetaliation.life--;
                if (battleState.pendingRetaliation.life <= 0) {
                    battleState.pendingRetaliation = null;
                }
            }

            if (battleState.onHitShieldGain) {
                battleState.onHitShieldGain.life--;
                if (battleState.onHitShieldGain.life <= 0) {
                    battleState.onHitShieldGain = null;
                }
                }

                        
                battleState.hazardZones.forEach(zone => {
                    zone.durationFrames--;
                    const pulse = 0.92 + Math.sin((battleState.framesElapsed || 0) / 10 + (zone.mesh.userData.pulseSeed || 0)) * 0.06;
                    zone.mesh.scale.setScalar(pulse);
                    if (zone.mesh.userData.ring) zone.mesh.userData.ring.material.opacity = 0.45 + (pulse - 0.92) * 2.0;
                    if (zone.mesh.userData.edge) zone.mesh.userData.edge.material.opacity = 0.7 + (pulse - 0.92) * 1.5;
                    if (zone.mesh.userData.outline) zone.mesh.userData.outline.material.opacity = 0.32 + (pulse - 0.92) * 1.2;
                    if (zone.durationFrames % zone.tickRate === 0) {
                        battleState.enemies.forEach(enemy => {
                            if (enemy.position.distanceTo(zone.mesh.position) <= zone.radius) {
                                if (zone.hazardEffect.type === 'damage') {
                                    enemy.userData.hp -= zone.hazardEffect.amount * (enemy.userData.vulnerableFrames > 0 ? 1.5 : 1);
                                    spawnHitSpark(enemy.position, 0xef4444);
                                } else if (zone.hazardEffect.type === 'poison') {
                                    enemy.userData.poison += zone.hazardEffect.amount;
                                    spawnHitSpark(enemy.position, 0xa3e635);
                                }
                            }
                        });
                    }
                });
                
                for (let i = battleState.hazardZones.length - 1; i >= 0; i--) {
                    if (battleState.hazardZones[i].durationFrames <= 0) {
                        scene.remove(battleState.hazardZones[i].mesh);
                        battleState.hazardZones.splice(i, 1);
                    }
                }

            // Enemy time scaling
            battleState.framesElapsed = (battleState.framesElapsed || 0) + 1;
            const powerUpInterval = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].enemyPowerUpInterval) || 600;
            if (battleState.framesElapsed % powerUpInterval === 0) {
                const amt = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].enemyPowerUpAmount) || 1.1;
                battleState.enemies.forEach(enemy => {
                    if (!enemy.userData.damageMult) enemy.userData.damageMult = 1.0;
                    enemy.userData.damageMult *= amt;
                });
                showToast("Enemies grow stronger!");
            }
            if (battleState.framesElapsed % 30 === 0) updateBattleStatsUI();

            // --- 2. Energy regeneration over time ---
            if (player.energy < player.maxEnergy) {
                const bonusRegen = battleState.energyRegenBuffs.reduce((sum, buff) => sum + (buff.amount || 0), 0);
                player.energy = Math.min(player.maxEnergy, player.energy + PARAMS.energyRecoveryPerFrame + bonusRegen);
                updateBattleStatsUI();
            }

            // --- 3. Buff and defense shield updates ---
            if (battleState.shieldTimer > 0) {
                battleState.shieldTimer--;
                if (battleState.shieldMesh) {
                    battleState.shieldMesh.position.copy(playerMesh.position);
                }
                if (battleState.shieldTimer <= 0 || player.shield <= 0) {
                    player.shield = 0;
                    if (battleState.shieldMesh) {
                        scene.remove(battleState.shieldMesh);
                        battleState.shieldMesh.geometry.dispose();
                        battleState.shieldMesh.material.dispose();
                        battleState.shieldMesh = null;
                    }
                    updateBattleStatsUI();
                }
            }

            if (battleState.invulnTimer > 0) {
                battleState.invulnTimer--;
            }

            if (battleState.pendingEnergyBonus > 0 && battleState.hand.length === 0) {
                player.energy = Math.min(player.maxEnergy, player.energy + battleState.pendingEnergyBonus);
                battleState.pendingEnergyBonus = 0;
                updateBattleStatsUI();
            }

            // --- 4. Projectile updates and collision checks ---
            for (let i = battleState.projectiles.length - 1; i >= 0; i--) {
                const p = battleState.projectiles[i];
                if (!p || !p.mesh) {
                    battleState.projectiles.splice(i, 1);
                    continue;
                }
                p.mesh.position.add(p.velocity);
                p.life--;

                let isRemoved = false;

                if (p.mesh.position.y < 0.2) {
                    p.mesh.position.y = 0.2;
                }

                if (Math.abs(p.mesh.position.x) > 49 || Math.abs(p.mesh.position.z) > 49) {
                    isRemoved = true;
                }

                if (!isRemoved) {
                    if (p.type.startsWith('player')) {
                        for (let eIdx = battleState.enemies.length - 1; eIdx >= 0; eIdx--) {
                            const enemy = battleState.enemies[eIdx];
                            const dist = p.mesh.position.distanceTo(enemy.position);

                            if (dist < (enemy.userData.radius + 0.4)) {
                                playSFX('hit');
                                enemy.userData.hp -= p.damage * (enemy.userData.vulnerableFrames > 0 ? 1.5 : 1);
                                spawnHitSpark(p.mesh.position, 0x06b6d4);
                                if (battleState.onHitShieldGain) {
                                    player.shield += battleState.onHitShieldGain.amount || 0;
                                    spawnShieldVFX();
                                }
                                
                                if (p.type === 'player_normal') {
                                    player.energy = Math.min(player.maxEnergy, player.energy + PARAMS.energyRecoveryOnHit);
                                    updateBattleStatsUI();
                                }

                                isRemoved = true;
                                break;
                            }
                        }
                    } 
                    else if (p.type === 'enemy_normal') {
                        const dist = p.mesh.position.distanceTo(playerMesh.position);
                        if (dist < 1.1) {
                            if (battleState.invulnTimer <= 0) {
                                playSFX('hit');
                                if (damagePlayer(p.damage * (p.mesh.userData.damageMult || 1.0), p.attacker)) return;
                                spawnHitSpark(playerMesh.position, 0xef4444);
                            }
                            isRemoved = true;
                        }
                    }
                }

                if (p.life <= 0) {
                    isRemoved = true;
                }

                if (isRemoved) {
                    scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                    battleState.projectiles.splice(i, 1);
                }
            }

            // --- 5. Enemy AI, movement, and actions ---
            for (let eIdx = battleState.enemies.length - 1; eIdx >= 0; eIdx--) {
                const enemy = battleState.enemies[eIdx];

                if (enemy.userData.hp <= 0) {
                    playSFX('explosion');
                    console.log(`[DEBUG-KILL] Enemy defeated: ${enemy.userData.name}`);
                    debugState('[DEBUG-KILL-STATE]', `enemy=${enemy.userData.name}`);
                    spawnExplosion(enemy.position, 0xec4899);
                    scene.remove(enemy);
                    
                    // Release resources
                    enemy.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                    });

                    battleState.enemies.splice(eIdx, 1);
                    if (gameState !== 'battle') return;
                    continue;
                }

                
                if (enemy.userData.vulnerableFrames > 0) enemy.userData.vulnerableFrames--;
                if (enemy.userData.weakFrames > 0) enemy.userData.weakFrames--;
                if (enemy.userData.slowFrames > 0) enemy.userData.slowFrames--;
                
                if (enemy.userData.poison > 0) {
                    enemy.userData.poisonTimer--;
                    if (enemy.userData.poisonTimer <= 0) {
                        enemy.userData.hp -= enemy.userData.poison * (enemy.userData.vulnerableFrames > 0 ? 1.5 : 1);
                        enemy.userData.poison--;
                        enemy.userData.poisonTimer = 60;
                        spawnHitSpark(enemy.position, 0xa3e635);
                    }
                }

                const toPlayer = new THREE.Vector3().copy(playerMesh.position).sub(enemy.position);
                const distToPlayer = toPlayer.length();
                toPlayer.y = 0;
                toPlayer.normalize();

                if (distToPlayer > 6) {
                    enemy.position.add(toPlayer.multiplyScalar(enemy.userData.speed * (enemy.userData.slowFrames > 0 ? 0.5 : 1.0)));
                } else if (distToPlayer < 3) {
                    enemy.position.sub(toPlayer.multiplyScalar(enemy.userData.speed * (enemy.userData.slowFrames > 0 ? 0.5 : 1.0)));
                }

                enemy.userData.intentTimer--;
                if (enemy.userData.intentTimer <= 0) {
                    const hasSpecial = !!enemy.userData.specialCardId;
                    if (hasSpecial && Math.random() < (enemy.userData.specialChance || 0)) {
                        enemy.userData.intent = 'special';
                    } else if (enemy.userData.type === 'boss') {
                        enemy.userData.intent = Math.random() > 0.3 ? 'attack_heavy' : 'defense';
                    } else {
                        enemy.userData.intent = Math.random() > 0.4 ? 'attack' : 'defense';
                    }
                    enemy.userData.intentTimer = 180 + Math.random() * 60;
                }

                enemy.userData.specialCooldown--;
                if (enemy.userData.specialCooldown <= 0 && enemy.userData.intent === 'special') {
                    if (insertEnemyCardToPlayer(enemy.userData.specialCardId, true)) {
                        enemy.userData.specialCooldown = 240 + Math.random() * 120;
                        enemy.userData.shootCooldown = 180;
                        console.log(`[DEBUG-ENEMY-ACTION] ${enemy.userData.name} used special attack (${enemy.userData.specialCardId})`);
                    } else {
                        enemy.userData.specialCooldown = 90;
                    }
                }

                enemy.userData.shootCooldown--;
                if (enemy.userData.shootCooldown <= 0) {
                    if (enemy.userData.intent === 'attack') {
                        fireEnemyBullet(enemy, 6);
                        enemy.userData.shootCooldown = 150 + Math.random() * 60;
                        console.log(`[DEBUG-ENEMY-ACTION] ${enemy.userData.name} chose attack (cooldown=${enemy.userData.shootCooldown.toFixed(0)})`);
                    } 
                    else if (enemy.userData.intent === 'attack_heavy') {
                        fireEnemyBullet(enemy, 15);
                        enemy.userData.shootCooldown = 100;
                        console.log(`[DEBUG-ENEMY-ACTION] ${enemy.userData.name} chose heavy attack (cooldown=${enemy.userData.shootCooldown.toFixed(0)})`);
                    }
                    else if (enemy.userData.intent === 'defense') {
                        playSFX('shield');
                        enemy.userData.hp = Math.min(enemy.userData.maxHp, enemy.userData.hp + 5);
                        spawnHitSpark(enemy.position, 0x3b82f6);
                        enemy.userData.shootCooldown = 180;
                        console.log(`[DEBUG-ENEMY-ACTION] ${enemy.userData.name} chose defense (hp=${enemy.userData.hp.toFixed(1)}/${enemy.userData.maxHp.toFixed(1)} cooldown=${enemy.userData.shootCooldown})`);
                    }
                }

                if (enemy.userData.shootCooldown < 45 && enemy.userData.intent.startsWith('attack')) {
                    drawWarningLine(enemy.position, playerMesh.position);
                }

                updateEnemyIntentUI(enemy);
            }

            // --- 7. Particle updates ---
            for (let i = battleState.particles.length - 1; i >= 0; i--) {
                const p = battleState.particles[i];
                p.mesh.position.add(p.velocity);
                if (typeof p.onUpdate === 'function') {
                    p.onUpdate(p);
                }
                p.life--;
                if (p.life <= 0) {
                    scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                    battleState.particles.splice(i, 1);
                }
            }

            // --- 8. Win/loss monitoring and cleanup ---
            if (battleState.enemies.length === 0) {
                gameState = 'battle_end';
                isFiring = false;
                const battleEndToken = autoProgressToken;

                console.log(`[DEBUG-WIN] 脂 Battle won! All enemies have been eliminated.`);
                debugState('[DEBUG-WIN-STATE]', selectedNode ? `node=${selectedNode.type}` : 'node=none');
                showToast("Battle won! Network barrier destroyed.");
                
                // Guard pointer lock release errors
                cleanupBattle3D();

                // Transition to the 2D draft screen after a short delay
                setTimeout(() => {
                    if (battleEndToken !== autoProgressToken || gameState !== 'battle_end') return;
                    if (selectedNode && selectedNode.type === 'boss') {
                        console.log(`[DEBUG-WIN] All sector hacks complete!`);
                        showPanel('victory');
                    } else {
                        showPanel('reward');
                    }
                }, 1000);
            }
        }

        function damagePlayer(amount, attacker = null, bypassShield = false) {
            if (attacker && attacker.userData && attacker.userData.weakFrames > 0) {
                amount *= 0.75;
            }
            const hadShield = player.shield > 0;
            let actualHpLoss = 0;
            if (player.shield > 0 && !bypassShield) {
                player.shield -= amount;
                if (player.shield < 0) {
                    actualHpLoss = -player.shield;
                    player.hp += player.shield;
                    player.shield = 0;
                }
            } else {
                actualHpLoss = amount;
                player.hp -= amount;
            }
            
            if (actualHpLoss > 0 && battleState.onHpLossBuffs) {
                for (const buff of battleState.onHpLossBuffs) {
                    if (buff.type === 'energy_flat') {
                        player.energy = Math.min(player.maxEnergy, player.energy + buff.amount);
                        showToast("Energy recovered!");
                    } else if (buff.type === 'strength') {
                        player.damageMult += buff.amount;
                        showToast("Strength increased!");
                        spawnBuffVFX();
                    }
                }
                updateBattleStatsUI();
            }

            console.log(`[DEBUG-DAMAGE] Player hit: ${amount} damage (Remaining HP: ${player.hp.toFixed(1)} / Shield: ${player.shield.toFixed(1)})`);
            debugState('[DEBUG-DAMAGE-STATE]', `amount=${amount} hadShield=${hadShield}`);
            updateBattleStatsUI();

            if (hadShield && battleState.pendingRetaliation) {
                battleState.enemies.forEach(enemy => {
                    enemy.userData.hp -= battleState.pendingRetaliation.damage || 0;
                    spawnHitSpark(enemy.position, 0xf59e0b);
                });
            }

            if (player.hp <= 0) {
                player.hp = 0;
                console.log(`[DEBUG-DEATH] 逐 Player death detected. System HP depleted 逐`);
                cleanupBattle3D();
                window.__runState = 'gameover';
                window.__runResult = 'gameover';
                showPanel('gameover');
                return true;
            }
            return false;
        }

        function drawWarningLine(from, to) {
            if (warningLineMesh) {
                scene.remove(warningLineMesh);
                warningLineMesh.geometry.dispose();
                warningLineMesh.material.dispose();
            }
            const points = [
                new THREE.Vector3(from.x, from.y, from.z),
                new THREE.Vector3(to.x, to.y, to.z)
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.6 });
            warningLineMesh = new THREE.Line(geometry, material);
            scene.add(warningLineMesh);
        }

        function spawnHitSpark(pos, colorHex) {
            for (let i = 0; i < 5; i++) {
                const geom = new THREE.SphereGeometry(0.1, 4, 4);
                const mat = new THREE.MeshBasicMaterial({ color: colorHex });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.copy(pos);

                battleState.particles.push({
                    mesh: mesh,
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 0.15,
                        (Math.random() - 0.5) * 0.15,
                        (Math.random() - 0.5) * 0.15
                    ),
                    life: 20
                });
                scene.add(mesh);
            }
        }

        function spawnExplosion(pos, colorHex) {
            for (let i = 0; i < 15; i++) {
                const geom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                const mat = new THREE.MeshBasicMaterial({ color: colorHex });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.copy(pos);

                battleState.particles.push({
                    mesh: mesh,
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 0.3,
                        (Math.random() - 0.5) * 0.3,
                        (Math.random() - 0.5) * 0.3
                    ),
                    life: 40
                });
                scene.add(mesh);
            }
        }

        window.startGame = function() {
            if (typeof window.clearLog === 'function') window.clearLog();
            console.log(`[DEBUG-NAV] Game start [PARAM: ${PARAMS.paramName}]`);
            window.__runState = 'running';
            window.__runResult = null;
            currentStage = 1;
            player.hp = PARAMS.playerMaxHp;
            player.maxHp = PARAMS.playerMaxHp;
            player.gold = PARAMS.playerGold;
            setupInitialDeck();
            showPanel('map');
        };

        window.resetGame = function() {
            showPanel('start');
        };

        // Map layer definition
        const MAP_NODE_TYPES = [
            [], // dummy index 0
            [{ type: 'start', label: 'Start Node', desc: 'Network entry path' }],
            [{ type: 'fight', label: 'Virus Barrier', desc: 'Security detection: medium' }, { type: 'fight', label: 'Quarantine Sector', desc: 'Security detection: low' }],
            [{ type: 'shop', label: 'Black Module Market', desc: 'Hack program trading' }, { type: 'fight', label: 'Infected Data Layer', desc: 'Security detection: medium' }],
            [{ type: 'elite', label: 'Security Core (Elite)', desc: 'High-priority parent virus detected' }],
            [{ type: 'camp', label: 'System Safe House', desc: 'Memory release and repair' }],
            [{ type: 'fight', label: 'System Core Barrier', desc: 'High security' }, { type: 'shop', label: 'Extreme Data Trade', desc: 'Hack program trading' }],
            [{ type: 'camp', label: 'Final Optimization Node', desc: 'Prepare for the final defense' }],
            [{ type: 'boss', label: 'Mainframe Core (BOSS)', desc: 'Origin point of total motherboard lockdown' }]
        ];
