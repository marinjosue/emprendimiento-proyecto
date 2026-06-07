/* ================================================================
   AgroConecta — Lógica de la aplicación (3 módulos)
   Datos reales cargados desde db.js (precios MMQ/SIPA, BPA AGROCALIDAD,
   productos de Machachi/Cayambe, centro de acopio de Mejía).
   ================================================================ */

/* ---------- Navegación por pestañas ---------- */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('activo'));
    tab.classList.add('activo');
    document.getElementById(tab.dataset.panel).classList.add('activo');
    if (tab.dataset.panel === 'logistica') renderLogistica();
    if (tab.dataset.panel === 'mercado') renderMercado();
  });
});

/* helper QR */
function urlQR(texto, size = 160) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(texto)}`;
}
function urlTrazabilidad(loteId) {
  return location.href.replace(/index\.html.*$/, '') + 'trazabilidad.html?lote=' + loteId;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ================================================================
   MÓDULO 1 — BOT DE WHATSAPP (máquina de estados conversacional)
   ================================================================ */
const Bot = (() => {
  const chat = document.getElementById('chat');
  const entrada = document.getElementById('entrada');
  let ctx = { paso: null, datos: {} };

  function hora() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function burbuja(texto, quien) {
    const div = document.createElement('div');
    div.className = 'msg ' + quien;
    const html = texto
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*(.+?)\*/g, '<b>$1</b>')
      .replace(/_(.+?)_/g, '<i>$1</i>')
      .replace(/\n/g, '<br>');
    div.innerHTML = html + `<span class="hora">${hora()}</span>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }
  const bot = t => setTimeout(() => burbuja(t, 'bot'), 350);

  function menu() {
    return 'Responde con el *número* de la opción:\n\n' +
           '*1* · 📈 Precios del día (Mercado Mayorista)\n' +
           '*2* · 🌽 Registrar mi cosecha\n' +
           '*3* · 📋 Estado de mis cosechas\n' +
           '*4* · 👨‍🌾 Hablar con un técnico (MAG)';
  }

  function precios() {
    let t = '📈 *Precios referenciales de hoy*\n_Mercado Mayorista de Quito (SIPA-MAG)_\n\n';
    DB.productosDisponibles().forEach(k => {
      const p = DB.PRECIOS[k];
      const flecha = p.variacion > 0 ? `🔺+${p.variacion}%` : p.variacion < 0 ? `🔻${p.variacion}%` : '➖';
      t += `${p.emoji} ${cap(k)}: *$${p.precio}*/${p.unidad}  ${flecha}\n`;
    });
    t += '\n_Variación vs. quincena anterior._\nEscribe *2* para registrar tu cosecha a precio justo.';
    return t;
  }

  function registrarFinal() {
    const d = ctx.datos;
    const of = DB.registrarOferta({
      productor: d.productor, sector: d.sector,
      telefono: '09' + Math.floor(10000000 + Math.random() * 89999999),
      producto: d.producto, cantidad: d.cantidad, bpa: d.bpa
    });
    const total = (of.precioJusto * of.cantidad).toFixed(2);
    const acopio = DB.acopioDe(of.sector);
    bot(`✅ *Cosecha registrada* (${of.id})\n\n` +
        `👨‍🌾 ${of.productor} — ${of.sector}\n` +
        `${of.emoji} ${of.cantidad} quintales de ${of.producto}\n` +
        `🏷️ Mayorista hoy: $${of.precioMayorista}/qq\n` +
        `💵 Tu precio justo: *$${of.precioJusto}/qq*\n` +
        `💰 Total estimado: *$${total}*\n` +
        (of.bpa ? '🏅 Declarado con certificación BPA\n' : '') +
        `\n📄 Se emitió tu *orden de recolección digital*.\n` +
        `🚛 Cuando tu sector complete la carga, coordinamos el flete compartido desde el *${acopio}* y recibirás tu pago en *menos de 24 horas*.\n\n` +
        `Escribe *menú* para volver.`);
    ctx = { paso: null, datos: {} };
    renderLogistica();
  }

  function procesar(texto) {
    const t = texto.trim().toLowerCase();

    if (['menu', 'menú', 'hola', 'buenas', 'inicio', 'buenos dias', 'buenos días'].includes(t)) {
      ctx = { paso: null, datos: {} };
      bot('👋 ¡Hola! Soy el bot de *AgroConecta*. Vende tu cosecha directo, sin intermediarios.\n\n' + menu());
      return;
    }

    // ---- flujo de registro paso a paso ----
    if (ctx.paso === 'nombre') {
      ctx.datos.productor = texto.trim();
      ctx.paso = 'sector';
      bot(`Gracias, *${ctx.datos.productor}*. ¿En qué sector estás?\n\n${DB.sectores().map((s,i)=>`*${i+1}* · ${s}`).join('\n')}`);
      return;
    }
    if (ctx.paso === 'sector') {
      const secs = DB.sectores();
      let sector = secs.find(s => t.includes(s.toLowerCase()));
      if (!sector && /^[1-3]$/.test(t)) sector = secs[parseInt(t,10) - 1];
      if (!sector) { bot('No reconocí el sector. Elige: ' + secs.join(', ')); return; }
      ctx.datos.sector = sector;
      ctx.paso = 'cosecha';
      bot(`Perfecto, *${sector}*.\nAhora dime *qué tienes para vender*.\n\nEjemplo: _"Tengo 25 quintales de cebolla"_\n\nEscribe *1* si quieres ver los productos y precios.`);
      return;
    }
    if (ctx.paso === 'cosecha') {
      if (t === '1') { bot(precios()); return; }
      const prod = DB.detectarProducto(texto);
      const num = (texto.match(/(\d+)/) || [])[1];
      if (!prod || !num) {
        bot('🤔 No entendí. Escríbelo así: _"20 quintales de zanahoria"_.\nProductos: ' + DB.productosDisponibles().slice(0,8).join(', ') + '…');
        return;
      }
      ctx.datos.cantidad = parseInt(num, 10);
      ctx.datos.producto = prod;
      ctx.paso = 'bpa';
      const info = DB.infoProducto(prod);
      bot(`${info.emoji} *${ctx.datos.cantidad} quintales de ${prod}*.\n` +
          `Mayorista hoy: $${info.precio}/qq.\n\n` +
          `¿Tu producto tiene *Buenas Prácticas Agrícolas (BPA)* de AGROCALIDAD? Responde *sí* o *no*.`);
      return;
    }
    if (ctx.paso === 'bpa') {
      ctx.datos.bpa = ['si', 'sí', 's', 'yes', 'claro'].includes(t);
      registrarFinal();
      return;
    }

    // ---- menú principal ----
    if (t === '1' || t.includes('precio')) { bot(precios()); return; }
    if (t === '3' || t.includes('mis cosecha') || t.includes('estado')) {
      const mias = DB.ofertas();
      if (!mias.length) { bot('Aún no hay cosechas registradas. Escribe *2* para registrar la primera.'); return; }
      let r = '📋 *Cosechas registradas:*\n\n';
      mias.slice(-6).forEach(o => {
        const e = o.estado === 'registrada' ? '🕓 esperando carga'
                : o.estado === 'consolidada' ? '🚛 en flete compartido'
                : '✅ vendida (pago enviado)';
        r += `${o.id} · ${o.emoji} ${o.cantidad}q ${o.producto} — ${e}\n`;
      });
      bot(r);
      return;
    }
    if (t === '4' || t.includes('técnico') || t.includes('tecnico') || t.includes('ayuda')) {
      bot('👨‍🌾 Te derivo con un *técnico territorial del MAG*.\n_(En la versión real, el chat escala a un agente humano.)_\nMientras tanto, escribe *menú* para seguir operando.');
      return;
    }

    // ¿registrar?
    if (t === '2' || t.includes('registrar') || (DB.detectarProducto(texto) && /\d/.test(texto))) {
      ctx = { paso: 'nombre', datos: {} };
      bot('🌽 ¡Vamos a registrar tu cosecha!\nPrimero, ¿cuál es tu *nombre completo*?');
      return;
    }

    bot('No reconocí ese comando. 🙂\n\n' + menu());
  }

  function enviar() {
    const texto = entrada.value.trim();
    if (!texto) return;
    burbuja(texto, 'user');
    entrada.value = '';
    procesar(texto);
  }
  function iniciar() {
    chat.innerHTML = '';
    bot('👋 ¡Bienvenido a *AgroConecta*!\nLa forma de vender tu cosecha sin intermediarios, vía WhatsApp.\n\n' + menu());
  }

  document.getElementById('enviar').addEventListener('click', enviar);
  entrada.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });
  document.querySelectorAll('#chips .chip').forEach(chip => {
    chip.addEventListener('click', () => { entrada.value = chip.dataset.msg; enviar(); });
  });

  return { iniciar };
})();

