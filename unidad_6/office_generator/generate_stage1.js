const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const sharp = require("sharp");
const pptxgen = require("pptxgenjs");
const {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel,
  ImageRun, PageBreak, PageNumber, Paragraph, Packer, ShadingType,
  Table, TableCell, TableRow, TextRun, WidthType
} = require("docx");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "unidad_6/etapa_1_evaluacion/entregables");
const ARCH = path.join(ROOT, "docs/diagrams/arquitectura_hibrida.png");
const RESULT = path.join(ROOT, "unidad_6/benchmark/resultados");

const C = {
  navy: "102A43", blue: "176B87", cyan: "64CCC5", ink: "243B53",
  gray: "627D98", light: "F4F7FA", white: "FFFFFF", green: "21867A",
  orange: "F59E0B", red: "C2413B", line: "D9E2EC", pale: "EAF4F5"
};

const team = "Andrés Fernando Díaz Moreno · Carlos Alberto Arévalo Martínez · Luis Alfredo González Mercado · Andrés Camilo López Castro";

function tr(text, options = {}) {
  return new TextRun({ text, font: "Aptos", size: 21, color: C.ink, ...options });
}

function p(text, options = {}) {
  return new Paragraph({
    children: Array.isArray(text) ? text : [tr(text)],
    spacing: { after: 130, line: 310 }, alignment: options.alignment,
    bullet: options.bullet, keepNext: options.keepNext
  });
}

function h(text, level = 1) {
  return new Paragraph({
    text,
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before: level === 1 ? 300 : 190, after: 110 }, keepNext: true
  });
}

function bullet(text) { return p(text, { bullet: { level: 0 } }); }

function cell(text, header = false, fill = C.white) {
  return new TableCell({
    shading: { fill: header ? C.navy : fill, type: ShadingType.CLEAR },
    margins: { top: 95, bottom: 95, left: 105, right: 105 },
    children: [new Paragraph({ children: [new TextRun({
      text: String(text), font: "Aptos", size: header ? 18 : 17,
      bold: header, color: header ? C.white : C.ink
    })] })]
  });
}

function tbl(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: widths,
    borders: {
      top: { style: BorderStyle.SINGLE, color: C.line, size: 1 },
      bottom: { style: BorderStyle.SINGLE, color: C.line, size: 1 },
      left: { style: BorderStyle.SINGLE, color: C.line, size: 1 },
      right: { style: BorderStyle.SINGLE, color: C.line, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: C.line, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, color: C.line, size: 1 }
    },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((x) => cell(x, true)) }),
      ...rows.map((row, i) => new TableRow({ children: row.map((x) => cell(x, false, i % 2 ? C.light : C.white)) }))
    ]
  });
}

function img(file, width, height, caption) {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 150, after: 70 }, children: [
      new ImageRun({ data: fs.readFileSync(file), transformation: { width, height }, type: "png" })
    ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 170 }, children: [
      new TextRun({ text: caption, font: "Aptos", size: 17, italics: true, color: C.gray })
    ] })
  ];
}

async function png(svg) {
  const out = path.join(os.tmpdir(), `u6_stage1_${path.basename(svg)}.png`);
  await sharp(path.join(RESULT, svg), { density: 180 }).png().toFile(out);
  return out;
}

function cover(title, subtitle, metrics) {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 760, after: 180 }, children: [
      new TextRun({ text: "ECOMMIFY", font: "Aptos Display", size: 50, bold: true, color: C.blue })
    ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
      new TextRun({ text: title, font: "Aptos Display", size: 31, bold: true, color: C.navy })
    ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 430 }, children: [
      new TextRun({ text: subtitle, font: "Aptos", size: 19, bold: true, color: C.green })
    ] }),
    tbl(["Indicador", "Resultado"], metrics, [4700, 4300]),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 520 }, children: [tr("Maestría en Arquitectura de Software · Universidad de La Sabana", { size: 19, bold: true, color: C.navy })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [tr("Profesor: Miguel Alfonso Varela Fonseca", { size: 18, color: C.gray })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [tr(team, { size: 17, color: C.gray })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [tr("Unidad 6 · Etapa 1 formativa · Junio de 2026", { size: 17, color: C.gray })] }),
    new Paragraph({ children: [new PageBreak()] })
  ];
}

async function writeDoc(filename, title, subtitle, metrics, content) {
  const doc = new Document({
    creator: "Equipo Ecommify", title,
    styles: {
      default: { document: { run: { font: "Aptos", size: 21, color: C.ink }, paragraph: { spacing: { line: 310 } } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "Aptos Display", size: 31, bold: true, color: C.navy }, paragraph: { outlineLevel: 0, keepNext: true, spacing: { before: 300, after: 140 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "Aptos Display", size: 25, bold: true, color: C.blue }, paragraph: { outlineLevel: 1, keepNext: true, spacing: { before: 220, after: 100 } } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "Aptos", size: 22, bold: true, color: C.green }, paragraph: { outlineLevel: 2, keepNext: true } }
      ]
    },
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ text: `ECOMMIFY · ${subtitle}`, font: "Aptos", size: 14, bold: true, color: C.blue })
      ] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: "Unidad 6 · Etapa 1  ·  ", size: 14, color: C.gray }),
        new TextRun({ children: [PageNumber.CURRENT], size: 14, color: C.gray })
      ] })] }) },
      children: [...cover(title, subtitle, metrics), ...content]
    }]
  });
  const file = path.join(OUTPUT, filename);
  fs.writeFileSync(file, await Packer.toBuffer(doc));
  return file;
}

