import os
import json
import re

def patch_game_js():
    with open("game.js", "r", encoding="utf-8") as f:
        content = f.read()
        
    # 1. buildInitialDeck
    target_1 = """            if (PARAMS && PARAMS.paramName === 'test_all_cards') {
                return Object.keys(CARDS).map(id => ({id, upgraded: false}));
            }"""
    replace_1 = """            if (PARAMS && PARAMS.paramName === 'test_all_cards') {
                return Object.keys(CARDS).filter(id => id !== 'templates' && CARDS[id].type).map(id => ({id, upgraded: false}));
            }"""
    content = content.replace(target_1, replace_1)
    
    # 2. renderMapNodes
    target_2 = """                container.appendChild(row);
            }
        }"""
    replace_2 = """                container.appendChild(row);
            }
            setTimeout(() => {
                const activeNode = container.querySelector('.ring-purple-500\\\\/50');
                if (activeNode) activeNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }"""
    content = content.replace(target_2, replace_2)
    
    # 3. renderShopItems
    target_3 = """                itemDiv.innerHTML = `
                    <div class="flex-1 pr-4 pointer-events-none">
                        <p class="text-sm font-bold text-white">${title}</p>
                        <p class="text-[10px] text-gray-400 mt-1">${desc}</p>
                    </div>"""
    replace_3 = """                itemDiv.innerHTML = `
                    <div class="flex-1 min-w-0 pr-4 pointer-events-none">
                        <p class="text-sm font-bold text-white truncate">${title}</p>
                        <p class="text-[10px] text-gray-400 mt-1 break-words whitespace-normal">${desc}</p>
                    </div>"""
    content = content.replace(target_3, replace_3)
    
    # 4. drawCard returns boolean
    target_4a = """        function drawCard() {
            if (battleState.hand.length >= 2) return;
            if (battleState.drawLockFrames > 0) return;

            if (battleState.drawPile.length === 0) {
                if (battleState.discardPile.length === 0) return;"""
    replace_4a = """        function drawCard() {
            if (battleState.hand.length >= 2) return false;
            if (battleState.drawLockFrames > 0) return false;

            if (battleState.drawPile.length === 0) {
                if (battleState.discardPile.length === 0) return false;"""
    content = content.replace(target_4a, replace_4a)
    
    target_4b = """            debugState('[DEBUG-DECK-DRAW]', `card=${card.name} upgraded=${!!card.upgraded}`);
            handleDrawnCard(card);
        }"""
    replace_4b = """            debugState('[DEBUG-DECK-DRAW]', `card=${card.name} upgraded=${!!card.upgraded}`);
            handleDrawnCard(card);
            return true;
        }"""
    content = content.replace(target_4b, replace_4b)
    
    # 5. useCardIndex loop
    target_5 = """            while (battleState.hand.length < 2) {
                const initialLen = battleState.hand.length;
                drawCard();
                if (battleState.hand.length === initialLen) break;
            }"""
    replace_5 = """            while (battleState.hand.length < 2) {
                if (!drawCard()) break;
            }"""
    content = content.replace(target_5, replace_5)
    
    # 6. redrawHand loop
    target_6 = """            while (battleState.hand.length < 2) {
                const initialLen = battleState.hand.length;
                drawCard();
                if (battleState.hand.length === initialLen) break;
            }"""
    content = content.replace(target_6, replace_5) # same replacement

    with open("game.js", "w", encoding="utf-8") as f:
        f.write(content)
    print("game.js patched.")

def patch_data_js():
    with open("data.js", "r", encoding="utf-8") as f:
        content = f.read()
        
    match = re.search(r'window\.RTPS_CARD_DATA\s*=\s*(\{.*?\});', content, re.DOTALL)
    if match:
        json_str = match.group(1)
        data = json.loads(json_str)
        
        cards = data.get("cards", {})
        
        # 1. Cost adjustments
        aoe_cards = ["cleave", "whirlwind", "immolate", "consecrate", "reaper", "hemokinesis", "die_die_die", "grand_finale"]
        zone_cards = ["acid_pool", "fire_wall", "toxic_zone", "deadly_zone"]
        
        for c in aoe_cards + zone_cards:
            if c in cards:
                orig_cost = cards[c].get("cost", 1)
                new_cost = max(5, orig_cost * 2)
                cards[c]["cost"] = new_cost
                
                # Update upgrade cost if exists
                if "upgrade" in cards[c] and "cost" in cards[c]["upgrade"]:
                    orig_up_cost = cards[c]["upgrade"]["cost"]
                    cards[c]["upgrade"]["cost"] = max(5, orig_up_cost * 2)
                    
        # 2. Hazard zone duration adjustments
        for c in zone_cards:
            if c in cards and "effect" in cards[c]:
                cards[c]["effect"]["durationFrames"] = 120
                
        new_json_str = json.dumps(data, separators=(',', ':'))
        new_content = content[:match.start()] + f"window.RTPS_CARD_DATA = {new_json_str};" + content[match.end():]
        
        with open("data.js", "w", encoding="utf-8") as f:
            f.write(new_content)
        print("data.js patched.")

patch_game_js()
patch_data_js()
