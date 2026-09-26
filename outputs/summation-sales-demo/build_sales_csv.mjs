import fs from "node:fs/promises";
import { Workbook } from "@oai/artifact-tool";

const outputDir = new URL("./", import.meta.url);
const csvPath = new URL("sample_sales_orders_2026.csv", outputDir);
const previewPath = new URL("/tmp/sample_sales_orders_2026_preview.png", import.meta.url);

const products = [
  { name: "Starter Kit", unitPrice: 250, unitCost: 110 },
  { name: "Pro Kit", unitPrice: 600, unitCost: 270 },
  { name: "Analytics Add-on", unitPrice: 1200, unitCost: 400 },
  { name: "Enterprise Bundle", unitPrice: 2500, unitCost: 1200 },
];

const territories = [
  { region: "West", rep: "Maya Chen" },
  { region: "Northeast", rep: "Omar Haddad" },
  { region: "South", rep: "Priya Shah" },
  { region: "Midwest", rep: "Luca Romero" },
];

const accounts = [
  ["Aster Labs", "Mid-Market"],
  ["Beacon Foods", "SMB"],
  ["Cedar Health", "Enterprise"],
  ["Drift Logistics", "Mid-Market"],
  ["Evergreen Retail", "Enterprise"],
  ["Forge Studio", "SMB"],
  ["Granite Systems", "Mid-Market"],
  ["Harbor Works", "SMB"],
  ["Ion Mobility", "Enterprise"],
  ["Juniper Media", "Mid-Market"],
  ["Keystone Energy", "Enterprise"],
  ["Lumen Design", "SMB"],
  ["Mariner Finance", "Mid-Market"],
  ["Northstar Bio", "Enterprise"],
  ["Oak & Field", "SMB"],
  ["Pioneer Cloud", "Mid-Market"],
];

const channels = ["Direct", "Online", "Partner"];
const discounts = [0, 0.05, 0.1, 0.15];
const rows = [];

for (let month = 0; month < 6; month += 1) {
  for (let order = 0; order < 8; order += 1) {
    const sequence = month * 8 + order;
    const product = products[(order + (month >= 3 ? 1 : 0)) % products.length];
    const territory = territories[(order + month) % territories.length];
    const account = accounts[(order * 2 + month * 3) % accounts.length];
    const channel = channels[(order + month * 2) % channels.length];
    const units = 2 + ((order * 3 + month * 2) % 9) + (month >= 3 ? 2 : 0);
    const discountPct = discounts[(order + month) % discounts.length];
    const revenue = Number((units * product.unitPrice * (1 - discountPct)).toFixed(2));
    const cogs = Number((units * product.unitCost).toFixed(2));
    const grossProfit = Number((revenue - cogs).toFixed(2));
    const day = String(4 + order * 3).padStart(2, "0");
    const monthNumber = String(month + 1).padStart(2, "0");

    rows.push([
      `SO-${String(sequence + 1).padStart(4, "0")}`,
      `2026-${monthNumber}-${day}`,
      account[0],
      account[1],
      territory.region,
      channel,
      territory.rep,
      product.name,
      units,
      product.unitPrice,
      discountPct,
      revenue,
      cogs,
      grossProfit,
      sequence < 16 ? "Yes" : "No",
    ]);
  }
}

const headers = [
  "order_id",
  "order_date",
  "account_name",
  "customer_segment",
  "region",
  "sales_channel",
  "sales_rep",
  "product",
  "units",
  "unit_price",
  "discount_pct",
  "revenue",
  "cogs",
  "gross_profit",
  "new_customer",
];

const escapeCsv = (value) => {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n") + "\n";
await fs.writeFile(csvPath, csv, "utf8");

const workbook = await Workbook.fromCSV(csv, { sheetName: "Sales orders" });
const sheet = workbook.worksheets.getItem("Sales orders");

sheet.getRange("B2:B49").values = rows.map((row) => [new Date(`${row[1]}T00:00:00Z`)]);
for (const column of ["I", "J", "K", "L", "M", "N"]) {
  const index = { I: 8, J: 9, K: 10, L: 11, M: 12, N: 13 }[column];
  sheet.getRange(`${column}2:${column}49`).values = rows.map((row) => [row[index]]);
}
sheet.getRange("B2:B49").setNumberFormat("yyyy-mm-dd");
sheet.getRange("I2:I49").setNumberFormat("0");
sheet.getRange("J2:J49").setNumberFormat("$#,##0.00");
sheet.getRange("K2:K49").setNumberFormat("0.0%");
sheet.getRange("L2:N49").setNumberFormat("$#,##0.00");
sheet.freezePanes.freezeRows(1);
sheet.getRange("A1:O1").format = {
  fill: "#1F4E78",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
};
sheet.getRange("A2:O49").format.font = { name: "Arial", size: 10 };
sheet.getRange("A1:O49").format.autofitColumns();
workbook.recalculate();

const revenueTotal = rows.reduce((sum, row) => sum + row[11], 0);
const cogsTotal = rows.reduce((sum, row) => sum + row[12], 0);
const profitTotal = rows.reduce((sum, row) => sum + row[13], 0);
const badRows = rows.filter((row) => Math.abs(row[11] - row[12] - row[13]) > 0.001);
if (rows.length !== 48 || badRows.length > 0 || Math.abs(revenueTotal - cogsTotal - profitTotal) > 0.001) {
  throw new Error("Sales dataset failed reconciliation checks.");
}

const inspection = await workbook.inspect({
  kind: "table",
  range: "Sales orders!A1:O8",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 15,
});
console.log(inspection.ndjson);
console.log(JSON.stringify({ rows: rows.length, revenueTotal, cogsTotal, profitTotal, badRows: badRows.length }));

const preview = await workbook.render({
  sheetName: "Sales orders",
  range: "A1:O18",
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
