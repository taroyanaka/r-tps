// --- 3D setup ---
        function initThree() {
            const container = document.getElementById('game-canvas');
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x030308, 0.02);

            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            
            renderer = new THREE.WebGLRenderer({ canvas: container, antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

            // Lighting
            ambientLight = new THREE.AmbientLight(0x0f0a20, 1.5);
            scene.add(ambientLight);

            dirLight = new THREE.DirectionalLight(0xec4899, 1.0);
            dirLight.position.set(20, 40, 20);
            scene.add(dirLight);

            // Ground
            const floorGeo = new THREE.PlaneGeometry(100, 100, 20, 20);
            const floorMat = new THREE.MeshBasicMaterial({
                color: 0xec4899,
                wireframe: true,
                transparent: true,
                opacity: 0.15
            });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = 0;
            scene.add(floor);

            // Boundary walls
            const wallGeo = new THREE.BoxGeometry(100, 15, 100);
            const wallEdges = new THREE.EdgesGeometry(wallGeo);
            const wallLine = new THREE.LineSegments(wallEdges, new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.1 }));
            wallLine.position.y = 7.5;
            scene.add(wallLine);

            createPlayerAvatar();

            window.addEventListener('resize', () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            });
        }

        function createPlayerAvatar() {
            const group = new THREE.Group();

            // Head
            const headGeo = new THREE.OctahedronGeometry(0.5);
            const edgesGeo = new THREE.EdgesGeometry(headGeo);
            const headLine = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 }));
            const headCore = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: 0x0891b2, transparent: true, opacity: 0.3 }));
            group.add(headLine);
            group.add(headCore);

            // Body
            const bodyGeo = new THREE.ConeGeometry(0.6, 1.5, 4);
            const bodyEdges = new THREE.EdgesGeometry(bodyGeo);
            const bodyLine = new THREE.LineSegments(bodyEdges, new THREE.LineBasicMaterial({ color: 0x3b82f6 }));
            bodyLine.position.y = -1.0;
            const bodyCore = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.3 }));
            bodyCore.position.y = -1.0;
            group.add(bodyLine);
            group.add(bodyCore);

            // Thruster
            const thrustGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
            const thrust = new THREE.Mesh(thrustGeo, new THREE.MeshBasicMaterial({ color: 0xec4899 }));
            thrust.position.set(0, -1.8, -0.3);
            group.add(thrust);

            group.position.set(0, 2, 0);
            scene.add(group);
            playerMesh = group;

            playerMesh.userData = {
                velocity: new THREE.Vector3(0, 0, 0),
                speed: 0.14,
                facingAngle: 0
            };
        }

        
