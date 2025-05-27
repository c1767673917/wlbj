#!/usr/bin/env node

/**
 * 物流报价系统清理验证脚本
 * 验证系统是否已正确清理并可以正常启动
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

console.log('🔍 开始验证系统清理状态...\n');

// 验证项目
const verifications = [];

// 1. 验证数据库状态
function verifyDatabase() {
    return new Promise((resolve) => {
        const dbPath = path.join(__dirname, 'data', 'logistics.db');

        if (!fs.existsSync(dbPath)) {
            verifications.push({
                item: '数据库文件',
                status: 'error',
                message: '数据库文件不存在'
            });
            resolve();
            return;
        }

        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                verifications.push({
                    item: '数据库连接',
                    status: 'error',
                    message: `无法连接数据库: ${err.message}`
                });
                resolve();
                return;
            }

            // 检查表是否存在且为空
            const tables = ['orders', 'quotes', 'providers'];
            let completedChecks = 0;

            tables.forEach(tableName => {
                db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
                    if (err) {
                        verifications.push({
                            item: `${tableName}表`,
                            status: 'error',
                            message: `表检查失败: ${err.message}`
                        });
                    } else {
                        verifications.push({
                            item: `${tableName}表`,
                            status: 'success',
                            message: `表存在，记录数: ${row.count}`
                        });
                    }

                    completedChecks++;
                    if (completedChecks === tables.length) {
                        db.close();
                        resolve();
                    }
                });
            });
        });
    });
}

// 2. 验证目录结构
function verifyDirectories() {
    const directories = [
        { path: 'data', required: true },
        { path: 'logs', required: true },
        { path: 'frontend', required: true },
        { path: 'frontend/src', required: true },
        { path: 'frontend/dist', required: false },
        { path: 'routes', required: true },
        { path: 'db', required: true }
    ];

    directories.forEach(dir => {
        const dirPath = path.join(__dirname, dir.path);
        const exists = fs.existsSync(dirPath);

        if (dir.required && !exists) {
            verifications.push({
                item: `目录: ${dir.path}`,
                status: 'error',
                message: '必需目录不存在'
            });
        } else if (exists) {
            const stats = fs.statSync(dirPath);
            if (stats.isDirectory()) {
                verifications.push({
                    item: `目录: ${dir.path}`,
                    status: 'success',
                    message: '目录存在'
                });
            } else {
                verifications.push({
                    item: `目录: ${dir.path}`,
                    status: 'warning',
                    message: '路径存在但不是目录'
                });
            }
        } else {
            verifications.push({
                item: `目录: ${dir.path}`,
                status: 'info',
                message: '可选目录不存在'
            });
        }
    });
}

// 3. 验证关键文件
function verifyFiles() {
    const files = [
        { path: 'app.js', required: true },
        { path: 'package.json', required: true },
        { path: 'db/database.js', required: true },
        { path: 'frontend/package.json', required: true },
        { path: 'frontend/src/App.tsx', required: true },
        { path: 'frontend/src/services/api.ts', required: true },
        { path: 'clear-data.sh', required: false }
    ];

    files.forEach(file => {
        const filePath = path.join(__dirname, file.path);
        const exists = fs.existsSync(filePath);

        if (file.required && !exists) {
            verifications.push({
                item: `文件: ${file.path}`,
                status: 'error',
                message: '必需文件不存在'
            });
        } else if (exists) {
            const stats = fs.statSync(filePath);
            verifications.push({
                item: `文件: ${file.path}`,
                status: 'success',
                message: `文件存在 (${(stats.size / 1024).toFixed(1)}KB)`
            });
        } else {
            verifications.push({
                item: `文件: ${file.path}`,
                status: 'info',
                message: '可选文件不存在'
            });
        }
    });
}

// 4. 验证日志目录是否为空
function verifyLogsEmpty() {
    const logsDir = path.join(__dirname, 'logs');

    if (!fs.existsSync(logsDir)) {
        verifications.push({
            item: '日志目录清理',
            status: 'warning',
            message: '日志目录不存在'
        });
        return;
    }

    const files = fs.readdirSync(logsDir);
    const logFiles = files.filter(file => !file.startsWith('.'));

    if (logFiles.length === 0) {
        verifications.push({
            item: '日志目录清理',
            status: 'success',
            message: '日志目录已清空'
        });
    } else {
        verifications.push({
            item: '日志目录清理',
            status: 'warning',
            message: `日志目录包含 ${logFiles.length} 个文件`
        });
    }
}

// 5. 验证前端构建状态
function verifyFrontendBuild() {
    const distDir = path.join(__dirname, 'frontend', 'dist');

    if (!fs.existsSync(distDir)) {
        verifications.push({
            item: '前端构建清理',
            status: 'success',
            message: '前端构建文件已清理'
        });
    } else {
        const files = fs.readdirSync(distDir);
        verifications.push({
            item: '前端构建清理',
            status: 'warning',
            message: `前端构建目录仍包含 ${files.length} 个文件`
        });
    }
}

// 6. 验证前端硬编码数据清理
function verifyFrontendMockData() {
    const filesToCheck = [
        {
            path: path.join(__dirname, 'frontend', 'src', 'components', 'user', 'UserPortal.tsx'),
            patterns: [
                /RX\d{6}-\d{3}/g,  // 订单号模式
                /广州仓|深圳仓|上海仓/g,  // 仓库名称
                /清香牛肉|香辣味|电子产品/g  // 商品信息
            ]
        },
        {
            path: path.join(__dirname, 'frontend', 'src', 'components', 'user', 'ProviderManagement.tsx'),
            patterns: [
                /顺丰物流|京东物流|德邦物流/g,  // 物流公司名称
                /sf-logistics|jd-logistics|deppon-logistics/g  // 访问密钥
            ]
        }
    ];

    filesToCheck.forEach(fileCheck => {
        if (!fs.existsSync(fileCheck.path)) {
            verifications.push({
                item: `前端文件: ${path.basename(fileCheck.path)}`,
                status: 'error',
                message: '文件不存在'
            });
            return;
        }

        const content = fs.readFileSync(fileCheck.path, 'utf8');
        let foundMockData = false;

        fileCheck.patterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
                foundMockData = true;
            }
        });

        if (foundMockData) {
            verifications.push({
                item: `硬编码数据: ${path.basename(fileCheck.path)}`,
                status: 'warning',
                message: '仍包含硬编码测试数据'
            });
        } else {
            verifications.push({
                item: `硬编码数据: ${path.basename(fileCheck.path)}`,
                status: 'success',
                message: '硬编码数据已清理'
            });
        }
    });
}

// 输出结果
function printResults() {
    console.log('📋 验证结果:\n');

    const statusIcons = {
        success: '✅',
        warning: '⚠️',
        error: '❌',
        info: 'ℹ️'
    };

    const statusCounts = {
        success: 0,
        warning: 0,
        error: 0,
        info: 0
    };

    verifications.forEach(verification => {
        const icon = statusIcons[verification.status];
        console.log(`${icon} ${verification.item}: ${verification.message}`);
        statusCounts[verification.status]++;
    });

    console.log('\n📊 统计信息:');
    console.log(`  ✅ 成功: ${statusCounts.success}`);
    console.log(`  ⚠️  警告: ${statusCounts.warning}`);
    console.log(`  ❌ 错误: ${statusCounts.error}`);
    console.log(`  ℹ️  信息: ${statusCounts.info}`);

    console.log('\n🎯 总体状态:');
    if (statusCounts.error > 0) {
        console.log('❌ 系统存在错误，需要修复后才能正常使用');
        process.exit(1);
    } else if (statusCounts.warning > 0) {
        console.log('⚠️  系统基本正常，但存在一些警告项');
    } else {
        console.log('✅ 系统状态良好，可以正常使用');
    }

    console.log('\n🚀 建议的下一步操作:');
    console.log('  1. 启动后端服务: node app.js');
    console.log('  2. 构建前端: cd frontend && npm run build');
    console.log('  3. 访问系统: http://localhost:3000');
    console.log('  4. 清理浏览器数据: 访问 /clear-browser-data.html');
}

// 主函数
async function main() {
    try {
        // 执行所有验证
        verifyDirectories();
        verifyFiles();
        verifyLogsEmpty();
        verifyFrontendBuild();
        verifyFrontendMockData();

        // 验证数据库（异步）
        await verifyDatabase();

        // 输出结果
        printResults();

    } catch (error) {
        console.error('❌ 验证过程中发生错误:', error.message);
        process.exit(1);
    }
}

// 运行验证
main();
