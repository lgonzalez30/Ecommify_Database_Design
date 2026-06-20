const fs = require("node:fs");
const path = require("node:path");

const resultsDir = path.resolve(process.argv[2] || "resultados");
const pattern = /^formal_s_u(\d+)_r(\d+)\.jtl$/;
const files = fs.readdirSync(resultsDir).filter((name) => pattern.test(name)).sort();
if (!files.length) {
  console.error("No se encontraron archivos formal_s_u*_r*.jtl");
  process.exit(1);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[index];
}

function median(values) {
  return percentile(values, 0.5);
}

function summarize(samples) {
  const elapsed = samples.map((sample) => sample.elapsed);
  const first = Math.min(...samples.map((sample) => sample.timestamp));
  const last = Math.max(...samples.map((sample) => sample.timestamp + sample.elapsed));
  const durationSeconds = Math.max((last - first) / 1000, 0.001);
  const errors = samples.filter((sample) => !sample.success).length;
  return {
    samples: samples.length,
    throughput: samples.length / durationSeconds,
    mean: elapsed.reduce((total, value) => total + value, 0) / elapsed.length,
    p50: percentile(elapsed, 0.5),
    p95: percentile(elapsed, 0.95),
    p99: percentile(elapsed, 0.99),
    max: Math.max(...elapsed),
    errorPct: errors * 100 / samples.length
  };
}

const rows = [];
for (const file of files) {
  const match = file.match(pattern);
  const users = Number(match[1]);
  const repetition = Number(match[2]);
  const lines = fs.readFileSync(path.join(resultsDir, file), "utf8").trim().split(/\r?\n/);
  const samples = lines.slice(1).filter(Boolean).map((line) => {
    const columns = line.split(",");
    return { timestamp: Number(columns[0]), elapsed: Number(columns[1]), label: columns[2], success: columns[7] === "true" };
  });
  const groups = new Map([["TOTAL", samples]]);
  for (const sample of samples) {
    if (!groups.has(sample.label)) groups.set(sample.label, []);
    groups.get(sample.label).push(sample);
  }
  for (const [label, group] of groups) rows.push({ users, repetition, label, ...summarize(group) });
}

const header = "usuarios,repeticion,flujo,muestras,throughput_ops_s,media_ms,p50_ms,p95_ms,p99_ms,max_ms,error_pct";
const csv = [header, ...rows.map((row) => [
  row.users, row.repetition, `"${row.label.replaceAll('"', '""')}"`, row.samples,
  row.throughput.toFixed(2), row.mean.toFixed(2), row.p50.toFixed(2), row.p95.toFixed(2),
  row.p99.toFixed(2), row.max.toFixed(2), row.errorPct.toFixed(4)
].join(","))].join("\n") + "\n";
fs.writeFileSync(path.join(resultsDir, "consolidado_metricas.csv"), csv);

const levels = [...new Set(rows.map((row) => row.users))].sort((a, b) => a - b);
const aggregate = levels.map((users) => {
  const runs = rows.filter((row) => row.users === users && row.label === "TOTAL");
  return {
    users,
    repetitions: runs.length,
    throughput: median(runs.map((row) => row.throughput)),
    p50: median(runs.map((row) => row.p50)),
    p95: median(runs.map((row) => row.p95)),
    p99: median(runs.map((row) => row.p99)),
    errorPct: median(runs.map((row) => row.errorPct))
  };
});

function svgChart(filename, title, field, unit, color) {
  const width = 900, height = 480, left = 80, right = 30, top = 55, bottom = 70;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const maxValue = Math.max(...aggregate.map((item) => item[field])) * 1.12 || 1;
  const x = (index) => left + (aggregate.length === 1 ? plotWidth / 2 : index * plotWidth / (aggregate.length - 1));
  const y = (value) => top + plotHeight - value / maxValue * plotHeight;
  const points = aggregate.map((item, index) => `${x(index)},${y(item[field])}`).join(" ");
  const ticks = Array.from({ length: 6 }, (_, index) => maxValue * index / 5);
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="${width / 2}" y="30" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold">${title}</text>
  ${ticks.map((tick) => `<line x1="${left}" y1="${y(tick)}" x2="${width - right}" y2="${y(tick)}" stroke="#e5e7eb"/><text x="${left - 10}" y="${y(tick) + 5}" text-anchor="end" font-family="Arial" font-size="12">${tick.toFixed(1)}</text>`).join("\n  ")}
  <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#111827"/>
  <line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#111827"/>
  <polyline points="${points}" fill="none" stroke="${color}" stroke-width="3"/>
  ${aggregate.map((item, index) => `<circle cx="${x(index)}" cy="${y(item[field])}" r="5" fill="${color}"/><text x="${x(index)}" y="${y(item[field]) - 12}" text-anchor="middle" font-family="Arial" font-size="12">${item[field].toFixed(1)}</text><text x="${x(index)}" y="${top + plotHeight + 25}" text-anchor="middle" font-family="Arial" font-size="12">${item.users}</text>`).join("\n  ")}
  <text x="${width / 2}" y="${height - 18}" text-anchor="middle" font-family="Arial" font-size="14">Usuarios concurrentes</text>
  <text transform="translate(20 ${height / 2}) rotate(-90)" text-anchor="middle" font-family="Arial" font-size="14">${unit}</text>
</svg>\n`;
  fs.writeFileSync(path.join(resultsDir, filename), content);
}

svgChart("grafica_throughput.svg", "Throughput mediano por concurrencia", "throughput", "Solicitudes/s", "#2563eb");
svgChart("grafica_p95.svg", "Latencia p95 mediana por concurrencia", "p95", "Milisegundos", "#dc2626");

const markdown = `# Resultados consolidados — matriz formal escala S

Cada valor es la mediana de las repeticiones disponibles para el nivel de concurrencia.

| Usuarios | Repeticiones | Throughput | p50 | p95 | p99 | Errores |
|---:|---:|---:|---:|---:|---:|---:|
${aggregate.map((item) => `| ${item.users} | ${item.repetitions} | ${item.throughput.toFixed(2)} ops/s | ${item.p50.toFixed(2)} ms | ${item.p95.toFixed(2)} ms | ${item.p99.toFixed(2)} ms | ${item.errorPct.toFixed(4)} % |`).join("\n")}

![Throughput](grafica_throughput.svg)

![Latencia p95](grafica_p95.svg)
`;
fs.writeFileSync(path.join(resultsDir, "resumen_matriz_formal.md"), markdown);
console.log(`Consolidadas ${files.length} corridas en ${resultsDir}`);

