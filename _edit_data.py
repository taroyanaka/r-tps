import json
import re

with open('data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract RTPS_CARD_DATA
match = re.search(r'window\.RTPS_CARD_DATA\s*=\s*(\{.*?\});\s*window\.RTPS_PARAM_LIST', content, re.DOTALL)
if match:
    card_data_str = match.group(1)
    card_data = json.loads(card_data_str)
    
    # Add new cards
    new_cards = {
        "poison_flask": {
            "id": "poison_flask", "name": "Poison Flask", "cost": 1, "type": "skill", 
            "text": "Apply 5 Poison to all nearby enemies.", "colorClass": "border-green-500 text-green-400 bg-green-950/20", 
            "rarity": "uncommon", "poolType": ["reward", "shop"], 
            "effect": {"kind": "apply_debuff", "debuffType": "poison", "amountBase": 5, "amountUpgraded": 8, "radius": 15, "sfx": "hit"}, 
            "upgrade": {"name": "Poison Flask+", "text": "Apply 8 Poison to all nearby enemies."}
        },
        "trip": {
            "id": "trip", "name": "Trip", "cost": 0, "type": "skill", 
            "text": "Apply 10 seconds of Vulnerable to enemies in a broad arc.", "colorClass": "border-slate-500 text-slate-400 bg-slate-950/20", 
            "rarity": "uncommon", "poolType": ["reward", "shop"], 
            "effect": {"kind": "apply_debuff", "debuffType": "vulnerable", "amountBase": 600, "amountUpgraded": 900, "radius": 12, "sfx": "hit", "isFront": True}, 
            "upgrade": {"name": "Trip+", "text": "Apply 15 seconds of Vulnerable."}
        },
        "blind": {
            "id": "blind", "name": "Blind", "cost": 0, "type": "skill", 
            "text": "Apply 5 seconds of Weak to all enemies.", "colorClass": "border-slate-500 text-slate-400 bg-slate-950/20", 
            "rarity": "uncommon", "poolType": ["reward", "shop"], 
            "effect": {"kind": "apply_debuff", "debuffType": "weak", "amountBase": 300, "amountUpgraded": 480, "radius": 100, "sfx": "hit"}, 
            "upgrade": {"name": "Blind+", "text": "Apply 8 seconds of Weak to all enemies."}
        },
        "leg_sweep": {
            "id": "leg_sweep", "name": "Leg Sweep", "cost": 2, "type": "skill", 
            "text": "Apply 5 seconds of Slow to all nearby enemies and gain 10 block.", "colorClass": "border-emerald-500 text-emerald-400 bg-emerald-950/20", 
            "rarity": "rare", "poolType": ["reward", "shop"], 
            "effect": {"kind": "apply_debuff", "debuffType": "slow", "amountBase": 300, "amountUpgraded": 300, "radius": 12, "sfx": "dodge", "gainShieldBase": 10, "gainShieldUpgraded": 10}, 
            "upgrade": {"name": "Leg Sweep+", "cost": 1, "text": "Low cost. Apply 5 seconds of Slow and gain 10 block."}
        },
        "acid_pool": {
            "id": "acid_pool", "name": "Acid Pool", "cost": 2, "type": "skill", 
            "text": "Place a Medium hazard zone that applies Poison for 10s.", "colorClass": "border-lime-500 text-lime-400 bg-lime-950/20", 
            "rarity": "rare", "poolType": ["reward", "shop"], 
            "effect": {"kind": "place_hazard_zone", "sizeBase": "medium", "sizeUpgraded": "large", "durationFrames": 600, "tickRate": 60, "hazardEffect": {"type": "poison", "amount": 2}, "colorHex": 10741301, "sfx": "hit"}, 
            "upgrade": {"name": "Acid Pool+", "text": "Place a Large hazard zone that applies Poison for 10s."}
        },
        "fire_wall": {
            "id": "fire_wall", "name": "Fire Wall", "cost": 3, "type": "attack", 
            "text": "Place a Large hazard zone that deals 10 damage/sec for 5s.", "colorClass": "border-red-500 text-red-400 bg-red-950/20", 
            "rarity": "rare", "poolType": ["reward", "shop"], 
            "effect": {"kind": "place_hazard_zone", "sizeBase": "large", "sizeUpgraded": "large", "durationFrames": 300, "tickRate": 60, "hazardEffect": {"type": "damage", "amount": 10}, "colorHex": 15680580, "sfx": "explosion"}, 
            "upgrade": {"name": "Fire Wall+", "cost": 2, "text": "Low cost. Place a Large hazard zone that deals 10 damage/sec."}
        }
    }
    
    card_data["cards"].update(new_cards)
    for pool in ["rewardPool", "shopPool"]:
        card_data[pool].extend(["poison_flask", "trip", "blind", "leg_sweep", "acid_pool", "fire_wall"])
        
    card_data["templates"]["effectKinds"].extend(["apply_debuff", "place_hazard_zone"])
    
    new_card_data_str = json.dumps(card_data, separators=(',', ':'))
    
    # Replace in content
    content = content.replace(card_data_str, new_card_data_str)
    
    # Add RTPS_HAZARD_ZONE_SIZES to the end if not exists
    if 'RTPS_HAZARD_ZONE_SIZES' not in content:
        content += '\nwindow.RTPS_HAZARD_ZONE_SIZES = {"small": 3.0, "medium": 6.0, "large": 10.0};\n'
    
    with open('data.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully updated data.js")
else:
    print("Failed to find RTPS_CARD_DATA")
