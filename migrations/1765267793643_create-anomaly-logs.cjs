exports.up = pgm => {
  pgm.createTable("anomaly_logs", {
    id: "id",
    machine_id: { type: "integer" },
    type: { type: "varchar(5)" },
    air_temp: { type: "float8" },
    process_temp: { type: "float8" },
    rpm: { type: "float8" },
    torque: { type: "float8" },
    tool_wear: { type: "float8" },

    is_anomaly: { type: "boolean", notNull: true },
    score: { type: "float8" },
    status: { type: "varchar(20)" },

    created_at: {
      type: "timestamp",
      default: pgm.func("now()"),
      notNull: true
    }
  });
};

exports.down = pgm => {
  pgm.dropTable("anomaly_logs");
};
