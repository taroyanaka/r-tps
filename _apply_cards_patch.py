import json
import re

def main():
    with open('game.js', 'r', encoding='utf-8') as f:
        game_js = f.read()

    # 1. buildInitialDeck
    old_build_initial_deck = r"""        function buildInitialDeck() {
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
    
    new_build_initial_deck = r"""        function buildInitialDeck() {
            if (currentParam && currentParam.paramName === 'test_all_cards') {
                return Object.keys(CARDS).map(id => ({id, upgraded: false}));
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
        }"""
    game_js = game_js.replace(old_build_initial_deck, new_build_initial_deck)

    # 2. damagePlayer
    old_damage_player = r"""        function damagePlayer(amount, attacker = null) {
            if (attacker && attacker.userData && attacker.userData.weakFrames > 0) {
                amount *= 0.75;
            }
            const hadShield = player.shield > 0;
            if (player.shield > 0) {
                player.shield -= amount;
                if (player.shield < 0) {
                    player.hp += player.shield;
                    player.shield = 0;
                }
            } else {
                player.hp -= amount;
            }"""
    new_damage_player = r"""        function damagePlayer(amount, attacker = null, bypassShield = false) {
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
            }"""
    game_js = game_js.replace(old_damage_player, new_damage_player)

    # Add initialization of onHpLossBuffs to initBattle
    game_js = game_js.replace('energyRegenBuffs: [],', 'energyRegenBuffs: [],\n            onHpLossBuffs: [],\n            nextCardPlayedTwice: false,')

    # 3. useCardIndex
    old_use_card = r"""            player.energy -= card.cost;
            console.log(`[DEBUG-PLAY] Card used: ${card.name} (cost: ${card.cost} / remaining energy: ${player.energy.toFixed(1)})`);
            debugState('[DEBUG-PLAY-STATE]', `card=${card.name} slot=${index}`);
            triggerCardEffect(card);

            battleState.hand.splice(index, 1);
            if (card.type === 'power') {
                showToast(`${card.name} exhausted!`);
            } else {
                battleState.discardPile.push(card);
            }"""
    new_use_card = r"""            player.energy -= card.cost;
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
            }"""
    game_js = game_js.replace(old_use_card, new_use_card)

    # 4. updatePlayerMovement (speedMult)
    game_js = game_js.replace('const spd = currentParam.playerSpeed || 0.05;', 'const spd = (currentParam.playerSpeed || 0.05) * (player.speedMult || 1.0);')
    game_js = game_js.replace('damageMult: 1.0,', 'damageMult: 1.0,\n            speedMult: 1.0,')

    # 5. applyDataDrivenCardEffect (effect.kind additions)
    # Finding the end of the switch statement or adding cases before `case 'aoe_front':`
    
    new_cases = r"""                case 'strike_scaling_damage': {
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
                    battleState.drawPile.push({id: 'wound', upgraded: false});
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
"""
    game_js = game_js.replace("case 'aoe_front':", new_cases + "                case 'aoe_front':")

    # 6. apply_debuff for array
    old_apply_debuff = r"""                                    if (effect.debuffType === 'poison') enemy.userData.poison += effectValue;
                                    else if (effect.debuffType === 'vulnerable') enemy.userData.vulnerableFrames += effectValue;
                                    else if (effect.debuffType === 'weak') enemy.userData.weakFrames += effectValue;
                                    else if (effect.debuffType === 'slow') enemy.userData.slowFrames += effectValue;"""
    new_apply_debuff = r"""                                    const types = Array.isArray(effect.debuffTypes) ? effect.debuffTypes : (effect.debuffType ? [effect.debuffType] : []);
                                    for (const t of types) {
                                        if (t === 'poison') enemy.userData.poison += effectValue;
                                        else if (t === 'vulnerable') enemy.userData.vulnerableFrames += effectValue;
                                        else if (t === 'weak') enemy.userData.weakFrames += effectValue;
                                        else if (t === 'slow') enemy.userData.slowFrames += effectValue;
                                    }"""
    game_js = game_js.replace(old_apply_debuff, new_apply_debuff)

    with open('game.js', 'w', encoding='utf-8') as f:
        f.write(game_js)

    # 7. Update data.js
    with open('data.js', 'r', encoding='utf-8') as f:
        data_js = f.read()

    cards_to_add = {
        "perfected_strike": {
            "id": "perfected_strike", "name": "Perfected Strike", "cost": 2, "type": "attack",
            "text": "Deals damage scaling with 'Strike' cards in your deck.",
            "colorClass": "border-red-500 text-red-400 bg-red-950/20", "rarity": "common", "poolType": ["reward", "shop"],
            "effect": { "kind": "strike_scaling_damage", "damageBase": 14, "damagePerStrike": 2, "radius": 10, "colorHex": 16711680 }
        },
        "wild_strike": {
            "id": "wild_strike", "name": "Wild Strike", "cost": 1, "type": "attack",
            "text": "Deals massive damage. Adds a Wound to your draw pile.",
            "colorClass": "border-orange-500 text-orange-400 bg-orange-950/20", "rarity": "common", "poolType": ["reward", "shop"],
            "effect": { "kind": "damage_add_wound_to_draw", "damageBase": 18, "damageUpgraded": 23, "colorHex": 16737792 }
        },
        "hemokinesis": {
            "id": "hemokinesis", "name": "Hemokinesis", "cost": 1, "type": "attack", "hpLoss": 5,
            "text": "Lose 5 HP. Deal high damage in a radius.",
            "colorClass": "border-red-500 text-red-400 bg-red-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "aoe_radial", "damageBase": 18, "radius": 8, "colorHex": 16711680, "sfx": "hit" }
        },
        "die_die_die": {
            "id": "die_die_die", "name": "Die Die Die", "cost": 1, "type": "attack", "exhaust": True,
            "text": "Ethereal(Exhaust). Deal high damage to all nearby enemies.",
            "colorClass": "border-slate-500 text-slate-400 bg-slate-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "aoe_radial", "damageBase": 15, "radius": 15, "colorHex": 11184810, "sfx": "explosion" }
        },
        "energy_regen": {
            "id": "energy_regen", "name": "Energy Regen", "cost": 3, "type": "power",
            "text": "Slightly increases energy recovery rate for the battle.",
            "colorClass": "border-cyan-500 text-cyan-400 bg-cyan-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "energy_recovery_boost", "amountBase": 0.003, "durationFrames": 999999, "toast": "Energy regen increased permanently!" }
        },
        "grand_finale": {
            "id": "grand_finale", "name": "Grand Finale", "cost": 3, "type": "attack", "exhaust": True,
            "text": "Extremely large area, low damage. Exhaust.",
            "colorClass": "border-fuchsia-500 text-fuchsia-400 bg-fuchsia-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "aoe_radial", "damageBase": 5, "radius": 30, "colorHex": 16711935, "sfx": "explosion" }
        },
        "double_tap": {
            "id": "double_tap", "name": "Double Tap", "cost": 2, "type": "skill", "exhaust": True,
            "text": "The next card you play is executed twice. Exhaust.",
            "colorClass": "border-amber-500 text-amber-400 bg-amber-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "double_tap", "sfx": "buff" }
        },
        "offering": {
            "id": "offering", "name": "Offering", "cost": 0, "type": "skill", "exhaust": True,
            "text": "Lose half your HP. Fully recover Energy. Exhaust.",
            "colorClass": "border-red-500 text-red-400 bg-red-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "lose_half_hp_max_energy", "sfx": "buff" }
        },
        "blood_energy": {
            "id": "blood_energy", "name": "Blood Energy", "cost": 1, "type": "power",
            "text": "Whenever you lose HP, recover 1 Energy.",
            "colorClass": "border-cyan-500 text-cyan-400 bg-cyan-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "power_rupture_energy", "amountBase": 1.0, "sfx": "buff" }
        },
        "rupture": {
            "id": "rupture", "name": "Rupture", "cost": 1, "type": "power",
            "text": "Whenever you lose HP, gain 1 Strength.",
            "colorClass": "border-orange-500 text-orange-400 bg-orange-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "power_rupture_strength", "amountBase": 1.0, "sfx": "buff" }
        },
        "footwork": {
            "id": "footwork", "name": "Footwork", "cost": 1, "type": "power",
            "text": "Increases movement speed by 20%.",
            "colorClass": "border-emerald-500 text-emerald-400 bg-emerald-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "power_speed_up", "amountBase": 0.2, "sfx": "buff" }
        },
        "shockwave": {
            "id": "shockwave", "name": "Shockwave", "cost": 2, "type": "skill", "exhaust": True,
            "text": "Apply Vulnerable in a wide area. Exhaust.",
            "colorClass": "border-slate-500 text-slate-400 bg-slate-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "apply_debuff", "debuffType": "vulnerable", "amountBase": 600, "radius": 20, "sfx": "hit" }
        },
        "crippling_cloud": {
            "id": "crippling_cloud", "name": "Crippling Cloud", "cost": 2, "type": "skill", "exhaust": True,
            "text": "Apply Poison and Weak in a wide area. Exhaust.",
            "colorClass": "border-green-500 text-green-400 bg-green-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "apply_debuff", "debuffTypes": ["poison", "weak"], "amountBase": 300, "radius": 20, "sfx": "hit" }
        },
        "slow_cloud": {
            "id": "slow_cloud", "name": "Slow Cloud", "cost": 2, "type": "skill", "exhaust": True,
            "text": "Apply Slow in a wide area. Exhaust.",
            "colorClass": "border-sky-500 text-sky-400 bg-sky-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "apply_debuff", "debuffType": "slow", "amountBase": 400, "radius": 20, "sfx": "hit" }
        },
        "toxic_zone": {
            "id": "toxic_zone", "name": "Toxic Zone", "cost": 1, "type": "skill",
            "text": "Place a Small hazard zone that applies Poison.",
            "colorClass": "border-lime-500 text-lime-400 bg-lime-950/20", "rarity": "common", "poolType": ["reward", "shop"],
            "effect": { "kind": "place_hazard_zone", "sizeBase": "small", "durationFrames": 300, "tickRate": 60, "hazardEffect": {"type": "poison", "amount": 1}, "colorHex": 10741301 }
        },
        "deadly_zone": {
            "id": "deadly_zone", "name": "Deadly Zone", "cost": 2, "type": "skill", "exhaust": True,
            "text": "Place a Medium hazard zone that applies Poison. Exhaust.",
            "colorClass": "border-lime-500 text-lime-400 bg-lime-950/20", "rarity": "uncommon", "poolType": ["reward", "shop"],
            "effect": { "kind": "place_hazard_zone", "sizeBase": "medium", "durationFrames": 450, "tickRate": 60, "hazardEffect": {"type": "poison", "amount": 3}, "colorHex": 10741301 }
        }
    }

    match_cards = re.search(r'window\.RTPS_CARD_DATA\s*=\s*(\{[\s\S]*?\});', data_js)
    if match_cards:
        card_data = json.loads(match_cards.group(1))
        for cid, cdef in cards_to_add.items():
            card_data['cards'][cid] = cdef
            if 'reward' in cdef['poolType']:
                card_data['rewardPool'].append(cid)
            if 'shop' in cdef['poolType']:
                card_data['shopPool'].append(cid)
        new_card_json = json.dumps(card_data, separators=(',', ':'))
        data_js = data_js[:match_cards.start(1)] + new_card_json + data_js[match_cards.end(1):]

    match_params = re.search(r'window\.RTPS_PARAM_LIST\s*=\s*(\[[\s\S]*?\]);', data_js)
    if match_params:
        param_data = json.loads(match_params.group(1))
        # Add test_all_cards
        test_param = param_data[0].copy()
        test_param['paramName'] = 'test_all_cards'
        test_param['enemyHpMult'] = 0.1 # Make enemies die fast just for testing cards?
        param_data.append(test_param)
        new_param_json = json.dumps(param_data, separators=(',', ':'))
        data_js = data_js[:match_params.start(1)] + new_param_json + data_js[match_params.end(1):]

    with open('data.js', 'w', encoding='utf-8') as f:
        f.write(data_js)

if __name__ == '__main__':
    main()
