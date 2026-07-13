import os
import re

file_path = 'game.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Inject Enemy Time Scaling
old_time = "// --- 2. Energy regeneration over time ---"
new_time = """            // Enemy time scaling
            battleState.framesElapsed = (battleState.framesElapsed || 0) + 1;
            const powerUpInterval = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].enemyPowerUpInterval) || 600;
            if (battleState.framesElapsed % powerUpInterval === 0) {
                const amt = (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].enemyPowerUpAmount) || 1.1;
                battleState.enemies.forEach(enemy => {
                    if (!enemy.userData.damageMult) enemy.userData.damageMult = 1.0;
                    enemy.userData.damageMult *= amt;
                });
                showToast("Enemies grow stronger!");
            }
            if (battleState.framesElapsed % 30 === 0) updateBattleStatsUI();

            // --- 2. Energy regeneration over time ---"""

if old_time in content and "Enemy time scaling" not in content:
    content = content.replace(old_time, new_time)

# Replace damage calculation
content = re.sub(r'if \(damagePlayer\(1\)\) return;', r'if (damagePlayer(1 * (enemy.userData.damageMult || 1.0))) return;', content)
content = re.sub(r'if \(damagePlayer\(p\.damage\)\) return;', r'if (damagePlayer(p.damage * (p.mesh.userData.damageMult || 1.0))) return;', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("game.js modified via Python (Part 2).")
