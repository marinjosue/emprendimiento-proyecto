# 🌱 AgroConecta — Prototipo funcional

Prototipo web de la plataforma **AgroConecta**, proyecto del Reto Innova-ESPE 2026 (Equipo 01, Ing. de Software).
Conecta a pequeños productores agrícolas de la Sierra centro-norte de Pichincha (Machachi, Cayambe, Tabacundo) con consumidores urbanos de Quito, **eliminando al intermediario**.

> *"Vendemos cosechas sin intermediarios mediante WhatsApp, logística compartida y pago garantizado en menos de 24 horas."*

## ▶️ Cómo ejecutarlo

No requiere instalación. Solo abre **`index.html`** en tu navegador (Chrome o Edge).

Para una demo guiada:
1. Pulsa **"🎬 Cargar datos de demo"** (abajo). Carga 5 cosechas de ejemplo.
2. Ve al **Módulo 2** → el sector *Machachi* ya supera los 80 quintales → pulsa **"Generar flete compartido"**.
3. Ve al **Módulo 3** → aparece el lote con su **QR**. Pulsa *Ver trazabilidad* o *Comprar*.

> 💡 Para abrir el QR desde un celular real, sirve la carpeta con un servidor local
> (`python -m http.server` dentro de la carpeta) y usa la IP de tu PC en lugar de abrir el archivo directo.

## 🧩 Los 3 módulos (uno por dolor, según la rúbrica)

| Módulo | Dolor que resuelve | Qué hace |
|--------|--------------------|----------|
| **1. Bot de WhatsApp** | Asimetría de precios | Chat simulado: consulta precios mayoristas reales y registra la cosecha con comandos simples. |
| **2. Consolidación logística** | Aislamiento logístico | Agrupa cosechas por sector; al llegar a 80 quintales habilita el flete compartido. |
| **3. Mercado + Trazabilidad QR** | Pérdida del margen premium | Publica canastas con QR que certifica origen y BPA; el productor cobra en <24 h. |

## 📁 Estructura

```
AgroConecta-Prototipo/
├── index.html          ← App principal (3 módulos en pestañas)
├── trazabilidad.html   ← Página que abre el QR (certificado de origen)
├── css/styles.css      ← Estilos
└── js/
    ├── db.js           ← Capa de datos (localStorage; preparada para Firebase)
    └── app.js          ← Lógica del bot y de los módulos
```

## 🔌 Migración a Firebase (siguiente paso)

El prototipo usa `localStorage` como base de datos simulada. Toda la persistencia está
aislada en `js/db.js`, marcada con comentarios `// FIREBASE`. Para producción:
- Reemplazar `_leer()` / `_guardar()` por Firestore (`getDocs`, `addDoc`, `setDoc`).
- Conectar el Módulo 1 con la **WhatsApp Business API** real.
- Integrar una pasarela de pago para el cobro en <24 h.

## 💰 Modelo de negocio (referencia)
- Comisión de plataforma (Take Rate): **8%** por transacción.
- Margen premium por trazabilidad/BPA: **+15–25%**.
- Infraestructura del piloto: **USD 0** (Firebase Spark, WhatsApp Business, Glide/Bubble).
