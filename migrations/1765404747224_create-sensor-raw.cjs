exports.up = (pgm) => {
  pgm.createTable("sensor_raw", {
    id: "id",

    udi: { type: "INTEGER" },
    product_id: { type: "VARCHAR(50)" },
    type: { type: "VARCHAR(10)" },

    air_temp: { type: "DOUBLE PRECISION" },
    process_temp: { type: "DOUBLE PRECISION" },
    rpm: { type: "DOUBLE PRECISION" },
    torque: { type: "DOUBLE PRECISION" },
    tool_wear: { type: "DOUBLE PRECISION" },

    target: { type: "INTEGER" },
    failure_type: { type: "VARCHAR(100)" },

    timestamp: { type: "TIMESTAMP" },

    created_at: {
      type: "TIMESTAMP",
      default: pgm.func("current_timestamp"),
    }
  });
};

exports.down = (pgm) => {
  pgm.dropTable("sensor_raw");
};
