import json
import re

data_path = 'data.js'
with open(data_path, 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'window\.RTPS_PARAM_LIST\s*=\s*(\[[\s\S]*?\]);', content)
if match:
    params = json.loads(match.group(1))
    
    # Remove enemy_x9 and enemy_x12 because they are confirmed impossible
    filtered_params = [p for p in params if p['paramName'] not in ['enemy_x9', 'enemy_x12']]
    
    new_json = json.dumps(filtered_params, separators=(',', ':'))
    new_content = content[:match.start(1)] + new_json + content[match.end(1):]
    
    with open(data_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Updated data.js. Removed un-executable regulations.")
else:
    print("Could not find RTPS_PARAM_LIST in data.js")
