/**
 * 创建报价表
 */

exports.up = function(knex) {
  return knex.schema.createTable('quotes', function(table) {
    table.string('id', 36).primary().comment('报价ID (UUID)');
    table.string('order_id', 20).notNullable().comment('订单ID');
    table.string('provider_id', 36).notNullable().comment('供应商ID');
    table.string('provider_name', 100).notNullable().comment('供应商名称');
    table.decimal('price', 10, 2).notNullable().comment('报价金额');
    table.string('estimated_delivery', 50).notNullable().comment('预计送达时间');
    table.text('remarks').comment('备注信息');
    table.enum('status', ['active', 'selected', 'expired']).defaultTo('active').comment('报价状态');
    table.timestamps(true, true);
    
    // 外键约束
    table.foreign('order_id').references('id').inTable('orders').onDelete('CASCADE');
    table.foreign('provider_id').references('id').inTable('providers').onDelete('CASCADE');
    
    // 索引
    table.index('order_id');
    table.index('provider_id');
    table.index('status');
    table.index(['order_id', 'price']);
    table.index(['order_id', 'status']);
    
    // 唯一约束：同一订单同一供应商只能有一个有效报价
    table.unique(['order_id', 'provider_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('quotes');
};
