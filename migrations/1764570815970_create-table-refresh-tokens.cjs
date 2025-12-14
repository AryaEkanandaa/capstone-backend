exports.up = (pgm) => {
  pgm.createTable('refresh_tokens', {
    id: 'id',
    user_id: {
      type: 'INTEGER',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    token: { type: 'TEXT', notNull: true },
    created_at: { type: 'TIMESTAMP', default: pgm.func('current_timestamp') }
  });
};

exports.down = (pgm) => {
  pgm.dropTable('refresh_tokens');
};
