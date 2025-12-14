import fs from "fs";
import csv from "csv-parser";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_PATH = path.join(__dirname, "../../../dataset/predictive_maintenance.csv");

let dataset = [];
let pointer = 0;

function loadDataset() {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(DATASET_PATH)
      .pipe(csv())
      .on("data", (d) => rows.push(d))
      .on("end", () => {
        dataset = rows;
        console.log(`📌 Loaded dataset (${rows.length} rows)`);
        resolve();
      })
      .on("error", reject);
  });
}

await loadDataset();

export function generateSensorForMachine(machine_id) {
  if (dataset.length === 0) return null;

  const row = dataset[pointer];

  pointer++;
  if (pointer >= dataset.length) pointer = 0;

  return {
    machine_id,
    airTemperature: Number(row["Air temperature [K]"]),
    processTemperature: Number(row["Process temperature [K]"]),
    rotationalSpeed: Number(row["Rotational speed [rpm]"]),
    torque: Number(row["Torque [Nm]"]),
    toolWear: Number(row["Tool wear [min]"]),
  };
}

export function getMachineCount() {
  return 5;
}
