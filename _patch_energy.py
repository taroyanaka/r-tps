from pathlib import Path

p = Path(__file__).resolve().parent / "data.js"
s = p.read_text(encoding="utf-8")
s = s.replace('"playerEnergy":3.0', '"playerEnergy":10.0')
s = s.replace('"playerMaxEnergy":3', '"playerMaxEnergy":10')
p.write_text(s, encoding="utf-8")
