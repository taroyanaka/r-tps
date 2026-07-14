import os

file_path = 'game.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix useCardIndex drawing
old_useCard = """            drawCard();

            renderHandUI();
            updateBattleStatsUI();
        };"""
new_useCard = """            while (battleState.hand.length < 2) {
                const initialLen = battleState.hand.length;
                drawCard();
                if (battleState.hand.length === initialLen) break;
            }

            renderHandUI();
            updateBattleStatsUI();
        };"""
if old_useCard in content:
    content = content.replace(old_useCard, new_useCard)
else:
    print("Warning: old_useCard chunk not found")

# Fix redrawHand drawing
old_redraw = """            drawCard();
            drawCard();
            
            renderHandUI();
            updateBattleStatsUI();
        };"""
new_redraw = """            while (battleState.hand.length < 2) {
                const initialLen = battleState.hand.length;
                drawCard();
                if (battleState.hand.length === initialLen) break;
            }
            
            renderHandUI();
            updateBattleStatsUI();
        };"""
if old_redraw in content:
    content = content.replace(old_redraw, new_redraw)
else:
    print("Warning: old_redraw chunk not found")

# Fix r key listener
old_r_key = """                    if (key === 'r') {
                        if (typeof redrawHand === 'function') redrawHand();
                    }"""
new_r_key = """                    if (key === 'r') {
                        if (typeof window.redrawHand === 'function') window.redrawHand();
                    }"""
if old_r_key in content:
    content = content.replace(old_r_key, new_r_key)
else:
    print("Warning: old_r_key chunk not found")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("game.js modified via Python (Card bugs fixed).")
