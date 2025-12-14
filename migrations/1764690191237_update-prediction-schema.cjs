exports.up = (pgm) => {
  pgm.dropTable("prediction_logs", { ifExists: true });

  pgm.createTable("prediction_logs", {
    id: "id",
    failure_label: { type: "TEXT", notNull: true },
    confidence: { type: "FLOAT", notNull: true },
    status: { type: "TEXT", notNull: true },
    created_at: { type: "TIMESTAMP", default: pgm.func("current_timestamp") }
  });
};

exports.down = (pgm) => {
  pgm.dropTable("prediction_logs");
};
