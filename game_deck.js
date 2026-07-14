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

        
// --- Deck build and draw engine ---
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        function drawCard() {
            if (battleState.hand.length >= 2) return;
            if (battleState.drawLockFrames > 0) return;

            if (battleState.drawPile.length === 0) {
                if (battleState.discardPile.length === 0) return;
                battleState.drawPile = [...battleState.discardPile];
                shuffleArray(battleState.drawPile);
                battleState.discardPile = [];
                playSFX('draw');
                console.log("[DEBUG-DECK] Rebuild and shuffle the draw pile from the discard pile");
                debugState('[DEBUG-DECK-RESHUFFLE]');
            }

            const card = battleState.drawPile.pop();
            battleState.hand.push(card);
            playSFX('draw');
            console.log(`[DEBUG-DECK] Card drawn: ${card.name} (Draw pile remaining: ${battleState.drawPile.length} cards)`);
            debugState('[DEBUG-DECK-DRAW]', `card=${card.name} upgraded=${!!card.upgraded}`);
            handleDrawnCard(card);
        }

        
// --- Card activation system ---
        window.useCardIndex = function(index) {
            if (gameState !== 'battle') return;
            if (index < 0 || index >= battleState.hand.length) return;

            const card = battleState.hand[index];
            if (player.energy < card.cost) {
                showToast("Not enough energy!");
                debugState('[DEBUG-PLAY-BLOCKED]', `card=${card.name} cost=${card.cost}`);
                return;
            }

            player.energy -= card.cost;
            console.log(`[DEBUG-PLAY] Card used: ${card.name} (cost: ${card.cost} / remaining energy: ${player.energy.toFixed(1)})`);
            debugState('[DEBUG-PLAY-STATE]', `card=${card.name} slot=${index}`);
            triggerCardEffect(card);

            battleState.hand.splice(index, 1);
            if (card.type === 'power') {
                showToast(`${card.name} exhausted!`);
            } else {
                battleState.discardPile.push(card);
            }

            while (battleState.hand.length < 2) {
                const initialLen = battleState.hand.length;
                drawCard();
                if (battleState.hand.length === initialLen) break;
            }

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
            
            while (battleState.hand.length < 2) {
                const initialLen = battleState.hand.length;
                drawCard();
                if (battleState.hand.length === initialLen) break;
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
                                const forward = new THREE.Vector3(Math.sin(cameraTargetYaw), 0, Math.cos(cameraTargetYaw));
                                const toEnemy = new THREE.Vector3(enemy.position.x - origin.x, 0, enemy.position.z - origin.z).normalize();
                                return forward.dot(toEnemy) > 0.25;
                            })();
                            if (isFront) {
                                enemy.userData.hp -= damage * mult;
                                spawnHitSpark(enemy.position, effect.colorHex || 0xec4899);
                                hitCount++;
                            }
                        }
                    });
                    if (effect.kind === 'aoe_drain' && hitCount > 0) {
                        player.hp = Math.min(player.maxHp, player.hp + hitCount * (effect.healPerHit || 2));
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
                mesh.rotation.y = cameraTargetYaw;
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

        
