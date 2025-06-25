/**
 * 创建订单序列表
 * 用于解决订单ID生成的数据污染问题
 */

exports.up = function(knex) {
  return knex.schema.createTable('order_sequences', function(table) {
    table.string('date', 8).primary().comment('日期字符串 YYYYMMDD');
    table.integer('sequence').unsigned().defaultTo(0).comment('当日序列号');
    table.timestamps(true, true);
    
    // 索引
    table.index('date');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('order_sequences');
};
