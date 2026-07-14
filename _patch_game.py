import os

file_path = 'game.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    # 1. Keybinds
    (
        """                if (gameState === 'battle') {
                    const key = e.key.toLowerCase();
                    if (key === '1') useCardIndex(0);
                    if (key === '2') useCardIndex(1);
                    if (key === '3') useCardIndex(2);
                    if (key === '4') useCardIndex(3);
                    if (key === 'i') useCardIndex(0);
                    if (key === 'k') useCardIndex(1);
                    if (key === 'j' || key === 'l' || key === 'i' || key === 'k') {
                        e.preventDefault();
                    }
                }""",
        """                if (gameState === 'battle') {
                    const key = e.key.toLowerCase();
                    if (key === 'i') useCardIndex(0);
                    if (key === 'k') useCardIndex(1);
                    if (key === 'r') {
                        if (typeof redrawHand === 'function') redrawHand();
                    }
                    if (key === 'j' || key === 'l' || key === 'i' || key === 'k' || key === 'r') {
                        e.preventDefault();
                    }
                }"""
    ),
    # 2. Mouse
    (
        """            // Mouse controls
            window.addEventListener('mousedown', (e) => {
                isMouseDown = true;
                if (gameState === 'battle') {
                    isFiring = true;
                }
            });

            window.addEventListener('mouseup', (e) => {
                isMouseDown = false;
                isFiring = false;
            });""",
        """            // Mouse controls
            window.addEventListener('mousedown', (e) => {
                isMouseDown = true;
            });

            window.addEventListener('mouseup', (e) => {
                isMouseDown = false;
            });"""
    ),
    # 3. Insert Enemy Card
    (
        "const putInHand = battleState.hand.length < 4;",
        "const putInHand = battleState.hand.length < 2;"
    ),
    # 4. Draw Card
    (
        "if (battleState.hand.length >= 4) return;",
        "if (battleState.hand.length >= 2) return;"
    ),
    # 5. Slot UI
    (
        "<span>SLOT ${idx + 1}</span>",
        "<span>SLOT ${idx === 0 ? 'I' : 'K'}</span>"
    ),
    # 6. useCardIndex / redrawHand
    (
        """            battleState.hand.splice(index, 1);
            battleState.discardPile.push(card);

            drawCard();

            renderHandUI();
            updateBattleStatsUI();
        };""",
        """            battleState.hand.splice(index, 1);
            if (card.type === 'power') {
                showToast(`${card.name} exhausted!`);
            } else {
                battleState.discardPile.push(card);
            }

            drawCard();

            renderHandUI();
            updateBattleStatsUI();
        };

        window.redrawHand = function() {
            if (gameState !== 'battle') return;
            const cost = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].redrawCost) || 1;
            if (player.energy < cost) {
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
            
            drawCard();
            drawCard();
            
            renderHandUI();
            updateBattleStatsUI();
        };"""
    ),
    # 7. Initial Deck
    (
        """        function buildInitialDeck() {
            const fixedDeck = [
                { id: 'strike', upgraded: false },
                { id: 'strike', upgraded: false },
                { id: 'strike', upgraded: false },
                { id: 'defend', upgraded: false },
                { id: 'defend', upgraded: false },
                { id: 'defend', upgraded: false },
                { id: 'shotgun', upgraded: false },
                { id: 'limit', upgraded: false }
            ];
            const excluded = new Set(['strike', 'defend', 'shotgun', 'limit']);
            const pool = Object.keys(CARDS).filter(cardId => {
                const card = CARDS[cardId];
                return card && card.type !== 'curse' && !excluded.has(cardId);
            });
            const randomAdds = [];
            while (randomAdds.length < 12 && pool.length > 0) {
                const cardId = pool[Math.floor(Math.random() * pool.length)];
                randomAdds.push({ id: cardId, upgraded: false });
            }
            return fixedDeck.concat(randomAdds);
        }""",
        """        function buildInitialDeck() {
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
        }"""
    ),
    # 8. Shop changes
    (
        """        function renderShopItems(panelElement) {
            const container = panelElement.querySelector('#shop-items-container');
            if (!container) return;
            container.innerHTML = '';

            const shopPool = [
                { card: pickRandomCardFromPool('shop', 0), cost: 40 },
                { card: pickRandomCardFromPool('shop', 0.4), cost: 65 },
                { card: pickRandomCardFromPool('shop', 0.2), cost: 45 },
                { card: null, type: 'heal', cost: 25, label: 'Full System Repair Patch', desc: 'Restore HP to the maximum.' }
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
                        <span class="text-[9px] text-gray-300 mt-1 font-bold">Buy</span>
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
        };""",
        """        function renderShopItems(panelElement) {
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
                itemDiv.className = "shop-item bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex justify-between items-center outline-none focus:ring-2 focus:ring-yellow-400";
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
                    <div class="flex-1 pr-4 pointer-events-none">
                        <p class="text-sm font-bold text-white">${title}</p>
                        <p class="text-[10px] text-gray-400 mt-1">${desc}</p>
                    </div>
                    <button class="shop-buy-btn flex flex-col items-center justify-center p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 active:scale-95 transition-all w-20 flex-shrink-0"
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
        };"""
    ),
    # 9. Auto-fire
    (
        """                // Auto basic-fire control (manual mode)
                if (normalShootCooldown > 0) {
                    normalShootCooldown--;
                }
                if (isFiring && isMouseDown && normalShootCooldown <= 0) {
                    fireNormalBullet();
                    normalShootCooldown = 12; 
                }""",
        """                // Auto basic-fire control (manual mode)
                if (normalShootCooldown > 0) {
                    normalShootCooldown--;
                }
                if (normalShootCooldown <= 0) {
                    fireNormalBullet();
                    normalShootCooldown = 12; 
                }"""
    ),
    # 10. Init Battle variables
    (
        """            battleState.enemies = [];
            battleState.projectiles = [];
            battleState.particles = [];
            battleState.limitBreakCount = 0;
            battleState.shieldTimer = 0;
            battleState.invulnTimer = 0;
            isFiring = false;""",
        """            battleState.enemies = [];
            battleState.projectiles = [];
            battleState.particles = [];
            battleState.limitBreakCount = 0;
            battleState.shieldTimer = 0;
            battleState.invulnTimer = 0;
            battleState.framesElapsed = 0;
            isFiring = false;"""
    ),
    # 11. Enemy Time Scaling Update
    (
        "            // Energy & Deck handling",
        """            // Enemy time scaling
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

            // Energy & Deck handling"""
    ),
    # 12. Stats UI (Time, Buffs, Mult) and Update Calls
    (
        """        function updateBattleStatsUI() {
            const nodesContainer = document.getElementById('energy-nodes');""",
        """        function updateBattleStatsUI() {
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
            }"""
    ),
    # To make sure updateBattleStatsUI is called frequently enough to update time/buffs, let's call it in updateBattleLogic
    (
        "            // Energy & Deck handling",
        """            // Energy & Deck handling
            if (battleState.framesElapsed % 30 === 0) updateBattleStatsUI();"""
    ),
    # 13. Spawn distance
    (
        """            for (let i = 0; i < numEnemies; i++) {
                const angle = (i / numEnemies) * Math.PI * 2 + Math.random();
                const dist = 15 + Math.random() * 5;
                const x = Math.cos(angle) * dist;
                const z = Math.sin(angle) * dist;""",
        """            for (let i = 0; i < numEnemies; i++) {
                const angle = (i / numEnemies) * Math.PI * 2 + Math.random();
                const distRoll = Math.random();
                let dist = 15;
                if (distRoll < 0.33) dist = 5 + Math.random() * 3; // Close
                else if (distRoll < 0.66) dist = 12 + Math.random() * 4; // Mid
                else dist = 22 + Math.random() * 6; // Far
                const x = Math.cos(angle) * dist;
                const z = Math.sin(angle) * dist;"""
    ),
    # 14. Projectile damage scaling
    (
        "if (damagePlayer(p.damage)) return;",
        "if (damagePlayer(p.damage * (p.mesh.userData.damageMult || 1.0))) return;"
    ),
    # 15. Collision damage scaling
    (
        "if (damagePlayer(1)) return;",
        "if (damagePlayer(1 * (enemy.userData.damageMult || 1.0))) return;"
    )
]

for old_text, new_text in replacements:
    if old_text in content:
        content = content.replace(old_text, new_text)
    else:
        print(f"Warning: Chunk not found:\n{old_text[:50]}...")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("game.js modified via Python.")