async function performanceDoc() {
  const throughput = await png("grafica_throughput.svg");
  const p95 = await png("grafica_p95.svg");
  const scaleThroughput = await png("grafica_escalabilidad_throughput.svg");
  const scaleP95 = await png("grafica_escalabilidad_p95.svg");
  return writeDoc(
    "01_Pruebas_Rendimiento_y_Escalabilidad.docx",
    "Pruebas de rendimiento y escalabilidad",
    "EVALUACIÓN CUANTITATIVA",
    [["Corridas distintas", "31"], ["Throughput máximo", "626,68 ops/s"], ["Punto de quiebre", "Entre 10 y 25 usuarios"], ["Errores", "0 %"]],
    [
      h("Resumen ejecutivo"),
      p("La evaluación cuantitativa midió cinco flujos representativos de Ecommify sobre PostgreSQL y MongoDB. Se ejecutaron 31 corridas distintas de 120 segundos, con concurrencia entre 1 y 100 usuarios y crecimiento de datos entre 1x y 10x. El sistema no presentó errores, pero el throughput dejó de crecer después de 10 usuarios y el dashboard híbrido dominó la cola de latencia."),
      h("1. Objetivos y alcance"),
      bullet("Medir throughput, p50, p95, p99 y tasa de error."),
      bullet("Identificar degradación, cuellos de botella y punto de quiebre."),
      bullet("Evaluar concurrencia y crecimiento del dataset de forma independiente."),
      bullet("Producir evidencia reproducible mediante JMeter, JTL, CSV y gráficas."),
      h("2. Diseño de la suite", 1),
      h("2.1 Cargas evaluadas", 2),
      tbl(["ID", "Flujo", "Motor", "Propósito"], [
        ["T01", "Checkout híbrido", "PostgreSQL + MongoDB", "Transacción, outbox y proyección"],
        ["T02", "Detalle de orden", "PostgreSQL", "Consulta relacional indexada"],
        ["T05", "Catálogo", "MongoDB", "Lectura denormalizada"],
        ["T06", "Evento", "MongoDB", "Escritura en bucket"],
        ["T09", "Dashboard", "Ambos", "Agregación cross-motor"]
      ], [900, 2600, 2500, 3000]),
      h("2.2 Concurrencia", 2),
      p("Niveles: 1, 10, 25, 50 y 100 usuarios virtuales. Cada nivel tuvo cinco repeticiones, 120 segundos de medición y 10 segundos de rampa. Antes de cada corrida se eliminaron datos dinámicos y se restauró el inventario."),
      h("2.3 Escalabilidad por volumen", 2),
      tbl(["Escala", "Órdenes", "Productos", "Eventos", "Relación"], [
        ["S", "10.000", "5.000", "100.000", "1x"],
        ["M", "50.000", "20.000", "500.000", "5x"],
        ["L", "100.000", "40.000", "1.000.000", "10x"]
      ], [1300, 1900, 1900, 2100, 1800]),
      h("3. Entorno y procedimiento"),
      tbl(["Elemento", "Configuración"], [
        ["Equipo", "Apple M1 · 8 GiB RAM · macOS 26.2"],
        ["Motores", "PostgreSQL 16.14 · MongoDB 7.0.37"],
        ["Generador", "Apache JMeter 5.6.3 en modo no GUI"],
        ["Contenedores", "Bases, API híbrida y JMeter aislados"],
        ["Estado", "Baseline restaurado antes de cada prueba"]
      ], [2800, 6200]),
      p("Procedimiento: levantar servicios, validar /health, restaurar baseline, ejecutar JMeter, conservar JTL, generar reporte HTML y consolidar medianas mediante scripts Node.js."),
      h("4. Resultados de concurrencia"),
      tbl(["Usuarios", "Throughput", "p50", "p95", "p99", "Errores"], [
        ["1", "400,39", "1 ms", "7 ms", "11 ms", "0 %"],
        ["10", "626,68", "4 ms", "71 ms", "110 ms", "0 %"],
        ["25", "560,70", "16 ms", "190 ms", "268 ms", "0 %"],
        ["50", "565,91", "65 ms", "252 ms", "354 ms", "0 %"],
        ["100", "540,56", "172 ms", "396 ms", "525 ms", "0 %"]
      ], [1300, 1900, 1300, 1300, 1300, 1200]),
      ...img(throughput, 620, 330, "Figura 1. Throughput mediano por nivel de concurrencia."),
      ...img(p95, 620, 330, "Figura 2. Latencia p95 mediana por nivel de concurrencia."),
      p("El máximo throughput se observó con 10 usuarios. Al subir a 25, throughput cayó 10,53 % y p95 aumentó 167,61 %. El punto de quiebre se ubica entre ambos niveles: el sistema continúa disponible, pero deja de escalar."),
      h("5. Resultados de escalabilidad"),
      tbl(["Escala", "Throughput", "p50", "p95", "p99", "Errores"], [
        ["S · 1x", "621,83", "4 ms", "71 ms", "112 ms", "0 %"],
        ["M · 5x", "164,73", "4 ms", "309 ms", "403 ms", "0 %"],
        ["L · 10x", "91,94", "5 ms", "568 ms", "703 ms", "0 %"]
      ], [1500, 1900, 1400, 1400, 1400, 1400]),
      ...img(scaleThroughput, 620, 350, "Figura 3. Throughput frente al crecimiento del dataset."),
      ...img(scaleP95, 620, 350, "Figura 4. Latencia p95 frente al crecimiento del dataset."),
      p("Entre S y L, throughput disminuyó 85,21 % y p95 aumentó 700 %. p50 permaneció entre 4 y 5 ms, evidencia de que las operaciones indexadas simples resistieron; la degradación se concentró en operaciones analíticas."),
      h("6. Cuellos de botella"),
      tbl(["Cuello", "Evidencia", "Causa probable"], [
        ["Dashboard híbrido", "p95 517 ms con 100 usuarios", "Agregación global sobre dos motores"],
        ["Pool MongoDB", "Catálogo/eventos se degradan con concurrencia", "Recursos compartidos con analítica"],
        ["Checkout híbrido", "p95 329 ms con 100 usuarios", "Proyección MongoDB dentro del flujo"],
        ["Consulta geoespacial U4", "116,412 ms aun optimizada", "Cálculo espacial y selectividad"]
      ], [2600, 3000, 3400]),
      h("7. Recomendaciones"),
      bullet("Preagregar eventos por hora/día y consultar una colección behavior_daily."),
      bullet("Consumir el outbox asíncronamente; PostgreSQL conserva el commit canónico."),
      bullet("Incorporar caché y paginación indexada para catálogo."),
      bullet("Separar cargas analíticas y operativas en recursos diferentes."),
      bullet("Definir SLO para p95, error rate y replication lag."),
      h("8. Reproducción"),
      p("Comando rápido: ./run_tests.sh smoke 2 15 2 demo. Matriz de concurrencia: ./run_tests.sh concurrency 120 5 10. Escalabilidad: ./run_tests.sh scalability 120 3. Consolidación: ./run_tests.sh consolidate."),
      h("Conclusión"),
      p("La implementación es funcional y estable hasta 100 usuarios en el entorno evaluado, pero su capacidad útil se satura entre 10 y 25 usuarios para la mezcla completa. La prioridad técnica es retirar la agregación global del camino de usuario y desacoplar la proyección de checkout.")
    ]
  );
}

