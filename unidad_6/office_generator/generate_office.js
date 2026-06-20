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
const OUTPUT = path.join(ROOT, "unidad_6/etapa_2_proyecto_final");
const ARCH = path.join(ROOT, "docs/diagrams/arquitectura_hibrida.png");
const ER = path.join(ROOT, "docs/diagrams/ER_Ecommify.png");
const RESULT = path.join(ROOT, "unidad_6/benchmark/resultados");

const COLORS = {
  navy: "102A43", blue: "176B87", cyan: "64CCC5", sky: "DDF2F4",
  ink: "243B53", gray: "627D98", light: "F4F7FA", white: "FFFFFF",
  orange: "F59E0B", red: "C2413B", green: "21867A", line: "D9E2EC"
};

const concurrency = {
  users: ["1", "10", "25", "50", "100"],
  throughput: [400.39, 626.68, 560.70, 565.91, 540.56],
  p95: [7, 71, 190, 252, 396]
};
const scalability = {
  scale: ["S · 1x", "M · 5x", "L · 10x"],
  throughput: [621.83, 164.73, 91.94],
  p95: [71, 309, 568]
};

function run(text, options = {}) {
  return new TextRun({ text, font: "Aptos", color: COLORS.ink, size: 21, ...options });
}

function paragraph(text, options = {}) {
  return new Paragraph({
    children: Array.isArray(text) ? text : [run(text)],
    spacing: { after: 130, line: 310 },
    alignment: options.alignment,
    style: options.style,
    bullet: options.bullet,
    keepNext: options.keepNext,
    pageBreakBefore: options.pageBreakBefore
  });
}

function heading(text, level = 1) {
  return new Paragraph({
    text,
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before: level === 1 ? 300 : 180, after: 120 },
    keepNext: true
  });
}

function bullet(text) {
  return paragraph(text, { bullet: { level: 0 } });
}

function cell(text, { header = false, fill, align = AlignmentType.LEFT } = {}) {
  return new TableCell({
    shading: { fill: fill || (header ? COLORS.navy : COLORS.white), type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 110, right: 110 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({
        text: String(text), font: "Aptos", size: header ? 19 : 18,
        bold: header, color: header ? COLORS.white : COLORS.ink
      })]
    })]
  });
}

function table(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    borders: {
      top: { style: BorderStyle.SINGLE, color: COLORS.line, size: 1 },
      bottom: { style: BorderStyle.SINGLE, color: COLORS.line, size: 1 },
      left: { style: BorderStyle.SINGLE, color: COLORS.line, size: 1 },
      right: { style: BorderStyle.SINGLE, color: COLORS.line, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: COLORS.line, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, color: COLORS.line, size: 1 }
    },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((value) => cell(value, { header: true })) }),
      ...rows.map((row, index) => new TableRow({
        children: row.map((value) => cell(value, { fill: index % 2 ? COLORS.light : COLORS.white }))
      }))
    ]
  });
}

function imageParagraph(file, width, height, caption) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 140, after: 80 },
      children: [new ImageRun({ data: fs.readFileSync(file), transformation: { width, height }, type: "png" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [new TextRun({ text: caption, italics: true, color: COLORS.gray, size: 17, font: "Aptos" })]
    })
  ];
}

async function chartPng(svgName) {
  const input = path.join(RESULT, svgName);
  const output = path.join(os.tmpdir(), `${svgName}.png`);
  await sharp(input, { density: 180 }).png().toFile(output);
  return output;
}

