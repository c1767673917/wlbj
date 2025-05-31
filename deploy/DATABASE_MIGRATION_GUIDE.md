# 🔄 数据库跨平台迁移指南

本指南专门解决从Mac ARM环境到Linux x86生产环境的SQLite数据库兼容性问题。

## 📋 问题背景

### 为什么需要数据库迁移？

1. **架构差异**: Mac ARM (arm64) vs Linux x86 (x86_64)
2. **字节序差异**: 可能存在大端/小端字节序问题
3. **SQLite版本**: 不同平台可能使用不同版本的SQLite
4. **性能优化**: Linux环境下的特定优化配置

### 当前数据库状态

通过兼容性检查，您的数据库状态：
- **文件大小**: 80KB
- **数据完整性**: ✅ 通过
- **SQLite版本**: 3.43.2 (兼容)
- **架构**: ARM64 (Mac)
- **字节序**: Little Endian

## 🔍 兼容性评估

### 自动检查

```bash
# 快速兼容性检查
./deploy/check-database-compatibility.sh -f data/logistics.db --quick

# 完整兼容性检查
./deploy/check-database-compatibility.sh -f data/logistics.db

# 生成详细报告
./deploy/check-database-compatibility.sh -f data/logistics.db -r
```

### 检查结果解读

| 检查项目 | 当前状态 | 说明 |
|---------|---------|------|
| 文件完整性 | ✅ 通过 | 数据库文件完整无损 |
| 版本兼容性 | ✅ 兼容 | SQLite 3.43.2支持跨平台 |
| 数据完整性 | ✅ 通过 | 所有数据表和索引正常 |
| 外键约束 | ✅ 通过 | 关系完整性正常 |

## 🚀 迁移方案

### 方案一：自动迁移（推荐）

部署脚本会自动检测并处理：

```bash
# 执行生产环境部署
sudo ./deploy/deploy-production.sh

# 脚本会自动：
# 1. 检测系统架构
# 2. 提示是否需要迁移
# 3. 执行数据库迁移
# 4. 验证迁移结果
```

### 方案二：手动迁移

```bash
# 1. 备份现有数据库
./deploy/migrate-database.sh --backup-only

# 2. 执行完整迁移
./deploy/migrate-database.sh

# 3. 验证迁移结果
./deploy/check-database-compatibility.sh -r
```

### 方案三：Docker部署（自动处理）

```bash
# Docker构建时自动处理兼容性
docker-compose up -d

# 或单独构建
docker build -t wlbj:latest .
```

## 📊 迁移过程详解

### 1. 数据备份

```bash
# 创建多重备份
- 二进制备份: logistics_original_YYYYMMDD_HHMMSS.db
- SQL导出: database_export_YYYYMMDD_HHMMSS.sql
- 统计信息: data_stats.txt
```

### 2. 数据库重建

```bash
# 在Linux x86环境下重新创建数据库
- 使用相同的表结构
- 应用性能优化配置
- 重建所有索引
```

### 3. 数据迁移

```bash
# 从SQL导出文件导入数据
- 保持数据完整性
- 验证数据一致性
- 测试功能正常性
```

### 4. 性能优化

```bash
# 应用Linux环境优化
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
PRAGMA mmap_size = 268435456;
```

## 🔧 迁移脚本功能

### migrate-database.sh

```bash
# 完整迁移
./deploy/migrate-database.sh

# 强制迁移（跳过确认）
./deploy/migrate-database.sh -f

# 仅备份
./deploy/migrate-database.sh --backup-only

# 仅验证
./deploy/migrate-database.sh --verify-only
```

### check-database-compatibility.sh

```bash
# 快速检查
./deploy/check-database-compatibility.sh --quick

# 性能测试
./deploy/check-database-compatibility.sh --performance

# 完整性检查
./deploy/check-database-compatibility.sh --integrity

# 生成报告
./deploy/check-database-compatibility.sh -r
```

## ⚠️ 注意事项

### 迁移前准备

1. **备份数据**: 确保有完整的数据备份
2. **停止应用**: 避免数据写入冲突
3. **检查空间**: 确保有足够的磁盘空间
4. **权限检查**: 确保有正确的文件权限

### 迁移后验证

1. **数据完整性**: 验证所有数据正确迁移
2. **功能测试**: 测试应用核心功能
3. **性能测试**: 检查查询性能
4. **备份策略**: 建立新的备份计划

## 🛡️ 风险控制

### 回滚机制

```bash
# 如果迁移失败，可以快速回滚
cp /opt/backups/wlbj/migration/logistics_original_*.db /opt/wlbj/data/logistics.db
```

### 数据验证

```bash
# 迁移前后数据对比
- 订单数量对比
- 报价数量对比
- 供应商数量对比
- 数据完整性验证
```

## 📈 性能提升

### 预期改进

- **查询性能**: 提升20-30%
- **并发处理**: WAL模式支持更好的并发
- **内存使用**: 优化的缓存配置
- **磁盘I/O**: 减少同步写入频率

### 监控指标

```bash
# 性能监控
- 查询响应时间
- 数据库文件大小
- 内存使用情况
- 磁盘I/O统计
```

## 🎯 最佳实践

### 生产环境建议

1. **定期备份**: 每日自动备份数据库
2. **监控告警**: 设置数据库性能监控
3. **版本控制**: 跟踪数据库结构变更
4. **容量规划**: 监控数据增长趋势

### 维护计划

```bash
# 定期维护任务
- 每周: 数据库完整性检查
- 每月: 性能分析和优化
- 每季度: 备份策略评估
- 每年: 数据库版本升级评估
```

## 📞 技术支持

### 常见问题

1. **迁移失败**: 检查磁盘空间和权限
2. **性能下降**: 重建索引和优化配置
3. **数据丢失**: 从备份恢复数据
4. **兼容性问题**: 升级SQLite版本

### 获取帮助

```bash
# 生成诊断报告
./deploy/check-database-compatibility.sh -r
./deploy/status.sh --app

# 查看详细日志
tail -f /opt/wlbj/logs/error.log
```

---

**🔄 数据库迁移是确保生产环境稳定性的重要步骤，建议在部署前仔细阅读本指南并执行相应的检查和迁移操作。**
