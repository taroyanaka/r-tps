import re

with open('game.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Define the sections by headers
sections = [
    "Parameter system",
    "Game state variables",
    "3D graphics state (Three.js)",
    "Startup initialization",
    "Auto mode toggle",
    "Initial deck setup",
    "3D setup",
    "UI switching and screen construction",
    "Auto Progression",
    "Map generation system",
    "Shop system",
    "Camp system",
    "Draft reward system",
    "Battle phase system (real-time 3D TPS)",
    "Deck build and draw engine",
    "Card activation system",
    "Projectile spawning helpers",
    "UI rendering",
    "Main game loop (3D rendering and logic)",
]

# We will split the file using these headers.
# First, let's find the positions of each header.
blocks = {}
for i in range(len(sections)):
    curr_header = f"// --- {sections[i]} ---"
    if i < len(sections) - 1:
        next_header = f"// --- {sections[i+1]} ---"
        pattern = re.compile(re.escape(curr_header) + r"(.*?)(?=" + re.escape(next_header) + r")", re.DOTALL)
    else:
        pattern = re.compile(re.escape(curr_header) + r"(.*)", re.DOTALL)
    
    match = pattern.search(js)
    if match:
        blocks[sections[i]] = curr_header + match.group(1)
    else:
        print(f"Warning: Could not find section {sections[i]}")

# Define the target files and their contents
files = {
    'game_core.js': [
        "Parameter system",
        "Game state variables",
        "3D graphics state (Three.js)",
        "Startup initialization",
        "Auto mode toggle",
    ],
    'game_deck.js': [
        "Initial deck setup",
        "Deck build and draw engine",
        "Card activation system",
    ],
    'game_map.js': [
        "UI switching and screen construction",
        "Auto Progression",
        "Map generation system",
        "Shop system",
        "Camp system",
        "Draft reward system",
    ],
    'game_battle.js': [
        "3D setup",
        "Battle phase system (real-time 3D TPS)",
        "Projectile spawning helpers",
        "Main game loop (3D rendering and logic)",
    ],
    'game_ui.js': [
        "UI rendering",
    ]
}

# Write out the new files
for filename, section_list in files.items():
    content = ""
    for sec in section_list:
        if sec in blocks:
            content += blocks[sec] + "\n"
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Created {filename}")

# Update index.html to include the new files instead of game.js
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove unused IDs/classes in html based on earlier analysis
html = html.replace(' id="help-btn"', '')
html = html.replace(' id="start-title"', '')
html = html.replace(' id="templates"', '')
html = html.replace(' id="ui-container"', '')
html = html.replace(' id="start-subtitle"', '')
html = html.replace(' id="start-game-btn"', '')
html = html.replace(' id="help-modal"', '')
html = html.replace(' id="param-test-list"', '')

# Update the script tags
new_scripts = """<script src="game_core.js"></script>
    <script src="game_deck.js"></script>
    <script src="game_map.js"></script>
    <script src="game_battle.js"></script>
    <script src="game_ui.js"></script>"""

html = html.replace('<script src="game.js"></script>', new_scripts)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated index.html")

# Remove unused CSS classes in style.css
with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

css = re.sub(r'\.neon-border-blue\s*\{[^}]*\}', '', css, flags=re.DOTALL)
css = re.sub(r'\.neon-text-blue\s*\{[^}]*\}', '', css, flags=re.DOTALL)
css = re.sub(r'\.neon-border-magenta\s*\{[^}]*\}', '', css, flags=re.DOTALL)
css = re.sub(r'\.neon-text-magenta\s*\{[^}]*\}', '', css, flags=re.DOTALL)
css = re.sub(r'\.neon-border-green\s*\{[^}]*\}', '', css, flags=re.DOTALL)
css = re.sub(r'\.neon-text-green\s*\{[^}]*\}', '', css, flags=re.DOTALL)

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("Cleaned up style.css")
