const fs = require("node:fs");
const path = require("node:path");

const directory = path.resolve(process.argv[2] || "resultados");
const candidates = fs.readdirSync(directory).filter((file) =>
  /^formal_s_u10_r[1-3]\.jtl$/.test(file) || /^scale_[ml]_u10_r\d+\.jtl$/.test(file)
);

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] || 0;
}

function median(values) { return percentile(values, 0.5); }

const runs = candidates.map((file) => {
  const scale = file.startsWith("formal_s") ? "S" : file.match(/^scale_([ml])_/)[1].toUpperCase();
  const repetition = Number(file.match(/_r(\d+)\.jtl$/)[1]);
  const lines = fs.readFileSync(path.join(directory, file), "utf8").trim().split(/\r?\n/).slice(1);
  const samples = lines.filter(Boolean).map((line) => {
    const columns = line.split(",");
    return { timestamp: Number(columns[0]), elapsed: Number(columns[1]), success: columns[7] === "true" };
  });
  const first = Math.min(...samples.map((sample) => sample.timestamp));
  const last = Math.max(...samples.map((sample) => sample.timestamp + sample.elapsed));
  const elapsed = samples.map((sample) => sample.elapsed);
  return {
    scale,
    repetition,
    samples: samples.length,
    throughput: samples.length / ((last - first) / 1000),
    p50: percentile(elapsed, 0.5),
    p95: percentile(elapsed, 0.95),
    p99: percentile(elapsed, 0.99),
    errorPct: samples.filter((sample) => !sample.success).length * 100 / samples.length
  };
});

const order = ["S", "M", "L"];
const aggregate = order.map((scale) => {
  const selected = runs.filter((run) => run.scale === scale);
  if (!selected.length) throw new Error(`No hay corridas para escala ${scale}`);
  return {
    scale,
    repetitions: selected.length,
    throughput: median(selected.map((run) => run.throughput)),
    p50: median(selected.map((run) => run.p50)),
    p95: median(selected.map((run) => run.p95)),
    p99: median(selected.map((run) => run.p99)),
    errorPct: median(selected.map((run) => run.errorPct))
  };
});

const csv = [
  "escala,repeticion,muestras,throughput_ops_s,p50_ms,p95_ms,p99_ms,error_pct",
  ...runs.sort((a, b) => order.indexOf(a.scale) - order.indexOf(b.scale) || a.repetition - b.repetition)
    .map((run) => [run.scale, run.repetition, run.samples, run.throughput.toFixed(2), run.p50, run.p95, run.p99, run.errorPct.toFixed(4)].join(","))
].join("\n") + "\n";
fs.writeFileSync(path.join(directory, "consolidado_escalabilidad.csv"), csv);

function graph(filename, title, field, unit, color) {
  const width = 760, height = 430, left = 75, top = 55, plotWidth = 640, plotHeight = 300;
  const maximum = Math.max(...aggregate.map((item) => item[field])) * 1.15 || 1;
  const x = (index) => left + index * plotWidth / 2;
  const y = (value) => top + plotHeight - value / maximum * plotHeight;
  const points = aggregate.map((item, index) => `${x(index)},${y(item[field])}`).join(" ");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="white"/><text x="380" y="30" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold">${title}</text>
${[0,1,2,3,4,5].map((i) => { const value = maximum * i / 5; return `<line x1="${left}" y1="${y(value)}" x2="${left + plotWidth}" y2="${y(value)}" stroke="#e5e7eb"/><text x="${left - 8}" y="${y(value) + 4}" text-anchor="end" font-family="Arial" font-size="12">${value.toFixed(1)}</text>`; }).join("\n")}
<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3"/>
${aggregate.map((item, index) => `<circle cx="${x(index)}" cy="${y(item[field])}" r="5" fill="${color}"/><text x="${x(index)}" y="${y(item[field]) - 12}" text-anchor="middle" font-family="Arial" font-size="12">${item[field].toFixed(1)}</text><text x="${x(index)}" y="380" text-anchor="middle" font-family="Arial" font-size="13">${item.scale}</text>`).join("\n")}
<text x="380" y="415" text-anchor="middle" font-family="Arial" font-size="14">Escala del dataset</text><text transform="translate(18 215) rotate(-90)" text-anchor="middle" font-family="Arial" font-size="14">${unit}</text></svg>\n`;
  fs.writeFileSync(path.join(directory, filename), svg);
}

graph("grafica_escalabilidad_throughput.svg", "Throughput por tamaño del dataset (10 usuarios)", "throughput", "Solicitudes/s", "#2563eb");
graph("grafica_escalabilidad_p95.svg", "Latencia p95 por tamaño del dataset (10 usuarios)", "p95", "Milisegundos", "#dc2626");

const markdown = `# Resultados de escalabilidad por volumen

Concurrencia fija: 10 usuarios. Cada valor corresponde a la mediana de tres corridas de 120 segundos.

| Escala | Órdenes | Productos | Eventos representados | Throughput | p50 | p95 | p99 | Errores |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${aggregate.map((item) => {
  const sizes = item.scale === "S" ? [10000, 5000, 100000] : item.scale === "M" ? [50000, 20000, 500000] : [100000, 40000, 1000000];
  return `| ${item.scale} | ${sizes[0].toLocaleString("es-CO")} | ${sizes[1].toLocaleString("es-CO")} | ${sizes[2].toLocaleString("es-CO")} | ${item.throughput.toFixed(2)} ops/s | ${item.p50.toFixed(2)} ms | ${item.p95.toFixed(2)} ms | ${item.p99.toFixed(2)} ms | ${item.errorPct.toFixed(4)} % |`;
}).join("\n")}

![Throughput por volumen](grafica_escalabilidad_throughput.svg)

![Latencia p95 por volumen](grafica_escalabilidad_p95.svg)
`;
fs.writeFileSync(path.join(directory, "resumen_escalabilidad.md"), markdown);
console.log(`Consolidadas ${runs.length} corridas de escalabilidad.`);
