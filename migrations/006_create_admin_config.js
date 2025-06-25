/**
 * 创建管理员配置表
 */

exports.up = function(knex) {
  return knex.schema.createTable('admin_config', function(table) {
    table.increments('id').primary();
    table.string('password', 255).notNullable().comment('管理员密码哈希');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('admin_config');
};
