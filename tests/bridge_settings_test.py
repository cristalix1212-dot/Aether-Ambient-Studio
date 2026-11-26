import json, sys
from pathlib import Path
sys.path.insert(0, r'C:\Users\Я\Documents\AmbientForge')
import app
api=app.Api()
path=app.LOCAL_APP/'settings.json'
backup=path.read_text(encoding='utf-8') if path.exists() else None
payload={"version":2,"activeThemeId":"custom_test","customThemes":[{"id":"custom_test","name":"Test","colors":{"bg":"#112233","panel":"#223344","text":"#eeeeee","muted":"#999999","accent":"#d0a878","accent2":"#9caf8a"}}]}
api.save_settings(json.dumps(payload))
loaded=json.loads(api.load_settings())
print('saved', loaded['activeThemeId'], loaded['customThemes'][0]['name'], path.exists(), path.stat().st_size)
if backup is None: path.unlink(missing_ok=True)
else: path.write_text(backup,encoding='utf-8')
print('restored')
