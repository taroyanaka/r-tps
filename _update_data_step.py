import re
import json

def main():
    with open('data.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update PARAMS
    match_params = re.search(r'window\.RTPS_PARAM_LIST\s*=\s*(\[[\s\S]*?\]);', content)
    if match_params:
        params_str = match_params.group(1)
        try:
            params = json.loads(params_str)
            for p in params:
                p['playerMaxHp'] = 10
                if p['playerHp'] > 10:
                    p['playerHp'] = 10
            
            new_params = []
            for p in params:
                new_params.append(p)
                p3 = dict(p)
                p3['paramName'] = p['paramName'] + '_hp3'
                # p3['name'] doesn't exist, it's just paramName
                p3['playerMaxHp'] = 30
                p3['playerHp'] = 30
                
                p5 = dict(p)
                p5['paramName'] = p['paramName'] + '_hp5'
                p5['playerMaxHp'] = 50
                p5['playerHp'] = 50
                
                new_params.append(p3)
                new_params.append(p5)
            
            for p in new_params:
                p['waveCount'] = 4
                p['bossAttackFrequencyMultiplier'] = 3

            new_params_str = json.dumps(new_params, separators=(',', ':'))
            content = content[:match_params.start(1)] + new_params_str + content[match_params.end(1):]
        except Exception as e:
            print("Error processing params:", e)

    # 2. Boss Adjustments and enemy_cleave removal
    match_enemies = re.search(r'window\.RTPS_ENEMY_DEFS\s*=\s*(\{[\s\S]*?\});', content)
    if match_enemies:
        enemies_str = match_enemies.group(1)
        try:
            enemies = json.loads(enemies_str)
            if 'enemy_cleave' in enemies:
                del enemies['enemy_cleave']
            
            for key, val in list(enemies.items()):
                if val.get('type') == 'boss':
                    val['baseHp'] *= 3
                    val['specialCardIds'] = ['strike', 'shotgun', 'whirlwind']
                    if 'specialCardId' in val:
                        del val['specialCardId']
            
            new_enemies_str = json.dumps(enemies, separators=(',', ':'))
            content = content[:match_enemies.start(1)] + new_enemies_str + content[match_enemies.end(1):]
        except Exception as e:
            print("Error processing enemies:", e)

    # 3. Remove Cleave Card
    match_cards = re.search(r'window\.RTPS_CARD_DATA\s*=\s*(\{[\s\S]*?\});', content)
    if match_cards:
        cards_str = match_cards.group(1)
        try:
            cards_data = json.loads(cards_str)
            if 'cleave' in cards_data['cards']:
                del cards_data['cards']['cleave']
            if 'cleave' in cards_data['rewardPool']:
                cards_data['rewardPool'].remove('cleave')
            if 'cleave' in cards_data['shopPool']:
                cards_data['shopPool'].remove('cleave')
            if 'aoe_front' in cards_data['templates']['effectKinds']:
                cards_data['templates']['effectKinds'].remove('aoe_front')

            new_cards_str = json.dumps(cards_data, separators=(',', ':'))
            content = content[:match_cards.start(1)] + new_cards_str + content[match_cards.end(1):]
        except Exception as e:
            print("Error processing cards:", e)

    with open('data.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done")

if __name__ == '__main__':
    main()
