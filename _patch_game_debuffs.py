import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add hazardZones to battleState
content = content.replace(
    'invulnTimer: 0',
    'invulnTimer: 0,\n            hazardZones: []'
)

# 2. Add properties to createEnemy3D
content = content.replace(
    'specialLabel: def.specialLabel\n            };',
    'specialLabel: def.specialLabel,\n                poison: 0, poisonTimer: 0, vulnerableFrames: 0, weakFrames: 0, slowFrames: 0\n            };'
)

# 3. Add properties to spawnBoss (using regex for flexibility)
content = re.sub(
    r'(specialLabel:\s*def\.specialLabel\s*\n\s*\}?;)',
    r'specialLabel: def.specialLabel,\n                poison: 0, poisonTimer: 0, vulnerableFrames: 0, weakFrames: 0, slowFrames: 0\n            };',
    content, count=2
)

# 4. Modify fireEnemyBullet
content = content.replace(
    'damage: damage,\n                life: 100',
    'damage: damage,\n                life: 100,\n                attacker: enemy'
)

# 5. Modify damagePlayer parameter and weak check
content = content.replace(
    'function damagePlayer(amount) {',
    'function damagePlayer(amount, attacker = null) {\n            if (attacker && attacker.userData && attacker.userData.weakFrames > 0) {\n                amount *= 0.75;\n            }'
)

# 6. Modify damagePlayer call in projectile update
content = content.replace(
    'if (damagePlayer(p.damage * (p.mesh.userData.damageMult || 1.0))) return;',
    'if (damagePlayer(p.damage * (p.mesh.userData.damageMult || 1.0), p.attacker)) return;'
)

# 7. Add vulnerable damage multiplier in triggerCardEffect (aoe_front)
content = content.replace(
    'enemy.userData.hp -= damage * mult;',
    'enemy.userData.hp -= damage * mult * (enemy.userData.vulnerableFrames > 0 ? 1.5 : 1);'
)

# 8. Add vulnerable damage multiplier in projectile loop
content = content.replace(
    'enemy.userData.hp -= p.damage;',
    'enemy.userData.hp -= p.damage * (enemy.userData.vulnerableFrames > 0 ? 1.5 : 1);'
)

# 9. Modify enemy speed for slow (around distToPlayer logic)
content = content.replace(
    'toPlayer.multiplyScalar(enemy.userData.speed)',
    'toPlayer.multiplyScalar(enemy.userData.speed * (enemy.userData.slowFrames > 0 ? 0.5 : 1.0))'
)

# 10. Add debuff processing and hazard zones in updateBattleLogic
debuff_update_code = """
                battleState.hazardZones.forEach(zone => {
                    zone.durationFrames--;
                    if (zone.durationFrames % zone.tickRate === 0) {
                        battleState.enemies.forEach(enemy => {
                            if (enemy.position.distanceTo(zone.mesh.position) <= zone.radius) {
                                if (zone.hazardEffect.type === 'damage') {
                                    enemy.userData.hp -= zone.hazardEffect.amount * (enemy.userData.vulnerableFrames > 0 ? 1.5 : 1);
                                    spawnHitSpark(enemy.position, 0xef4444);
                                } else if (zone.hazardEffect.type === 'poison') {
                                    enemy.userData.poison += zone.hazardEffect.amount;
                                    spawnHitSpark(enemy.position, 0xa3e635);
                                }
                            }
                        });
                    }
                });
                
                for (let i = battleState.hazardZones.length - 1; i >= 0; i--) {
                    if (battleState.hazardZones[i].durationFrames <= 0) {
                        scene.remove(battleState.hazardZones[i].mesh);
                        battleState.hazardZones.splice(i, 1);
                    }
                }
"""
content = content.replace(
    '// Enemy time scaling',
    debuff_update_code + '\n            // Enemy time scaling'
)

# Insert per-enemy debuff processing at the top of the enemy loop
enemy_loop_start = 'const toPlayer = new THREE.Vector3().copy(playerMesh.position).sub(enemy.position);'
per_enemy_debuff = """
                if (enemy.userData.vulnerableFrames > 0) enemy.userData.vulnerableFrames--;
                if (enemy.userData.weakFrames > 0) enemy.userData.weakFrames--;
                if (enemy.userData.slowFrames > 0) enemy.userData.slowFrames--;
                
                if (enemy.userData.poison > 0) {
                    enemy.userData.poisonTimer--;
                    if (enemy.userData.poisonTimer <= 0) {
                        enemy.userData.hp -= enemy.userData.poison * (enemy.userData.vulnerableFrames > 0 ? 1.5 : 1);
                        enemy.userData.poison--;
                        enemy.userData.poisonTimer = 60;
                        spawnHitSpark(enemy.position, 0xa3e635);
                    }
                }
"""
content = content.replace(
    enemy_loop_start,
    per_enemy_debuff + '\n                ' + enemy_loop_start
)

# 11. Add apply_debuff and place_hazard_zone to triggerCardEffect
trigger_card_additions = """
                    if (effect.kind === 'apply_debuff') {
                        battleState.enemies.forEach(enemy => {
                            if (enemy.position.distanceTo(origin) <= effect.radius) {
                                const isFront = !effect.isFront || (() => {
                                    const forward = new THREE.Vector3(Math.sin(cameraTargetYaw), 0, Math.cos(cameraTargetYaw));
                                    const toEnemy = new THREE.Vector3(enemy.position.x - origin.x, 0, enemy.position.z - origin.z).normalize();
                                    return forward.dot(toEnemy) > 0.25;
                                })();
                                if (isFront) {
                                    if (effect.debuffType === 'poison') enemy.userData.poison += effectValue;
                                    else if (effect.debuffType === 'vulnerable') enemy.userData.vulnerableFrames += effectValue;
                                    else if (effect.debuffType === 'weak') enemy.userData.weakFrames += effectValue;
                                    else if (effect.debuffType === 'slow') enemy.userData.slowFrames += effectValue;
                                    spawnHitSpark(enemy.position, 0x22c55e);
                                }
                            }
                        });
                        if (effect.gainShieldBase) {
                            const shieldVal = card.upgraded ? effect.gainShieldUpgraded : effect.gainShieldBase;
                            player.shield += shieldVal || 0;
                            spawnShieldVFX();
                        }
                    }
                    if (effect.kind === 'place_hazard_zone') {
                        const effectSizeStr = card.upgraded ? (effect.sizeUpgraded || effect.sizeBase) : (effect.sizeBase || 'medium');
                        const radius = (window.RTPS_HAZARD_ZONE_SIZES && window.RTPS_HAZARD_ZONE_SIZES[effectSizeStr]) || 6.0;
                        const geom = new THREE.CylinderGeometry(radius, radius, 0.1, 32);
                        const mat = new THREE.MeshBasicMaterial({color: effect.colorHex || 0xff0000, transparent: true, opacity: 0.3});
                        const mesh = new THREE.Mesh(geom, mat);
                        mesh.position.copy(origin);
                        mesh.position.y = 0.1;
                        scene.add(mesh);
                        battleState.hazardZones.push({
                            mesh: mesh,
                            radius: radius,
                            durationFrames: effect.durationFrames || 300,
                            tickRate: effect.tickRate || 60,
                            hazardEffect: effect.hazardEffect
                        });
                    }
"""

content = content.replace(
    "case 'conditional_temp_damage_buff':",
    "case 'apply_debuff':\ncase 'place_hazard_zone':\n" + trigger_card_additions + "\n                    return true;\n                case 'conditional_temp_damage_buff':"
)


with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("game.js patched successfully.")
