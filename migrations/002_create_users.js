/**
 * 创建用户表
 */

exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.string('id', 36).primary().comment('用户ID (UUID)');
    table.string('email', 255).unique().notNullable().comment('邮箱地址');
    table.string('password', 255).notNullable().comment('密码哈希');
    table.string('name', 100).comment('用户姓名');
    table.enum('role', ['admin', 'user', 'provider']).defaultTo('user').comment('用户角色');
    table.boolean('is_active').defaultTo(true).comment('是否激活');
    table.string('wechat_webhook_url', 500).comment('企业微信Webhook地址');
    table.timestamps(true, true);
    
    // 索引
    table.index('email');
    table.index('role');
    table.index('is_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
};
