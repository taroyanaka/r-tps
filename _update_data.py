import json
import re
import random

random.seed(42)

with open("data.js", "r", encoding="utf-8") as f:
    content = f.read()

def extract_json(var_name, text):
    pattern = rf"window\.{var_name}\s*=\s*(\{{.*?\}}|\[.*?\]);"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    return None

def update_json(var_name, text, new_data):
    pattern = rf"(window\.{var_name}\s*=\s*)(\{{.*?\}}|\[.*?\])(;)"
    def repl(m):
        return m.group(1) + json.dumps(new_data, separators=(',', ':')) + m.group(3)
    return re.sub(pattern, repl, text, flags=re.DOTALL)

cards = extract_json("RTPS_CARD_DATA", content)
params = extract_json("RTPS_PARAM_LIST", content)
enemies = extract_json("RTPS_ENEMY_DEFS", content)

for p in params:
    if "enemyTypesPerBattle" not in p:
        p["enemyTypesPerBattle"] = 5

attack_cards = [card_id for card_id, card in cards['cards'].items() if card['type'] == 'attack']

new_bosses = [
    {
        "id": "boss_2",
        "name": "Obliterator Core (BOSS)",
        "type": "boss",
        "geometry": {"kind": "icosahedron", "radius": 2.5, "detail": 1},
        "color": 15636948,
        "baseHp": 150,
        "speed": 0.015,
        "radius": 2.5,
        "specialCardIds": ["cleave", "strike", "blind"],
        "specialChance": 1.0,
        "specialLabel": "System Overload",
        "attackCard": "whirlwind",
        "attackIntervalFrames": 300
    },
    {
        "id": "boss_3",
        "name": "Hivemind Node (BOSS)",
        "type": "boss",
        "geometry": {"kind": "icosahedron", "radius": 2.5, "detail": 1},
        "color": 16724838,
        "baseHp": 150,
        "speed": 0.015,
        "radius": 2.5,
        "specialCardIds": ["whirlwind", "shotgun", "trip"],
        "specialChance": 1.0,
        "specialLabel": "Fatal Error",
        "attackCard": "whirlwind",
        "attackIntervalFrames": 300
    },
    {
        "id": "boss_4",
        "name": "Singularity Engine (BOSS)",
        "type": "boss",
        "geometry": {"kind": "icosahedron", "radius": 2.5, "detail": 1},
        "color": 5635925,
        "baseHp": 150,
        "speed": 0.015,
        "radius": 2.5,
        "specialCardIds": ["immolate", "sweeping_beam", "leg_sweep"],
        "specialChance": 1.0,
        "specialLabel": "Singularity Event",
        "attackCard": "whirlwind",
        "attackIntervalFrames": 300
    }
]

for card_id in attack_cards:
    enemy_id = f"enemy_{card_id}"
    if enemy_id not in enemies:
        enemies[enemy_id] = {
            "id": enemy_id,
            "name": f"{card_id.replace('_', ' ').title()} Virus",
            "type": "virus",
            "geometry": {"kind": "octahedron", "size": 0.8},
            "color": random.randint(0, 16777215),
            "baseHp": 25,
            "speed": 0.03 + (random.random() * 0.02),
            "radius": 1,
            "specialCardId": None,
            "specialChance": 0,
            "specialLabel": None,
            "attackCard": card_id,
            "attackIntervalFrames": 180 + int(random.random() * 60)
        }

for boss in new_bosses:
    enemies[boss["id"]] = boss

content = update_json("RTPS_PARAM_LIST", content, params)
content = update_json("RTPS_ENEMY_DEFS", content, enemies)

with open("data.js", "w", encoding="utf-8") as f:
    f.write(content)
