import re

def analyze_unused():
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()
    with open('style.css', 'r', encoding='utf-8') as f:
        css = f.read()
    with open('game.js', 'r', encoding='utf-8') as f:
        js = f.read()

    funcs = re.findall(r'function\s+([a-zA-Z0-9_]+)\s*\(', js)
    funcs += re.findall(r'const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?function', js)
    funcs += re.findall(r'let\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?function', js)
    funcs += re.findall(r'window\.([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?function', js)

    unused_funcs = []
    for func in set(funcs):
        js_count = len(re.findall(r'\b' + func + r'\b', js))
        html_count = len(re.findall(r'\b' + func + r'\b', html))
        if js_count + html_count <= 1:
            unused_funcs.append(func)

    css_classes = set(re.findall(r'\.([a-zA-Z0-9_-]+)\s*\{', css))
    unused_css = []
    for c in css_classes:
        if not re.search(r'\b' + c + r'\b', html) and not re.search(r'\b' + c + r'\b', js):
            unused_css.append(c)

    html_ids = set(re.findall(r'id=[\'\"]([a-zA-Z0-9_-]+)[\'\"]', html))
    unused_ids = []
    for i in html_ids:
        # Check if ID is used in CSS as #id
        if re.search(r'#' + i + r'\b', css):
            continue
        # Check if ID is used in JS as #id or just id
        if re.search(r'[\'\"]#?' + i + r'[\'\"]', js):
            continue
        # Check if it is used in HTML onclick etc.? We just check if it's referenced anywhere else
        unused_ids.append(i)

    print("Unused Functions:", unused_funcs)
    print("Unused CSS Classes:", unused_css)
    print("Unused HTML IDs:", unused_ids)

analyze_unused()
