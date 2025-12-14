exports.up = (pgm) => {
  pgm.addColumn("prediction_logs", {
    confidence: { type: "REAL", notNull: false },
    status: { type: "VARCHAR(20)", default: "NORMAL" }
  });

  pgm.sql(`
    UPDATE prediction_logs
    SET confidence = failure_probability
    WHERE confidence IS NULL;
  `);

  pgm.alterColumn("prediction_logs", "confidence", { notNull: true });

  pgm.createIndex("prediction_logs", "status");
  pgm.createIndex("prediction_logs", "confidence");
};

exports.down = (pgm) => {
  pgm.dropColumn("prediction_logs", "confidence");
  pgm.dropColumn("prediction_logs", "status");
};
