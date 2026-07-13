import json
import re

file_path = 'c:/Users/taroyanaka/Downloads/r-tps/data.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
for i, line in enumerate(lines):
    if line.startswith('window.RTPS_CARD_DATA = '):
        json_str = line.replace('window.RTPS_CARD_DATA = ', '').rstrip(';')
        data = json.loads(json_str)
        
        cards = data['cards']
        
        # T1-1: Remove defense cards
        def_cards = ['defend', 'shrug_it_off', 'flame_barrier']
        for c in def_cards:
            if c in cards:
                del cards[c]
                
        # T1-2: Remove 0-cost support cards, set others to min cost 1
        zero_cost_supports = ['flex', 'prepared', 'adrenaline', 'turbo', 'battle_trance']
        for c in zero_cost_supports:
            if c in cards:
                del cards[c]
                
        # Set min cost to 1 for non-status, non-curse
        for c_id, card in cards.items():
            if card.get('type') not in ['status', 'curse']:
                if card.get('cost', 0) < 1:
                    card['cost'] = 1
                    if 'upgrade' in card and card['upgrade'].get('cost', 0) < 1:
                        card['upgrade']['cost'] = 1
        
        # T1-3 & T1-4: Buff AoE attacks
        aoe_buffs = ['cleave', 'whirlwind', 'immolate', 'consecrate', 'reaper', 'sweeping_beam']
        for c in aoe_buffs:
            if c in cards:
                eff = cards[c]['effect']
                if 'radius' in eff:
                    eff['radius'] += 3
                if 'spread' in eff:
                    eff['spread'] += 0.2
                if 'damageBase' in eff:
                    eff['damageBase'] = int(eff['damageBase'] * 1.5)
                if 'damageUpgraded' in eff:
                    eff['damageUpgraded'] = int(eff['damageUpgraded'] * 1.5)

        # T5-1: Increase buff duration
        for c_id, card in cards.items():
            if 'effect' in card and 'durationFrames' in card['effect']:
                card['effect']['durationFrames'] += 180

        # Update initial deck in data (though we use game.js, let's keep it clean)
        data['initialDeck'] = [{"id": "strike", "upgraded": False}] * 4
        
        # Clean pools
        removed_cards = set(def_cards + zero_cost_supports)
        if 'rewardPool' in data:
            data['rewardPool'] = [c for c in data['rewardPool'] if c not in removed_cards]
        if 'shopPool' in data:
            data['shopPool'] = [c for c in data['shopPool'] if c not in removed_cards]
            
        lines[i] = 'window.RTPS_CARD_DATA = ' + json.dumps(data, separators=(',', ':')) + ';'

    elif line.startswith('window.RTPS_PARAM_LIST = '):
        json_str = line.replace('window.RTPS_PARAM_LIST = ', '').rstrip(';')
        params = json.loads(json_str)
        for p in params:
            p['redrawCost'] = 1
            p['shopRerollCost'] = 1
            p['enemyPowerUpInterval'] = 600  # 10 seconds at 60fps
            p['enemyPowerUpAmount'] = 1.1    # 10% increase per interval
        lines[i] = 'window.RTPS_PARAM_LIST = ' + json.dumps(params, separators=(',', ':')) + ';'

with open(file_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print("data.js successfully updated via Python.")