async function createDocx() {
  const throughputPng = await chartPng("grafica_throughput.svg");
  const p95Png = await chartPng("grafica_p95.svg");
  const scalePng = await chartPng("grafica_escalabilidad_throughput.svg");
  const scaleP95Png = await chartPng("grafica_escalabilidad_p95.svg");

  const children = [];
  children.push(
    new Paragraph({ spacing: { before: 850, after: 220 }, alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: "ECOMMIFY", font: "Aptos Display", size: 54, bold: true, color: COLORS.blue })
    ]}),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 280 }, children: [
      new TextRun({ text: "Arquitectura híbrida, rendimiento y estrategia de evolución", font: "Aptos Display", size: 30, bold: true, color: COLORS.navy })
    ]}),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 520 }, children: [
      new TextRun({ text: "INFORME TÉCNICO INTEGRAL · UNIDAD 6", font: "Aptos", size: 20, bold: true, color: COLORS.green })
    ]}),
    table(["Indicador ejecutivo", "Resultado"], [
      ["Pruebas ejecutadas", "31 corridas distintas"],
      ["Throughput máximo mediano", "626,68 operaciones/s"],
      ["Punto de saturación", "Entre 10 y 25 usuarios"],
      ["Confiabilidad observada", "0 % de errores"]
    ], [4800, 4200]),
    new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [run("Maestría en Arquitectura de Software · Universidad de La Sabana", { size: 20, bold: true, color: COLORS.navy })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Profesor: Miguel Alfonso Varela Fonseca", { size: 19, color: COLORS.gray })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Equipo: Andrés Fernando Díaz Moreno · Carlos Alberto Arévalo Martínez · Luis Alfredo González Mercado · Andrés Camilo López Castro", { size: 18, color: COLORS.gray })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Junio de 2026", { size: 18, color: COLORS.gray })] }),
    new Paragraph({ children: [new PageBreak()] })
  );

  children.push(
    heading("Contenido", 1),
    paragraph("Resumen ejecutivo", { keepNext: true }),
    paragraph("1. Contexto y objetivos"),
    paragraph("2. Arquitectura y diseño"),
    paragraph("3. Implementación técnica"),
    paragraph("4. Evaluación de rendimiento"),
    paragraph("5. Análisis crítico"),
    paragraph("6. Recomendaciones estratégicas"),
    paragraph("7. Conclusiones"),
    paragraph("Referencias y anexos"),
    new Paragraph({ children: [new PageBreak()] }),

    heading("Resumen ejecutivo", 1),
    paragraph("Ecommify es un marketplace multivendedor cuya persistencia combina PostgreSQL como fuente de verdad transaccional y MongoDB para proyecciones de lectura y datos flexibles. La decisión responde a dos necesidades simultáneas: preservar integridad en órdenes, pagos e inventario y mantener disponibilidad para catálogo, sesiones, reseñas y eventos."),
    paragraph("La evaluación ejecutó 31 corridas distintas de 120 segundos. El throughput mediano alcanzó 626,68 operaciones por segundo con 10 usuarios. Al aumentar a 25 usuarios el throughput disminuyó y p95 creció de 71 a 190 ms, ubicando el inicio de saturación entre ambos niveles. Todas las corridas finalizaron con 0 % de errores."),
    paragraph("La principal conclusión gerencial es que la arquitectura híbrida es válida, pero la analítica no puede depender de agregaciones completas en tiempo real. El plan recomendado prioriza preagregación, outbox asíncrono, caché de catálogo, observabilidad del lag y separación entre cargas operativas y analíticas."),

    heading("1. Contexto y objetivos", 1),
    heading("1.1 Problema de negocio", 2),
    paragraph("Ecommify debe soportar un catálogo cambiante, múltiples vendedores, órdenes, pagos, promociones, entregas, reseñas y telemetría de comportamiento. El dominio financiero requiere consistencia fuerte, mientras que navegación y analítica requieren flexibilidad y tolerancia a fallas parciales."),
    heading("1.2 Objetivos", 2),
    bullet("Diseñar estructuras eficientes y escalables para cargas operativas y analíticas."),
    bullet("Proteger integridad, trazabilidad y consistencia del núcleo transaccional."),
    bullet("Evaluar rendimiento y escalabilidad con evidencia reproducible."),
    bullet("Documentar decisiones CAP, escenarios de falla y recomendaciones de evolución."),
    heading("1.3 Alcance", 2),
    paragraph("El alcance integra diseño, implementación, optimización PostgreSQL de Unidad 4 y evaluación híbrida de Unidad 6. La capacidad productiva definitiva debe validarse en infraestructura dedicada; las cifras de este informe comparan tendencias dentro de un entorno local controlado."),

    heading("2. Arquitectura y diseño", 1),
    ...imageParagraph(ARCH, 650, 340, "Figura 1. Arquitectura híbrida implementada para Ecommify."),
    heading("2.1 Asignación tecnológica", 2),
    table(["Módulo", "Motor", "Razón de negocio"], [
      ["Órdenes, ítems y pagos", "PostgreSQL", "ACID, FK, auditoría y reglas monetarias"],
      ["Producto maestro y promociones", "PostgreSQL", "Integridad, rangos temporales y referencias"],
      ["Catálogo de lectura", "MongoDB", "Documento denormalizado para frontend"],
      ["Reseñas", "MongoDB", "Contenido flexible y polimórfico"],
      ["Eventos", "MongoDB", "Alto volumen y bucket pattern"],
      ["Sesiones", "MongoDB", "Datos efímeros con TTL"]
    ], [2700, 1800, 4500]),
    heading("2.2 Política CAP", 2),
    table(["Módulo", "Política", "Decisión durante una partición"], [
      ["Órdenes, pagos e inventario", "CP", "No confirmar antes que aceptar estados divergentes"],
      ["Producto maestro", "CP", "Conservar un único estado canónico"],
      ["Catálogo", "AP", "Servir proyección y revalidar al comprar"],
      ["Reseñas, eventos y sesiones", "AP", "Continuar y reconciliar posteriormente"]
    ], [3000, 1200, 4800]),
    heading("2.3 Consistencia eventual", 2),
    paragraph("MongoDB puede presentar una versión anterior del catálogo. La mitigación es contractual: precio, promoción y stock se revalidan en PostgreSQL durante checkout. Los cambios se publican mediante eventos idempotentes con source_updated_at; el lag debe medirse y alertarse."),

    heading("3. Implementación técnica", 1),
    heading("3.1 PostgreSQL", 2),
    bullet("Modelo normalizado, restricciones, claves foráneas y RBAC."),
    bullet("JSONB, arreglos, HSTORE, tipos compuestos y TSTZRANGE."),
    bullet("PostGIS y pg_trgm para geolocalización y búsqueda difusa."),
    bullet("Particionamiento temporal, vistas materializadas e índices B-tree, GIN, GiST y BRIN."),
    heading("3.2 MongoDB", 2),
    bullet("Extended Reference y Computed Pattern en product_catalog."),
    bullet("Polymorphic Pattern para reseñas."),
    bullet("Bucket Pattern para eventos y TTL para sesiones."),
    bullet("Validadores, índices compuestos y referencias lógicas controladas por aplicación."),
    heading("3.3 Decisiones no obvias", 2),
    table(["Decisión", "Justificación"], [
      ["Producto canónico en PostgreSQL", "La flexibilidad no justifica perder integridad con órdenes"],
      ["Checkout contra PostgreSQL", "Evita confirmar precio o stock obsoleto"],
      ["Outbox idempotente", "Evita acoplar el commit financiero a MongoDB"],
      ["Preagregación analítica", "Evita escaneos completos dentro del camino de usuario"]
    ], [3800, 5200]),

    heading("4. Evaluación de rendimiento", 1),
    heading("4.1 Metodología", 2),
    paragraph("JMeter 5.6.3 se ejecutó en modo no GUI. Se realizaron cinco repeticiones para 1, 10, 25, 50 y 100 usuarios, más tres repeticiones por tamaño S, M y L. Cada prueba duró 120 segundos con rampa de 10 segundos y restauración del estado dinámico."),
    table(["Variable", "Configuración"], [
      ["Equipo", "Apple M1 · 8 GiB RAM"],
      ["Motores", "PostgreSQL 16.14 · MongoDB 7.0.37"],
      ["Métricas", "Throughput, p50, p95, p99 y errores"],
      ["Flujos", "Catálogo, orden, evento, checkout y dashboard híbrido"]
    ], [2800, 6200]),
    heading("4.2 Concurrencia", 2),
    table(["Usuarios", "Throughput", "p50", "p95", "p99", "Errores"], [
      ["1", "400,39", "1 ms", "7 ms", "11 ms", "0 %"],
      ["10", "626,68", "4 ms", "71 ms", "110 ms", "0 %"],
      ["25", "560,70", "16 ms", "190 ms", "268 ms", "0 %"],
      ["50", "565,91", "65 ms", "252 ms", "354 ms", "0 %"],
      ["100", "540,56", "172 ms", "396 ms", "525 ms", "0 %"]
    ], [1300, 1900, 1300, 1300, 1300, 1200]),
    ...imageParagraph(throughputPng, 620, 330, "Figura 2. Throughput mediano por nivel de concurrencia."),
    ...imageParagraph(p95Png, 620, 330, "Figura 3. Latencia p95 mediana por nivel de concurrencia."),
    paragraph("El máximo throughput se alcanzó con 10 usuarios. De 10 a 25 usuarios throughput cayó 10,53 % y p95 aumentó 167,61 %. Por tanto, el punto de saturación de la mezcla se encuentra entre ambos niveles."),
    heading("4.3 Escalabilidad por volumen", 2),
    table(["Escala", "Órdenes", "Eventos", "Throughput", "p95"], [
      ["S · 1x", "10.000", "100.000", "621,83", "71 ms"],
      ["M · 5x", "50.000", "500.000", "164,73", "309 ms"],
      ["L · 10x", "100.000", "1.000.000", "91,94", "568 ms"]
    ], [1400, 1800, 1900, 2100, 1800]),
    ...imageParagraph(scalePng, 620, 350, "Figura 4. Throughput frente al crecimiento del dataset."),
    ...imageParagraph(scaleP95Png, 620, 350, "Figura 5. Latencia p95 frente al crecimiento del dataset."),
    paragraph("Entre S y L, throughput disminuyó 85,21 % y p95 aumentó 700 %. La estabilidad de p50 —de 4 a 5 ms— indica que las operaciones indexadas simples se mantuvieron estables; la cola de latencia fue dominada por el dashboard."),
    heading("4.4 Cuellos de botella", 2),
    table(["Hallazgo", "Impacto", "Acción"], [
      ["Dashboard con agregación completa", "p95 de 517 ms con 100 usuarios", "Preagregar por hora/día"],
      ["Pool MongoDB compartido", "Contención entre catálogo, eventos y analítica", "Separar recursos y réplicas"],
      ["Proyección síncrona en checkout", "Aumenta latencia y acoplamiento", "Consumidor asíncrono de outbox"],
      ["Consulta geoespacial", "Mayor costo observado en Unidad 4", "Limitar radio y cachear por zona"]
    ], [3000, 3000, 3000]),

    heading("5. Análisis crítico", 1),
    heading("5.1 Comparación PostgreSQL vs. MongoDB", 2),
    table(["Aspecto", "Ganador contextual", "Evidencia"], [
      ["Transacciones e integridad", "PostgreSQL", "Detalle de orden p95 27 ms con 100 usuarios"],
      ["Catálogo denormalizado", "MongoDB", "p95 25 ms con 10 usuarios en S"],
      ["Eventos", "MongoDB", "p95 14 ms con 10 usuarios en S"],
      ["Dashboard cross-motor", "Ninguno sin optimización", "p95 517 ms con 100 usuarios"],
      ["Auditoría financiera", "PostgreSQL", "Snapshots, FK y consistencia fuerte"]
    ], [2800, 2600, 3600]),
    heading("5.2 Escenarios de falla", 2),
    bullet("Sin PostgreSQL: se permite navegar, pero checkout queda suspendido."),
    bullet("Sin MongoDB: el núcleo financiero continúa; catálogo y eventos se degradan."),
    bullet("Con replication lag: se sirve proyección, pero precio y stock se revalidan."),
    bullet("Con eventos duplicados: idempotency key y reconciliación evitan efectos dobles."),
    heading("5.3 Lecciones aprendidas", 2),
    paragraph("La persistencia políglota resuelve requisitos diferentes, pero introduce sincronización, doble operación, observabilidad y recuperación coordinada. Medir p95 y no solo promedios fue decisivo: la mayoría de operaciones permaneció rápida mientras una minoría analítica degradó la experiencia."),

    heading("6. Recomendaciones estratégicas", 1),
    heading("6.1 Plan de escalamiento 10x", 2),
    table(["Horizonte", "Acción", "Indicador de éxito"], [
      ["0–30 días", "Preagregar eventos y sacar MongoDB del commit de checkout", "p95 dashboard < 300 ms"],
      ["30–60 días", "Caché de catálogo y SLO de lag", "Cache hit > 80 %; lag bajo umbral"],
      ["60–90 días", "Réplicas, observabilidad y pruebas de failover", "RTO/RPO validados"],
      ["90+ días", "Evaluar sharding por volumen y distribución", "Crecimiento sin degradación lineal"]
    ], [1700, 4500, 2800]),
    heading("6.2 Migración a producción", 2),
    bullet("Separar desarrollo, staging y producción con credenciales y redes independientes."),
    bullet("Implementar backups, recuperación point-in-time y pruebas periódicas de restauración."),
    bullet("Dimensionar por CPU, memoria, IOPS, transferencia, retención y picos; validar precios en la región elegida."),
    bullet("Definir alertas por p95, errores, conexiones, replication lag y outbox pendiente."),
    heading("6.3 Tecnologías complementarias", 2),
    table(["Capacidad", "Alternativa", "Uso recomendado"], [
      ["Caché", "Redis", "Catálogo y consultas frecuentes con TTL e invalidación"],
      ["Búsqueda", "MongoDB Search / OpenSearch", "Texto, relevancia y filtros"],
      ["Observabilidad", "OpenTelemetry", "Trazas, métricas y logs correlacionados"],
      ["CDC", "Debezium + plataforma Kafka", "Propagación desacoplada de cambios"],
      ["Migraciones", "Flyway / Liquibase", "Esquema versionado dentro de CI/CD"]
    ], [2200, 2800, 4000]),
    heading("6.4 CI/CD para cambios de esquema", 2),
    bullet("Versionar migraciones inmutables y validarlas en bases efímeras."),
    bullet("Aplicar expand-contract para conservar compatibilidad durante despliegues."),
    bullet("Promover a staging, respaldar, aprobar y observar antes de completar el cambio."),

    heading("7. Conclusiones", 1),
    paragraph("La arquitectura híbrida fue correcta para separar integridad transaccional de flexibilidad operativa. PostgreSQL debe conservar órdenes, pagos e inventario; MongoDB aporta valor en catálogo, eventos y sesiones. La selección tecnológica, sin embargo, no reemplaza el diseño de flujos y agregaciones."),
    paragraph("El sistema funcionó sin errores en todas las corridas, pero alcanzó saturación entre 10 y 25 usuarios para la mezcla probada. El dashboard híbrido fue el principal cuello de botella. La evolución debe preagregar analítica, desacoplar proyecciones mediante outbox, introducir caché y operar con SLO de latencia y lag."),
    paragraph("[ESPACIO PARA REFLEXIÓN FINAL Y APORTES PROPIOS DEL EQUIPO]", { alignment: AlignmentType.CENTER }),

    heading("Referencias", 1),
    paragraph("Brewer, E. (2012). CAP twelve years later: How the rules have changed. Computer, 45(2), 23–29."),
    paragraph("Gilbert, S., & Lynch, N. (2002). Brewer's conjecture and the feasibility of consistent, available, partition-tolerant web services. ACM SIGACT News, 33(2), 51–59."),
    paragraph("MongoDB, Inc. (2026). MongoDB Atlas production notes. https://www.mongodb.com/docs/atlas/production-notes/"),
    paragraph("OpenTelemetry Authors. (2026). OpenTelemetry documentation. https://opentelemetry.io/docs/"),
    paragraph("PostgreSQL Global Development Group. (2026). PostgreSQL 16 documentation. https://www.postgresql.org/docs/16/"),
    heading("Anexos", 1),
    bullet("A. Plan JMeter y scripts de ejecución."),
    bullet("B. CSV consolidados y gráficas."),
    bullet("C. Planes EXPLAIN ANALYZE de Unidad 4."),
    bullet("D. Diagramas y modelos editables."),
    ...imageParagraph(ER, 520, 515, "Anexo. Modelo entidad–relación de Ecommify.")
  );

  const doc = new Document({
    creator: "Equipo Ecommify",
    title: "Informe técnico integral — Ecommify",
    description: "Arquitectura híbrida, rendimiento y estrategia de evolución",
    styles: {
      default: { document: { run: { font: "Aptos", size: 21, color: COLORS.ink }, paragraph: { spacing: { line: 310 } } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "Aptos Display", size: 32, bold: true, color: COLORS.navy },
          paragraph: { spacing: { before: 320, after: 150 }, outlineLevel: 0, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "Aptos Display", size: 26, bold: true, color: COLORS.blue },
          paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "Aptos", size: 22, bold: true, color: COLORS.green },
          paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2, keepNext: true } }
      ]
    },
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      headers: { default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "ECOMMIFY · INFORME TÉCNICO INTEGRAL", size: 15, bold: true, color: COLORS.blue, font: "Aptos" })]
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Unidad 6  ·  ", size: 15, color: COLORS.gray }), new TextRun({ children: [PageNumber.CURRENT], size: 15, color: COLORS.gray })]
      })] }) },
      children
    }]
  });

  const file = path.join(OUTPUT, "Informe_Tecnico_Integral_Ecommify.docx");
  fs.writeFileSync(file, await Packer.toBuffer(doc));
  return file;
}