async function comparisonDoc() {
  return writeDoc(
    "02_Analisis_Comparativo_PostgreSQL_vs_MongoDB.docx",
    "Análisis comparativo PostgreSQL vs. MongoDB",
    "DECISIÓN TECNOLÓGICA BASADA EN EVIDENCIA",
    [["PostgreSQL", "Núcleo transaccional"], ["MongoDB", "Proyecciones y flexibilidad"], ["Dashboard híbrido", "Requiere preagregación"], ["Conclusión", "Mantener arquitectura híbrida"]],
    [
      h("Resumen ejecutivo"),
      p("La comparación no busca un ganador universal. Evalúa qué tecnología reduce riesgo y costo para cada carga de Ecommify. PostgreSQL fue superior para transacciones, integridad y consultas relacionales; MongoDB fue adecuado para catálogo denormalizado, eventos y sesiones. La evidencia también mostró que combinar ambos motores en agregaciones síncronas introduce el mayor costo."),
      h("1. Criterios de evaluación"),
      tbl(["Criterio", "Pregunta de decisión"], [
        ["Transaccional", "¿Requiere atomicidad, FK y auditoría?"],
        ["Analítico", "¿Agrega grandes volúmenes o múltiples entidades?"],
        ["Flexibilidad", "¿El esquema cambia por instancia o categoría?"],
        ["Integridad", "¿Las relaciones deben validarse declarativamente?"],
        ["Escalabilidad", "¿La carga crece vertical u horizontalmente?"],
        ["Consistencia", "¿Acepta datos temporalmente desactualizados?"]
      ], [2600, 6400]),
      h("2. Comparación cuantitativa"),
      tbl(["Aspecto", "Ganador", "Evidencia del proyecto"], [
        ["Detalle de orden", "PostgreSQL", "p95 5 ms con 10 usuarios; 27 ms con 100"],
        ["Catálogo", "MongoDB", "p95 25 ms con 10 usuarios en S"],
        ["Eventos", "MongoDB", "p95 14 ms con 10 usuarios en S"],
        ["Checkout", "PostgreSQL canónico", "Transacción + outbox; 0 % errores"],
        ["Dashboard cross-motor", "Ninguno sin optimizar", "p95 517 ms con 100 usuarios"],
        ["Reportería estructurada", "PostgreSQL", "Vistas U4 redujeron Q03 a 0,693 ms"]
      ], [2500, 2600, 3900]),
      h("3. Matriz integral"),
      tbl(["Aspecto", "PostgreSQL", "MongoDB", "Ganador Ecommify"], [
        ["Transacciones", "ACID y restricciones", "Transacciones posibles, mayor complejidad", "PostgreSQL"],
        ["Integridad", "FK y checks", "Referencias lógicas", "PostgreSQL"],
        ["Consultas multi-tabla", "Joins y optimizador", "$lookup no es el patrón objetivo", "PostgreSQL"],
        ["Catálogo", "JSONB + joins", "Documento autocontenido", "MongoDB"],
        ["Esquema flexible", "JSONB controlado", "Documentos polimórficos", "MongoDB contextual"],
        ["Eventos", "Presiona OLTP", "Buckets append-only", "MongoDB"],
        ["Consistencia fuerte", "Natural en primario", "Depende de concerns", "PostgreSQL"],
        ["Escala horizontal", "Requiere extensión/servicio", "Sharding nativo", "MongoDB contextual"],
        ["Búsqueda", "pg_trgm", "Search/índice texto", "Empate condicionado"]
      ], [1900, 2500, 2600, 2000]),
      h("4. Análisis cualitativo"),
      h("4.1 Casos que superaron expectativas", 2),
      p("PostgreSQL absorbió más flexibilidad de la prevista mediante JSONB, arreglos, HSTORE y tipos compuestos sin sacrificar integridad. Sus vistas materializadas y partition pruning mejoraron reportería y segmentación."),
      p("MongoDB simplificó catálogo, TTL de sesiones y buckets de eventos. Las lecturas/escrituras simples fueron rápidas en escala S; la limitación apareció cuando la analítica recorrió toda la colección."),
      h("4.2 ¿Se eligió una tecnología incorrecta?", 2),
      p("No existe evidencia para mover órdenes, pagos o inventario fuera de PostgreSQL. Reviews merece revisión: si la regla 'solo una orden entregada puede reseñar' se vuelve crítica, el estado canónico podría residir en PostgreSQL y publicarse como proyección MongoDB."),
      p("El error no estuvo en elegir MongoDB para eventos, sino en usar la colección operacional para un dashboard global síncrono. La corrección es una proyección analítica preagregada, no necesariamente cambiar de motor."),
      h("5. Viabilidad de una arquitectura 100 % relacional"),
      tbl(["Ventajas", "Riesgos"], [
        ["Menor complejidad operativa", "Eventos y sesiones compiten con el OLTP"],
        ["Integridad centralizada", "Proyecciones de lectura deben construirse manualmente"],
        ["JSONB cubre flexibilidad moderada", "Escala horizontal requiere decisiones adicionales"],
        ["Backups y seguridad unificados", "Mayor radio de falla y contención"]
      ], [4500, 4500]),
      p("Es viable para una primera etapa o tráfico moderado. No es la recomendación para el crecimiento proyectado si eventos y sesiones mantienen su ritmo."),
      h("6. Viabilidad de una arquitectura 100 % NoSQL"),
      tbl(["Ventajas", "Riesgos"], [
        ["Modelo flexible y sharding nativo", "Integridad pasa a la aplicación"],
        ["Documentos listos para lectura", "Órdenes y pagos requieren coordinación adicional"],
        ["Alta disponibilidad configurable", "Auditoría y joins financieros se complejizan"],
        ["Escala de eventos", "Riesgo de estados monetarios divergentes"]
      ], [4500, 4500]),
      p("No se recomienda para Ecommify: el beneficio no compensa trasladar validación monetaria, relaciones y auditoría a código de aplicación."),
      h("7. Decisión final"),
      tbl(["Mantener", "Modificar", "No adoptar"], [
        ["PostgreSQL para núcleo CP", "Outbox completamente asíncrono", "Todo NoSQL"],
        ["MongoDB para proyecciones AP", "Preagregación behavior_daily", "Dashboard con escaneo global"],
        ["Validación de checkout canónica", "Caché y SLO de lag", "Duplicación sin reconciliación"]
      ], [3000, 3000, 3000]),
      h("Conclusión"),
      p("La arquitectura híbrida sigue siendo la opción defendible. PostgreSQL gana donde el costo del error es financiero o referencial; MongoDB gana donde flexibilidad y disponibilidad son prioritarias. El principal trade-off es el costo de sincronización y observabilidad entre motores.")
    ]
  );
}

