exports.up = (pgm) => {
  pgm.createTable('sensor_logs', {
    id: 'id',
    air_temperature: 'FLOAT',
    process_temperature: 'FLOAT',
    rotational_speed: 'FLOAT',
    torque: 'FLOAT',
    tool_wear: 'FLOAT',
    created_at: { type: 'TIMESTAMP', default: pgm.func('current_timestamp') }
  });
};

exports.down = (pgm) => {
  pgm.dropTable('sensor_logs');
};