function addTitle(slide, title, subtitle, number) {
  slide.addText(title, { x: 0.65, y: 0.35, w: 10.9, h: 0.5, fontFace: "Aptos Display", fontSize: 25, bold: true, color: COLORS.navy, margin: 0 });
  if (subtitle) slide.addText(subtitle, { x: 0.67, y: 0.9, w: 11.2, h: 0.3, fontFace: "Aptos", fontSize: 10.5, color: COLORS.gray, margin: 0 });
  slide.addShape("line", { x: 0.65, y: 1.18, w: 12.0, h: 0, line: { color: COLORS.cyan, width: 2.3 } });
  slide.addText(String(number).padStart(2, "0"), { x: 12.25, y: 0.36, w: 0.45, h: 0.28, fontFace: "Aptos", fontSize: 10, bold: true, color: COLORS.blue, align: "right", margin: 0 });
}

function addFooter(slide) {
  slide.addText("Ecommify · Unidad 6", { x: 0.65, y: 7.12, w: 2.2, h: 0.18, fontFace: "Aptos", fontSize: 8, color: "78909C", margin: 0 });
}

function card(slide, x, y, w, h, value, label, accent = COLORS.blue) {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.08, fill: { color: COLORS.white }, line: { color: COLORS.line, width: 1 }, shadow: { type: "outer", color: "AAB7C4", blur: 1.5, angle: 45, distance: 1, opacity: 0.15 } });
  slide.addShape("rect", { x, y, w: 0.08, h, fill: { color: accent }, line: { color: accent } });
  slide.addText(value, { x: x + 0.22, y: y + 0.22, w: w - 0.35, h: 0.52, fontFace: "Aptos Display", fontSize: 25, bold: true, color: COLORS.navy, margin: 0 });
  slide.addText(label, { x: x + 0.22, y: y + 0.78, w: w - 0.35, h: h - 0.9, fontFace: "Aptos", fontSize: 10.5, color: COLORS.gray, breakLine: false, margin: 0.02 });
}

