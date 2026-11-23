# Test automatico (Playwright + Chrome). Uso:  pip install playwright && python3 tests/smoke.py
# Usa l'aggancio di debug window.__dbg del gioco. __dbg.sim(sec, keys) fa avanzare la fisica a passo fisso.
import pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    pg = b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto((ROOT / 'nerf-salotto.html').as_uri()); pg.wait_for_function('window.__ready', timeout=120000)
    pg.click('#go'); pg.wait_for_timeout(1500); pg.screenshot(path='/tmp/sel.png')
    for ci in range(3):
        pg.evaluate(f"__dbg.setChar({ci}); __dbg.start()"); pg.evaluate("__dbg.sim(0.5)")
        a0 = pg.evaluate("__dbg.ammo()"); pg.evaluate("__dbg.player.pitch=-.15; __dbg.shoot()"); pg.evaluate("__dbg.sim(0.4)")
        print(ci, pg.evaluate("document.getElementById('hudChar').textContent"), 'munizioni', a0, '->', pg.evaluate("__dbg.ammo()"))
    pg.evaluate("__dbg.player.pitch=-1.4; __dbg.sim(1)"); y0 = pg.evaluate("__dbg.player.pos.y"); pg.evaluate("__dbg.shoot()"); mx = y0
    for i in range(20): pg.evaluate("__dbg.sim(0.05)"); mx = max(mx, pg.evaluate("__dbg.player.pos.y"))
    print('salto a razzo: salita', round(mx - y0, 2))
    pg.evaluate("__dbg.setGfx('low')"); pg.evaluate("__dbg.sim(1.0,{KeyW:true})"); print('low poly a terra:', pg.evaluate("__dbg.player.onGround"))
    print('errori:', errs); b.close()
