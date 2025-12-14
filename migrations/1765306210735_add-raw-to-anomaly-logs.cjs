exports.up = (pgm) => {
  pgm.addColumn("anomaly_logs", {
    raw: {
      type: "JSONB",
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("anomaly_logs", "raw");
};
