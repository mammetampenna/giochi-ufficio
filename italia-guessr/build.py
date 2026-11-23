# Crea italia-guessr.html: inserisce Leaflet 1.9.4 e i sorgenti JS dentro src/template.html
import os
R = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(R, f), encoding='utf-8').read()
app = '\n'.join(rd('src/' + f) for f in ['geo.js', 'places.js', 'italy_outline.js', 'centri.js', 'famosi.js', 'catalog.js', 'app.js'])
s = rd('src/template.html').replace('/*LEAFLET_CSS*/', rd('vendor/leaflet.css')).replace('/*LEAFLET_JS*/', rd('vendor/leaflet.js')).replace('/*APP_JS*/', app)
open(os.path.join(R, 'italia-guessr.html'), 'w', encoding='utf-8').write(s); print(len(s) // 1024, 'KB')
