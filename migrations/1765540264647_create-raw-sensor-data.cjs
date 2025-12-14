exports.up = (pgm) => {
  pgm.createTable("raw_sensor_data", {
    id: "id",

    machine_id: { type: "INTEGER", notNull: true },
    product_id: { type: "VARCHAR(50)" },
    type: { type: "VARCHAR(10)" },

    air_temp: { type: "DOUBLE PRECISION", notNull: true },
    process_temp: { type: "DOUBLE PRECISION", notNull: true },
    rpm: { type: "DOUBLE PRECISION", notNull: true },
    torque: { type: "DOUBLE PRECISION", notNull: true },
    tool_wear: { type: "DOUBLE PRECISION", notNull: true },

    created_at: {
      type: "TIMESTAMP",
      default: pgm.func("current_timestamp"),
    }
  });
};

exports.down = (pgm) => {
  pgm.dropTable("raw_sensor_data");
};