// --- Battle phase system (real-time 3D TPS) ---
        function initBattlePhase() {
            console.log(`[DEBUG-INIT] 徴 Battle sector initialized 徴 Deck size: ${player.deck.length} cards`);
            debugState('[DEBUG-BATTLE-INIT]');
            cleanupBattle3D();

            playerMesh.position.set(0, 1.2, 0);
            playerMesh.rotation.set(0, 0, 0);

            battleState.drawPile = [...player.deck];
            shuffleArray(battleState.drawPile);
            battleState.hand = [];
            battleState.discardPile = [];
            battleState.enemies = [];
            battleState.projectiles = [];
            battleState.particles = [];
            battleState.limitBreakCount = 0;
            battleState.shieldTimer = 0;
            battleState.invulnTimer = 0;
            battleState.framesElapsed = 0;
            isFiring = false;
            normalShootCooldown = 0;
            player.shield = 0;
            player.energy = PARAMS.playerEnergy;
            player.damageMult = 1.0;

            spawnEnemiesForStage();

            for (let i = 0; i < 4; i++) {
                drawCard();
            }

            renderHandUI();
            updateBattleStatsUI();
        }

        function spawnEnemiesForStage() {
            let numEnemies = 2;
            let speedFactor = 1.0;
            let hpFactor = 1.0;

            if (selectedNode && selectedNode.type === 'elite') {
                numEnemies = 3;
                hpFactor = 1.8;
                speedFactor = 1.1;
            } else if (selectedNode && selectedNode.type === 'boss') {
                numEnemies = 1;
                spawnBoss();
                return;
            }

            numEnemies = Math.max(1, Math.round(numEnemies * PARAMS.enemyCountMult));
            debugState('[DEBUG-SPAWN-PLAN]', `node=${selectedNode ? selectedNode.type : 'none'} enemies=${numEnemies} hpFactor=${hpFactor.toFixed(2)} speedFactor=${speedFactor.toFixed(2)}`);

            for (let i = 0; i < numEnemies; i++) {
                const angle = (i / numEnemies) * Math.PI * 2 + Math.random();
                const distRoll = Math.random();
                let dist = 15;
                if (distRoll < 0.33) dist = 5 + Math.random() * 3; // Close
                else if (distRoll < 0.66) dist = 12 + Math.random() * 4; // Mid
                else dist = 22 + Math.random() * 6; // Far
                const x = Math.cos(angle) * dist;
                const z = Math.sin(angle) * dist;

            const enemyRoll = Math.random();
            const enemyType = enemyRoll < 0.18 ? 'scout' : (enemyRoll < 0.59 ? 'glitch' : 'sentinel');
            createEnemy3D(x, z, enemyType, hpFactor, speedFactor);
        }
        }

        function createEnemy3D(x, z, type, hpFactor = 1.0, speedFactor = 1.0) {
            const group = new THREE.Group();
            const def = getEnemyDef(type);
            const geometry = def.geometry.kind === 'octahedron'
                ? new THREE.OctahedronGeometry(def.geometry.size)
                : def.geometry.kind === 'icosahedron'
                    ? new THREE.IcosahedronGeometry(def.geometry.radius, def.geometry.detail)
                    : new THREE.BoxGeometry(def.geometry.width, def.geometry.height, def.geometry.depth);
            const color = def.color;
            const name = def.name;
            let maxHp = def.baseHp * hpFactor * PARAMS.enemyHpMult;
            let speed = def.speed * speedFactor;

            if (isAutoMode) maxHp /= 10;

            const wireframe = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({ color: color, linewidth: 2 })
            );
            const core = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.25 }));

            group.add(wireframe);
            group.add(core);
            group.position.set(x, 1.2, z);
            scene.add(group);

            const intentSprite = createIntentSprite(name);
            intentSprite.position.y = 1.6;
            group.add(intentSprite);

            group.userData = {
                id: Math.random().toString(36).substr(2, 9),
                type: def.type,
                defId: def.id,
                name: name,
                hp: maxHp,
                maxHp: maxHp,
                speed: speed,
                shield: 0,
                shootCooldown: 120 + Math.random() * 60,
                intent: 'attack',
                intentTimer: 180,
                specialCooldown: 240 + Math.random() * 120,
                intentSprite: intentSprite,
                radius: def.radius,
                specialCardId: def.specialCardId,
                specialChance: def.specialChance || 0,
                specialLabel: def.specialLabel
            };

            battleState.enemies.push(group);
            console.log(`[DEBUG-SPAWN] Enemy spawned: ${name} (HP: ${maxHp.toFixed(1)}) at [${x.toFixed(1)}, ${z.toFixed(1)}]`);
            debugState('[DEBUG-SPAWN-STATE]', `enemy=${name} type=${type}`);
        }

        function spawnBoss() {
            const def = getEnemyDef('boss');
            const group = new THREE.Group();
            const geometry = new THREE.IcosahedronGeometry(def.geometry.radius, def.geometry.detail);
            const color = def.color; 

            const wireframe = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({ color: color, linewidth: 3 })
            );
            const core = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.3 }));

            group.add(wireframe);
            group.add(core);
            group.position.set(0, 3, 18);
            scene.add(group);

            let maxHp = def.baseHp;
            if (isAutoMode) {
                maxHp /= 10;
            }

            const intentSprite = createIntentSprite(def.name);
            intentSprite.position.y = 3.5;
            group.add(intentSprite);

            group.userData = {
                id: 'boss-core',
                type: def.type,
                defId: def.id,
                name: def.name,
                hp: maxHp,
                maxHp: maxHp,
                speed: def.speed,
                shield: 0,
                shootCooldown: 80,
                intent: 'attack_heavy',
                intentTimer: 200,
                intentSprite: intentSprite,
                radius: def.radius,
                specialCardId: def.specialCardId,
                specialChance: def.specialChance || 0,
                specialLabel: def.specialLabel,
                specialCooldown: 180
            };

            battleState.enemies.push(group);
            console.log(`[DEBUG-SPAWN] Boss spawned: ${def.name} (HP: ${maxHp.toFixed(1)})`);
            debugState('[DEBUG-BOSS-STATE]', `enemy=${def.name}`);
        }

        function createIntentSprite(name) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.fillRect(0, 0, 256, 64);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.strokeRect(2, 2, 252, 60);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(name, 10, 25);

            ctx.fillStyle = '#f43f5e';
            ctx.font = '14px monospace';
            ctx.fillText('Attack: LASER BEAM', 10, 48);

            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(3, 0.75, 1);

            sprite.userData = { ctx: ctx, canvas: canvas, texture: texture };
            return sprite;
        }

        function updateEnemyIntentUI(enemy) {
            const sprite = enemy.userData.intentSprite;
            const ctx = sprite.userData.ctx;
            const canvas = sprite.userData.canvas;
            
            ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
            ctx.fillRect(0, 0, 256, 64);
            ctx.strokeStyle = enemy.userData.type === 'boss' ? '#ef4444' : '#ec4899';
            ctx.lineWidth = 2;
            ctx.strokeRect(2, 2, 252, 60);

            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 15px sans-serif';
            ctx.fillText(`${enemy.userData.name}`, 10, 25);
            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(`HP: ${Math.ceil(enemy.userData.hp)}/${Math.ceil(enemy.userData.maxHp)}`, 150, 25);

            let text = "";
            let color = "#ffffff";
            if (enemy.userData.intent === 'attack') {
                text = "Attack prediction (6 DMG)";
                color = "#f43f5e";
            } else if (enemy.userData.intent === 'attack_heavy') {
                text = "Giga beam round (15 DMG)";
                color = "#ef4444";
            } else if (enemy.userData.intent === 'defense') {
                text = "Barrier load (+10 BLOCK)";
                color = "#3b82f6";
            } else if (enemy.userData.intent === 'special') {
                const cardName = enemy.userData.specialCardId && CARDS[enemy.userData.specialCardId]
                    ? CARDS[enemy.userData.specialCardId].name
                    : "Corruption";
                text = `Special: ${cardName}`;
                color = "#a855f7";
            }

            ctx.fillStyle = color;
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(text, 10, 48);

            sprite.userData.texture.needsUpdate = true;
        }

        function cleanupBattle3D() {
            // Safe removal and resource release (dispose)
            if (battleState.enemies) {
                battleState.enemies.forEach(e => {
                    scene.remove(e);
                    e.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                    });
                });
                battleState.enemies = [];
            }
            if (battleState.projectiles) {
                battleState.projectiles.forEach(p => {
                    scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                });
                battleState.projectiles = [];
            }
            if (battleState.particles) {
                battleState.particles.forEach(p => {
                    scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                });
                battleState.particles = [];
            }
            if (battleState.shieldMesh) {
                scene.remove(battleState.shieldMesh);
                battleState.shieldMesh.geometry.dispose();
                battleState.shieldMesh.material.dispose();
                battleState.shieldMesh = null;
            }

            if (warningLineMesh) {
                scene.remove(warningLineMesh);
                warningLineMesh.geometry.dispose();
                warningLineMesh.material.dispose();
                warningLineMesh = null;
            }
        }

        
