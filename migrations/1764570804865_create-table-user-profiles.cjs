exports.up = (pgm) => {
  pgm.createTable('user_profiles', {
    id: 'id',
    user_id: {
      type: 'INTEGER',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    photo_url: { type: 'TEXT' },
    phone: { type: 'VARCHAR(20)' },
    address: { type: 'TEXT' },
    updated_at: { type: 'TIMESTAMP', default: pgm.func('current_timestamp') }
  });

  pgm.addConstraint('user_profiles', 'unique_user_profile', {
    unique: ['user_id']
  });
};

exports.down = (pgm) => {
  pgm.dropTable('user_profiles');
};
