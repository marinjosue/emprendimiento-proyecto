/* ================================================================
   AgroConecta — Capa de datos (DB)
   ----------------------------------------------------------------
   Para el PROTOTIPO usamos localStorage como "base de datos"
   simulada. Está aislado aquí para que migrar a Firebase sea
   directo: solo hay que reemplazar el cuerpo de estas funciones
   por llamadas a Firestore (ver notas // FIREBASE más abajo).

   DATOS REALES (no genéricos), fuentes:
   - Productos cultivados en Mejía/Machachi y Cayambe (MAG, GAD Pichincha).
   - Precios mayoristas referenciales: Mercado Mayorista de Quito / SIPA-MAG
     y mercados regionales (Ambato EMA, EP-EMMPA Riobamba). Ej. real:
     cebolla paiteña ~$13–14/qq; papa con alta volatilidad (~+$4/qq).
   - Certificación BPA: AGROCALIDAD (vigencia 3 años, 4 pilares).
   - Punto de acopio: Centro de Acopio del cantón Mejía (MAG).
   ================================================================ */

const DB = (() => {
  const KEY = 'agroconecta_v2';

  /* ---------- Catálogo real de productos de Machachi/Cayambe ----------
     precio = referencia mayorista del día (USD) · unidad · variacion (%)
     respecto a la quincena anterior (signo simula reporte SIPA).        */
  const PRECIOS = {
    'papa superchola':  { emoji:'🥔', precio: 25, unidad:'quintal', variacion:  16 },
    'cebolla paiteña':  { emoji:'🧅', precio: 14, unidad:'quintal', variacion: -10 },
    'cebolla blanca':   { emoji:'🧅', precio: 20, unidad:'quintal', variacion:  -4 },
    'zanahoria amarilla':{emoji:'🥕', precio: 17, unidad:'quintal', variacion:  79 },
    'brócoli':          { emoji:'🥦', precio: 18, unidad:'quintal', variacion:   5 },
    'coliflor':         { emoji:'🥬', precio: 15, unidad:'quintal', variacion:  -3 },
    'lechuga':          { emoji:'🥬', precio: 12, unidad:'quintal', variacion:   8 },
    'col':              { emoji:'🥬', precio: 10, unidad:'quintal', variacion: -10 },
    'tomate riñón':     { emoji:'🍅', precio: 28, unidad:'quintal', variacion:  12 },
    'remolacha':        { emoji:'🟣', precio: 14, unidad:'quintal', variacion:   2 },
    'arveja tierna':    { emoji:'🫛', precio: 42, unidad:'quintal', variacion:  -6 },
    'haba tierna':      { emoji:'🫘', precio: 30, unidad:'quintal', variacion:   4 },
    'choclo':           { emoji:'🌽', precio: 26, unidad:'quintal', variacion: -10 },
    'mellocos':         { emoji:'🥔', precio: 28, unidad:'quintal', variacion:   3 }
  };

  // Sinónimos / formas cortas que el bot debe reconocer del lenguaje natural
  const ALIAS = {
    'papa':'papa superchola', 'papas':'papa superchola', 'superchola':'papa superchola',
    'cebolla':'cebolla paiteña', 'paiteña':'cebolla paiteña', 'paitena':'cebolla paiteña',
    'cebolla blanca':'cebolla blanca',
    'zanahoria':'zanahoria amarilla', 'zanahorias':'zanahoria amarilla',
    'brocoli':'brócoli', 'brócoli':'brócoli',
    'coliflor':'coliflor', 'lechuga':'lechuga', 'lechugas':'lechuga',
    'col':'col', 'repollo':'col',
    'tomate':'tomate riñón', 'tomate riñon':'tomate riñón', 'tomates':'tomate riñón',
    'remolacha':'remolacha', 'arveja':'arveja tierna', 'arvejas':'arveja tierna',
    'haba':'haba tierna', 'habas':'haba tierna',
    'choclo':'choclo', 'choclos':'choclo', 'maiz':'choclo',
    'melloco':'mellocos', 'mellocos':'mellocos'
  };

  // Sectores reales con su punto de acopio
  const SECTORES = {
    'Machachi':  'Centro de Acopio del cantón Mejía',
    'Cayambe':   'Acopio asociativo Cayambe',
    'Tabacundo': 'Acopio Tabacundo (Pedro Moncayo)'
  };

  // Parámetros operativos
  const MASA_CRITICA = 80;      // quintales para activar flete compartido
  const COMISION = 0.08;        // Take Rate de la plataforma
  const PREMIUM = 0.20;         // margen premium por trazabilidad/BPA
  const FLETE_CAMION = 110;     // costo real aprox. de un camión a Quito (USD)
  const FLETE_INDIVIDUAL = 4.5; // costo por quintal si el productor va solo (USD/qq)

  const estadoInicial = { ofertas: [], consolidaciones: [], secuencia: 1 };

  function _leer() {
    // FIREBASE: aquí iría getDocs(collection(db, ...))
    const raw = localStorage.getItem(KEY);
    if (!raw) { localStorage.setItem(KEY, JSON.stringify(estadoInicial)); return JSON.parse(JSON.stringify(estadoInicial)); }
    return JSON.parse(raw);
  }
  function _guardar(estado) {
    // FIREBASE: aquí iría setDoc / addDoc
    localStorage.setItem(KEY, JSON.stringify(estado));
  }

  // Normaliza un nombre libre a una clave del catálogo
  function _resolver(nombre) {
    if (!nombre) return null;
    const n = nombre.toLowerCase().trim();
    if (PRECIOS[n]) return n;
    if (ALIAS[n]) return ALIAS[n];
    return null;
  }

  return {
    PRECIOS, SECTORES, MASA_CRITICA, COMISION, PREMIUM, FLETE_CAMION, FLETE_INDIVIDUAL,

    catalogo() { return PRECIOS; },
    productosDisponibles() { return Object.keys(PRECIOS); },
    sectores() { return Object.keys(SECTORES); },
    acopioDe(sector) { return SECTORES[sector] || 'Punto de acopio AgroConecta'; },

    /** Busca un producto en texto libre. Devuelve la clave del catálogo o null. */
    detectarProducto(texto) {
      const t = (texto || '').toLowerCase();
      // intenta primero nombres completos del catálogo, luego alias largos, luego cortos
      const todos = [...Object.keys(PRECIOS), ...Object.keys(ALIAS)]
        .sort((a, b) => b.length - a.length);
      const hit = todos.find(p => t.includes(p));
      return _resolver(hit);
    },

    infoProducto(nombre) {
      const k = _resolver(nombre);
      return k ? { nombre: k, ...PRECIOS[k] } : null;
    },
    precioDe(nombre) {
      const k = _resolver(nombre);
      return k ? PRECIOS[k].precio : null;
    },

    /** Registra una nueva cosecha (Módulo 1: Bot) */
    registrarOferta({ productor, sector, telefono, producto, cantidad, bpa }) {
      const estado = _leer();
      const k = _resolver(producto) || producto;
      const precioMayorista = (PRECIOS[k] && PRECIOS[k].precio) || 0;
      // Precio justo = mayorista menos pequeño descuento logístico (vs. 60% que perdía con el intermediario)
      const precioJusto = +(precioMayorista * 0.92).toFixed(2);
      const oferta = {
        id: 'OF-' + String(estado.secuencia).padStart(3, '0'),
        productor, sector, telefono,
        producto: k,
        emoji: (PRECIOS[k] && PRECIOS[k].emoji) || '🌱',
        cantidad: Number(cantidad),
        bpa: !!bpa,
        precioMayorista, precioJusto,
        estado: 'registrada',
        consolidacionId: null,
        fecha: new Date().toISOString()
      };
      estado.ofertas.push(oferta);
      estado.secuencia++;
      _guardar(estado);
      return oferta;
    },

    ofertas() { return _leer().ofertas; },
    consolidaciones() { return _leer().consolidaciones; },

    ofertasPorSector() {
      const grupos = {};
      _leer().ofertas.filter(o => o.estado === 'registrada')
        .forEach(o => { (grupos[o.sector] = grupos[o.sector] || []).push(o); });
      return grupos;
    },

    /** Genera el flete compartido para un sector (Módulo 2) */
    consolidar(sector) {
      const estado = _leer();
      const ofertas = estado.ofertas.filter(o => o.sector === sector && o.estado === 'registrada');
      if (!ofertas.length) return null;
      const totalQuintales = ofertas.reduce((s, o) => s + o.cantidad, 0);
      const costoCompartidoQ = +(FLETE_CAMION / totalQuintales).toFixed(2);
      const ahorroQ = +(FLETE_INDIVIDUAL - costoCompartidoQ).toFixed(2);
      const cons = {
        id: 'LT-' + String(estado.secuencia).padStart(3, '0'),
        sector,
        acopio: this.acopioDe(sector),
        ofertaIds: ofertas.map(o => o.id),
        productos: [...new Set(ofertas.map(o => o.producto))],
        totalQuintales,
        productores: ofertas.map(o => o.productor),
        bpa: ofertas.every(o => o.bpa),
        costoFleteTotal: FLETE_CAMION,
        costoFleteCompartidoQ: costoCompartidoQ,
        ahorroPorQuintal: ahorroQ,
        estado: 'en_transito',
        fecha: new Date().toISOString()
      };
      ofertas.forEach(o => { o.estado = 'consolidada'; o.consolidacionId = cons.id; });
      estado.consolidaciones.push(cons);
      estado.secuencia++;
      _guardar(estado);
      return cons;
    },

    venderLote(consId) {
      const estado = _leer();
      const cons = estado.consolidaciones.find(c => c.id === consId);
      if (cons) {
        cons.estado = 'vendido';
        cons.fechaVenta = new Date().toISOString();
        estado.ofertas.forEach(o => { if (o.consolidacionId === consId) o.estado = 'vendida'; });
        _guardar(estado);
      }
      return cons;
    },

    loteById(id) { return _leer().consolidaciones.find(c => c.id === id) || null; },

    /** Número de certificado BPA realista (formato AGROCALIDAD) */
    certificadoBPA(loteId) {
      const num = (loteId || 'LT-000').replace(/\D/g, '').padStart(4, '0');
      return `BPA-AGROCALIDAD-PICH-${num}`;
    },

    reset() { localStorage.removeItem(KEY); },

    /** Datos de ejemplo para demo (productores reales de las entrevistas E-01..E-03) */
    seedDemo() {
      this.reset();
      this.registrarOferta({ productor:'Don Esteban Chicaiza', sector:'Machachi', telefono:'0991111111', producto:'cebolla paiteña', cantidad:25, bpa:true });
      this.registrarOferta({ productor:'Omar Iza',            sector:'Machachi', telefono:'0992222222', producto:'zanahoria',       cantidad:30, bpa:true });
      this.registrarOferta({ productor:'Sr. Manuel',          sector:'Machachi', telefono:'0993333333', producto:'papa',            cantidad:28, bpa:false });
      this.registrarOferta({ productor:'María Toaquiza',      sector:'Cayambe',  telefono:'0994444444', producto:'brócoli',         cantidad:15, bpa:true });
      this.registrarOferta({ productor:'Luis Quishpe',        sector:'Cayambe',  telefono:'0995555555', producto:'choclo',          cantidad:18, bpa:true });
    }
  };
})();
