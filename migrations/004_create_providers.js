/**
 * 创建物流供应商表
 */

exports.up = function(knex) {
  return knex.schema.createTable('providers', function(table) {
    table.string('id', 36).primary().comment('供应商ID (UUID)');
    table.string('name', 100).unique().notNullable().comment('供应商名称');
    table.string('access_key', 100).unique().notNullable().comment('访问密钥');
    table.string('wechat_webhook_url', 500).comment('企业微信Webhook地址');
    table.boolean('is_active').defaultTo(true).comment('是否激活');
    table.timestamps(true, true);
    
    // 索引
    table.index('name');
    table.index('access_key');
    table.index('is_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('providers');
};
