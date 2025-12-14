exports.up = (pgm) => {
  pgm.dropTable("prediction_logs", { ifExists: true });

  pgm.createTable("prediction_logs", {
    id: "id",
    machine_id: { type: "INTEGER", notNull: true },
    failure_type: { type: "TEXT", notNull: true },
    failure_probability: { type: "FLOAT", notNull: true },
    created_at: { type: "TIMESTAMP", default: pgm.func("current_timestamp") }
  });
};

exports.down = (pgm) => {
  pgm.dropTable("prediction_logs");
};
