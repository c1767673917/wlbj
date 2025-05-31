// PM2生产环境配置文件
// 用于生产环境的进程管理和监控

module.exports = {
  apps: [{
    // 应用基本信息
    name: 'wlbj-app',
    script: 'app.js',
    cwd: '/opt/wlbj',
    
    // 进程配置
    instances: 'max',  // 使用所有CPU核心
    exec_mode: 'cluster',  // 集群模式
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // 日志配置
    error_file: '/var/log/wlbj/pm2-error.log',
    out_file: '/var/log/wlbj/pm2-out.log',
    log_file: '/var/log/wlbj/pm2-combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // 性能配置
    max_memory_restart: '500M',  // 内存超过500M时重启
    node_args: '--max-old-space-size=512',  // Node.js内存限制
    
    // 监控配置
    min_uptime: '10s',  // 最小运行时间
    max_restarts: 10,   // 最大重启次数
    
    // 自动重启配置
    watch: false,  // 生产环境不监听文件变化
    ignore_watch: [
      'node_modules',
      'logs',
      'data',
      '.git'
    ],
    
    // 健康检查
    health_check_grace_period: 3000,  // 健康检查宽限期
    
    // 进程间通信
    kill_timeout: 5000,  // 强制杀死进程的超时时间
    listen_timeout: 3000,  // 监听超时时间
    
    // 自定义配置
    merge_logs: true,  // 合并日志
    autorestart: true,  // 自动重启
    
    // 环境特定配置
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      // 可以在这里添加生产环境特定的环境变量
    }
  }],
  
  // 部署配置
  deploy: {
    production: {
      user: 'wlbj',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/c1767673917/wlbj.git',
      path: '/opt/wlbj',
      'post-deploy': 'npm install --production && cd frontend && npm install && npm run build && cd .. && pm2 reload ecosystem.production.js --env production',
      'pre-setup': 'mkdir -p /opt/wlbj'
    }
  }
};
