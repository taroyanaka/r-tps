import re

with open('cyber_spire.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract style
style_match = re.search(r'<style>\s*(.*?)\s*</style>', content, re.DOTALL)
if style_match:
    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(style_match.group(1))
    content = content.replace(style_match.group(0), '<link rel="stylesheet" href="style.css">')

# Extract audio script
script_matches = list(re.finditer(r'<script>\s*(.*?)\s*</script>', content, re.DOTALL))
if len(script_matches) >= 2:
    audio_script = script_matches[0]
    with open('audio.js', 'w', encoding='utf-8') as f:
        f.write(audio_script.group(1))
    content = content.replace(audio_script.group(0), '<script src="audio.js"></script>')
    
    game_script = script_matches[1]
    with open('game.js', 'w', encoding='utf-8') as f:
        f.write(game_script.group(1))
    content = content.replace(game_script.group(0), '<script src="game.js"></script>')

with open('cyber_spire.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Split completed successfully.")
