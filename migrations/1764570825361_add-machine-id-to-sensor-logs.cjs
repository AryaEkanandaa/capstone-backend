exports.up = (pgm) => {
  pgm.addColumn("sensor_logs", {
    machine_id: {
      type: "INTEGER",
      notNull: true,
      default: 1,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("sensor_logs", "machine_id");
};
