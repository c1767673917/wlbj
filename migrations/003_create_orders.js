/**
 * 创建订单表
 */

exports.up = function(knex) {
  return knex.schema.createTable('orders', function(table) {
    table.string('id', 20).primary().comment('订单ID (RX格式)');
    table.string('warehouse', 200).notNullable().comment('仓库地址');
    table.text('goods').notNullable().comment('货物描述');
    table.string('delivery_address', 300).notNullable().comment('收货地址');
    table.enum('status', ['active', 'closed', 'cancelled']).defaultTo('active').comment('订单状态');
    table.string('selected_provider', 100).comment('选中的物流商');
    table.decimal('selected_price', 10, 2).comment('选中的价格');
    table.timestamp('selected_at').comment('选择时间');
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.timestamps(true, true);
    
    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // 索引
    table.index('user_id');
    table.index('status');
    table.index('created_at');
    table.index(['user_id', 'status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('orders');
};
