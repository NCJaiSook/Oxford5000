import json, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/oxford5000.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total entries: {len(data)}")
indices = [0, 50, 100, 500, 1000, 2500, 4000, 5000]
for idx in indices:
    item = data[idx]
    print(f"[{idx}] {item['word']} ({item['pos']}) [{item['cefr']}] - Topic: {item['topic']}")
    print(f"     UK: {item['phon_uk']} | US: {item['phon_us']}")
    print(f"     TH: {item['def_th']}")
    print(f"     EN: {item['def_en'][:60]}")
    print(f"     Ex: {item['example'][:60]}")
    print(f"     Syn: {item['synonyms']} | Ant: {item['antonyms']}")
    print()