async function tradeoffsDoc() {
  return writeDoc(
    "04_Tradeoffs_y_Escenarios_Operacionales.docx",
    "Trade-offs y escenarios operacionales",
    "CONSISTENCIA · DISPONIBILIDAD · PARTICIONES",
    [["Black Friday", "AP navegación · CP compra"], ["Checkout", "CP"], ["Auditoría", "CP"], ["Mitigación transversal", "Outbox + idempotencia"]],
    [
      h("Resumen ejecutivo"),
      p("Ecommify no puede aplicar una única política de consistencia. La navegación debe continuar durante picos y fallas parciales, mientras que órdenes, inventario y pagos deben conservar consistencia estricta. Este documento convierte el análisis CAP en configuraciones y playbooks operacionales."),
      h("1. Marco de decisión"),
      p("Cuando ocurre una partición de red, la decisión práctica es CP o AP. CP preserva consistencia sacrificando disponibilidad temporal; AP mantiene disponibilidad aceptando consistencia eventual. La tolerancia a particiones es obligatoria en una arquitectura distribuida."),
      tbl(["Módulo", "Política", "Garantía mantenida", "Garantía sacrificada"], [
        ["Órdenes y pagos", "CP", "Consistencia + partición", "Disponibilidad"],
        ["Inventario", "CP", "No sobreventa", "Confirmación inmediata"],
        ["Catálogo", "AP", "Disponibilidad + partición", "Frescura temporal"],
        ["Reseñas y eventos", "AP", "Aceptación continua", "Visibilidad inmediata"],
        ["Sesiones", "AP", "Continuidad", "Estado exacto entre réplicas"]
      ], [2200, 1300, 3100, 2400]),
      h("2. Escenario 1 · Black Friday"),
      h("Prioridad", 2),
      p("Disponibilidad para navegación; consistencia para checkout. El sistema puede mostrar información levemente desactualizada, pero nunca confirmar precio, stock o pago sin consultar el estado canónico."),
      h("Configuración recomendada", 2),
      bullet("Catálogo desde MongoDB y caché con TTL corto."),
      bullet("Eventos en modo AP con buffer, event_id y deduplicación."),
      bullet("Órdenes, inventario y pagos en PostgreSQL con transacción ACID."),
      bullet("Circuit breaker: si PostgreSQL no confirma, la compra no se promete."),
      bullet("Preescalamiento y límites de conexión antes del evento."),
      h("Trade-off y mitigación", 2),
      tbl(["Trade-off aceptado", "Riesgo", "Mitigación"], [
        ["Catálogo eventualmente consistente", "Precio/stock visible obsoleto", "Revalidación al comprar"],
        ["Eventos con entrega al menos una vez", "Duplicados", "Idempotencia y deduplicación"],
        ["Checkout menos disponible", "Venta diferida", "Cola/sala de espera y reintento"]
      ], [3000, 2700, 3300]),
      h("3. Escenario 2 · Checkout y pagos"),
      h("Prioridad", 2),
      p("Consistencia sobre disponibilidad. Es preferible perder temporalmente una venta que duplicar un cobro, confirmar inventario inexistente o generar una orden parcial."),
      h("Configuración recomendada", 2),
      bullet("Transacción para orden, ítems, reserva y estado inicial del pago."),
      bullet("Idempotency key por intento de compra."),
      bullet("Outbox escrito dentro de la transacción y consumido después del commit."),
      bullet("Timeouts, reintentos con backoff y estado pending ante incertidumbre."),
      bullet("Conciliación con el proveedor de pagos."),
      h("Matriz de decisión", 2),
      tbl(["Condición", "Respuesta", "Garantía"], [
        ["PostgreSQL disponible", "Procesar transacción", "ACID"],
        ["PostgreSQL no disponible", "Rechazar o diferir", "Evita divergencia"],
        ["MongoDB no disponible", "Confirmar y dejar outbox pendiente", "Compra consistente"],
        ["Timeout de pago", "Estado pending", "No asumir confirmación"]
      ], [2700, 3400, 2900]),
      h("4. Escenario 3 · Auditoría financiera"),
      h("Prioridad", 2),
      p("Consistencia, trazabilidad y reproducibilidad. Se acepta demorar el informe hasta disponer de un snapshot válido y completar conciliación."),
      h("Configuración recomendada", 2),
      bullet("Snapshot PostgreSQL con hora de corte documentada."),
      bullet("Réplica usada solo si lag = 0 para el corte requerido."),
      bullet("Conciliación entre órdenes, pagos y proveedor externo."),
      bullet("MongoDB aporta contexto, no cifras del libro financiero."),
      bullet("Retención, logs de auditoría y control de acceso."),
      h("5. Escenarios de falla"),
      tbl(["Falla", "Comportamiento", "Mantiene", "Pierde/degrada"], [
        ["Partición con PostgreSQL", "Navegar sí; comprar no", "Consistencia financiera", "Disponibilidad de checkout"],
        ["Partición con MongoDB", "Checkout continúa", "Consistencia transaccional", "Catálogo enriquecido/eventos"],
        ["Replication lag", "Servir proyección y validar", "Disponibilidad", "Frescura del catálogo"],
        ["Evento duplicado", "Deduplicar por id", "Efecto único", "Latencia adicional"],
        ["Evento fuera de orden", "Comparar source_updated_at", "Último estado válido", "Aplicación inmediata"]
      ], [2200, 2600, 2100, 2100]),
      h("6. Ventana de inconsistencia"),
      p("El fallback académico por lotes puede producir hasta seis horas de inconsistencia más reintentos. En producción es inaceptable para precio y stock. Se recomienda CDC, medición extremo a extremo y un SLO explícito de lag definido por el negocio."),
      tbl(["Dato", "Tolerancia sugerida", "Acción al superar umbral"], [
        ["Descripción/imágenes", "Minutos", "Alertar y reintentar"],
        ["Precio/promoción", "Segundos; siempre revalidar", "Invalidar caché"],
        ["Stock", "Solo indicativo en catálogo", "Validar/reservar en PostgreSQL"],
        ["Rating", "Horas", "Recalcular agregado"]
      ], [2400, 3100, 3500]),
      h("7. Playbook operacional"),
      tbl(["Fase", "Acción"], [
        ["Detectar", "Alertas por p95, error rate, lag, conexiones y outbox pendiente"],
        ["Contener", "Circuit breaker, degradación parcial y límites de tráfico"],
        ["Recuperar", "Reintentos idempotentes, replay de outbox y reconciliación"],
        ["Validar", "Conteos, saldos, referencias huérfanas y eventos duplicados"],
        ["Aprender", "Postmortem y ajuste de umbrales/capacidad"]
      ], [2200, 6800]),
      h("Conclusión"),
      p("La arquitectura debe degradarse por capacidades, no fallar como un bloque. AP sostiene navegación, sesiones y captura de eventos; CP protege órdenes, inventario y dinero. Outbox, idempotencia, revalidación y observabilidad convierten estos trade-offs en riesgos controlables.")
    ]
  );
}

