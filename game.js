// --- パラメータシステム ---
        // URLクエリからパラメータ名を取得
        const _urlParams = new URLSearchParams(window.location.search);
        const _paramName = _urlParams.get('param') || null;
        const _autoStart = _urlParams.get('mode') === 'auto';

        // デフォルト値（param.txtの1行目と同期）
        const PARAMS = {
            paramName: 'default',
            playerHp: 80,
            playerMaxHp: 80,
            playerEnergy: 3.0,
            playerMaxEnergy: 3,
            playerGold: 99,
            energyRecoveryPerFrame: 0.003,
            energyRecoveryOnHit: 0.15,
            autoModeSpeedMult: 10,
            enemyHpMult: 1.0,
            enemyDamageMult: 1.0
        };

        // ローカル直開き時は param-data.js から、サーバー起動時は /params から取得して上書き
        async function loadParams() {
            if (_paramName && Array.isArray(window.PARAM_CONFIGS)) {
                const config = window.PARAM_CONFIGS.find(c => c.paramName === _paramName);
                if (config) {
                    for (const key in config) {
                        if (PARAMS.hasOwnProperty(key)) {
                            const raw = config[key];
                            PARAMS[key] = isNaN(raw) ? raw : Number(raw);
                        }
                    }
                    console.log(`[PARAM] ローカル設定を適用: ${_paramName}`);
                } else {
                    console.log(`[PARAM] 設定が見つかりません: ${_paramName}`);
                }
                return;
            }

            if (_paramName) {
                try {
                    const res = await fetch('http://localhost:8000/params');
                    const configs = await res.json();
                    const config = configs.find(c => c.paramName === _paramName);
                    if (config) {
                        for (const key in config) {
                            if (PARAMS.hasOwnProperty(key)) {
                                const raw = config[key];
                                PARAMS[key] = isNaN(raw) ? raw : Number(raw);
                            }
                        }
                        console.log(`[PARAM] レギュレーション適用: ${_paramName}`);
                    } else {
                        console.log(`[PARAM] 設定が見つかりません: ${_paramName}`);
                    }
                } catch(e) {
                    console.log(`[PARAM] パラメータ読み込みエラー: ${e}`);
                }
            }
        }

        // --- ゲーム状態変数 ---
        let gameState = 'start'; // start, map, battle, reward, camp, shop, gameover, victory, battle_end
        let currentStage = 1; 
        const totalStages = 8;
        let selectedNode = null;
        let isAutoMode = false; // オートモードフラグ

        // プレイヤーデータ
        const player = {
            hp: 80,
            maxHp: 80,
            shield: 0,
            energy: 3.0,
            maxEnergy: 3,
            gold: 99,
            deck: [], 
            damageMult: 1.0 
        };

        // バトル中の一時状態
        const battleState = {
            drawPile: [],
            hand: [],
            discardPile: [],
            enemies: [],
            projectiles: [],
            particles: [],
            limitBreakCount: 0,
            shieldTimer: 0,
            invulnTimer: 0 
        };

        // カードライブラリ
        const CARDS = {
            strike: { id: 'strike', name: 'ストライク', cost: 1, type: 'attack', text: 'シアンレーザーを 3連射 して各 6ダメージ。', colorClass: 'border-cyan-500 text-cyan-400 bg-cyan-950/20' },
            shotgun: { id: 'shotgun', name: '散弾ショット', cost: 2, type: 'attack', text: '近距離に 8発 の拡散弾。至近距離で壊滅的ダメージ。', colorClass: 'border-pink-500 text-pink-400 bg-pink-950/20' },
            defend: { id: 'defend', name: '防御シールド', cost: 1, type: 'defense', text: 'ブロックを +10 獲得。プレイヤー周囲に電磁ドーム展開。', colorClass: 'border-blue-500 text-blue-400 bg-blue-950/20' },
            dodge: { id: 'dodge', name: 'ドッジパルス', cost: 1, type: 'skill', text: '向いている方向へ高速ダッシュ。0.5秒の無敵。1枚ドロー。', colorClass: 'border-emerald-500 text-emerald-400 bg-emerald-950/20' },
            poison: { id: 'poison', name: 'アシッドガス', cost: 2, type: 'skill', text: '毒ガス弾を射出。着弾地点に敵を侵食する緑ドームを形成。', colorClass: 'border-green-500 text-green-400 bg-green-950/20' },
            limit: { id: 'limit', name: '限界突破', cost: 3, type: 'power', text: '戦闘終了まで、全カードの与ダメージを +100%。', colorClass: 'border-amber-500 text-amber-400 bg-amber-950/20' }
        };

        // アップグレード差分
        const UPGRADES = {
            strike: { name: 'ストライク+', text: 'シアンレーザーを 3連射。各 10ダメージ。' },
            shotgun: { name: '散弾ショット+', cost: 1, text: '低コスト。近距離に 8発 の拡散弾。' },
            defend: { name: '防御シールド+', text: 'ブロックを +16 獲得。' },
            dodge: { name: 'ドッジパルス+', cost: 0, text: 'ノーコスト。ダッシュ、無敵。1枚ドロー。' },
            poison: { name: 'アシッドガス+', text: 'より高威力の毒ガス。着弾地点を強力に侵食。' },
            limit: { name: '限界突破+', cost: 2, text: '低コスト。全カードの与ダメージを +100%。' }
        };

        // --- 3Dグラフィック環境変数 (Three.js) ---
        let scene, camera, renderer;
        let playerMesh;
        let terrainGrid;
        let ambientLight, dirLight;
        const keys = {}; 

        // 視点移動
        let mouseX = 0, mouseY = 0;
        let cameraTargetPitch = 0.2; 
        let cameraTargetYaw = 0;   
        let isPointerLocked = false;
        let isMouseDown = false;   
        let isFiring = false; 
        let normalShootCooldown = 0; 
        let warningLineMesh = null; // 敵の警告射線

        // --- 起動初期化 ---
        document.addEventListener('DOMContentLoaded', async () => {
            await loadParams();

            // PARAMSをプレイヤー初期値に反映
            player.hp = PARAMS.playerHp;
            player.maxHp = PARAMS.playerMaxHp;
            player.energy = PARAMS.playerEnergy;
            player.maxEnergy = PARAMS.playerMaxEnergy;
            player.gold = PARAMS.playerGold;

            // オートスタートフラグ
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

            // キーハンドラ
            window.addEventListener('keydown', (e) => {
                keys[e.key.toLowerCase()] = true;
                
                // Pキーでのマニュアル/オートトグル
                if (e.key.toLowerCase() === 'p') {
                    toggleAutoMode();
                }

                if (gameState === 'battle') {
                    if (e.key === '1') useCardIndex(0);
                    if (e.key === '2') useCardIndex(1);
                    if (e.key === '3') useCardIndex(2);
                    if (e.key === '4') useCardIndex(3);
                }
            });
            window.addEventListener('keyup', (e) => {
                keys[e.key.toLowerCase()] = false;
            });

            // マウス操作
            window.addEventListener('mousedown', (e) => {
                isMouseDown = true;
                if (gameState === 'battle') {
                    isFiring = true;
                }
            });

            window.addEventListener('mouseup', (e) => {
                isMouseDown = false;
                isFiring = false;
            });

            window.addEventListener('mousemove', (e) => {
                if (gameState === 'battle' && !isAutoMode) {
                    if (isPointerLocked || isMouseDown) {
                        cameraTargetYaw -= e.movementX * 0.003;
                        cameraTargetPitch = Math.max(-0.4, Math.min(0.8, cameraTargetPitch - e.movementY * 0.003));
                    }
                }
            });

            renderer.domElement.addEventListener('click', (e) => {
                if (gameState === 'battle' && !isPointerLocked && !isAutoMode) {
                    renderer.domElement.requestPointerLock();
                }
            });

            document.addEventListener('pointerlockchange', () => {
                isPointerLocked = (document.pointerLockElement === renderer.domElement);
                if (!isPointerLocked) {
                    isFiring = false; 
                }
            });

            // ループスタート
            requestAnimationFrame(gameLoop);
        });

        // --- オートモードトグル処理 ---
        function toggleAutoMode() {
            isAutoMode = !isAutoMode;
            console.log(`[DEBUG-MODE] モード切替: ${isAutoMode ? "AUTO (自動戦闘)" : "MANUAL (手動移動)"}`);
            showToast(isAutoMode ? "オート戦闘起動：敵のHPが 1/10 に縮小" : "マニュアル戦闘：敵のHPが標準に復元");

            // 戦闘中の場合、敵のHPと最大HPを動的にスケーリング
            if (gameState === 'battle' && battleState.enemies) {
                battleState.enemies.forEach(enemy => {
                    if (isAutoMode) {
                        // HPを1/10にする
                        enemy.userData.hp = Math.max(1, enemy.userData.hp / 10);
                        enemy.userData.maxHp = Math.max(1, enemy.userData.maxHp / 10);
                        console.log(`[DEBUG-AI] 敵弱体化 (HP1/10): ${enemy.userData.name} (HP: ${enemy.userData.hp.toFixed(1)}/${enemy.userData.maxHp.toFixed(1)})`);
                    } else {
                        // HPを10倍に戻す
                        enemy.userData.hp *= 10;
                        enemy.userData.maxHp *= 10;
                        console.log(`[DEBUG-AI] 敵HP復元 (10倍): ${enemy.userData.name} (HP: ${enemy.userData.hp.toFixed(1)}/${enemy.userData.maxHp.toFixed(1)})`);
                    }
                    updateEnemyIntentUI(enemy);
                });
            }

            // マウス固定をオートモード時は不要なので解除
            if (isAutoMode && document.pointerLockElement === renderer.domElement) {
                try {
                    document.exitPointerLock();
                } catch (e) {
                    console.warn(e);
                }
            }

            updateModeIndicator();
        }

        // モードインジケーターの視覚的アップデート
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

        // --- デッキ初期設定 ---
        function setupInitialDeck() {
            player.deck = [
                { ...CARDS.strike, upgraded: false },
                { ...CARDS.strike, upgraded: false },
                { ...CARDS.strike, upgraded: false },
                { ...CARDS.defend, upgraded: false },
                { ...CARDS.defend, upgraded: false },
                { ...CARDS.defend, upgraded: false },
                { ...CARDS.dodge, upgraded: false },
                { ...CARDS.shotgun, upgraded: false },
                { ...CARDS.poison, upgraded: false },
                { ...CARDS.limit, upgraded: false }
            ];
            updateTopBarUI();
        }

        // --- 3D 初期セットアップ ---
        function initThree() {
            const container = document.getElementById('game-canvas');
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x030308, 0.02);

            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            
            renderer = new THREE.WebGLRenderer({ canvas: container, antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

            // ライト
            ambientLight = new THREE.AmbientLight(0x0f0a20, 1.5);
            scene.add(ambientLight);

            dirLight = new THREE.DirectionalLight(0xec4899, 1.0);
            dirLight.position.set(20, 40, 20);
            scene.add(dirLight);

            // 地面
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

            // 境界の外壁
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

            // 頭
            const headGeo = new THREE.OctahedronGeometry(0.5);
            const edgesGeo = new THREE.EdgesGeometry(headGeo);
            const headLine = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 }));
            const headCore = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: 0x0891b2, transparent: true, opacity: 0.3 }));
            group.add(headLine);
            group.add(headCore);

            // ボディ
            const bodyGeo = new THREE.ConeGeometry(0.6, 1.5, 4);
            const bodyEdges = new THREE.EdgesGeometry(bodyGeo);
            const bodyLine = new THREE.LineSegments(bodyEdges, new THREE.LineBasicMaterial({ color: 0x3b82f6 }));
            bodyLine.position.y = -1.0;
            const bodyCore = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.3 }));
            bodyCore.position.y = -1.0;
            group.add(bodyLine);
            group.add(bodyCore);

            // スラスター
            const thrustGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
            const thrust = new THREE.Mesh(thrustGeo, new THREE.MeshBasicMaterial({ color: 0xec4899 }));
            thrust.position.set(0, -1.8, -0.3);
            group.add(thrust);

            group.position.set(0, 2, 0);
            scene.add(group);
            playerMesh = group;

            playerMesh.userData = {
                velocity: new THREE.Vector3(0, 0, 0),
                speed: 0.14,
                facingAngle: 0
            };
        }

        // --- UI表示切り替え & 画面構築 ---
        function showPanel(panelType) {
            console.log(`[DEBUG-PANEL] showPanel: ${panelType}`);
            gameState = panelType;
            const panel = document.getElementById('main-panel');
            const battleTray = document.getElementById('battle-tray');
            const reticle = document.getElementById('reticle');

            // 描画初期化
            panel.innerHTML = '';
            battleTray.classList.add('translate-y-32');
            battleTray.classList.add('pointer-events-none');
            reticle.classList.add('hidden');

            if (panelType === 'start') {
                const temp = document.getElementById('temp-start-screen').cloneNode(true);
                temp.removeAttribute('id');
                panel.appendChild(temp);
                // param.txtのレギュレーション一覧を動的に描画
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
                    stageText.textContent = `セクター ${currentStage}`;
                }
            }
            else if (panelType === 'victory') {
                const temp = document.getElementById('temp-victory-screen').cloneNode(true);
                temp.removeAttribute('id');
                panel.appendChild(temp);
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
                setTimeout(() => {
                    console.log(`[DEBUG-AUTO] Executing auto progression for ${panelType}, gameState is ${gameState}`);
                    if (gameState !== panelType) return;
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
            document.getElementById('player-deck-size').textContent = `${player.deck.length}枚`;
            document.getElementById('current-stage-text').textContent = `階層 ${currentStage} / ${totalStages}`;
        }

        // --- マップ構築システム ---
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
        }

        function selectMapNode(node, depth) {
            selectedNode = node;
            document.getElementById('current-node-name').textContent = node.label;
            
            showCurtain(`セクター接続中...`, () => {
                if (node.type === 'fight' || node.type === 'elite' || node.type === 'boss' || node.type === 'start') {
                    showPanel('battle');
                } else if (node.type === 'camp') {
                    showPanel('camp');
                } else if (node.type === 'shop') {
                    showPanel('shop');
                }
            });
        }

        // --- ショップシステム ---
        function renderShopItems(panelElement) {
            const container = panelElement.querySelector('#shop-items-container');
            if (!container) return;
            container.innerHTML = '';

            const cardIds = Object.keys(CARDS);
            const shopPool = [
                { card: { ...CARDS[cardIds[Math.floor(Math.random() * cardIds.length)]], upgraded: false }, cost: 40 },
                { card: { ...CARDS[cardIds[Math.floor(Math.random() * cardIds.length)]], upgraded: Math.random() > 0.6 }, cost: 65 },
                { card: { ...CARDS.dodge, upgraded: false }, cost: 45 },
                { card: null, type: 'heal', cost: 25, label: 'フルシステム修復パッチ', desc: 'HPを最大値まで回復します。' }
            ];

            shopPool.forEach((item, idx) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = "bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex justify-between items-center";

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
                    <div class="flex-1 pr-4">
                        <p class="text-sm font-bold text-white">${title}</p>
                        <p class="text-[10px] text-gray-400 mt-1">${desc}</p>
                    </div>
                    <button onclick="buyShopItem(${idx}, ${item.cost}, ${JSON.stringify(item.card).replace(/"/g, '&quot;')})" 
                            class="flex flex-col items-center justify-center p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 active:scale-95 transition-all w-20 flex-shrink-0"
                            ${player.gold < item.cost ? 'disabled' : ''}>
                        <span class="text-xs ${costColor} font-bold font-mono"><i class="fa-solid fa-coins mr-1"></i>${item.cost}</span>
                        <span class="text-[9px] text-gray-300 mt-1 font-bold">購入</span>
                    </button>
                `;

                container.appendChild(itemDiv);
            });
        }

        window.buyShopItem = function(index, cost, cardData) {
            if (player.gold < cost) return;
            player.gold -= cost;
            playSFX('shield');

            if (cardData) {
                player.deck.push(cardData);
            } else {
                player.hp = player.maxHp;
            }

            showPanel('shop'); 
        };

        window.leaveShop = function() {
            currentStage++;
            if (currentStage > totalStages) {
                showPanel('victory');
            } else {
                showPanel('map');
            }
        };

        // --- キャンプシステム ---
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
                listContainer.innerHTML = `<p class="text-xs text-gray-500 col-span-2 text-center py-4">アップグレード可能なカードがありません</p>`;
            }
        };

        function upgradeCard(index) {
            const card = player.deck[index];
            card.upgraded = true;
            
            const upDef = UPGRADES[card.id];
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

        // --- ドラフト報酬システム ---
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

            const cardPool = Object.keys(CARDS);
            const selected = [];
            while (selected.length < 3) {
                const rId = cardPool[Math.floor(Math.random() * cardPool.length)];
                if (!selected.includes(rId)) {
                    selected.push(rId);
                }
            }

            selected.forEach(cardId => {
                const card = { ...CARDS[cardId], upgraded: false };
                
                const isUpg = Math.random() < 0.3;
                if (isUpg) {
                    card.upgraded = true;
                    const upDef = UPGRADES[cardId];
                    if (upDef) {
                        card.name = upDef.name;
                        if (upDef.cost !== undefined) card.cost = upDef.cost;
                        card.text = upDef.text;
                    }
                }

                const cardDiv = document.createElement('div');
                cardDiv.className = `p-4 rounded-2xl border ${card.colorClass} hover:scale-105 active:scale-95 transition-all cursor-pointer flex flex-col justify-between w-full md:w-48 h-64 text-left relative overflow-hidden group`;
                cardDiv.onclick = () => selectRewardCard(card);

                cardDiv.innerHTML = `
                    <div class="flex flex-col">
                        <div class="flex justify-between items-start">
                            <span class="text-xs font-mono px-2 py-0.5 rounded bg-slate-950/80 font-bold border border-white/10 text-white">${card.cost}</span>
                            <span class="text-[9px] uppercase tracking-wider text-gray-400 font-bold">${card.type}</span>
                        </div>
                        <h3 class="text-sm font-bold text-white mt-4 tracking-wider">${card.name}</h3>
                        <p class="text-[10px] text-gray-300 mt-2 leading-relaxed">${card.text}</p>
                    </div>

                    <div class="border-t border-white/5 pt-2 flex justify-between items-center mt-auto">
                        <span class="text-[9px] text-gray-400">最適化モジュール</span>
                        <i class="fa-solid fa-microchip text-xs text-white/40 group-hover:text-white transition-colors"></i>
                    </div>
                `;

                container.appendChild(cardDiv);
            });
        }

        function selectRewardCard(card) {
            console.log(`[DEBUG-PANEL] selectRewardCard called: ${card.name}`);
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

        // --- バトルフェーズ・システム (リアルタイム3D TPS) ---
        function initBattlePhase() {
            console.log(`[DEBUG-INIT] 💥 バトルセクター初期化 💥 デッキ枚数: ${player.deck.length}枚`);
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
            let numEnemies = 2;
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

            for (let i = 0; i < numEnemies; i++) {
                const angle = (i / numEnemies) * Math.PI * 2 + Math.random();
                const dist = 15 + Math.random() * 5;
                const x = Math.cos(angle) * dist;
                const z = Math.sin(angle) * dist;

                const enemyType = Math.random() > 0.5 ? 'glitch' : 'sentinel';
                createEnemy3D(x, z, enemyType, hpFactor, speedFactor);
            }
        }

        function createEnemy3D(x, z, type, hpFactor = 1.0, speedFactor = 1.0) {
            const group = new THREE.Group();

            let geometry, color, name;
            let maxHp = 25 * hpFactor * PARAMS.enemyHpMult;
            let speed = 0.04 * speedFactor;

            if (type === 'glitch') {
                geometry = new THREE.OctahedronGeometry(0.8);
                color = 0xec4899; 
                name = 'グリッチ・ウイルス';
            } else { 
                geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
                color = 0xf59e0b; 
                name = 'センチネル・シールド';
                maxHp = 40 * hpFactor * PARAMS.enemyHpMult;
                speed = 0.02 * speedFactor;
            }

            // オートモード時は最初からHPを1/10に
            if (isAutoMode) {
                maxHp /= 10;
            }

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
                type: type,
                name: name,
                hp: maxHp,
                maxHp: maxHp,
                speed: speed,
                shield: 0,
                shootCooldown: 120 + Math.random() * 60,
                intent: 'attack',
                intentTimer: 180,
                intentSprite: intentSprite,
                radius: 1.0
            };

            battleState.enemies.push(group);
            console.log(`[DEBUG-SPAWN] 敵出現: ${name} (HP: ${maxHp.toFixed(1)}) at [${x.toFixed(1)}, ${z.toFixed(1)}]`);
        }

        function spawnBoss() {
            const group = new THREE.Group();
            const geometry = new THREE.IcosahedronGeometry(2.5, 1);
            const color = 0xef4444; 

            const wireframe = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({ color: color, linewidth: 3 })
            );
            const core = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.3 }));

            group.add(wireframe);
            group.add(core);
            group.position.set(0, 3, 18);
            scene.add(group);

            let maxHp = 150;
            if (isAutoMode) {
                maxHp /= 10;
            }

            const intentSprite = createIntentSprite('メインフレーム・コア');
            intentSprite.position.y = 3.5;
            group.add(intentSprite);

            group.userData = {
                id: 'boss-core',
                type: 'boss',
                name: 'メインフレーム・コア (BOSS)',
                hp: maxHp,
                maxHp: maxHp,
                speed: 0.015,
                shield: 0,
                shootCooldown: 80,
                intent: 'attack_heavy',
                intentTimer: 200,
                intentSprite: intentSprite,
                radius: 2.5
            };

            battleState.enemies.push(group);
            console.log(`[DEBUG-SPAWN] 💻 ボス出現: メインフレーム・コア (HP: ${maxHp.toFixed(1)})`);
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
            ctx.fillText('攻撃: LASER BEAM', 10, 48);

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
                text = "⚡ 攻撃予測 (6 DMG)";
                color = "#f43f5e";
            } else if (enemy.userData.intent === 'attack_heavy') {
                text = "☄ ギガビーム弾 (15 DMG)";
                color = "#ef4444";
            } else if (enemy.userData.intent === 'defense') {
                text = "🛡 防壁ロード (+10 BLOCK)";
                color = "#3b82f6";
            }

            ctx.fillStyle = color;
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(text, 10, 48);

            sprite.userData.texture.needsUpdate = true;
        }

        function cleanupBattle3D() {
            // 安全な消去 & リソース解放 (dispose)
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
            if (battleState.acidDomes) {
                battleState.acidDomes.forEach(d => {
                    scene.remove(d.mesh);
                    d.mesh.geometry.dispose();
                    d.mesh.material.dispose();
                });
                battleState.acidDomes = [];
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
        }

        // --- デッキ構築＆ドローエンジン ---
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        function drawCard() {
            if (battleState.hand.length >= 4) return;

            if (battleState.drawPile.length === 0) {
                if (battleState.discardPile.length === 0) return;
                battleState.drawPile = [...battleState.discardPile];
                shuffleArray(battleState.drawPile);
                battleState.discardPile = [];
                playSFX('draw');
                console.log("[DEBUG-DECK] 墓地から山札を再構築＆シャッフル");
            }

            const card = battleState.drawPile.pop();
            battleState.hand.push(card);
            playSFX('draw');
            console.log(`[DEBUG-DECK] カードドロー: ${card.name} (山札残り: ${battleState.drawPile.length}枚)`);
        }

        // --- カード発動システム ---
        window.useCardIndex = function(index) {
            if (gameState !== 'battle') return;
            if (index < 0 || index >= battleState.hand.length) return;

            const card = battleState.hand[index];
            if (player.energy < card.cost) {
                showToast("エネルギーが不足しています！");
                return;
            }

            player.energy -= card.cost;
            console.log(`[DEBUG-PLAY] カード使用: ${card.name} (コスト: ${card.cost} / 残りエネルギー: ${player.energy.toFixed(1)})`);
            triggerCardEffect(card);

            battleState.hand.splice(index, 1);
            battleState.discardPile.push(card);

            drawCard();

            renderHandUI();
            updateBattleStatsUI();
        };

        function triggerCardEffect(card) {
            const mult = player.damageMult;
            const dmgStrike = card.upgraded ? 10 : 6;
            const dmgShotgun = card.upgraded ? 7 : 5;
            const defAmt = card.upgraded ? 16 : 10;

            console.log(`[DEBUG-EFFECT] ${card.name} 発動 (火力倍率: ${mult.toFixed(1)}x)`);

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
            else if (card.id === 'dodge') {
                playSFX('dodge');
                const velX = Math.sin(playerMesh.userData.facingAngle);
                const velZ = Math.cos(playerMesh.userData.facingAngle);
                playerMesh.position.x += velX * 8;
                playerMesh.position.z += velZ * 8;
                battleState.invulnTimer = 30;
                drawCard();
            } 
            else if (card.id === 'poison') {
                playSFX('shoot');
                firePoisonShell(card.upgraded);
            } 
            else if (card.id === 'limit') {
                playSFX('buff');
                player.damageMult += 1.0;
                showToast("全カードのダメージが+100%されました！");
                spawnBuffVFX();
            }
        }

        function spawnShieldVFX() {
            battleState.shieldTimer = 180;

            if (battleState.shieldMesh) {
                scene.remove(battleState.shieldMesh);
                battleState.shieldMesh.geometry.dispose();
                battleState.shieldMesh.material.dispose();
            }

            const geom = new THREE.SphereGeometry(1.6, 16, 16);
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

        // --- 弾丸射出関数群 ---
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

        function firePoisonShell(isUpgraded) {
            const targetY = cameraTargetYaw;
            const velocity = new THREE.Vector3(
                Math.sin(targetY) * 0.35,
                0.08,
                Math.cos(targetY) * 0.35
            );

            const geom = new THREE.SphereGeometry(0.4, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.copy(playerMesh.position);
            mesh.position.y += 0.2;
            scene.add(mesh);

            battleState.projectiles.push({
                type: 'poison_shell',
                mesh: mesh,
                velocity: velocity,
                damage: isUpgraded ? 4 : 2,
                life: 120
            });
        }

        if (!battleState.acidDomes) battleState.acidDomes = [];
        
        function createAcidDome(pos, damage) {
            const geom = new THREE.SphereGeometry(4.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
            const edges = new THREE.EdgesGeometry(geom);
            const mat = new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.3 });
            const mesh = new THREE.LineSegments(edges, mat);
            mesh.position.copy(pos);
            mesh.position.y = 0;
            scene.add(mesh);

            battleState.acidDomes.push({
                mesh: mesh,
                position: mesh.position,
                damage: damage,
                life: 240
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
                life: 100
            });
        }

        // --- UIレンダリング系 ---
        function renderHandUI() {
            const container = document.getElementById('hand-cards');
            container.innerHTML = '';

            battleState.hand.forEach((card, idx) => {
                const isAffordable = player.energy >= card.cost;
                const opacityClass = isAffordable ? 'opacity-100' : 'opacity-50';

                const cardDiv = document.createElement('div');
                cardDiv.className = `p-3 rounded-xl border ${card.colorClass} ${opacityClass} cursor-pointer hover:-translate-y-4 hover:brightness-110 active:scale-95 transition-all flex flex-col justify-between w-36 h-48 select-none shadow-lg text-left relative`;
                cardDiv.onclick = () => useCardIndex(idx);

                cardDiv.innerHTML = `
                    <div class="flex flex-col">
                        <div class="flex justify-between items-start">
                            <span class="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-950/80 font-mono border border-white/10">${card.cost}</span>
                            <span class="text-[8px] uppercase tracking-wider text-gray-400 font-bold">${card.type}</span>
                        </div>
                        <h3 class="text-xs font-bold text-white mt-3 tracking-wider">${card.name}</h3>
                        <p class="text-[9px] text-gray-300 mt-1.5 leading-snug">${card.text}</p>
                    </div>

                    <div class="border-t border-white/5 pt-1.5 flex justify-between items-center mt-auto text-[8px] text-gray-400 font-mono">
                        <span>SLOT ${idx + 1}</span>
                        <i class="fa-solid fa-bolt"></i>
                    </div>
                `;

                container.appendChild(cardDiv);
            });
        }

        function updateBattleStatsUI() {
            const nodesContainer = document.getElementById('energy-nodes');
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

        // --- メインゲームループ (3D描画 ＆ ロジック) ---
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

            // --- 0. オートモード自動操作AI ---
            if (isAutoMode && battleState.enemies.length > 0) {
                // 最も近い敵を探索
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
                    // 1. 敵の方向へ自動エイム (カメラの回転目標Yawを補間)
                    const dx = closestEnemy.position.x - playerMesh.position.x;
                    const dz = closestEnemy.position.z - playerMesh.position.z;
                    const targetYaw = Math.atan2(dx, dz);
                    
                    const yawDiff = targetYaw - cameraTargetYaw;
                    cameraTargetYaw += Math.sin(yawDiff) * 0.12; // スムーズなエイム追尾

                    // 2. 自動通常射撃ON
                    isFiring = true;

                    // 3. 自動カード発動（マナが溜まり次第、ストライクや防御を高速自動使用）
                    if (Math.random() < 0.05) { // 5%のフレーム確率でチェック
                        for (let idx = 0; idx < battleState.hand.length; idx++) {
                            const card = battleState.hand[idx];
                            if (player.energy >= card.cost) {
                                console.log(`[DEBUG-AUTO-AI] カードを自動発動: ${card.name} (手札スロット: ${idx+1})`);
                                useCardIndex(idx);
                                break; // 同一フレームでの重複使用防止
                            }
                        }
                    }

                    // 4. 自動移動 (敵の周りを時計回りに円形旋回しながら間合いを調整)
                    const toEnemyX = dx / minDist;
                    const toEnemyZ = dz / minDist;

                    const tangentX = -toEnemyZ; // 接線ベクトル
                    const tangentZ = toEnemyX;

                    const idealDist = 7.0; // 理想とする敵との距離
                    let moveDirX = tangentX * 0.8;
                    let moveDirZ = tangentZ * 0.8;

                    if (minDist > idealDist + 1.0) {
                        // 近づく
                        moveDirX += toEnemyX * 0.4;
                        moveDirZ += toEnemyZ * 0.4;
                    } else if (minDist < idealDist - 1.0) {
                        // 離れる
                        moveDirX -= toEnemyX * 0.4;
                        moveDirZ -= toEnemyZ * 0.4;
                    }

                    playerMesh.userData.facingAngle = Math.atan2(moveDirX, moveDirZ);
                    const moveVec = new THREE.Vector3(moveDirX, 0, moveDirZ).normalize().multiplyScalar(playerMesh.userData.speed);
                    playerMesh.position.add(moveVec);
                }
            } else {
                // 通常射撃自動連射の制御（マニュアル時）
                if (normalShootCooldown > 0) {
                    normalShootCooldown--;
                }
                if (isFiring && (isPointerLocked || isMouseDown) && normalShootCooldown <= 0) {
                    fireNormalBullet();
                    normalShootCooldown = 12; 
                }

                // 通常のマニュアルキー移動
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

            // プレイヤー座標の壁境界制限
            playerMesh.position.x = Math.max(-48, Math.min(48, playerMesh.position.x));
            playerMesh.position.z = Math.max(-48, Math.min(48, playerMesh.position.z));

            // カメラフォロー
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
                playerMesh.rotation.y = cameraTargetYaw; // オート時はエイムを向いて移動
            }

            // --- 2. エネルギー時間回復 ---
            if (player.energy < player.maxEnergy) {
                player.energy = Math.min(player.maxEnergy, player.energy + PARAMS.energyRecoveryPerFrame);
                updateBattleStatsUI();
            }

            // --- 3. バフ・防御シールドアップデート ---
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

            // --- 4. 弾丸アップデート ＆ コリジョン判定 ---
            for (let i = battleState.projectiles.length - 1; i >= 0; i--) {
                const p = battleState.projectiles[i];
                p.mesh.position.add(p.velocity);
                p.life--;

                let isRemoved = false;

                if (p.mesh.position.y < 0.2) {
                    p.mesh.position.y = 0.2;
                    if (p.type === 'poison_shell') {
                        createAcidDome(p.mesh.position, p.damage);
                    }
                    isRemoved = true;
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
                                enemy.userData.hp -= p.damage;
                                spawnHitSpark(p.mesh.position, 0x06b6d4);
                                
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
                                damagePlayer(p.damage);
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

            // --- 5. 毒ガスドームの処理 ---
            for (let dIdx = battleState.acidDomes.length - 1; dIdx >= 0; dIdx--) {
                const dome = battleState.acidDomes[dIdx];
                dome.life--;

                if (dome.life % 20 === 0) {
                    battleState.enemies.forEach(enemy => {
                        const dist = enemy.position.distanceTo(dome.position);
                        if (dist < 4.5) {
                            enemy.userData.hp -= dome.damage;
                            spawnHitSpark(enemy.position, 0x22c55e);
                        }
                    });
                }

                if (dome.life <= 0) {
                    scene.remove(dome.mesh);
                    dome.mesh.geometry.dispose();
                    dome.mesh.material.dispose();
                    battleState.acidDomes.splice(dIdx, 1);
                }
            }

            // --- 6. 敵AI ＆ 移動 ＆ 行動更新 ---
            for (let eIdx = battleState.enemies.length - 1; eIdx >= 0; eIdx--) {
                const enemy = battleState.enemies[eIdx];

                if (enemy.userData.hp <= 0) {
                    playSFX('explosion');
                    console.log(`[DEBUG-KILL] 敵の撃破検出: ${enemy.userData.name}`);
                    spawnExplosion(enemy.position, 0xec4899);
                    scene.remove(enemy);
                    
                    // リソース解放
                    enemy.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                    });

                    battleState.enemies.splice(eIdx, 1);
                    continue;
                }

                const toPlayer = new THREE.Vector3().copy(playerMesh.position).sub(enemy.position);
                const distToPlayer = toPlayer.length();
                toPlayer.y = 0;
                toPlayer.normalize();

                if (distToPlayer > 6) {
                    enemy.position.add(toPlayer.multiplyScalar(enemy.userData.speed));
                } else if (distToPlayer < 3) {
                    enemy.position.sub(toPlayer.multiplyScalar(enemy.userData.speed));
                }

                enemy.userData.intentTimer--;
                if (enemy.userData.intentTimer <= 0) {
                    enemy.userData.intent = Math.random() > 0.4 ? 'attack' : 'defense';
                    enemy.userData.intentTimer = 180 + Math.random() * 60;
                }

                enemy.userData.shootCooldown--;
                if (enemy.userData.shootCooldown <= 0) {
                    if (enemy.userData.intent === 'attack') {
                        fireEnemyBullet(enemy, 6);
                        enemy.userData.shootCooldown = 150 + Math.random() * 60;
                    } 
                    else if (enemy.userData.intent === 'attack_heavy') {
                        fireEnemyBullet(enemy, 15);
                        enemy.userData.shootCooldown = 100;
                    }
                    else if (enemy.userData.intent === 'defense') {
                        playSFX('shield');
                        enemy.userData.hp = Math.min(enemy.userData.maxHp, enemy.userData.hp + 5);
                        spawnHitSpark(enemy.position, 0x3b82f6);
                        enemy.userData.shootCooldown = 180;
                    }
                }

                if (enemy.userData.shootCooldown < 45 && enemy.userData.intent.startsWith('attack')) {
                    drawWarningLine(enemy.position, playerMesh.position);
                }

                updateEnemyIntentUI(enemy);
            }

            // --- 7. パーティクルの更新 ---
            for (let i = battleState.particles.length - 1; i >= 0; i--) {
                const p = battleState.particles[i];
                p.mesh.position.add(p.velocity);
                p.life--;
                if (p.life <= 0) {
                    scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                    battleState.particles.splice(i, 1);
                }
            }

            // --- 8. 勝敗確定の監視 (例外ガード＆即時クリーンアップ) ---
            if (battleState.enemies.length === 0) {
                gameState = 'battle_end';
                isFiring = false;

                console.log(`[DEBUG-WIN] 🎉 戦闘に勝利！ 敵が完全に排除されました。`);
                showToast("戦闘に勝利！ネットワーク障壁を撃破しました。");
                
                // ポインターロック解除時の例外ガード
                try {
                    if (document && document.pointerLockElement === renderer.domElement) {
                        document.exitPointerLock();
                    }
                } catch (err) {
                    console.warn("Pointer lock exit ignored (Expected in Sandbox):", err);
                }

                cleanupBattle3D();

                // 1秒間の余韻の後に確実に2Dドラフト画面へ移行
                setTimeout(() => {
                    if (selectedNode && selectedNode.type === 'boss') {
                        console.log(`[DEBUG-WIN] 全セクターハック完了！`);
                        showPanel('victory');
                    } else {
                        showPanel('reward');
                    }
                }, 1000);
            }
        }

        function damagePlayer(amount) {
            if (player.shield > 0) {
                player.shield -= amount;
                if (player.shield < 0) {
                    player.hp += player.shield;
                    player.shield = 0;
                }
            } else {
                player.hp -= amount;
            }

            console.log(`[DEBUG-DAMAGE] プレイヤー被弾: ${amount}ダメージ (残りHP: ${player.hp.toFixed(1)} / シールド: ${player.shield.toFixed(1)})`);
            updateBattleStatsUI();

            if (player.hp <= 0) {
                player.hp = 0;
                console.log(`[DEBUG-DEATH] 💀 プレイヤーの死亡検知。システムHP枯渇 💀`);
                try {
                    if (document && document.pointerLockElement === renderer.domElement) {
                        document.exitPointerLock();
                    }
                } catch (e) {
                    console.warn(e);
                }
                cleanupBattle3D();
                showPanel('gameover');
            }
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
            console.log(`[DEBUG-NAV] ゲーム開始 [PARAM: ${PARAMS.paramName}]`);
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

        // マップ階層定義
        const MAP_NODE_TYPES = [
            [], // dummy index 0
            [{ type: 'start', label: '開始ノード', desc: 'ネットワーク進入経路' }],
            [{ type: 'fight', label: 'ウイルス防壁', desc: 'セキュリティ検知・中' }, { type: 'fight', label: '隔離セクタ', desc: 'セキュリティ検知・低' }],
            [{ type: 'shop', label: '闇モジュール市場', desc: 'ハックプログラム売買' }, { type: 'fight', label: '感染データ層', desc: 'セキュリティ検知・中' }],
            [{ type: 'elite', label: 'セキュリティ中枢 (Elite)', desc: '強力な親ウイルス検知' }],
            [{ type: 'camp', label: 'システムセーフハウス', desc: 'メモリの解放、修復' }],
            [{ type: 'fight', label: 'システム中核防壁', desc: '高度セキュリティ' }, { type: 'shop', label: '極限データ・トレード', desc: 'ハックプログラム売買' }],
            [{ type: 'camp', label: '最終最適化ノード', desc: '最終防戦への準備' }],
            [{ type: 'boss', label: 'メインフレーム・コア (BOSS)', desc: 'マザーボード全域封鎖の起点' }]
        ];
