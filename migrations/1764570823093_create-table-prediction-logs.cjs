exports.up = (pgm) => {
  pgm.createTable('prediction_logs', {
    id: 'id',
    failure_probability: 'FLOAT',
    created_at: { type: 'TIMESTAMP', default: pgm.func('current_timestamp') }
  });
};

exports.down = (pgm) => {
  pgm.dropTable('prediction_logs');
};
