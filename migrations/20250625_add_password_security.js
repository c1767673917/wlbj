/**
 * 密码安全增强迁移
 * 添加密码历史记录、密码策略、登录尝试跟踪等表
 */

exports.up = function(knex) {
  return Promise.all([
    // 1. 添加用户表的密码安全字段
    knex.schema.table('users', function(table) {
      table.timestamp('password_changed_at').defaultTo(knex.fn.now()).comment('密码最后更改时间');
      table.boolean('password_expired').defaultTo(false).comment('密码是否已过期');
      table.boolean('force_password_change').defaultTo(false).comment('是否强制更改密码');
      table.integer('failed_login_attempts').defaultTo(0).comment('失败登录尝试次数');
      table.timestamp('locked_until').nullable().comment('账户锁定到期时间');
      table.timestamp('last_login_at').nullable().comment('最后登录时间');
      table.string('last_login_ip', 45).nullable().comment('最后登录IP地址');
    }),

    // 2. 创建密码历史记录表
    knex.schema.createTable('password_history', function(table) {
      table.increments('id').primary().comment('主键ID');
      table.integer('user_id').unsigned().notNullable().comment('用户ID');
      table.string('password_hash', 255).notNullable().comment('密码哈希值');
      table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
      table.string('created_by_ip', 45).nullable().comment('创建时的IP地址');
      
      // 外键约束
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      
      // 索引
      table.index(['user_id', 'created_at'], 'idx_password_history_user_time');
    }),

    // 3. 创建登录尝试记录表
    knex.schema.createTable('login_attempts', function(table) {
      table.increments('id').primary().comment('主键ID');
      table.string('email', 255).notNullable().comment('尝试登录的邮箱');
      table.string('ip_address', 45).notNullable().comment('IP地址');
      table.string('user_agent', 500).nullable().comment('用户代理');
      table.boolean('success').notNullable().comment('是否成功');
      table.string('failure_reason', 100).nullable().comment('失败原因');
      table.timestamp('attempted_at').defaultTo(knex.fn.now()).comment('尝试时间');
      table.json('additional_data').nullable().comment('额外数据');
      
      // 索引
      table.index(['email', 'attempted_at'], 'idx_login_attempts_email_time');
      table.index(['ip_address', 'attempted_at'], 'idx_login_attempts_ip_time');
      table.index(['success', 'attempted_at'], 'idx_login_attempts_success_time');
    }),

    // 4. 创建密码策略配置表
    knex.schema.createTable('password_policies', function(table) {
      table.increments('id').primary().comment('主键ID');
      table.string('name', 100).notNullable().unique().comment('策略名称');
      table.json('config').notNullable().comment('策略配置JSON');
      table.boolean('is_active').defaultTo(true).comment('是否激活');
      table.string('description', 500).nullable().comment('策略描述');
      table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
      table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');
      table.string('created_by', 100).nullable().comment('创建者');
      
      // 索引
      table.index(['is_active'], 'idx_password_policies_active');
    }),

    // 5. 创建安全事件日志表
    knex.schema.createTable('security_events', function(table) {
      table.increments('id').primary().comment('主键ID');
      table.integer('user_id').unsigned().nullable().comment('用户ID');
      table.string('event_type', 50).notNullable().comment('事件类型');
      table.string('event_description', 500).notNullable().comment('事件描述');
      table.string('ip_address', 45).nullable().comment('IP地址');
      table.string('user_agent', 500).nullable().comment('用户代理');
      table.enum('severity', ['low', 'medium', 'high', 'critical']).defaultTo('medium').comment('严重程度');
      table.json('event_data').nullable().comment('事件数据');
      table.timestamp('occurred_at').defaultTo(knex.fn.now()).comment('发生时间');
      table.boolean('resolved').defaultTo(false).comment('是否已解决');
      table.timestamp('resolved_at').nullable().comment('解决时间');
      table.string('resolved_by', 100).nullable().comment('解决者');
      
      // 外键约束
      table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
      
      // 索引
      table.index(['event_type', 'occurred_at'], 'idx_security_events_type_time');
      table.index(['user_id', 'occurred_at'], 'idx_security_events_user_time');
      table.index(['severity', 'resolved'], 'idx_security_events_severity_resolved');
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    // 删除新创建的表
    knex.schema.dropTableIfExists('security_events'),
    knex.schema.dropTableIfExists('password_policies'),
    knex.schema.dropTableIfExists('login_attempts'),
    knex.schema.dropTableIfExists('password_history'),
    
    // 移除用户表的新字段
    knex.schema.table('users', function(table) {
      table.dropColumn('password_changed_at');
      table.dropColumn('password_expired');
      table.dropColumn('force_password_change');
      table.dropColumn('failed_login_attempts');
      table.dropColumn('locked_until');
      table.dropColumn('last_login_at');
      table.dropColumn('last_login_ip');
    })
  ]);
};
