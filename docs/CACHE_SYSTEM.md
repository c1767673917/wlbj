# 物流报价系统缓存功能说明

## 概述

物流报价系统已成功启用智能缓存系统，提供多层缓存、自动过期、性能监控等功能，显著提升系统性能。

## 缓存架构

### 多层缓存设计

- **L1缓存**: NodeCache内存缓存（最快，容量1000个键，TTL 5分钟）
- **L2缓存**: LRU缓存（中等速度，更大容量5000个项目，TTL 30分钟）
- **Redis缓存**: 可选的分布式缓存（需要单独配置）

### 缓存策略

- **用户数据**: 30分钟缓存
- **订单数据**: 10分钟缓存
- **供应商数据**: 1小时缓存
- **报价数据**: 5分钟缓存
- **统计数据**: 15分钟缓存

## 已启用功能

### 1. 智能缓存管理器

- ✅ 多层缓存自动管理
- ✅ 缓存命中率统计
- ✅ 性能监控和报告
- ✅ 自动缓存预热

### 2. API路由缓存

- ✅ GET /api/orders/\* - 5分钟缓存
- ✅ GET /api/quotes/\* - 3分钟缓存
- ✅ GET /api/providers/\* - 30分钟缓存

### 3. 缓存监控API

- ✅ GET /api/cache/stats - 查看缓存统计
- ✅ POST /api/cache/flush - 清空缓存（仅开发环境）

### 4. 缓存性能监控

- ✅ 实时命中率监控
- ✅ 响应时间统计
- ✅ 缓存容量监控
- ✅ 自动性能优化建议

## 配置选项

### 内存缓存（当前已启用）

```env
REDIS_ENABLED=false
```

### Redis缓存（可选）

```env
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
```

## 性能提升

### 预期效果

- **API响应速度**: 提升60-80%
- **数据库查询**: 减少70-90%
- **系统并发能力**: 提升3-5倍
- **服务器负载**: 降低50-70%

### 监控指标

- 缓存命中率: 目标 >80%
- 平均响应时间: <50ms
- 内存使用率: <80%

## 使用方法

### 查看缓存状态

```bash
curl http://localhost:3000/api/cache/stats
```

### 清空缓存（开发环境）

```bash
curl -X POST http://localhost:3000/api/cache/flush
```

### 业务代码中使用缓存

```javascript
const { cacheIntegration } = require('./utils/cache/CacheIntegration');

// 设置用户缓存
await cacheIntegration.setUserCache(userId, userData);

// 获取用户缓存
const userData = await cacheIntegration.getUserCache(userId);

// 设置订单缓存
await cacheIntegration.setOrderCache(orderId, orderData);
```

## 注意事项

1. **内存使用**: 智能缓存会占用一定内存，建议服务器内存 ≥2GB
2. **数据一致性**: 缓存会有短暂的数据延迟，适合读多写少的场景
3. **缓存失效**: 数据更新时会自动清除相关缓存
4. **监控告警**: 系统会自动监控缓存性能并提供优化建议

## 故障排除

### 缓存不工作

1. 检查服务器启动日志是否显示"智能缓存系统已启用"
2. 访问 /api/cache/stats 查看缓存状态
3. 检查内存使用情况

### 性能问题

1. 查看缓存命中率是否过低
2. 检查缓存容量是否接近上限
3. 考虑调整TTL设置或启用Redis

### Redis连接问题

1. 确认Redis服务器运行状态
2. 检查网络连接和防火墙设置
3. 验证Redis配置参数

## 更新日志

- **2025-06-20**: 智能缓存系统启用成功
  - 修复LRU缓存导入问题
  - 启用多层缓存架构
  - 添加API路由缓存
  - 实现缓存监控和统计
  - 添加性能监控和优化建议
  - 清理旧缓存系统，移除重复代码
  - 统一缓存架构，提升系统稳定性