function pill(slide, x, y, text, fill) {
  slide.addShape("roundRect", { x, y, w: 1.1, h: 0.34, rectRadius: 0.1, fill: { color: fill }, line: { color: fill } });
  slide.addText(text, { x, y: y + 0.05, w: 1.1, h: 0.18, fontFace: "Aptos", fontSize: 9, bold: true, color: COLORS.white, align: "center", margin: 0 });
}

function addBullets(slide, items, x, y, w, h, size = 17) {
  const runs = [];
  items.forEach((item) => runs.push({ text: item, options: { bullet: { indent: size * 1.3 }, breakLine: true, hanging: size * 0.25 } }));
  slide.addText(runs, { x, y, w, h, fontFace: "Aptos", fontSize: size, color: COLORS.ink, breakLine: false, paraSpaceAfterPt: 10, valign: "mid", margin: 0.08 });
}

async function createPptx() {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Equipo Ecommify";
  pptx.subject = "Arquitectura híbrida y evaluación de rendimiento";
  pptx.title = "Ecommify — Presentación ejecutiva";
  pptx.company = "Universidad de La Sabana";
  pptx.lang = "es-CO";
  pptx.theme = {
    headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "es-CO"
  };
  pptx.defineSlideMaster({
    title: "EXEC",
    background: { color: COLORS.light },
    objects: [
      { rect: { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: COLORS.blue }, line: { color: COLORS.blue } } },
      { rect: { x: 0.18, y: 0, w: 0.05, h: 7.5, fill: { color: COLORS.cyan }, line: { color: COLORS.cyan } } }
    ],
    slideNumber: { x: 12.6, y: 7.12, w: 0.25, h: 0.18, fontFace: "Aptos", fontSize: 8, color: COLORS.gray, align: "right", margin: 0 }
  });

  let slide = pptx.addSlide();
  slide.background = { color: COLORS.navy };
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: COLORS.navy }, line: { color: COLORS.navy } });
  slide.addShape("arc", { x: 8.9, y: -1.5, w: 5.6, h: 5.6, adjustPoint: 0.25, rotate: 25, fill: { color: COLORS.blue, transparency: 18 }, line: { color: COLORS.blue, transparency: 100 } });
  slide.addShape("arc", { x: 9.8, y: 3.5, w: 4.6, h: 4.6, adjustPoint: 0.25, rotate: 210, fill: { color: COLORS.cyan, transparency: 25 }, line: { color: COLORS.cyan, transparency: 100 } });
  slide.addText("ECOMMIFY", { x: 0.85, y: 1.15, w: 6.2, h: 0.75, fontFace: "Aptos Display", fontSize: 38, bold: true, color: COLORS.cyan, margin: 0 });
  slide.addText("Arquitectura híbrida, rendimiento\ny estrategia de evolución", { x: 0.85, y: 2.05, w: 7.4, h: 1.35, fontFace: "Aptos Display", fontSize: 29, bold: true, color: COLORS.white, margin: 0, breakLine: false });
  slide.addText("PRESENTACIÓN EJECUTIVA · UNIDAD 6", { x: 0.88, y: 3.75, w: 4.6, h: 0.28, fontFace: "Aptos", fontSize: 12, bold: true, color: "B8E4E2", charSpacing: 1.4, margin: 0 });
  slide.addText("Maestría en Arquitectura de Software\nUniversidad de La Sabana · Junio 2026", { x: 0.88, y: 5.65, w: 5.2, h: 0.65, fontFace: "Aptos", fontSize: 12, color: "D9E2EC", margin: 0 });
  slide.addText("Andrés F. Díaz · Carlos A. Arévalo · Luis A. González · Andrés C. López", { x: 0.88, y: 6.52, w: 8.4, h: 0.26, fontFace: "Aptos", fontSize: 9.5, color: "9FB3C8", margin: 0 });
  slide.addNotes("Presentar al equipo y explicar que la exposición se enfoca en decisiones, evidencia y próximos pasos.");

  slide = pptx.addSlide("EXEC"); addTitle(slide, "Resumen ejecutivo", "La evidencia confirma la arquitectura, pero cambia la prioridad de optimización", 2); addFooter(slide);
  card(slide, 0.72, 1.55, 3.75, 1.55, "31", "corridas distintas de 120 segundos", COLORS.blue);
  card(slide, 4.78, 1.55, 3.75, 1.55, "626,68", "operaciones/s: máximo throughput mediano", COLORS.green);
  card(slide, 8.84, 1.55, 3.75, 1.55, "0 %", "errores en todas las ejecuciones", COLORS.cyan);
  slide.addShape("roundRect", { x: 0.72, y: 3.55, w: 11.87, h: 2.55, rectRadius: 0.08, fill: { color: "EAF4F5" }, line: { color: "B8E4E2" } });
  slide.addText("Decisión ejecutiva", { x: 1.0, y: 3.88, w: 2.5, h: 0.35, fontFace: "Aptos Display", fontSize: 19, bold: true, color: COLORS.blue, margin: 0 });
  slide.addText("Mantener la arquitectura híbrida y priorizar cuatro acciones: preagregar analítica, desacoplar el checkout con outbox, incorporar caché de catálogo y medir el lag entre motores.", { x: 1.0, y: 4.42, w: 10.95, h: 1.0, fontFace: "Aptos", fontSize: 19, bold: true, color: COLORS.navy, margin: 0.02, valign: "mid" });
  slide.addNotes("Enfatizar que la tecnología no cambia; cambia el orden de inversión y optimización.");

  slide = pptx.addSlide("EXEC"); addTitle(slide, "El desafío de negocio", "Un marketplace combina requisitos que no deben resolverse con una única política de datos", 3); addFooter(slide);
  const challenges = [
    ["CONSISTENCIA", "Pagos, órdenes e inventario no toleran estados divergentes", COLORS.navy],
    ["DISPONIBILIDAD", "Catálogo y sesiones deben continuar ante fallas parciales", COLORS.blue],
    ["ESCALA", "Eventos y analítica crecen más rápido que las transacciones", COLORS.green]
  ];
  challenges.forEach(([title, desc, color], i) => {
    const x = 0.75 + i * 4.05;
    slide.addShape("roundRect", { x, y: 1.55, w: 3.62, h: 3.8, rectRadius: 0.08, fill: { color: COLORS.white }, line: { color: COLORS.line } });
    slide.addShape("ellipse", { x: x + 1.22, y: 1.95, w: 1.15, h: 1.15, fill: { color }, line: { color } });
    slide.addText(String(i + 1), { x: x + 1.22, y: 2.2, w: 1.15, h: 0.35, fontFace: "Aptos Display", fontSize: 22, bold: true, color: COLORS.white, align: "center", margin: 0 });
    slide.addText(title, { x: x + 0.25, y: 3.35, w: 3.12, h: 0.35, fontFace: "Aptos", fontSize: 14, bold: true, color, align: "center", margin: 0 });
    slide.addText(desc, { x: x + 0.35, y: 4.0, w: 2.92, h: 0.88, fontFace: "Aptos", fontSize: 14, color: COLORS.ink, align: "center", valign: "mid", margin: 0.03 });
  });
  slide.addText("Respuesta: persistencia políglota con responsabilidades explícitas y reglas de sincronización.", { x: 1.55, y: 5.85, w: 10.0, h: 0.55, fontFace: "Aptos Display", fontSize: 20, bold: true, color: COLORS.navy, align: "center", margin: 0 });

  slide = pptx.addSlide("EXEC"); addTitle(slide, "Arquitectura implementada", "PostgreSQL conserva el estado canónico; MongoDB optimiza proyecciones y datos flexibles", 4); addFooter(slide);
  slide.addImage({ path: ARCH, x: 0.72, y: 1.42, w: 8.4, h: 4.4, transparency: 0 });
  slide.addShape("roundRect", { x: 9.4, y: 1.45, w: 3.18, h: 4.65, rectRadius: 0.08, fill: { color: COLORS.white }, line: { color: COLORS.line } });
  pill(slide, 9.72, 1.78, "CP", COLORS.navy);
  slide.addText("PostgreSQL", { x: 10.95, y: 1.82, w: 1.25, h: 0.25, fontFace: "Aptos", fontSize: 14, bold: true, color: COLORS.navy, margin: 0 });
  slide.addText("Órdenes · pagos · inventario\nproducto maestro · promociones", { x: 9.72, y: 2.3, w: 2.55, h: 0.85, fontFace: "Aptos", fontSize: 12.5, color: COLORS.ink, margin: 0 });
  pill(slide, 9.72, 3.38, "AP", COLORS.blue);
  slide.addText("MongoDB", { x: 10.95, y: 3.42, w: 1.25, h: 0.25, fontFace: "Aptos", fontSize: 14, bold: true, color: COLORS.blue, margin: 0 });
  slide.addText("Catálogo · reseñas\neventos · sesiones", { x: 9.72, y: 3.9, w: 2.55, h: 0.65, fontFace: "Aptos", fontSize: 12.5, color: COLORS.ink, margin: 0 });
  slide.addShape("line", { x: 9.72, y: 4.9, w: 2.45, h: 0, line: { color: COLORS.line, width: 1 } });
  slide.addText("Regla de oro", { x: 9.72, y: 5.12, w: 2.1, h: 0.25, fontFace: "Aptos", fontSize: 11, bold: true, color: COLORS.green, margin: 0 });
  slide.addText("Precio y stock se validan al confirmar la compra.", { x: 9.72, y: 5.48, w: 2.45, h: 0.48, fontFace: "Aptos", fontSize: 11.5, bold: true, color: COLORS.navy, margin: 0 });

  slide = pptx.addSlide("EXEC"); addTitle(slide, "Decisiones técnicas que sostienen el negocio", "La implementación aprovecha capacidades nativas y limita el acoplamiento", 5); addFooter(slide);
  slide.addShape("roundRect", { x: 0.72, y: 1.48, w: 5.72, h: 4.9, fill: { color: COLORS.white }, line: { color: COLORS.line }, rectRadius: 0.08 });
  slide.addText("PostgreSQL", { x: 1.05, y: 1.8, w: 2.5, h: 0.4, fontFace: "Aptos Display", fontSize: 22, bold: true, color: COLORS.navy, margin: 0 });
  addBullets(slide, ["JSONB, arreglos y tipos compuestos", "PostGIS y búsqueda pg_trgm", "Particionamiento temporal", "Índices B-tree, GIN, GiST y BRIN", "Vistas materializadas y RBAC"], 1.0, 2.4, 4.9, 3.4, 15);
  slide.addShape("roundRect", { x: 6.75, y: 1.48, w: 5.82, h: 4.9, fill: { color: "EAF4F5" }, line: { color: "B8E4E2" }, rectRadius: 0.08 });
  slide.addText("MongoDB", { x: 7.1, y: 1.8, w: 2.5, h: 0.4, fontFace: "Aptos Display", fontSize: 22, bold: true, color: COLORS.blue, margin: 0 });
  addBullets(slide, ["Extended Reference para catálogo", "Computed Pattern para derivados", "Polymorphic Pattern para reseñas", "Bucket Pattern para eventos", "TTL para sesiones efímeras"], 7.05, 2.4, 4.9, 3.4, 15);
  slide.addText("Decisión no obvia: MongoDB sirve el catálogo, pero PostgreSQL conserva el producto canónico.", { x: 2.0, y: 6.58, w: 9.4, h: 0.36, fontFace: "Aptos", fontSize: 13, bold: true, color: COLORS.green, align: "center", margin: 0 });

  slide = pptx.addSlide("EXEC"); addTitle(slide, "Metodología de evaluación", "Pruebas reproducibles, estado restaurado y métricas orientadas a experiencia", 6); addFooter(slide);
  const steps = [
    ["1", "Preparar", "Docker aislado y semillas deterministas"],
    ["2", "Ejecutar", "JMeter no GUI · 120 s · rampa 10 s"],
    ["3", "Medir", "Throughput · p50 · p95 · p99 · errores"],
    ["4", "Comparar", "Concurrencia 1–100 · volumen 1x–10x"],
    ["5", "Consolidar", "CSV, JTL, HTML y gráficas SVG"]
  ];
  steps.forEach(([n, title, desc], i) => {
    const x = 0.72 + i * 2.43;
    slide.addShape("ellipse", { x: x + 0.67, y: 1.55, w: 0.85, h: 0.85, fill: { color: i < 3 ? COLORS.blue : COLORS.green }, line: { color: COLORS.white, width: 2 } });
    slide.addText(n, { x: x + 0.67, y: 1.77, w: 0.85, h: 0.25, fontFace: "Aptos Display", fontSize: 17, bold: true, color: COLORS.white, align: "center", margin: 0 });
    if (i < 4) slide.addShape("chevron", { x: x + 1.62, y: 1.79, w: 0.55, h: 0.34, fill: { color: COLORS.line }, line: { color: COLORS.line } });
    slide.addText(title, { x, y: 2.65, w: 2.2, h: 0.32, fontFace: "Aptos", fontSize: 15, bold: true, color: COLORS.navy, align: "center", margin: 0 });
    slide.addText(desc, { x: x + 0.08, y: 3.2, w: 2.04, h: 0.78, fontFace: "Aptos", fontSize: 11.5, color: COLORS.gray, align: "center", valign: "mid", margin: 0.02 });
  });
  card(slide, 1.05, 5.1, 3.4, 1.15, "25", "corridas de concurrencia", COLORS.blue);
  card(slide, 4.98, 5.1, 3.4, 1.15, "6", "corridas adicionales de volumen", COLORS.green);
  card(slide, 8.9, 5.1, 3.4, 1.15, "31", "ejecuciones distintas", COLORS.cyan);

  slide = pptx.addSlide("EXEC"); addTitle(slide, "Resultado 1 · Concurrencia", "El sistema maximiza throughput con 10 usuarios y luego entra en saturación", 7); addFooter(slide);
  slide.addChart(pptx.ChartType.line, [{ name: "Throughput", labels: concurrency.users, values: concurrency.throughput }], {
    x: 0.72, y: 1.48, w: 5.75, h: 4.65, showLegend: false, showTitle: true, title: "Throughput mediano (ops/s)",
    chartColors: [COLORS.blue], lineSize: 3, showValue: true, showCatName: false, dataLabelPosition: "t",
    catAxisTitle: "Usuarios concurrentes", valAxisMinVal: 0, valAxisMaxVal: 700, valAxisMajorUnit: 100,
    showValue: true, showBorder: false, showCatName: false, showPercent: false, showGridLines: true,
    valGridLine: { color: "D9E2EC", width: 1 }, showValue: true, fontFace: "Aptos", fontSize: 10
  });
  slide.addChart(pptx.ChartType.line, [{ name: "p95", labels: concurrency.users, values: concurrency.p95 }], {
    x: 6.82, y: 1.48, w: 5.75, h: 4.65, showLegend: false, showTitle: true, title: "Latencia p95 (ms)",
    chartColors: [COLORS.red], lineSize: 3, showValue: true, dataLabelPosition: "t",
    catAxisTitle: "Usuarios concurrentes", valAxisMinVal: 0, valAxisMaxVal: 450, valAxisMajorUnit: 50,
    showBorder: false, valGridLine: { color: "D9E2EC", width: 1 }, fontFace: "Aptos", fontSize: 10
  });
  slide.addText("Punto de saturación: entre 10 y 25 usuarios", { x: 3.85, y: 6.38, w: 5.8, h: 0.38, fontFace: "Aptos Display", fontSize: 18, bold: true, color: COLORS.orange, align: "center", margin: 0 });

  slide = pptx.addSlide("EXEC"); addTitle(slide, "Resultado 2 · Crecimiento 10x", "Las operaciones simples resisten; la cola de latencia queda dominada por la analítica", 8); addFooter(slide);
  slide.addChart(pptx.ChartType.bar, [{ name: "Throughput", labels: scalability.scale, values: scalability.throughput }], {
    x: 0.72, y: 1.48, w: 5.75, h: 4.65, showLegend: false, showTitle: true, title: "Throughput (ops/s)",
    chartColors: [COLORS.blue], showValue: true, dataLabelPosition: "outEnd", catAxisLabelFontFace: "Aptos",
    valAxisMinVal: 0, valAxisMaxVal: 700, valAxisMajorUnit: 100, showBorder: false, valGridLine: { color: COLORS.line }
  });
  slide.addChart(pptx.ChartType.bar, [{ name: "p95", labels: scalability.scale, values: scalability.p95 }], {
    x: 6.82, y: 1.48, w: 5.75, h: 4.65, showLegend: false, showTitle: true, title: "Latencia p95 (ms)",
    chartColors: [COLORS.red], showValue: true, dataLabelPosition: "outEnd",
    valAxisMinVal: 0, valAxisMaxVal: 650, valAxisMajorUnit: 100, showBorder: false, valGridLine: { color: COLORS.line }
  });
  slide.addText("S → L: throughput −85,21 % · p95 +700 %", { x: 3.78, y: 6.38, w: 5.9, h: 0.38, fontFace: "Aptos Display", fontSize: 18, bold: true, color: COLORS.red, align: "center", margin: 0 });

  slide = pptx.addSlide("EXEC"); addTitle(slide, "El cuello de botella real", "El dashboard híbrido concentra la mayor degradación", 9); addFooter(slide);
  slide.addShape("roundRect", { x: 0.72, y: 1.45, w: 5.25, h: 4.95, rectRadius: 0.08, fill: { color: COLORS.navy }, line: { color: COLORS.navy } });
  slide.addText("517 ms", { x: 1.15, y: 2.05, w: 4.4, h: 0.82, fontFace: "Aptos Display", fontSize: 43, bold: true, color: COLORS.cyan, align: "center", margin: 0 });
  slide.addText("p95 del dashboard híbrido\ncon 100 usuarios", { x: 1.25, y: 3.05, w: 4.2, h: 0.9, fontFace: "Aptos", fontSize: 20, bold: true, color: COLORS.white, align: "center", margin: 0 });
  slide.addText("Agrega PostgreSQL y toda la colección de eventos MongoDB en línea.", { x: 1.35, y: 4.42, w: 4.0, h: 0.8, fontFace: "Aptos", fontSize: 14, color: "D9E2EC", align: "center", margin: 0.02 });
  slide.addShape("chevron", { x: 6.25, y: 3.15, w: 0.75, h: 0.7, fill: { color: COLORS.orange }, line: { color: COLORS.orange } });
  slide.addShape("roundRect", { x: 7.25, y: 1.45, w: 5.32, h: 4.95, rectRadius: 0.08, fill: { color: COLORS.white }, line: { color: COLORS.line } });
  slide.addText("Acciones prioritarias", { x: 7.62, y: 1.85, w: 4.6, h: 0.4, fontFace: "Aptos Display", fontSize: 21, bold: true, color: COLORS.navy, margin: 0 });
  addBullets(slide, ["Preagregar por hora y día", "Separar analítica de cargas operativas", "Procesar outbox asíncronamente", "Cachear catálogo y consultas frecuentes", "Alertar por p95 y replication lag"], 7.55, 2.55, 4.45, 3.15, 15);

  slide = pptx.addSlide("EXEC"); addTitle(slide, "CAP aplicado al negocio", "La política cambia por módulo y define cómo degradar el servicio", 10); addFooter(slide);
  slide.addShape("roundRect", { x: 0.72, y: 1.48, w: 5.72, h: 4.85, rectRadius: 0.08, fill: { color: "E9EEF5" }, line: { color: "CAD5E2" } });
  pill(slide, 1.05, 1.85, "CP", COLORS.navy);
  slide.addText("Consistencia primero", { x: 2.35, y: 1.88, w: 3.25, h: 0.3, fontFace: "Aptos Display", fontSize: 19, bold: true, color: COLORS.navy, margin: 0 });
  addBullets(slide, ["Órdenes y pagos", "Inventario", "Producto maestro", "Auditoría financiera"], 1.05, 2.55, 4.65, 2.1, 16);
  slide.addText("Durante una partición: rechazar o diferir antes que confirmar estados divergentes.", { x: 1.05, y: 5.1, w: 4.75, h: 0.7, fontFace: "Aptos", fontSize: 13, bold: true, color: COLORS.navy, margin: 0 });
  slide.addShape("roundRect", { x: 6.82, y: 1.48, w: 5.75, h: 4.85, rectRadius: 0.08, fill: { color: "EAF4F5" }, line: { color: "B8E4E2" } });
  pill(slide, 7.15, 1.85, "AP", COLORS.blue);
  slide.addText("Disponibilidad primero", { x: 8.45, y: 1.88, w: 3.4, h: 0.3, fontFace: "Aptos Display", fontSize: 19, bold: true, color: COLORS.blue, margin: 0 });
  addBullets(slide, ["Catálogo", "Reseñas", "Eventos", "Sesiones"], 7.15, 2.55, 4.65, 2.1, 16);
  slide.addText("Durante una partición: continuar con consistencia eventual y reconciliación.", { x: 7.15, y: 5.1, w: 4.75, h: 0.7, fontFace: "Aptos", fontSize: 13, bold: true, color: COLORS.blue, margin: 0 });

  slide = pptx.addSlide("EXEC"); addTitle(slide, "Ruta de evolución a producción", "Un plan por horizontes reduce riesgo y alinea inversión con evidencia", 11); addFooter(slide);
  const roadmap = [
    ["0–30 días", "ESTABILIZAR", "Preagregación\nOutbox asíncrono", COLORS.navy],
    ["30–60 días", "ACELERAR", "Caché de catálogo\nSLO de lag", COLORS.blue],
    ["60–90 días", "OPERAR", "Observabilidad\nFailover y backups", COLORS.green],
    ["90+ días", "ESCALAR", "Réplicas y evaluación\nde sharding", COLORS.orange]
  ];
  roadmap.forEach(([period, title, desc, color], i) => {
    const x = 0.72 + i * 3.0;
    slide.addShape("roundRect", { x, y: 1.65, w: 2.68, h: 3.9, rectRadius: 0.08, fill: { color: COLORS.white }, line: { color: COLORS.line } });
    slide.addShape("rect", { x, y: 1.65, w: 2.68, h: 0.18, fill: { color }, line: { color } });
    slide.addText(period, { x: x + 0.22, y: 2.05, w: 2.24, h: 0.3, fontFace: "Aptos", fontSize: 12, bold: true, color, align: "center", margin: 0 });
    slide.addText(title, { x: x + 0.22, y: 2.68, w: 2.24, h: 0.38, fontFace: "Aptos Display", fontSize: 18, bold: true, color: COLORS.navy, align: "center", margin: 0 });
    slide.addText(desc, { x: x + 0.3, y: 3.48, w: 2.08, h: 0.9, fontFace: "Aptos", fontSize: 14, color: COLORS.ink, align: "center", valign: "mid", margin: 0 });
    if (i < 3) slide.addShape("chevron", { x: x + 2.73, y: 3.28, w: 0.38, h: 0.52, fill: { color: COLORS.line }, line: { color: COLORS.line } });
  });
  slide.addText("Tecnologías habilitadoras: Redis · OpenTelemetry · CDC/Debezium · Flyway/Liquibase", { x: 1.6, y: 6.15, w: 10.2, h: 0.42, fontFace: "Aptos", fontSize: 14, bold: true, color: COLORS.gray, align: "center", margin: 0 });

  slide = pptx.addSlide();
  slide.background = { color: COLORS.navy };
  slide.addShape("rect", { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: COLORS.cyan }, line: { color: COLORS.cyan } });
  slide.addText("Conclusión", { x: 0.85, y: 0.8, w: 3.0, h: 0.55, fontFace: "Aptos Display", fontSize: 27, bold: true, color: COLORS.cyan, margin: 0 });
  slide.addText("La arquitectura híbrida fue correcta.\nLa medición mostró cómo hacerla sostenible.", { x: 0.85, y: 1.75, w: 8.6, h: 1.3, fontFace: "Aptos Display", fontSize: 30, bold: true, color: COLORS.white, margin: 0 });
  const conclusions = [
    "PostgreSQL protege el núcleo financiero.",
    "MongoDB aporta flexibilidad y disponibilidad.",
    "El dashboard requiere una capa analítica preagregada.",
    "El próximo salto es operativo: observabilidad, lag y automatización."
  ];
  addBullets(slide, conclusions, 0.95, 3.45, 8.2, 2.2, 17);
  slide.addShape("roundRect", { x: 9.75, y: 1.4, w: 2.65, h: 4.6, rectRadius: 0.08, fill: { color: COLORS.blue, transparency: 12 }, line: { color: COLORS.cyan, transparency: 35 } });
  slide.addText("SIGUIENTE\nDECISIÓN", { x: 10.1, y: 2.05, w: 1.95, h: 0.75, fontFace: "Aptos", fontSize: 13, bold: true, color: "B8E4E2", align: "center", margin: 0 });
  slide.addText("Priorizar\npreagregación\ny outbox\nasíncrono", { x: 10.02, y: 3.15, w: 2.1, h: 1.6, fontFace: "Aptos Display", fontSize: 21, bold: true, color: COLORS.white, align: "center", margin: 0 });
  slide.addText("Gracias", { x: 0.88, y: 6.72, w: 2.0, h: 0.32, fontFace: "Aptos", fontSize: 13, color: "9FB3C8", margin: 0 });

  const file = path.join(OUTPUT, "Presentacion_Ejecutiva_Ecommify_U6.pptx");
  await pptx.writeFile({ fileName: file, compression: true });
  return file;
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const [docxFile, pptxFile] = await Promise.all([createDocx(), createPptx()]);
  console.log(docxFile);
  console.log(pptxFile);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
