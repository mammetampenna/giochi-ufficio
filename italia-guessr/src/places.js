/* ================= LUOGHI ================= */
// [nome, lat, lng, comune (se diverso dal nome)]
const REGIONS = {
  calabria: {
    name: 'Calabria', scale: 30, osm: 'Calabria',
    bounds: [[37.88, 15.6], [40.16, 17.22]],
    towns: [['Cosenza',39.298,16.254],['Catanzaro',38.910,16.587],['Reggio C.',38.111,15.647],['Crotone',39.081,17.127],['Vibo V.',38.675,16.100]],
    places: [
      ['Reggio Calabria',38.111,15.647,'Reggio di Calabria'],['Catanzaro',38.910,16.587],['Cosenza',39.298,16.254],['Crotone',39.081,17.127],
      ['Vibo Valentia',38.675,16.100],['Lamezia Terme',38.966,16.309],['Tropea',38.677,15.898],['Scilla',38.254,15.716],
      ['Pizzo',38.734,16.157],['Gerace',38.271,16.220],['Stilo',38.477,16.468],['Rossano',39.576,16.635,'Corigliano-Rossano'],
      ['Corigliano Calabro',39.597,16.519,'Corigliano-Rossano'],['Castrovillari',39.817,16.202],['Diamante',39.680,15.824],
      ['Scalea',39.814,15.791],['Praia a Mare',39.895,15.784],['Paola',39.365,16.037],['Amantea',39.133,16.076],
      ['Soverato',38.687,16.550],['Squillace',38.780,16.513],['Le Castella',38.915,17.022,'Isola di Capo Rizzuto'],
      ['Isola di Capo Rizzuto',38.959,17.094],['Cirò Marina',39.371,17.128],['Santa Severina',39.147,16.912],
      ['Badolato',38.567,16.523],['Bova',37.997,15.917],['Pentedattilo',37.957,15.761,'Melito di Porto Salvo'],
      ['Palmi',38.359,15.851],['Bagnara Calabra',38.288,15.807],['Gioia Tauro',38.426,15.898],['Siderno',38.268,16.297],
      ['Locri',38.238,16.262],['Roccella Ionica',38.322,16.401],['Serra San Bruno',38.577,16.329],
      ['Camigliatello Silano',39.338,16.448,'Spezzano della Sila'],['San Giovanni in Fiore',39.258,16.698],
      ['Altomonte',39.698,16.130],['Civita',39.829,16.315],['Morano Calabro',39.840,16.138],['Rocca Imperiale',40.111,16.578],
      ['Cetraro',39.516,15.942],['Belvedere Marittimo',39.627,15.861],['Nicotera',38.554,15.937],
      ['Capo Vaticano',38.621,15.834,'Ricadi'],['Taverna',39.021,16.580],['Rende',39.331,16.183],
      ['Villa San Giovanni',38.219,15.636],['Melito di Porto Salvo',37.924,15.785],['Brancaleone',37.963,16.100],
      ['Fiumefreddo Bruzio',39.236,16.069],['Santuario di San Francesco di Paola',39.357,16.046,'Paola'],
      ['Capo Colonna',39.026,17.188,'Crotone'],['Riace',38.418,16.481],['Parco archeologico di Scolacium',38.810,16.555,'Borgia'],
      ['Sibari',39.715,16.483,"Cassano all'Ionio"],['Copanello',38.763,16.560,'Stalettì'],
      ['Gambarie d\'Aspromonte',38.164,15.833,'Santo Stefano in Aspromonte']
    ]
  },
  treviso: {
    name: 'Provincia di Treviso', scale: 10, osm: 'Provincia di Treviso',
    bounds: [[45.53, 11.78], [46.09, 12.72]],
    towns: [['Treviso',45.666,12.243],['Conegliano',45.887,12.297],['Castelfranco',45.672,11.927],['Vittorio V.',45.987,12.298],['Oderzo',45.781,12.492]],
    places: [
      ['Treviso',45.666,12.243],['Castelfranco Veneto',45.672,11.927],['Conegliano',45.887,12.297],['Vittorio Veneto',45.990,12.298],
      ['Asolo',45.800,11.913],['Montebelluna',45.775,12.045],['Oderzo',45.781,12.492],['Valdobbiadene',45.900,11.997],
      ['Tempio Canoviano di Possagno',45.851,11.880,'Possagno'],['Villa di Maser',45.817,11.976,'Maser'],['Pieve di Soligo',45.898,12.172],
      ['Abbazia di Follina',45.953,12.119,'Follina'],['Cison di Valmarino',45.968,12.143],['Revine Lago',45.999,12.226],
      ['Motta di Livenza',45.778,12.608],['Mogliano Veneto',45.562,12.237],['Preganziol',45.603,12.236],['Vedelago',45.689,12.018],
      ['Castello di Godego',45.693,11.880],['Paese',45.674,12.160],['Villorba',45.729,12.239],['Spresiano',45.780,12.257],
      ['Nervesa della Battaglia',45.826,12.207],['Castello di San Salvatore',45.851,12.258,'Susegana'],['San Pietro di Feletto',45.912,12.255],
      ['Molinetto della Croda',45.931,12.207,'Refrontolo'],['Col San Martino',45.903,12.075,'Farra di Soligo'],['Cornuda',45.830,12.008],
      ['Crocetta del Montello',45.828,12.034],['Riese Pio X',45.729,11.919],['Roncade',45.629,12.375],['Ponte di Piave',45.715,12.462],
      ['San Polo di Piave',45.789,12.391],['Gorgo al Monticano',45.792,12.556],['Fregona',46.007,12.338],['Cappella Maggiore',45.968,12.362],
      ['Sarmede',45.981,12.385],['Tarzo',45.977,12.231],['Farra di Soligo',45.892,12.120],['Quinto di Treviso',45.645,12.164],
      ['Silea',45.656,12.296],['Zero Branco',45.600,12.164],['Istrana',45.676,12.103],['Pederobba',45.877,11.950],
      ['Segusino',45.919,11.950],['Cavaso del Tomba',45.862,11.902],['Monfumo',45.830,11.915]
    ]
  },
  umbria: {
    name: 'Umbria', scale: 18, osm: 'Umbria',
    bounds: [[42.36, 11.88], [43.62, 13.27]],
    towns: [['Perugia',43.112,12.389],['Terni',42.563,12.643],['Foligno',42.956,12.704],['Città di Castello',43.457,12.240],['Orvieto',42.718,12.111],['Spoleto',42.735,12.738]],
    places: [
      ['Perugia',43.112,12.389],['Assisi',43.070,12.615],['Spoleto',42.735,12.738],['Orvieto',42.718,12.111],['Todi',42.781,12.407],
      ['Gubbio',43.352,12.577],['Foligno',42.956,12.704],['Terni',42.563,12.643],['Narni',42.519,12.516],['Amelia',42.553,12.416],
      ['Città di Castello',43.457,12.240],['Spello',42.990,12.669],['Montefalco',42.894,12.651],['Bevagna',42.932,12.610],
      ['Trevi',42.877,12.749],['Norcia',42.792,13.094],['Castelluccio di Norcia',42.828,13.208,'Norcia'],
      ['Cascata delle Marmore',42.552,12.716,'Terni'],['Castiglione del Lago',43.127,12.051],['Passignano sul Trasimeno',43.185,12.137],
      ['Tuoro sul Trasimeno',43.207,12.075],['Panicale',43.028,12.100],['Città della Pieve',42.953,12.004],['Deruta',42.982,12.418],
      ['Torgiano',43.026,12.434],['Bettona',43.014,12.485],['Cannara',42.995,12.584],['Gualdo Tadino',43.231,12.784],
      ['Umbertide',43.305,12.336],['Montone',43.363,12.326],['Nocera Umbra',43.114,12.786],['Cascia',42.718,13.014],
      ['Preci',42.880,13.039],['Vallo di Nera',42.755,12.865],['Scheggino',42.713,12.832],['Ferentillo',42.620,12.787],
      ['Piediluco',42.535,12.755,'Terni'],['Arrone',42.583,12.769],['Stroncone',42.501,12.661],['Otricoli',42.420,12.477],
      ['Acquasparta',42.690,12.545],['Massa Martana',42.776,12.523],['Fonti del Clitunno',42.830,12.762,'Campello sul Clitunno'],
      ['Marsciano',42.910,12.338],['Corciano',43.129,12.287],['Citerna',43.498,12.115],['San Gemini',42.613,12.545],
      ['Lugnano in Teverina',42.574,12.333]
    ]
  },
  roma: {
    name: 'Roma e Castelli Romani', scale: 6, osm: 'Roma',
    bounds: [[41.57, 12.23], [42.15, 12.86]],
    towns: [['Roma centro',41.896,12.482],['Ostia',41.732,12.280],['Frascati',41.808,12.680],['Albano',41.730,12.659],['Velletri',41.687,12.777],['Rocca di Papa',41.761,12.709]],
    places: [
      ['Colosseo',41.8902,12.4922,'Roma'],['Fontana di Trevi',41.9009,12.4833,'Roma'],['Pantheon',41.8986,12.4769,'Roma'],
      ['Piazza Navona',41.8992,12.4731,'Roma'],['Piazza di Spagna',41.9057,12.4823,'Roma'],['Piazza del Popolo',41.9107,12.4763,'Roma'],
      ['Castel Sant\'Angelo',41.9031,12.4663,'Roma'],['Campo de\' Fiori',41.8956,12.4722,'Roma'],['Trastevere',41.8894,12.4699,'Roma'],
      ['Altare della Patria',41.8946,12.4831,'Roma'],['Circo Massimo',41.8861,12.4851,'Roma'],['Terme di Caracalla',41.8790,12.4924,'Roma'],
      ['Villa Borghese',41.9142,12.4922,'Roma'],['Gianicolo',41.8913,12.4613,'Roma'],['Giardino degli Aranci',41.8846,12.4795,'Roma'],
      ['Piramide Cestia',41.8765,12.4808,'Roma'],['San Paolo fuori le Mura',41.8587,12.4768,'Roma'],['EUR — Palazzo della Civiltà',41.8364,12.4648,'Roma'],
      ['San Giovanni in Laterano',41.8859,12.5057,'Roma'],['Santa Maria Maggiore',41.8976,12.4984,'Roma'],['Quartiere Coppedè',41.9179,12.5005,'Roma'],
      ['Pigneto',41.8885,12.5285,'Roma'],['Garbatella',41.8634,12.4876,'Roma'],['Testaccio',41.8768,12.4752,'Roma'],
      ['Via Appia Antica',41.8518,12.5197,'Roma'],['Parco degli Acquedotti',41.8545,12.5600,'Roma'],['Foro Italico',41.9339,12.4547,'Roma'],
      ['Ponte Milvio',41.9356,12.4669,'Roma'],['Ostia Antica',41.7556,12.2919,'Roma'],['Lido di Ostia',41.7316,12.2795,'Roma'],
      ['Frascati',41.8085,12.6800],['Castel Gandolfo',41.7470,12.6510],['Albano Laziale',41.7300,12.6590],['Ariccia',41.7210,12.6720],
      ['Genzano di Roma',41.7060,12.6890],['Nemi',41.7210,12.7170],['Marino',41.7700,12.6590],['Grottaferrata',41.7880,12.6710],
      ['Rocca di Papa',41.7610,12.7090],['Rocca Priora',41.7890,12.7590],['Monte Porzio Catone',41.8160,12.7140],
      ['Monte Compatri',41.8090,12.7370],['Lanuvio',41.6760,12.6980],['Velletri',41.6870,12.7770],['Colonna',41.8350,12.7520],
      ['Lago di Nemi',41.7140,12.7020,'Nemi'],['Lago Albano',41.7480,12.6650,'Castel Gandolfo'],['Ciampino',41.8010,12.6020]
    ]
  }
};