/* ================================================================
   MÓDULO 2 — CONSOLIDACIÓN LOGÍSTICA
   ================================================================ */
function renderLogistica() {
  document.getElementById('masaTxt').textContent = DB.MASA_CRITICA;
  const grupos = DB.ofertasPorSector();
  const grid = document.getElementById('gridSectores');
  const kpis = document.getElementById('kpisLog');

  const totalOf = DB.ofertas().length;
  const totalQ = DB.ofertas().filter(o => o.estado === 'registrada').reduce((s, o) => s + o.cantidad, 0);
  const fletes = DB.consolidaciones().length;
  kpis.innerHTML = `
    <div class="kpi"><b>${totalOf}</b><span>Cosechas registradas</span></div>
    <div class="kpi"><b>${totalQ}</b><span>Quintales por despachar</span></div>
    <div class="kpi"><b>${fletes}</b><span>Fletes generados</span></div>
    <div class="kpi"><b>${Object.keys(grupos).length}</b><span>Sectores activos</span></div>`;

  const sectores = Object.keys(grupos);
  if (!sectores.length) {
    grid.innerHTML = `<div class="vacio">No hay cosechas pendientes.<br>Ve al <b>Módulo 1</b> y registra una cosecha, o usa <b>"Cargar datos de demo"</b> abajo.</div>`;
    return;
  }

  grid.innerHTML = sectores.map(sector => {
    const ofs = grupos[sector];
    const total = ofs.reduce((s, o) => s + o.cantidad, 0);
    const pct = Math.min(100, Math.round(total / DB.MASA_CRITICA * 100));
    const listo = total >= DB.MASA_CRITICA;
    const fleteComp = (DB.FLETE_CAMION / total).toFixed(2);
    const items = ofs.map(o => `
      <li><span>${o.emoji} ${o.productor} — ${o.cantidad}q ${o.producto} ${o.bpa ? '<span class="bpa">🏅BPA</span>' : ''}</span>
          <span>$${o.precioJusto}/q</span></li>`).join('');
    return `
      <div class="card">
        <h3>📍 ${sector}
          <span class="badge ${listo ? 'listo' : 'pend'}">${listo ? 'Listo para flete' : 'Acumulando'}</span>
        </h3>
        <div class="meta">🏬 ${DB.acopioDe(sector)} · ${ofs.length} productores · ${total}/${DB.MASA_CRITICA} qq</div>
        <div class="barra"><div style="width:${pct}%"></div><span>${pct}%</span></div>
        <ul class="lista-ofertas">${items}</ul>
        <div class="meta">🚛 Flete compartido: <b>$${fleteComp}/qq</b> vs. $${DB.FLETE_INDIVIDUAL}/qq yendo solo
          → ahorro de <b>$${Math.max(0,(DB.FLETE_INDIVIDUAL - fleteComp)).toFixed(2)}/qq</b></div>
        <button class="btn" ${listo ? '' : 'disabled'} onclick="generarFlete('${sector}')">
          ${listo ? '🚛 Generar flete compartido a Quito' : `Faltan ${DB.MASA_CRITICA - total} quintales`}
        </button>
      </div>`;
  }).join('');
}

