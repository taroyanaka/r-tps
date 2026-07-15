#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch script for:
1. data.js: add arenaRadius:60 to all RTPS_PARAM_LIST entries
2. index.html: start-screen toggle for no-ena-on-move, wave notice element, buff UI element, hint text update
3. game.js: circular arena, ena-on-move toggle, wave notice display, buff timer UI, keybinding fix (k->space/i), reward card keyboard nav
"""

import json, re

# ========== data.js ==========
def patch_data():
    with open('data.js', 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'window\.RTPS_PARAM_LIST\s*=\s*(\[.*?\]);', content, re.DOTALL)
    if not match:
        print("ERROR: RTPS_PARAM_LIST not found")
        return
    arr_str = match.group(1)
    params = json.loads(arr_str)
    for p in params:
        if 'arenaRadius' not in p:
            p['arenaRadius'] = 60
    new_arr_str = json.dumps(params, separators=(',', ':'))
    content = content[:match.start(1)] + new_arr_str + content[match.end(1):]
    with open('data.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("data.js patched: arenaRadius added")


# ========== index.html ==========
def patch_html():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Key hint text update (Space = right card, I = left card)
    content = content.replace(
        'Left click: left card / Right click: right card / [1] [2] [3] [4] keys to use cards',
        'Left click / [I] key: left card &nbsp;|&nbsp; Right click / [Space] key: right card'
    )

    # 2. Add wave-notice element after curtain div
    wave_notice_html = '''
  <!-- Wave start notification -->
  <div class="hidden fixed inset-0 z-[90] flex flex-col items-center justify-center pointer-events-none" id="wave-notice">
    <div class="text-center">
      <div class="text-4xl font-black tracking-[0.3em] uppercase text-cyan-300 wave-notice-text" id="wave-notice-text" style="text-shadow:0 0 40px rgba(6,182,212,0.9),0 0 80px rgba(6,182,212,0.5);">WAVE 1</div>
      <div class="text-lg font-bold tracking-widest uppercase text-cyan-500 mt-2" id="wave-notice-sub" style="text-shadow:0 0 20px rgba(6,182,212,0.7);">INCOMING</div>
    </div>
  </div>'''
    # Insert before closing </body>
    content = content.replace('  <script src="audio.js">', wave_notice_html + '\n  <script src="audio.js">')

    # 3. Add buff container UI in battle-tray, after energy display
    buff_ui_html = '''     <div class="flex flex-col gap-1 items-center mt-1 pointer-events-none" id="buff-container" style="min-height:0;">
      <!-- Buff bars injected by JS -->
     </div>'''
    content = content.replace(
        '     <div class="text-[10px] text-gray-500 mt-2 tracking-widest uppercase flex items-center gap-2">',
        buff_ui_html + '\n     <div class="text-[10px] text-gray-500 mt-2 tracking-widest uppercase flex items-center gap-2">'
    )

    # 4. Add toggle in start screen, inside the flex-col gap-3 buttons div, after Help button
    toggle_html = '''       <div class="w-full border-t border-slate-800 pt-3 mt-1 flex flex-col gap-2">
        <div class="flex items-center justify-between bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-2.5">
          <span class="text-xs text-gray-300 font-bold tracking-wide">移動中 ENA 回復停止</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="no-ena-on-move-toggle" class="sr-only peer" onchange="window.RTPS_NO_ENA_RECOVERY_ON_MOVE = this.checked;">
            <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
          </label>
        </div>
       </div>'''
    content = content.replace(
        '       <div class="w-full border-t border-slate-800 pt-3 mt-1">',
        toggle_html + '\n       <div class="w-full border-t border-slate-800 pt-3 mt-1">'
    )

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("index.html patched")


# ========== game.js ==========
def patch_game():
    with open('game.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # --- 1. Keybinding: remove 'k', keep 'i' for slot 0, space for slot 1 ---
    # Current: if (key === 'i') useCardIndex(0);
    # Current: if (key === 'k' || key === ' ' || key === 'space') useCardIndex(1);
    content = content.replace(
        "if (key === 'k' || key === ' ' || key === 'space') useCardIndex(1);",
        "if (key === ' ') useCardIndex(1);"
    )
    # Fix prevent default list: remove 'k', keep i and space
    content = content.replace(
        "if (key === 'j' || key === 'l' || key === 'i' || key === 'k' || key === ' ' || key === 'space' || key === 'r') {",
        "if (key === 'j' || key === 'l' || key === 'i' || key === ' ' || key === 'r') {"
    )

    # --- 2. Circular arena boundary (replace square clamp) ---
    old_clamp = (
        "            playerMesh.position.x = Math.max(-48, Math.min(48, playerMesh.position.x));\r\n"
        "            playerMesh.position.z = Math.max(-48, Math.min(48, playerMesh.position.z));"
    )
    new_clamp = (
        "            // Circular arena boundary\r\n"
        "            {\r\n"
        "                const _radius = (window.PARAMS && window.PARAMS.arenaRadius) || (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].arenaRadius) || 60;\r\n"
        "                const _dist = Math.hypot(playerMesh.position.x, playerMesh.position.z);\r\n"
        "                if (_dist > _radius) {\r\n"
        "                    const _scale = _radius / _dist;\r\n"
        "                    playerMesh.position.x *= _scale;\r\n"
        "                    playerMesh.position.z *= _scale;\r\n"
        "                }\r\n"
        "            }"
    )
    if old_clamp in content:
        content = content.replace(old_clamp, new_clamp)
        print("game.js: circular arena boundary patched")
    else:
        print("WARNING: could not find square clamp (may use LF line endings)")
        # Try LF version
        old_clamp_lf = (
            "            playerMesh.position.x = Math.max(-48, Math.min(48, playerMesh.position.x));\n"
            "            playerMesh.position.z = Math.max(-48, Math.min(48, playerMesh.position.z));"
        )
        new_clamp_lf = (
            "            // Circular arena boundary\n"
            "            {\n"
            "                const _radius = (window.PARAMS && window.PARAMS.arenaRadius) || (window.RTPS_PARAM_LIST && window.RTPS_PARAM_LIST[0] && window.RTPS_PARAM_LIST[0].arenaRadius) || 60;\n"
            "                const _dist = Math.hypot(playerMesh.position.x, playerMesh.position.z);\n"
            "                if (_dist > _radius) {\n"
            "                    const _scale = _radius / _dist;\n"
            "                    playerMesh.position.x *= _scale;\n"
            "                    playerMesh.position.z *= _scale;\n"
            "                }\n"
            "            }"
        )
        if old_clamp_lf in content:
            content = content.replace(old_clamp_lf, new_clamp_lf)
            print("game.js: circular arena boundary patched (LF)")
        else:
            print("ERROR: square clamp not found!")

    # --- 3. Ena recovery: skip if moving and toggle is on ---
    old_ena = (
        "            // --- 2. Energy regeneration over time ---\r\n"
        "            if (player.energy < player.maxEnergy) {\r\n"
        "                const bonusRegen = battleState.energyRegenBuffs.reduce((sum, buff) => sum + (buff.amount || 0), 0);\r\n"
        "                player.energy = Math.min(player.maxEnergy, player.energy + PARAMS.energyRecoveryPerFrame + bonusRegen);\r\n"
        "                updateBattleStatsUI();\r\n"
        "            }"
    )
    new_ena = (
        "            // --- 2. Energy regeneration over time ---\r\n"
        "            if (player.energy < player.maxEnergy) {\r\n"
        "                const _isMoving = keys['w'] || keys['s'] || keys['a'] || keys['d'];\r\n"
        "                const _noEnaOnMove = window.RTPS_NO_ENA_RECOVERY_ON_MOVE && !isAutoMode;\r\n"
        "                if (!(_isMoving && _noEnaOnMove)) {\r\n"
        "                    const bonusRegen = battleState.energyRegenBuffs.reduce((sum, buff) => sum + (buff.amount || 0), 0);\r\n"
        "                    player.energy = Math.min(player.maxEnergy, player.energy + PARAMS.energyRecoveryPerFrame + bonusRegen);\r\n"
        "                }\r\n"
        "                updateBattleStatsUI();\r\n"
        "            }"
    )
    if old_ena in content:
        content = content.replace(old_ena, new_ena)
        print("game.js: ena-on-move toggle patched")
    else:
        # Try LF
        old_ena_lf = old_ena.replace('\r\n', '\n')
        new_ena_lf = new_ena.replace('\r\n', '\n')
        if old_ena_lf in content:
            content = content.replace(old_ena_lf, new_ena_lf)
            print("game.js: ena-on-move toggle patched (LF)")
        else:
            print("WARNING: ena regen block not found, trying regex")
            content = re.sub(
                r'(// --- 2\. Energy regeneration over time ---\s*\n\s*if \(player\.energy < player\.maxEnergy\) \{)\s*\n(\s*const bonusRegen)',
                r'\1\n                const _isMoving = keys[\'w\'] || keys[\'s\'] || keys[\'a\'] || keys[\'d\'];\n                const _noEnaOnMove = window.RTPS_NO_ENA_RECOVERY_ON_MOVE && !isAutoMode;\n                if (!(_isMoving && _noEnaOnMove)) {\n\2',
                content
            )
            # Need to close the if block before updateBattleStatsUI too
            content = re.sub(
                r'(player\.energy = Math\.min\(player\.maxEnergy, player\.energy \+ PARAMS\.energyRecoveryPerFrame \+ bonusRegen\);)\s*\n(\s*updateBattleStatsUI\(\);)',
                r'\1\n                }\n\2',
                content
            )

    # --- 4. Wave notice display in spawnNextWave ---
    old_wave_toast = "showToast(`Wave ${battleState.currentWave} / ${battleState.maxWaves}`);"
    new_wave_toast = (
        "showToast(`Wave ${battleState.currentWave} / ${battleState.maxWaves}`);\r\n"
        "            // Show wave notice overlay\r\n"
        "            (function() {\r\n"
        "                const wn = document.getElementById('wave-notice');\r\n"
        "                const wnText = document.getElementById('wave-notice-text');\r\n"
        "                const wnSub = document.getElementById('wave-notice-sub');\r\n"
        "                if (wn) {\r\n"
        "                    if (wnText) wnText.textContent = `WAVE ${battleState.currentWave} / ${battleState.maxWaves}`;\r\n"
        "                    if (wnSub) wnSub.textContent = battleState.currentWave === battleState.maxWaves ? 'FINAL WAVE' : 'INCOMING';\r\n"
        "                    wn.classList.remove('hidden');\r\n"
        "                    wn.style.opacity = '1';\r\n"
        "                    wn.style.transition = 'opacity 0.4s';\r\n"
        "                    setTimeout(() => {\r\n"
        "                        wn.style.opacity = '0';\r\n"
        "                        setTimeout(() => wn.classList.add('hidden'), 400);\r\n"
        "                    }, 2000);\r\n"
        "                }\r\n"
        "            })();"
    )
    if old_wave_toast in content:
        content = content.replace(old_wave_toast, new_wave_toast)
        print("game.js: wave notice display patched")
    else:
        print("WARNING: wave toast line not found")

    # --- 5. Buff duration UI in updateBattleStatsUI ---
    # Insert buff display before } closing of updateBattleStatsUI (after the hand container block)
    # The function ends with the hand container update, then closing }
    old_stats_end = (
        "            }\r\n"
        "        }\r\n"
        "\r\n"
        "        let toastEl = document.getElementById('toast');"
    )
    new_stats_end = (
        "            }\r\n"
        "\r\n"
        "            // --- Buff duration UI ---\r\n"
        "            const buffContainer = document.getElementById('buff-container');\r\n"
        "            if (buffContainer) {\r\n"
        "                const buffLines = [];\r\n"
        "                (battleState.tempDamageBuffs || []).forEach(b => {\r\n"
        "                    const secs = (b.life / 60).toFixed(1);\r\n"
        "                    const pct = Math.min(100, (b.life / (b.maxLife || b.life)) * 100);\r\n"
        "                    buffLines.push({ label: `DMG +${(b.amount * 100).toFixed(0)}%`, secs, pct, color: 'bg-amber-400' });\r\n"
        "                });\r\n"
        "                (battleState.energyRegenBuffs || []).forEach(b => {\r\n"
        "                    const secs = (b.life / 60).toFixed(1);\r\n"
        "                    const pct = Math.min(100, (b.life / (b.maxLife || b.life)) * 100);\r\n"
        "                    buffLines.push({ label: `ENA Regen+`, secs, pct, color: 'bg-cyan-400' });\r\n"
        "                });\r\n"
        "                if (battleState.pendingRetaliation && battleState.pendingRetaliation.life > 0) {\r\n"
        "                    const b = battleState.pendingRetaliation;\r\n"
        "                    buffLines.push({ label: 'Retaliation', secs: (b.life / 60).toFixed(1), pct: 100, color: 'bg-rose-400' });\r\n"
        "                }\r\n"
        "                if (battleState.onHitShieldGain && battleState.onHitShieldGain.life > 0) {\r\n"
        "                    const b = battleState.onHitShieldGain;\r\n"
        "                    buffLines.push({ label: 'On-Hit Shield', secs: (b.life / 60).toFixed(1), pct: 100, color: 'bg-emerald-400' });\r\n"
        "                }\r\n"
        "                if (buffLines.length === 0) {\r\n"
        "                    buffContainer.innerHTML = '';\r\n"
        "                } else {\r\n"
        "                    buffContainer.innerHTML = buffLines.map(bl => `\r\n"
        "                        <div class=\"flex items-center gap-2 bg-slate-950/80 border border-white/10 px-2 py-0.5 rounded-lg\" style=\"min-width:150px;max-width:200px\">\r\n"
        "                            <span class=\"text-[9px] text-gray-300 font-mono truncate flex-1\">${bl.label}</span>\r\n"
        "                            <div class=\"w-16 h-2 bg-slate-800 rounded-full overflow-hidden border border-white/10\">\r\n"
        "                                <div class=\"h-full ${bl.color} rounded-full transition-all\" style=\"width:${bl.pct}%\"></div>\r\n"
        "                            </div>\r\n"
        "                            <span class=\"text-[9px] font-mono text-gray-400\">${bl.secs}s</span>\r\n"
        "                        </div>`).join('');\r\n"
        "                }\r\n"
        "            }\r\n"
        "        }\r\n"
        "\r\n"
        "        let toastEl = document.getElementById('toast');"
    )
    if old_stats_end in content:
        content = content.replace(old_stats_end, new_stats_end)
        print("game.js: buff duration UI patched")
    else:
        # Try LF
        old_lf = old_stats_end.replace('\r\n', '\n')
        new_lf = new_stats_end.replace('\r\n', '\n')
        if old_lf in content:
            content = content.replace(old_lf, new_lf)
            print("game.js: buff duration UI patched (LF)")
        else:
            print("WARNING: stats end block not found for buff UI")

    # --- 6. Buff life tracking: store maxLife when pushing ---
    # addTempDamageBuff
    old_buff_push = (
        "            battleState.tempDamageBuffs.push({\r\n"
        "                amount,\r\n"
        "                source,\r\n"
        "                life: Math.max(1, durationFrames || 180)\r\n"
        "            });"
    )
    new_buff_push = (
        "            const _buffLife = Math.max(1, durationFrames || 180);\r\n"
        "            battleState.tempDamageBuffs.push({\r\n"
        "                amount,\r\n"
        "                source,\r\n"
        "                life: _buffLife,\r\n"
        "                maxLife: _buffLife\r\n"
        "            });"
    )
    if old_buff_push in content:
        content = content.replace(old_buff_push, new_buff_push)
        print("game.js: buff maxLife tracking added")
    else:
        old_lf = old_buff_push.replace('\r\n', '\n')
        new_lf = new_buff_push.replace('\r\n', '\n')
        if old_lf in content:
            content = content.replace(old_lf, new_lf)
            print("game.js: buff maxLife tracking added (LF)")
        else:
            print("WARNING: buff push block not found")

    # --- 7. energyRegenBuff maxLife tracking ---
    old_regen_push_search = 'battleState.energyRegenBuffs.push({'
    idx = content.find(old_regen_push_search)
    if idx != -1:
        # Find the closing }) after it
        block_start = idx
        depth = 0
        for ci in range(idx, min(idx+500, len(content))):
            if content[ci] == '{':
                depth += 1
            elif content[ci] == '}':
                depth -= 1
                if depth == 0:
                    block_end = ci + 2  # include );
                    break
        old_block = content[block_start:block_end]
        # Add maxLife field after life field
        new_block = re.sub(
            r'(life:\s*Math\.max\(1,\s*durationFrames\s*\|\|\s*\d+\))',
            r'\1,\n                    maxLife: Math.max(1, durationFrames || 999999)',
            old_block
        )
        if new_block != old_block:
            content = content[:block_start] + new_block + content[block_end:]
            print("game.js: energyRegenBuff maxLife tracking added")

    # --- 8. Reward card keyboard nav: make cards focusable ---
    old_card_div = "                const cardDiv = document.createElement('div');\r\n                cardDiv.className = `p-4 rounded-2xl border ${card.colorClass} hover:scale-105 active:scale-95 transition-all cursor-pointer flex flex-col justify-between w-full md:w-48 h-64 text-left relative overflow-hidden group`;\r\n                cardDiv.onclick = () => selectRewardCard(card);"
    new_card_div = "                const cardDiv = document.createElement('button');\r\n                cardDiv.className = `p-4 rounded-2xl border ${card.colorClass} hover:scale-105 active:scale-95 focus:scale-105 focus:ring-2 focus:ring-white/50 transition-all cursor-pointer flex flex-col justify-between w-full md:w-48 h-64 text-left relative overflow-hidden group`;\r\n                cardDiv.setAttribute('tabindex', '0');\r\n                cardDiv.onclick = () => selectRewardCard(card);"
    if old_card_div in content:
        content = content.replace(old_card_div, new_card_div)
        print("game.js: reward cards made focusable (button)")
    else:
        # Try LF
        old_lf = old_card_div.replace('\r\n', '\n')
        new_lf = new_card_div.replace('\r\n', '\n')
        if old_lf in content:
            content = content.replace(old_lf, new_lf)
            print("game.js: reward cards made focusable (LF)")
        else:
            print("WARNING: reward card div not found")

    # --- 9. Global keyboard nav: also include 'reward' state ---
    old_nav_cond = "if (typeof gameState !== 'undefined' && gameState !== 'battle' && gameState !== 'start') {"
    new_nav_cond = "if (typeof gameState !== 'undefined' && gameState !== 'battle' && gameState !== 'start' || gameState === 'reward') {"
    content = content.replace(old_nav_cond, new_nav_cond)

    # Safer approach: make the condition just exclude battle and start  
    # (The condition above is logically wrong. Let's fix it properly)
    # Revert wrong change and use correct approach
    content = content.replace(
        "if (typeof gameState !== 'undefined' && gameState !== 'battle' && gameState !== 'start' || gameState === 'reward') {",
        "if (typeof gameState !== 'undefined' && gameState !== 'battle') {"
    )
    print("game.js: global keyboard nav condition expanded")

    with open('game.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("game.js patched")


patch_data()
patch_html()
patch_game()
print("All patches applied.")
