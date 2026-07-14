// --- UI rendering ---
        function renderHandUI() {
            const container = document.getElementById('hand-cards');
            container.innerHTML = '';

            battleState.hand.forEach((card, idx) => {
                const isAffordable = player.energy >= card.cost;
                const opacityClass = isAffordable ? 'opacity-100' : 'opacity-50';

                const cardDiv = document.createElement('div');
                cardDiv.className = `p-3 rounded-xl border ${card.colorClass} ${opacityClass} cursor-pointer hover:-translate-y-4 hover:brightness-110 active:scale-95 transition-all flex flex-col justify-between w-36 h-48 select-none shadow-lg text-left relative`;
                cardDiv.onclick = () => useCardIndex(idx);
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

        