// --- Projectile spawning helpers ---
        function fireNormalBullet() {
            playSFX('shoot');
            const targetY = cameraTargetYaw;
            const velocity = new THREE.Vector3(
                Math.sin(targetY) * 0.5,
                0,
                Math.cos(targetY) * 0.5
            );

            const geom = new THREE.SphereGeometry(0.18, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.copy(playerMesh.position);
            mesh.position.y += 0.2;
            scene.add(mesh);

            battleState.projectiles.push({
                type: 'player_normal',
                mesh: mesh,
                velocity: velocity,
                damage: 2,
                life: 60
            });
        }

        function fireCardBullet(angleOffset, colorHex, damage, size, isEnemy = false, caster = null) {
            let targetY = cameraTargetYaw + angleOffset;
            if (isEnemy && caster) {
                targetY = Math.atan2(playerMesh.position.x - caster.position.x, playerMesh.position.z - caster.position.z) + angleOffset;
            }
            const velocity = new THREE.Vector3(
                Math.sin(targetY) * 0.6,
                0,
                Math.cos(targetY) * 0.6
            );

            const geom = new THREE.SphereGeometry(size, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: colorHex });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.copy(isEnemy && caster ? caster.position : playerMesh.position);
            mesh.position.y += 0.2;
            scene.add(mesh);

            battleState.projectiles.push({
                type: isEnemy ? 'enemy_card' : 'player_card',
                mesh: mesh,
                velocity: velocity,
                damage: damage,
                life: 60
            });
        }

        function fireEnemyBullet(enemy, damage) {
            playSFX('hit');
            const targetDir = new THREE.Vector3().copy(playerMesh.position).sub(enemy.position).normalize();
            const velocity = targetDir.multiplyScalar(0.18);

            const geom = new THREE.SphereGeometry(0.25, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.copy(enemy.position);
            mesh.position.y = 1.0;
            scene.add(mesh);

            battleState.projectiles.push({
                type: 'enemy_normal',
                mesh: mesh,
                velocity: velocity,
                damage: damage,
                life: 100
            });
        }

        
// --- Main game loop (3D rendering and logic) ---
        let lastTime = 0;
        function gameLoop(time) {
            requestAnimationFrame(gameLoop);
            
            if (time - lastTime < 16) return;
            lastTime = time;

            if (gameState === 'battle') {
                const iterations = isAutoMode ? PARAMS.autoModeSpeedMult : 1;
                for (let i = 0; i < iterations; i++) {
                    updateBattleLogic();
                }
            }

            renderer.render(scene, camera);
        }

        function updateBattleLogic() {
            if (gameState !== 'battle') return;

            // --- 0. Auto mode AI ---
            if (isAutoMode && battleState.enemies.length > 0) {
                // Find the nearest enemy
                let closestEnemy = null;
                let minDist = Infinity;
                battleState.enemies.forEach(enemy => {
                    const dist = playerMesh.position.distanceTo(enemy.position);
                    if (dist < minDist) {
                        minDist = dist;
                        closestEnemy = enemy;
                    }
                });

                if (closestEnemy) {
                    // 1. Auto-aim toward the enemy (interpolate the camera yaw target)
                    const dx = closestEnemy.position.x - playerMesh.position.x;
                    const dz = closestEnemy.position.z - playerMesh.position.z;
                    const targetYaw = Math.atan2(dx, dz);
                    
                    const yawDiff = targetYaw - cameraTargetYaw;
                    cameraTargetYaw += Math.sin(yawDiff) * 0.12; // Smooth aim tracking

                    // 2. Enable auto basic fire
                    isFiring = true;

                    // 3. Auto-play cards whenever energy is available.
                    // Keep consuming playable cards to avoid random stalls in automation.
                    let playedCard = false;
                    do {
                        playedCard = false;
                        for (let idx = 0; idx < battleState.hand.length; idx++) {
                            const card = battleState.hand[idx];
                            if (player.energy >= card.cost) {
                                console.log(`[DEBUG-AUTO-AI] Auto-play card: ${card.name} (hand slot: ${idx+1})`);
                                useCardIndex(idx);
                                playedCard = true;
                                break;
                            }
                        }
                    } while (playedCard && player.energy > 0 && gameState === 'battle');

                    // 4. Auto-move (circle the enemy clockwise while adjusting range)
                    const toEnemyX = dx / minDist;
                    const toEnemyZ = dz / minDist;

                    const tangentX = -toEnemyZ; // Tangent vector
                    const tangentZ = toEnemyX;

                    const idealDist = 7.0; // Desired distance to the enemy
                    let moveDirX = tangentX * 0.8;
                    let moveDirZ = tangentZ * 0.8;

                    if (minDist > idealDist + 1.0) {
                        // Move closer
                        moveDirX += toEnemyX * 0.4;
                        moveDirZ += toEnemyZ * 0.4;
                    } else if (minDist < idealDist - 1.0) {
                        // Move away
                        moveDirX -= toEnemyX * 0.4;
                        moveDirZ -= toEnemyZ * 0.4;
                    }

                    playerMesh.userData.facingAngle = Math.atan2(moveDirX, moveDirZ);
                    const moveVec = new THREE.Vector3(moveDirX, 0, moveDirZ).normalize().multiplyScalar(playerMesh.userData.speed);
                    playerMesh.position.add(moveVec);
                }
            } else {
                // Auto basic-fire control (manual mode)
                if (normalShootCooldown > 0) {
                    normalShootCooldown--;
                }
                if (normalShootCooldown <= 0) {
                    fireNormalBullet();
                    normalShootCooldown = 12; 
                }

                // Standard manual key movement
                if (keys['j']) {
                    cameraTargetYaw += 0.045;
                }
                if (keys['l']) {
                    cameraTargetYaw -= 0.045;
                }

                let moveX = 0;
                let moveZ = 0;

                if (keys['w'] || keys['s'] || keys['a'] || keys['d']) {
                    const forward = new THREE.Vector3(Math.sin(cameraTargetYaw), 0, Math.cos(cameraTargetYaw));
                    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

                    if (keys['w']) {
                        moveX += forward.x;
                        moveZ += forward.z;
                    }
                    if (keys['s']) {
                        moveX -= forward.x;
                        moveZ -= forward.z;
                    }
                    if (keys['d']) {
                        moveX -= right.x;
                        moveZ -= right.z;
                    }
                    if (keys['a']) {
                        moveX += right.x;
                        moveZ += right.z;
                    }

                    playerMesh.userData.facingAngle = Math.atan2(moveX, moveZ);
                }

                const dir = new THREE.Vector3(moveX, 0, moveZ);
                if (dir.lengthSq() > 0) {
                    dir.normalize().multiplyScalar(playerMesh.userData.speed);
                    playerMesh.position.add(dir);
                }
            }

            // Clamp the player position to the arena bounds
            playerMesh.position.x = Math.max(-48, Math.min(48, playerMesh.position.x));
            playerMesh.position.z = Math.max(-48, Math.min(48, playerMesh.position.z));

            // Camera follow
            const camDist = 7.5;
            if (keys['arrowup']) {
                cameraTargetPitch = Math.min(0.8, cameraTargetPitch + 0.02);
            }
            if (keys['arrowdown']) {
                cameraTargetPitch = Math.max(-0.4, cameraTargetPitch - 0.02);
            }
            const targetCamX = playerMesh.position.x - Math.sin(cameraTargetYaw) * camDist;
            const targetCamZ = playerMesh.position.z - Math.cos(cameraTargetYaw) * camDist;
            const targetCamY = playerMesh.position.y + 3.0 + cameraTargetPitch * camDist;

            camera.position.set(targetCamX, targetCamY, targetCamZ);
            const lookTarget = new THREE.Vector3().copy(playerMesh.position).add(
                new THREE.Vector3(Math.sin(cameraTargetYaw) * 3, 0.5, Math.cos(cameraTargetYaw) * 3)
            );
            camera.lookAt(lookTarget);

            if (!isAutoMode) {
                playerMesh.rotation.y = playerMesh.userData.facingAngle;
            } else {
                playerMesh.rotation.y = cameraTargetYaw; // Face the aim direction while moving in auto mode
            }

            if (battleState.tempDamageBuffs.length > 0) {
                for (let i = battleState.tempDamageBuffs.length - 1; i >= 0; i--) {
                    battleState.tempDamageBuffs[i].life--;
                    if (battleState.tempDamageBuffs[i].life <= 0) {
                        battleState.tempDamageBuffs.splice(i, 1);
                    }
                }
            }

            if (battleState.drawLockFrames > 0) {
                battleState.drawLockFrames--;
            }

            if (battleState.energyRegenBuffs.length > 0) {
                for (let i = battleState.energyRegenBuffs.length - 1; i >= 0; i--) {
                    battleState.energyRegenBuffs[i].life--;
                    if (battleState.energyRegenBuffs[i].life <= 0) {
                        battleState.energyRegenBuffs.splice(i, 1);
                    }
                }
            }

            if (battleState.pendingRetaliation) {
                battleState.pendingRetaliation.life--;
                if (battleState.pendingRetaliation.life <= 0) {
                    battleState.pendingRetaliation = null;
                }
            }

            if (battleState.onHitShieldGain) {
                battleState.onHitShieldGain.life--;
                if (battleState.onHitShieldGain.life <= 0) {
                    battleState.onHitShieldGain = null;
                }
            }

                        // Enemy time scaling
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

            // --- 2. Energy regeneration over time ---
            if (player.energy < player.maxEnergy) {
                const bonusRegen = battleState.energyRegenBuffs.reduce((sum, buff) => sum + (buff.amount || 0), 0);
                player.energy = Math.min(player.maxEnergy, player.energy + PARAMS.energyRecoveryPerFrame + bonusRegen);
                updateBattleStatsUI();
            }

            // --- 3. Buff and defense shield updates ---
            if (battleState.shieldTimer > 0) {
                battleState.shieldTimer--;
                if (battleState.shieldMesh) {
                    battleState.shieldMesh.position.copy(playerMesh.position);
                }
                if (battleState.shieldTimer <= 0 || player.shield <= 0) {
                    player.shield = 0;
                    if (battleState.shieldMesh) {
                        scene.remove(battleState.shieldMesh);
                        battleState.shieldMesh.geometry.dispose();
                        battleState.shieldMesh.material.dispose();
                        battleState.shieldMesh = null;
                    }
                    updateBattleStatsUI();
                }
            }

            if (battleState.invulnTimer > 0) {
                battleState.invulnTimer--;
            }

            if (battleState.pendingEnergyBonus > 0 && battleState.hand.length === 0) {
                player.energy = Math.min(player.maxEnergy, player.energy + battleState.pendingEnergyBonus);
                battleState.pendingEnergyBonus = 0;
                updateBattleStatsUI();
            }

            // --- 4. Projectile updates and collision checks ---
            for (let i = battleState.projectiles.length - 1; i >= 0; i--) {
                const p = battleState.projectiles[i];
                if (!p || !p.mesh) {
                    battleState.projectiles.splice(i, 1);
                    continue;
                }
                p.mesh.position.add(p.velocity);
                p.life--;

                let isRemoved = false;

                if (p.mesh.position.y < 0.2) {
                    p.mesh.position.y = 0.2;
                }

                if (Math.abs(p.mesh.position.x) > 49 || Math.abs(p.mesh.position.z) > 49) {
                    isRemoved = true;
                }

                if (!isRemoved) {
                    if (p.type.startsWith('player')) {
                        for (let eIdx = battleState.enemies.length - 1; eIdx >= 0; eIdx--) {
                            const enemy = battleState.enemies[eIdx];
                            const dist = p.mesh.position.distanceTo(enemy.position);

                            if (dist < (enemy.userData.radius + 0.4)) {
                                playSFX('hit');
                                enemy.userData.hp -= p.damage;
                                spawnHitSpark(p.mesh.position, 0x06b6d4);
                                if (battleState.onHitShieldGain) {
                                    player.shield += battleState.onHitShieldGain.amount || 0;
                                    spawnShieldVFX();
                                }
                                
                                if (p.type === 'player_normal') {
                                    player.energy = Math.min(player.maxEnergy, player.energy + PARAMS.energyRecoveryOnHit);
                                    updateBattleStatsUI();
                                }

                                isRemoved = true;
                                break;
                            }
                        }
                    } 
                    else if (p.type.startsWith('enemy')) {
                        const dist = p.mesh.position.distanceTo(playerMesh.position);
                        if (dist < 1.1) {
                            if (battleState.invulnTimer <= 0) {
                                playSFX('hit');
                                if (damagePlayer(p.damage * (p.mesh.userData.damageMult || 1.0))) return;
                                spawnHitSpark(playerMesh.position, 0xef4444);
                            }
                            isRemoved = true;
                        }
                    }
                }

                if (p.life <= 0) {
                    isRemoved = true;
                }

                if (isRemoved) {
                    scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                    battleState.projectiles.splice(i, 1);
                }
            }

            // --- 5. Enemy AI, movement, and actions ---
            for (let eIdx = battleState.enemies.length - 1; eIdx >= 0; eIdx--) {
                const enemy = battleState.enemies[eIdx];

                if (enemy.userData.hp <= 0) {
                    playSFX('explosion');
                    console.log(`[DEBUG-KILL] Enemy defeated: ${enemy.userData.name}`);
                    debugState('[DEBUG-KILL-STATE]', `enemy=${enemy.userData.name}`);
                    spawnExplosion(enemy.position, 0xec4899);
                    scene.remove(enemy);
                    
                    // Release resources
                    enemy.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                    });

                    battleState.enemies.splice(eIdx, 1);
                    if (gameState !== 'battle') return;
                    continue;
                }

                const toPlayer = new THREE.Vector3().copy(playerMesh.position).sub(enemy.position);
                const distToPlayer = toPlayer.length();
                toPlayer.y = 0;
                toPlayer.normalize();

                if (distToPlayer > 6) {
                    enemy.position.add(toPlayer.multiplyScalar(enemy.userData.speed));
                } else if (distToPlayer < 3) {
                    enemy.position.sub(toPlayer.multiplyScalar(enemy.userData.speed));
                }

                enemy.userData.intentTimer--;
                if (enemy.userData.intentTimer <= 0) {
                    const hasSpecial = !!enemy.userData.specialCardId;
                    if (hasSpecial && Math.random() < (enemy.userData.specialChance || 0)) {
                        enemy.userData.intent = 'special';
                    } else if (enemy.userData.type === 'boss') {
                        enemy.userData.intent = Math.random() > 0.3 ? 'attack_heavy' : 'defense';
                    } else {
                        enemy.userData.intent = Math.random() > 0.4 ? 'attack' : 'defense';
                    }
                    enemy.userData.intentTimer = 180 + Math.random() * 60;
                }

                enemy.userData.specialCooldown--;
                if (enemy.userData.specialCooldown <= 0 && enemy.userData.intent === 'special') {
                    if (insertEnemyCardToPlayer(enemy.userData.specialCardId, true)) {
                        enemy.userData.specialCooldown = 240 + Math.random() * 120;
                        enemy.userData.shootCooldown = 180;
                        console.log(`[DEBUG-ENEMY-ACTION] ${enemy.userData.name} used special attack (${enemy.userData.specialCardId})`);
                    } else {
                        enemy.userData.specialCooldown = 90;
                    }
                }

                enemy.userData.shootCooldown--;
                if (enemy.userData.shootCooldown <= 0) {
                    if (enemy.userData.intent === 'attack') {
                        fireEnemyBullet(enemy, 6);
                        enemy.userData.shootCooldown = 150 + Math.random() * 60;
                        console.log(`[DEBUG-ENEMY-ACTION] ${enemy.userData.name} chose attack (cooldown=${enemy.userData.shootCooldown.toFixed(0)})`);
                    } 
                    else if (enemy.userData.intent === 'attack_heavy') {
                        fireEnemyBullet(enemy, 15);
                        enemy.userData.shootCooldown = 100;
                        console.log(`[DEBUG-ENEMY-ACTION] ${enemy.userData.name} chose heavy attack (cooldown=${enemy.userData.shootCooldown.toFixed(0)})`);
                    }
                    else if (enemy.userData.intent === 'defense') {
                        playSFX('shield');
                        enemy.userData.hp = Math.min(enemy.userData.maxHp, enemy.userData.hp + 5);
                        spawnHitSpark(enemy.position, 0x3b82f6);
                        enemy.userData.shootCooldown = 180;
                        console.log(`[DEBUG-ENEMY-ACTION] ${enemy.userData.name} chose defense (hp=${enemy.userData.hp.toFixed(1)}/${enemy.userData.maxHp.toFixed(1)} cooldown=${enemy.userData.shootCooldown})`);
                    }
                }

                if (enemy.userData.shootCooldown < 45 && enemy.userData.intent.startsWith('attack')) {
                    drawWarningLine(enemy.position, playerMesh.position);
                }

                updateEnemyIntentUI(enemy);
            }

            // --- 7. Particle updates ---
            for (let i = battleState.particles.length - 1; i >= 0; i--) {
                const p = battleState.particles[i];
                p.mesh.position.add(p.velocity);
                if (typeof p.onUpdate === 'function') {
                    p.onUpdate(p);
                }
                p.life--;
                if (p.life <= 0) {
                    scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                    battleState.particles.splice(i, 1);
                }
            }

            // --- 8. Win/loss monitoring and cleanup ---
            if (battleState.enemies.length === 0) {
                gameState = 'battle_end';
                isFiring = false;
                const battleEndToken = autoProgressToken;

                console.log(`[DEBUG-WIN] 脂 Battle won! All enemies have been eliminated.`);
                debugState('[DEBUG-WIN-STATE]', selectedNode ? `node=${selectedNode.type}` : 'node=none');
                showToast("Battle won! Network barrier destroyed.");
                
                // Guard pointer lock release errors
                cleanupBattle3D();

                // Transition to the 2D draft screen after a short delay
                setTimeout(() => {
                    if (battleEndToken !== autoProgressToken || gameState !== 'battle_end') return;
                    if (selectedNode && selectedNode.type === 'boss') {
                        console.log(`[DEBUG-WIN] All sector hacks complete!`);
                        showPanel('victory');
                    } else {
                        showPanel('reward');
                    }
                }, 1000);
            }
        }

        function damagePlayer(amount) {
            const hadShield = player.shield > 0;
            if (player.shield > 0) {
                player.shield -= amount;
                if (player.shield < 0) {
                    player.hp += player.shield;
                    player.shield = 0;
                }
            } else {
                player.hp -= amount;
            }

            console.log(`[DEBUG-DAMAGE] Player hit: ${amount} damage (Remaining HP: ${player.hp.toFixed(1)} / Shield: ${player.shield.toFixed(1)})`);
            debugState('[DEBUG-DAMAGE-STATE]', `amount=${amount} hadShield=${hadShield}`);
            updateBattleStatsUI();

            if (hadShield && battleState.pendingRetaliation) {
                battleState.enemies.forEach(enemy => {
                    enemy.userData.hp -= battleState.pendingRetaliation.damage || 0;
                    spawnHitSpark(enemy.position, 0xf59e0b);
                });
            }

            if (player.hp <= 0) {
                player.hp = 0;
                console.log(`[DEBUG-DEATH] 逐 Player death detected. System HP depleted 逐`);
                cleanupBattle3D();
                window.__runState = 'gameover';
                window.__runResult = 'gameover';
                showPanel('gameover');
                return true;
            }
            return false;
        }

        function drawWarningLine(from, to) {
            if (warningLineMesh) {
                scene.remove(warningLineMesh);
                warningLineMesh.geometry.dispose();
                warningLineMesh.material.dispose();
            }
            const points = [
                new THREE.Vector3(from.x, from.y, from.z),
                new THREE.Vector3(to.x, to.y, to.z)
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.6 });
            warningLineMesh = new THREE.Line(geometry, material);
            scene.add(warningLineMesh);
        }

        function spawnHitSpark(pos, colorHex) {
            for (let i = 0; i < 5; i++) {
                const geom = new THREE.SphereGeometry(0.1, 4, 4);
                const mat = new THREE.MeshBasicMaterial({ color: colorHex });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.copy(pos);

                battleState.particles.push({
                    mesh: mesh,
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 0.15,
                        (Math.random() - 0.5) * 0.15,
                        (Math.random() - 0.5) * 0.15
                    ),
                    life: 20
                });
                scene.add(mesh);
            }
        }

        function spawnExplosion(pos, colorHex) {
            for (let i = 0; i < 15; i++) {
                const geom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                const mat = new THREE.MeshBasicMaterial({ color: colorHex });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.copy(pos);

                battleState.particles.push({
                    mesh: mesh,
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 0.3,
                        (Math.random() - 0.5) * 0.3,
                        (Math.random() - 0.5) * 0.3
                    ),
                    life: 40
                });
                scene.add(mesh);
            }
        }

        window.startGame = function() {
            if (typeof window.clearLog === 'function') window.clearLog();
            console.log(`[DEBUG-NAV] Game start [PARAM: ${PARAMS.paramName}]`);
            window.__runState = 'running';
            window.__runResult = null;
            currentStage = 1;
            player.hp = PARAMS.playerMaxHp;
            player.maxHp = PARAMS.playerMaxHp;
            player.gold = PARAMS.playerGold;
            setupInitialDeck();
            showPanel('map');
        };

        window.resetGame = function() {
            showPanel('start');
        };

        // Map layer definition
        const MAP_NODE_TYPES = [
            [], // dummy index 0
            [{ type: 'start', label: 'Start Node', desc: 'Network entry path' }],
            [{ type: 'fight', label: 'Virus Barrier', desc: 'Security detection: medium' }, { type: 'fight', label: 'Quarantine Sector', desc: 'Security detection: low' }],
            [{ type: 'shop', label: 'Black Module Market', desc: 'Hack program trading' }, { type: 'fight', label: 'Infected Data Layer', desc: 'Security detection: medium' }],
            [{ type: 'elite', label: 'Security Core (Elite)', desc: 'High-priority parent virus detected' }],
            [{ type: 'camp', label: 'System Safe House', desc: 'Memory release and repair' }],
            [{ type: 'fight', label: 'System Core Barrier', desc: 'High security' }, { type: 'shop', label: 'Extreme Data Trade', desc: 'Hack program trading' }],
            [{ type: 'camp', label: 'Final Optimization Node', desc: 'Prepare for the final defense' }],
            [{ type: 'boss', label: 'Mainframe Core (BOSS)', desc: 'Origin point of total motherboard lockdown' }]
        ];

