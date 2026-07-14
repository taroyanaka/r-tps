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
            const rerollDiv = document.createElement('div');
            rerollDiv.className = "mb-4 text-center";
            rerollDiv.innerHTML = `
                <button onclick="rerollShop()" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded" ${player.gold < rerollCost ? 'disabled' : ''}>
                    Reroll Shop (Cost: <i class="fa-solid fa-coins mr-1"></i>${rerollCost})
                </button>
            `;
            container.appendChild(rerollDiv);

            const shopSlots = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].shopSlotCount) || 8;
            const shopPool = [];
            for (let i = 0; i < shopSlots - 1; i++) {
                shopPool.push({ card: pickRandomCardFromPool('shop', 0.2), cost: 80 + Math.floor(Math.random() * 40) });
            }
            shopPool.push({ card: null, type: 'heal', cost: 50, label: 'Full System Repair Patch', desc: 'Restore HP to the maximum.' });

            const gridDiv = document.createElement('div');
            gridDiv.className = "grid grid-cols-1 md:grid-cols-2 gap-4";
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
            const selected = [];
            while (selected.length < 3) {
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

        