function title(slide, text, subtitle, number) {
  slide.addText(text, { x: 0.65, y: 0.34, w: 10.9, h: 0.5, fontFace: "Aptos Display", fontSize: 25, bold: true, color: C.navy, margin: 0 });
  slide.addText(subtitle, { x: 0.67, y: 0.9, w: 11.3, h: 0.28, fontFace: "Aptos", fontSize: 10.5, color: C.gray, margin: 0 });
  slide.addShape("line", { x: 0.65, y: 1.18, w: 12, h: 0, line: { color: C.cyan, width: 2.2 } });
  slide.addText(String(number).padStart(2, "0"), { x: 12.2, y: 0.36, w: 0.45, h: 0.2, fontFace: "Aptos", fontSize: 9, color: C.gray, align: "right", margin: 0 });
  slide.addText("Ecommify · Análisis arquitectónico CAP", { x: 0.65, y: 7.12, w: 2.9, h: 0.18, fontFace: "Aptos", fontSize: 8, color: C.gray, margin: 0 });
}

function card(slide, x, y, w, h, head, text, color) {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line } });
  slide.addShape("rect", { x, y, w: 0.08, h, fill: { color }, line: { color } });
  slide.addText(head, { x: x + 0.25, y: y + 0.28, w: w - 0.45, h: 0.38, fontFace: "Aptos Display", fontSize: 20, bold: true, color, margin: 0 });
  slide.addText(text, { x: x + 0.25, y: y + 0.9, w: w - 0.45, h: h - 1.1, fontFace: "Aptos", fontSize: 13, color: C.ink, valign: "mid", margin: 0.02 });
}

