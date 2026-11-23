# Crea ../nerf-salotto.html incorporando modelli e animazioni (base64) dentro game.html
import base64, json, os
R = os.path.dirname(os.path.abspath(__file__)) + '/..'
s = open(R + '/game.html').read()
b = lambda f: base64.b64encode(open(R + '/' + f, 'rb').read()).decode()
assets = {k: b('assets/' + v + '.glb') for k, v in {'male': 'Superhero_Male_FullBody_m', 'female': 'Superhero_Female_FullBody_m', 'anims1': 'anims1_m', 'anims2': 'anims2_m',
          'gun_rifle': 'gun_rifle_m', 'gun_sniper': 'gun_sniper_m', 'gun_bazooka': 'gun_bazooka_m'}.items()}
s = s.replace('/*ROOM_B64*/', b('models/room_q.glb')).replace('/*LOW_B64*/', b('models/lowpoly_0.08.glb')).replace('/*ASSETS_JSON*/null', json.dumps(assets))
open(R + '/nerf-salotto.html', 'w').write(s); print(len(s) // 1024, 'KB')