function generarFlete(sector) {
  const c = DB.consolidar(sector);
  if (c) {
    alert(`✅ Flete compartido generado: ${c.id}\n\n` +
          `📍 Sector: ${c.sector}  (${c.acopio})\n` +
          `📦 ${c.totalQuintales} quintales · ${c.productores.length} productores\n` +
          `🌽 ${c.productos.join(', ')}\n\n` +
          `🚛 Costo del flete: $${c.costoFleteTotal} ÷ ${c.totalQuintales}qq = $${c.costoFleteCompartidoQ}/qq\n` +
          `💸 Ahorro: $${c.ahorroPorQuintal}/qq frente a transportar solo.\n\n` +
          `El lote ya está en el Módulo 3 (Mercado) con su QR de trazabilidad.`);
    renderLogistica();
    renderMercado();
  }
}

/* ================================================================
   MÓDULO 3 — MERCADO + TRAZABILIDAD QR
   ================================================================ */
function precioBaseLote(c) {
  // suma real del precio justo × cantidad de las ofertas del lote
  const ofs = DB.ofertas().filter(o => o.consolidacionId === c.id);
  return ofs.reduce((s, o) => s + o.precioJusto * o.cantidad, 0);
}

function renderMercado() {
  const grid = document.getElementById('gridMercado');
  const lotes = DB.consolidaciones();
  if (!lotes.length) {
    grid.innerHTML = `<div class="vacio">Todavía no hay lotes a la venta.<br>Genera un flete compartido en el <b>Módulo 2</b> para publicar canastas trazables aquí.</div>`;
    return;
  }
  grid.innerHTML = lotes.map(c => {
    const base = precioBaseLote(c);
    const conComision = base * (1 + DB.COMISION);
    const final = conComision * (1 + (c.bpa ? DB.PREMIUM : 0));
    const vendido = c.estado === 'vendido';
    const traza = urlTrazabilidad(c.id);
    const emojis = c.productos.map(p => (DB.PRECIOS[p] && DB.PRECIOS[p].emoji) || '🌱').join(' ');
    return `
      <div class="card canasta">
        <h3>🧺 Lote ${c.id}
          <span class="badge ${vendido ? 'listo' : 'transito'}">${vendido ? 'Vendido' : 'Disponible'}</span>
        </h3>
        <div class="meta">📍 ${c.sector} · ${c.totalQuintales} qq · ${c.productores.length} productores</div>
        <div class="meta">${emojis} ${c.productos.join(', ')}</div>
        ${c.bpa ? '<span class="premium">🏅 Certificado BPA (AGROCALIDAD) — premium +20%</span>' : ''}
        <div class="precio">$${final.toFixed(2)} <small>(base $${base.toFixed(0)} + 8% comisión${c.bpa ? ' + 20% premium' : ''})</small></div>
        <img class="qr-mini" src="${urlQR(traza, 120)}" alt="QR trazabilidad" title="Escanéame">
        <div style="display:flex;gap:8px">
          <button class="btn sec" onclick="window.open('${traza}','_blank')">🔍 Trazabilidad</button>
          <button class="btn" ${vendido ? 'disabled' : ''} onclick="comprarLote('${c.id}')">${vendido ? '✔ Pagado' : '💳 Comprar'}</button>
        </div>
      </div>`;
  }).join('');
}

function comprarLote(id) {
  DB.venderLote(id);
  alert('💳 ¡Compra realizada!\n\n' +
        '✅ El consumidor pagó con margen premium por trazabilidad BPA.\n' +
        '⏱️ Los productores del lote recibirán su pago en *menos de 24 horas* en su cuenta cooperativa.\n\n' +
        '(Cumple la promesa de valor financiero del proyecto.)');
  renderMercado();
}

/* ---------- Botones globales ---------- */
document.getElementById('btnSeed').addEventListener('click', () => {
  DB.seedDemo();
  Bot.iniciar(); renderLogistica(); renderMercado();
  alert('🎬 Datos de demo cargados: 5 cosechas reales (Machachi y Cayambe).\n\nEn el Módulo 2, el sector Machachi ya supera los 80 quintales → genera su flete compartido.');
});
document.getElementById('btnReset').addEventListener('click', () => {
  if (confirm('¿Reiniciar el prototipo y borrar todos los datos?')) {
    DB.reset(); Bot.iniciar(); renderLogistica(); renderMercado();
  }
});

/* ---------- Arranque ---------- */
Bot.iniciar();
renderLogistica();
