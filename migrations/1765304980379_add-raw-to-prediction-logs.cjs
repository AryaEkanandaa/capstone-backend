exports.up = (pgm) => {
  pgm.addColumn("prediction_logs", {
    raw: {
      type: "JSONB",
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("prediction_logs", "raw");
};
