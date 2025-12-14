import sensorService from "../../services/sensor/sensorService.js";

const getLatestAllMachines = async (req, res, next) => {
  try {
    const data = await sensorService.getLatestAll();
    res.json({ status: "success", data });
  } catch (err) {
    next(err);
  }
};

const getLatestByMachine = async (req, res, next) => {
  try {
    const { machine_id } = req.params;
    const data = await sensorService.getLatestByMachine(machine_id);
    res.json({ status: "success", data });
  } catch (err) {
    next(err);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, date_from, date_to, machine_id, range } = req.query;

    const result = await sensorService.getSensorHistory({
      page: Number(page),
      limit: Number(limit),
      date_from,
      date_to,
      machine_id,
      range,
    });

    res.json({ status: "success", ...result });
  } catch (err) {
    next(err);
  }
};

const getTrend = async (req, res, next) => {
  try {
    const { machine_id } = req.params;
    const range = req.query.range || "24h";

    const trend = await sensorService.getMachineTrend(machine_id, range);

    if (!trend || trend.rowCount === 0) {
      return res.json({
        status: "no-data",
        message: `Tidak ada data trend untuk mesin ${machine_id} pada range ${range}`
      });
    }

    res.json({
      status: "success",
      machine_id,
      range,
      points: trend.rowCount,
      trend: trend.rows
    });

  } catch (err) {
    next(err);
  }
};

const addLog = async (req, res, next) => {
  try {
    const saved = await sensorService.saveSensorLog(req.body);

    res.status(201).json({
      status: "success",
      message: "Sensor log saved",
      data: saved,
    });
  } catch (err) {
    next(err);
  }
};

export default {
  getLatestAllMachines,
  getLatestByMachine,
  getHistory,
  addLog,
  getTrend,
};