function bullets(slide, items, x, y, w, h, size = 16) {
  slide.addText(items.map((text) => ({ text, options: { bullet: { indent: size * 1.3 }, hanging: size * 0.25, breakLine: true } })), {
    x, y, w, h, fontFace: "Aptos", fontSize: size, color: C.ink, paraSpaceAfterPt: 10, margin: 0.05, valign: "mid"
  });
}

async function capPpt() {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Equipo Ecommify";
  pptx.title = "Análisis arquitectónico CAP — Ecommify";
  pptx.subject = "Unidad 6 Etapa 1 formativa";
  pptx.lang = "es-CO";
  pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "es-CO" };
  pptx.defineSlideMaster({ title: "CAP", background: { color: C.light }, objects: [
    { rect: { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: C.blue }, line: { color: C.blue } } },
    { rect: { x: 0.18, y: 0, w: 0.05, h: 7.5, fill: { color: C.cyan }, line: { color: C.cyan } } }
  ], slideNumber: { x: 12.6, y: 7.1, w: 0.25, h: 0.18, fontFace: "Aptos", fontSize: 8, color: C.gray } });

  let s = pptx.addSlide(); s.background = { color: C.navy };
  s.addText("ECOMMIFY", { x: 0.85, y: 1.0, w: 5, h: 0.65, fontFace: "Aptos Display", fontSize: 37, bold: true, color: C.cyan, margin: 0 });
  s.addText("Análisis arquitectónico\ny Teorema CAP", { x: 0.85, y: 2.0, w: 6.8, h: 1.25, fontFace: "Aptos Display", fontSize: 31, bold: true, color: C.white, margin: 0 });
  s.addText("DECISIONES POR MÓDULO · FALLAS · TRADE-OFFS", { x: 0.88, y: 3.65, w: 5.8, h: 0.3, fontFace: "Aptos", fontSize: 12, bold: true, color: "B8E4E2", charSpacing: 1.2, margin: 0 });
  s.addShape("ellipse", { x: 8.7, y: 1.25, w: 2.0, h: 2.0, fill: { color: C.blue }, line: { color: C.cyan, width: 2 } });
  s.addText("CP", { x: 8.7, y: 1.86, w: 2.0, h: 0.55, fontFace: "Aptos Display", fontSize: 31, bold: true, color: C.white, align: "center", margin: 0 });
  s.addShape("ellipse", { x: 10.3, y: 3.55, w: 2.0, h: 2.0, fill: { color: C.green }, line: { color: C.cyan, width: 2 } });
  s.addText("AP", { x: 10.3, y: 4.16, w: 2.0, h: 0.55, fontFace: "Aptos Display", fontSize: 31, bold: true, color: C.white, align: "center", margin: 0 });
  s.addText("Unidad 6 · Etapa 1 formativa · Junio de 2026", { x: 0.88, y: 6.5, w: 4.2, h: 0.25, fontFace: "Aptos", fontSize: 10, color: "9FB3C8", margin: 0 });

  s = pptx.addSlide("CAP"); title(s, "La arquitectura no tiene una única política CAP", "La criticidad del dato determina qué propiedad se sacrifica durante una partición", 2);
  card(s, 0.75, 1.55, 3.75, 3.9, "C · Consistency", "Cada lectura observa el dato más reciente o recibe un error. Es obligatoria para dinero, inventario y estados canónicos.", C.navy);
  card(s, 4.78, 1.55, 3.75, 3.9, "A · Availability", "Toda solicitud recibe respuesta, aunque pueda contener una versión temporalmente desactualizada.", C.blue);
  card(s, 8.82, 1.55, 3.75, 3.9, "P · Partition tolerance", "El sistema continúa operando aunque la red separe nodos o servicios. En distribución real no es opcional.", C.green);
  s.addText("Durante una partición, la elección práctica es CP o AP.", { x: 2.25, y: 5.95, w: 8.9, h: 0.48, fontFace: "Aptos Display", fontSize: 20, bold: true, color: C.orange, align: "center", margin: 0 });

  s = pptx.addSlide("CAP"); title(s, "Arquitectura híbrida implementada", "La frontera entre motores coincide con la frontera de riesgo del negocio", 3);
  s.addImage({ path: ARCH, x: 0.72, y: 1.42, w: 8.55, h: 4.47 });
  card(s, 9.55, 1.48, 2.9, 1.8, "CP", "PostgreSQL\nórdenes · pagos\ninventario · maestro", C.navy);
  card(s, 9.55, 3.58, 2.9, 1.8, "AP", "MongoDB\ncatálogo · eventos\nreseñas · sesiones", C.blue);
  s.addText("Regla: catálogo informa; checkout confirma.", { x: 8.95, y: 6.0, w: 3.9, h: 0.38, fontFace: "Aptos", fontSize: 14, bold: true, color: C.green, align: "center", margin: 0 });

  s = pptx.addSlide("CAP"); title(s, "Mapa CAP por módulo", "La decisión se justifica por costo del error, no por preferencia tecnológica", 4);
  const map = [
    ["Órdenes", "CP", "Una orden parcial rompe trazabilidad"], ["Pagos", "CP", "No se acepta cobro divergente"],
    ["Inventario", "CP", "Evitar sobreventa"], ["Producto maestro", "CP", "Estado canónico y referencias"],
    ["Catálogo", "AP", "Frescura temporal aceptable"], ["Reseñas", "AP", "Visibilidad puede retrasarse"],
    ["Eventos", "AP", "Throughput y continuidad"], ["Sesiones", "AP", "Estado efímero recuperable"]
  ];
  map.forEach(([mod, policy, why], i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 0.75 + col * 6.05, y = 1.45 + row * 1.32;
    s.addShape("roundRect", { x, y, w: 5.7, h: 1.05, rectRadius: 0.06, fill: { color: C.white }, line: { color: C.line } });
    s.addShape("roundRect", { x: x + 0.18, y: y + 0.23, w: 0.75, h: 0.42, fill: { color: policy === "CP" ? C.navy : C.blue }, line: { color: policy === "CP" ? C.navy : C.blue } });
    s.addText(policy, { x: x + 0.18, y: y + 0.31, w: 0.75, h: 0.18, fontFace: "Aptos", fontSize: 10, bold: true, color: C.white, align: "center", margin: 0 });
    s.addText(mod, { x: x + 1.15, y: y + 0.2, w: 1.5, h: 0.27, fontFace: "Aptos", fontSize: 14, bold: true, color: C.navy, margin: 0 });
    s.addText(why, { x: x + 1.15, y: y + 0.56, w: 4.15, h: 0.25, fontFace: "Aptos", fontSize: 10.5, color: C.gray, margin: 0 });
  });

  s = pptx.addSlide("CAP"); title(s, "Módulos CP · Qué se protege", "La disponibilidad se sacrifica para evitar daños financieros y referenciales", 5);
  s.addShape("roundRect", { x: 0.75, y: 1.5, w: 4.2, h: 4.9, fill: { color: C.navy }, line: { color: C.navy }, rectRadius: 0.08 });
  s.addText("CONSISTENCIA\nNO NEGOCIABLE", { x: 1.2, y: 2.1, w: 3.3, h: 1.0, fontFace: "Aptos Display", fontSize: 25, bold: true, color: C.cyan, align: "center", margin: 0 });
  s.addText("Órdenes · pagos\ninventario · promociones", { x: 1.2, y: 3.6, w: 3.3, h: 0.85, fontFace: "Aptos", fontSize: 17, color: C.white, align: "center", margin: 0 });
  s.addText("Si no se puede confirmar,\nla operación se difiere.", { x: 1.2, y: 5.1, w: 3.3, h: 0.65, fontFace: "Aptos", fontSize: 14, bold: true, color: "D9E2EC", align: "center", margin: 0 });
  card(s, 5.35, 1.5, 3.4, 2.15, "Controles", "Transacciones ACID\nFK y restricciones\nIdempotency key", C.navy);
  card(s, 9.05, 1.5, 3.4, 2.15, "Falla", "Rechazo explícito\nEstado pending\nReintento acotado", C.red);
  card(s, 5.35, 4.05, 3.4, 2.15, "Integración", "Outbox dentro del commit\nProyección posterior", C.green);
  card(s, 9.05, 4.05, 3.4, 2.15, "Garantía", "No hay cobro supuesto\nNo hay sobreventa", C.blue);

  s = pptx.addSlide("CAP"); title(s, "Módulos AP · Qué se tolera", "Disponibilidad continua con ventanas controladas de inconsistencia", 6);
  card(s, 0.75, 1.5, 2.75, 4.5, "Catálogo", "Puede mostrar una versión anterior. Precio y stock se revalidan al comprar.", C.blue);
  card(s, 3.75, 1.5, 2.75, 4.5, "Reseñas", "Publicación y moderación pueden retrasarse sin afectar el núcleo financiero.", C.green);
  card(s, 6.75, 1.5, 2.75, 4.5, "Eventos", "Se aceptan reintentos y duplicados mitigados por event_id.", C.orange);
  card(s, 9.75, 1.5, 2.75, 4.5, "Sesiones", "El estado es efímero, reconstruible y expira mediante TTL.", C.cyan);
  s.addText("Mitigaciones comunes: idempotencia · timestamp de origen · reconciliación · monitoreo de lag", { x: 1.25, y: 6.35, w: 10.8, h: 0.36, fontFace: "Aptos", fontSize: 13.5, bold: true, color: C.navy, align: "center", margin: 0 });

  s = pptx.addSlide("CAP"); title(s, "Escenarios de partición", "La degradación es parcial: el sistema conserva las capacidades seguras", 7);
  const scenarios = [
    ["PostgreSQL inaccesible", "Navegar: sí\nComprar: no", "Consistencia financiera", C.navy],
    ["MongoDB inaccesible", "Checkout: sí\nCatálogo enriquecido: no", "Núcleo transaccional", C.blue],
    ["Sincronización retrasada", "Servir proyección\nRevalidar en checkout", "Disponibilidad controlada", C.green]
  ];
  scenarios.forEach(([head, behavior, guarantee, color], i) => {
    const x = 0.75 + i * 4.05;
    s.addShape("roundRect", { x, y: 1.55, w: 3.68, h: 4.6, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line } });
    s.addShape("rect", { x, y: 1.55, w: 3.68, h: 0.18, fill: { color }, line: { color } });
    s.addText(head, { x: x + 0.28, y: 2.0, w: 3.12, h: 0.55, fontFace: "Aptos Display", fontSize: 19, bold: true, color, align: "center", margin: 0 });
    s.addText(behavior, { x: x + 0.35, y: 3.05, w: 2.98, h: 1.0, fontFace: "Aptos", fontSize: 17, bold: true, color: C.navy, align: "center", margin: 0 });
    s.addText("Se mantiene", { x: x + 0.45, y: 4.55, w: 2.78, h: 0.25, fontFace: "Aptos", fontSize: 10, bold: true, color: C.gray, align: "center", margin: 0 });
    s.addText(guarantee, { x: x + 0.35, y: 5.0, w: 2.98, h: 0.42, fontFace: "Aptos", fontSize: 13, bold: true, color, align: "center", margin: 0 });
  });

  s = pptx.addSlide("CAP"); title(s, "Replication lag · El riesgo silencioso", "La disponibilidad puede ocultar datos obsoletos; la frescura debe medirse", 8);
  s.addShape("chevron", { x: 0.9, y: 2.2, w: 2.2, h: 1.25, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("Cambio en\nPostgreSQL", { x: 1.1, y: 2.53, w: 1.55, h: 0.55, fontFace: "Aptos", fontSize: 15, bold: true, color: C.white, align: "center", margin: 0 });
  s.addShape("chevron", { x: 3.55, y: 2.2, w: 2.2, h: 1.25, fill: { color: C.orange }, line: { color: C.orange } });
  s.addText("Outbox / CDC", { x: 3.85, y: 2.66, w: 1.35, h: 0.25, fontFace: "Aptos", fontSize: 15, bold: true, color: C.white, align: "center", margin: 0 });
  s.addShape("chevron", { x: 6.2, y: 2.2, w: 2.2, h: 1.25, fill: { color: C.blue }, line: { color: C.blue } });
  s.addText("Proyección\nMongoDB", { x: 6.5, y: 2.53, w: 1.35, h: 0.55, fontFace: "Aptos", fontSize: 15, bold: true, color: C.white, align: "center", margin: 0 });
  s.addShape("chevron", { x: 8.85, y: 2.2, w: 2.2, h: 1.25, fill: { color: C.green }, line: { color: C.green } });
  s.addText("Lectura\nfrontend", { x: 9.15, y: 2.53, w: 1.35, h: 0.55, fontFace: "Aptos", fontSize: 15, bold: true, color: C.white, align: "center", margin: 0 });
  s.addText("VENTANA DE INCONSISTENCIA", { x: 3.65, y: 4.1, w: 4.6, h: 0.35, fontFace: "Aptos Display", fontSize: 19, bold: true, color: C.red, align: "center", margin: 0 });
  bullets(s, ["Fallback académico: hasta 6 horas + reintentos", "Producción: CDC y SLO explícito", "source_updated_at evita sobrescrituras fuera de orden", "Precio y stock siempre se revalidan"], 2.3, 4.75, 8.7, 1.6, 14);

  s = pptx.addSlide("CAP"); title(s, "Tres escenarios críticos de negocio", "La misma plataforma cambia su prioridad según el momento operacional", 9);
  card(s, 0.75, 1.5, 3.75, 4.65, "Black Friday", "AP para navegar\nCP para comprar\n\nCaché + preescalamiento\nCircuit breaker\nRevalidación", C.orange);
  card(s, 4.78, 1.5, 3.75, 4.65, "Checkout", "CP estricto\n\nTransacción ACID\nIdempotency key\nOutbox asíncrono\nEstado pending", C.navy);
  card(s, 8.82, 1.5, 3.75, 4.65, "Auditoría", "CP y trazabilidad\n\nSnapshot de corte\nLag = 0\nConciliación\nAcceso controlado", C.green);

  s = pptx.addSlide(); s.background = { color: C.navy };
  s.addText("Decisión arquitectónica", { x: 0.85, y: 0.85, w: 5.5, h: 0.5, fontFace: "Aptos Display", fontSize: 26, bold: true, color: C.cyan, margin: 0 });
  s.addText("Mantener el modelo híbrido\ncon degradación controlada", { x: 0.85, y: 1.75, w: 7.6, h: 1.2, fontFace: "Aptos Display", fontSize: 31, bold: true, color: C.white, margin: 0 });
  bullets(s, ["CP protege dinero, inventario y estado canónico", "AP sostiene navegación, sesiones y eventos", "Outbox e idempotencia controlan la sincronización", "Observabilidad convierte lag y fallas en riesgos medibles"], 1.0, 3.45, 7.6, 2.2, 17);
  s.addShape("roundRect", { x: 9.25, y: 1.45, w: 3.15, h: 4.7, fill: { color: C.blue, transparency: 10 }, line: { color: C.cyan, transparency: 35 }, rectRadius: 0.08 });
  s.addText("PRÓXIMAS\nACCIONES", { x: 9.65, y: 2.0, w: 2.35, h: 0.7, fontFace: "Aptos", fontSize: 13, bold: true, color: "B8E4E2", align: "center", margin: 0 });
  s.addText("Preagregar\nMedir lag\nProbar failover\nReconciliar outbox", { x: 9.55, y: 3.05, w: 2.55, h: 1.75, fontFace: "Aptos Display", fontSize: 20, bold: true, color: C.white, align: "center", margin: 0 });
  s.addText("La tolerancia a particiones no elimina el trade-off; lo hace explícito.", { x: 1.2, y: 6.55, w: 7.8, h: 0.35, fontFace: "Aptos", fontSize: 14, color: "D9E2EC", margin: 0 });

  const file = path.join(OUTPUT, "03_Analisis_Arquitectonico_CAP.pptx");
  await pptx.writeFile({ fileName: file, compression: true });
  return file;
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const files = await Promise.all([performanceDoc(), comparisonDoc(), tradeoffsDoc(), capPpt()]);
  files.forEach((file) => console.log(file));
}

main().catch((error) => { console.error(error); process.exit(1); });

