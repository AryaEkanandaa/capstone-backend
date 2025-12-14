exports.up = pgm => {
  pgm.dropTable("prediction_logs", { ifExists: true });
  pgm.createTable("prediction_logs", {
    id: "id", 
    machine_id: { type: "integer", notNull: true },
    failure_type: { type: "text", notNull: true },
    failure_probability: { type: "real", notNull: true },
    status: { type: "text", notNull: true, default: "NORMAL" }, 
    created_at: { type: "timestamp", default: pgm.func("current_timestamp") }
  });

  pgm.createIndex("prediction_logs", "machine_id");
  pgm.createIndex("prediction_logs", "status");
};

exports.down = pgm => {
  pgm.dropTable("prediction_logs", { ifExists: true });
};
