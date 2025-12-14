exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO users (full_name, username, email, password, role)
    SELECT
      'System',
      'system',
      'system@internal',
      'SYSTEM',
      'SYSTEM'
    WHERE NOT EXISTS (
      SELECT 1 FROM users WHERE username = 'system'
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM users
    WHERE username = 'system';
  `);
};
