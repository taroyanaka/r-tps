import re

def main():
    with open('game.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove aoe_front logic
    content = re.sub(r'case\s+[\'"]aoe_front[\'"]\s*:', '', content)

    # 2. Key Reassignment
    content = re.sub(r"if\s*\(\s*key\s*===\s*'k'\s*\)\s*useCardIndex\(1\);", r"if (key === 'k' || key === ' ' || key === 'space') useCardIndex(1);", content)
    content = content.replace("key === 'k' || key === 'r'", "key === 'k' || key === ' ' || key === 'space' || key === 'r'")
    content = content.replace("[K] Right Card", "[Space] Right Card")

    # 3. Boss modifications
    content = re.sub(
        r'attackIntervalFrames:\s*def\.attackIntervalFrames\s*\|\|\s*180,?',
        r'attackIntervalFrames: (def.attackIntervalFrames || 180) / ((window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0].bossAttackFrequencyMultiplier) || 1),',
        content
    )
    content = re.sub(
        r'attackIntervalFrames:\s*def\.attackIntervalFrames\s*\|\|\s*240,?',
        r'attackIntervalFrames: (def.attackIntervalFrames || 240) / ((window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0].bossAttackFrequencyMultiplier) || 1),',
        content
    )
    content = re.sub(
        r'attackCard:\s*def\.attackCard\s*\|\|\s*[\'"]strike[\'"],?',
        r'attackCard: def.attackCard || "strike",\n                specialCardIds: def.specialCardIds,',
        content
    )
    content = re.sub(
        r'attackCard:\s*def\.attackCard\s*\|\|\s*[\'"]whirlwind[\'"],?',
        r'attackCard: def.attackCard || "whirlwind",\n                specialCardIds: def.specialCardIds,',
        content
    )
    
    # Boss attack selection in updateEnemyAction (2 places usually or 1)
    # search for `const cardId = enemy.userData.attackCard || 'strike';` or similar
    boss_attack_injection = r"""let cardId = enemy.userData.attackCard || 'strike';
            if (enemy.userData.type === 'boss' && enemy.userData.specialCardIds && enemy.userData.specialCardIds.length > 0) {
                cardId = enemy.userData.specialCardIds[Math.floor(Math.random() * enemy.userData.specialCardIds.length)];
            }"""
    content = re.sub(r'const\s+cardId\s*=\s*enemy\.userData\.attackCard\s*\|\|\s*[\'"]strike[\'"];', boss_attack_injection, content)
    content = re.sub(r'let\s+cardId\s*=\s*enemy\.userData\.attackCard\s*\|\|\s*[\'"]strike[\'"];', boss_attack_injection, content)
    # Same with cardDef 
    content = re.sub(r'const\s+cardDef\s*=\s*CARDS\[enemy\.userData\.attackCard\s*\|\|\s*[\'"]strike[\'"]\];', 
                     boss_attack_injection + '\n                const cardDef = CARDS[cardId];', content)

    # 4. Wave Spawning
    wave_init_logic = r"""numEnemies = Math.max(1, Math.round(numEnemies * PARAMS.enemyCountMult * 3));
            battleState.totalWaveEnemies = numEnemies;
            battleState.currentWave = 1;
            battleState.maxWaves = PARAMS.waveCount || 4;
            battleState.enemiesPerWave = Math.ceil(numEnemies / battleState.maxWaves);
            numEnemies = Math.min(numEnemies, battleState.enemiesPerWave);
            battleState.remainingWaveEnemiesToSpawn = battleState.totalWaveEnemies - numEnemies;"""
    content = re.sub(r'numEnemies\s*=\s*Math\.max\(1,\s*Math\.round\(numEnemies\s*\*\s*PARAMS\.enemyCountMult\)\);', wave_init_logic, content)

    # Inject spawnNextWave function and logic
    spawn_next_wave_func = r"""
        window.spawnNextWave = function() {
            if (!battleState.remainingWaveEnemiesToSpawn || battleState.remainingWaveEnemiesToSpawn <= 0) return;
            let numEnemies = Math.min(battleState.remainingWaveEnemiesToSpawn, battleState.enemiesPerWave);
            battleState.remainingWaveEnemiesToSpawn -= numEnemies;
            battleState.currentWave++;
            showToast(`Wave ${battleState.currentWave} / ${battleState.maxWaves}`);
            
            let hpFactor = 1.0;
            let speedFactor = 1.0;
            if (battleState.selectedNode && battleState.selectedNode.type === 'elite') {
                hpFactor = 1.8;
                speedFactor = 1.1;
            }
            
            for (let i = 0; i < numEnemies; i++) {
                const angle = (i / numEnemies) * Math.PI * 2 + Math.random();
                let dist = 10 + Math.random() * 5; 
                const x = Math.cos(angle) * dist;
                const z = Math.sin(angle) * dist;

                const availableEnemies = Object.keys(window.RTPS_ENEMY_DEFS).filter(k => window.RTPS_ENEMY_DEFS[k].type !== 'boss' && window.RTPS_ENEMY_DEFS[k].type !== 'elite');
                const enemyType = availableEnemies.length > 0 ? availableEnemies[Math.floor(Math.random() * availableEnemies.length)] : 'glitch';
                createEnemy3D(x, z, enemyType, hpFactor, speedFactor);
            }
        };
"""
    # Insert it before `function createEnemy3D`
    content = content.replace("function createEnemy3D(", spawn_next_wave_func + "\n        function createEnemy3D(")

    # Inject wave trigger in gameLoop
    wave_trigger_logic = r"""
            const powerUpInterval = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].enemyPowerUpInterval) || 600;
            if (battleState.enemies.length === 0 && battleState.remainingWaveEnemiesToSpawn > 0) {
                window.spawnNextWave();
            } else if (battleState.framesElapsed > 0 && battleState.framesElapsed % powerUpInterval === 0) {
                if (battleState.remainingWaveEnemiesToSpawn > 0) {
                    window.spawnNextWave();
                } else {
                    const amt = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].enemyPowerUpAmount) || 1.1;
                    battleState.enemies.forEach(enemy => {
                        if (!enemy.userData.damageMult) enemy.userData.damageMult = 1.0;
                        enemy.userData.damageMult *= amt;
                    });
                    showToast("Enemies grow stronger!");
                }
            }
            """
    
    # We replace the old power up logic block with the wave_trigger_logic
    old_power_up_block = r"""const powerUpInterval = (window\.RTPS_PARAM_LIST && window\.RTPS_PARAM_LIST\[0\] && window\.RTPS_PARAM_LIST\[0\]\.enemyPowerUpInterval) \|\| 600;
\s*if\s*\(battleState\.framesElapsed\s*%\s*powerUpInterval\s*===\s*0\)\s*\{
\s*const\s*amt\s*=\s*\(window\.RTPS_PARAM_LIST\s*&&\s*window\.RTPS_PARAM_LIST\[0\]\s*&&\s*window\.RTPS_PARAM_LIST\[0\]\.enemyPowerUpAmount\)\s*\|\|\s*1\.1;
\s*battleState\.enemies\.forEach\(enemy\s*=>\s*\{
\s*if\s*\(!enemy\.userData\.damageMult\)\s*enemy\.userData\.damageMult\s*=\s*1\.0;
\s*enemy\.userData\.damageMult\s*\*\=\s*amt;
\s*\}\);
\s*showToast\("Enemies grow stronger!"\);
\s*\}"""
    
    content = re.sub(old_power_up_block, wave_trigger_logic.replace('\\', '\\\\'), content, count=1)
    
    # 5. Global Keyboard Navigation for menus
    # At the end of the file, we append the keyboard event listener
    global_keyboard_nav = r"""
    window.addEventListener('keydown', (e) => {
        if (typeof gameState !== 'undefined' && gameState !== 'battle' && gameState !== 'start') {
            const focusables = Array.from(document.querySelectorAll('button:not([disabled]), [tabindex="0"], select'));
            if (focusables.length === 0) return;
            
            const active = document.activeElement;
            let idx = focusables.indexOf(active);
            
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                idx = (idx + 1) % focusables.length;
                focusables[idx].focus();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                idx = (idx - 1 + focusables.length) % focusables.length;
                focusables[idx].focus();
            } else if (e.key === 'Enter') {
                if (active && active.click) {
                    active.click();
                }
            }
        }
    });
"""
    content += global_keyboard_nav

    with open('game.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done")

if __name__ == '__main__':
    main()
