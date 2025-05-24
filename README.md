# 物流报价平台

本项目是一个专业的物流报价 Web 应用程序，允许用户发布物流订单，并允许物流供应商对这些订单进行报价。经过全面的安全优化和功能升级，现已达到生产级稳定性。

## 最新更新 (v1.0.0) - 2024年12月

### 🔐 重大安全修复

- **依赖安全漏洞修复**: 移除高危漏洞依赖 `xlsx@0.18.5`，升级至安全的 `exceljs` 库
- **API密钥安全化**: 移除前端硬编码的SiliconFlow API密钥，改为后端环境变量管理
- **安全状态**: 0个安全漏洞 (通过 `npm audit` 验证)

### ✅ 错误修复

- **SQL聚合函数错误**: 修复订单查询中的嵌套聚合函数问题
- **Excel库404错误**: 修复供应商端页面对已移除库的引用
- **环境变量配置**: 添加完整的环境变量配置支持

### 🚀 功能优化

- **Excel导出优化**: 用户端导出功能改进，最低报价信息拆分为独立列
- **供应商端导出**: 新增可报价订单和报价历史的Excel导出功能
- **中文文件名支持**: 修复Excel导出文件名中文编码问题
- **AI功能后端化**: AI识别功能迁移至后端，提升安全性和性能

### 📊 性能验证

- **导出功能**: 所有导出API返回HTTP/1.1 200 OK状态
- **AI功能**: 响应时间0.4-2.5秒，工作正常
- **页面加载**: 所有页面正常，无404错误
- **应用稳定性**: 核心功能全部正常运行

## 主要功能

### 用户端 (货主)

- **访问认证**:
  - 首次访问用户端 (`/user`) 时，需要通过密码认证。
  - 认证成功后，该用户的 IP 地址将被添加到白名单，后续访问无需再次输入密码。
  - 主密码更改后，IP 白名单将自动失效，需要重新认证。
- **AI 智能识别订单**: 支持粘贴文本，通过 AI (SiliconFlow API) 自动识别并填充订单信息（发货仓库、货物信息、收货信息）。
- **发布物流订单**: 用户可以手动填写或通过 AI 识别后，发布新的物流需求订单。
- **订单管理**:
  - 查看当前已发布的**活跃订单**列表，包括订单详情和收到的最低报价。
  - 查看已关闭的**历史订单**列表。
  - 对活跃订单进行**编辑**或**关闭**操作。
- **报价查看**: 查看特定订单收到的所有物流供应商的报价详情，最低报价会高亮显示。
- **物流公司管理**:
  - 添加新的合作物流公司。
  - 查看已添加的物流公司列表及其**专属操作链接**。
  - 复制专属链接，方便分享给对应的物流公司。
- **数据导出**: 支持将活跃订单和历史订单列表（包含最低报价信息）导出为 Excel (XLSX) 文件。
  - 导出时会根据当前是否设置搜索条件来决定导出内容（搜索结果或全部内容）。
  - **新增**: 最低报价信息拆分为"最低报价物流商"和"最低报价(元)"两个独立列。
- **标签页状态保持**: 刷新页面后，保持在用户上次查看的标签页。
- **搜索与分页**: 支持对订单列表进行搜索和分页浏览。

### 物流供应商端

- **专属链接访问**: 每个物流公司通过用户端生成的唯一专属链接访问其操作界面，无需注册或登录。
- **查看可报价订单**: 自动显示当前所有状态为"活跃"且该物流商尚未报价的订单列表。
- **提交报价**: 对可报价的订单提交价格和预计送达时间。
- **查看我的报价**: 查看自己已提交的所有报价历史。
- **搜索与分页**: 可报价订单和报价历史均支持分页显示和条件搜索。
- **数据导出**: **新功能** 支持将可报价订单列表和我的报价历史列表导出为 Excel (XLSX) 文件。
  - 导出时会根据当前是否设置搜索条件来决定导出内容（搜索结果或全部内容）。
  - 支持中文文件名，格式：`{供应商名称}-available-orders-{日期}.xlsx`

## 技术栈

- **后端**: Node.js, Express.js
- **数据库**: SQLite
- **前端**: HTML5, CSS3, JavaScript (原生)
- **HTTP 请求日志**: Morgan
- **应用日志**: Winston (日志记录到控制台和文件 `logs/app.log`, `logs/error.log`)
- **Excel 处理**: **升级** ExcelJS (安全替代 SheetJS)
- **AI 服务**: [SiliconFlow API](https://siliconflow.cn/) (用于订单信息智能识别，后端调用)
- **唯一ID生成**: UUID
- **环境变量管理**: dotenv

## 项目结构

项目的主要代码位于 `wlbj/` 目录下：

```
wlbj/
├── app.js                  # Express 应用主文件 (应用初始化, 中间件, 路由, 认证, 日志)
├── .env                    # (需手动创建) 环境变量配置文件
├── auth_config.json        # (需手动创建) 用户端访问密码配置文件
├── ip_whitelist.json       # (自动生成/管理) 用户端IP白名单
├── config/                 # 应用配置目录
│   ├── logger.js           # Winston 日志系统配置
│   └── env.js              # 新增: 环境变量配置模块
├── data/                   # 存放 SQLite 数据库文件
│   └── logistics.db
├── db/                     # 数据库相关模块
│   └── database.js         # 数据库连接初始化和表结构定义
├── logs/                   # (自动创建) 日志文件存放目录
│   ├── app.log             # 应用运行日志
│   └── error.log           # 应用错误日志
├── node_modules/           # Node.js 依赖包
├── public/                 # 存放前端静态资源 (CSS, 客户端JS)
│   ├── css/
│   │   └── styles.css      # 全局样式表
│   └── js/
│       ├── user.js         # 用户端前端逻辑 (已移除API密钥)
│       └── provider.js     # 物流供应商端前端逻辑
├── routes/                 # API 路由定义模块
│   ├── ordersRoutes.js     # 订单相关API路由
│   ├── quotesRoutes.js     # 报价相关API路由
│   ├── providersRoutes.js  # 物流公司相关API路由
│   ├── exportRoutes.js     # 新增: Excel导出路由
│   └── aiRoutes.js         # 新增: AI服务API路由
├── views/                  # 存放 HTML 视图文件
│   ├── home.html           # 应用首页 (提示联系管理员)
│   ├── index.html          # 用户端主操作界面
│   ├── login_user.html     # 用户端密码认证页面
│   └── provider.html       # 物流供应商端操作界面 (已修复xlsx引用)
├── package.json            # 项目依赖和脚本配置 (已更新依赖)
├── package-lock.json       # 精确依赖版本锁定
└── README.md               # 项目说明文件 (本文件)
```

## 安装与运行

### 🐳 Docker 部署（推荐）

**快速开始**：
```bash
git clone https://github.com/c1767673917/wlbj.git
cd wlbj
git checkout docker-version
cp .env.docker.example .env
# 编辑 .env 文件设置 SILICONFLOW_API_KEY
./docker-deploy.sh
```

详细说明请参考：[Docker 部署指南](README-Docker.md) | [快速开始](DOCKER-QUICKSTART.md)

### 📦 传统部署

#### 前提条件

- [Node.js](https://nodejs.org/) (建议使用 LTS 版本)
- npm (通常随 Node.js 一起安装)

#### 安装步骤

1. 克隆或下载本项目代码。
2. 打开终端，进入项目根目录下的 `wlbj` 文件夹：

   ```bash
   cd path/to/your/project/wlbj
   ```
3. 安装项目依赖：

   ```bash
   npm install
   ```

   **注意**: 项目已完成安全依赖升级，`npm audit` 显示0个安全漏洞。

### 首次运行与配置

#### 1. 配置环境变量

在 `wlbj/` 目录下创建 `.env` 文件：

```env
# SiliconFlow AI API配置
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
SILICONFLOW_API_URL=https://api.siliconflow.cn/v1/chat/completions

# 应用配置
NODE_ENV=production
PORT=3000

# 数据库配置
DB_PATH=./data/logistics.db

# 日志配置
LOG_LEVEL=info
LOG_DIR=./logs
```

**重要**: 请将 `your_siliconflow_api_key_here` 替换为您的真实 SiliconFlow API 密钥。

#### 2. 配置用户访问密码

在 `wlbj/` 目录下手动创建 `auth_config.json` 文件：

```json
{
  "password": "your_secure_password_here"
}
```

**安全提示**: 请务必设置一个强密码并妥善保管。

#### 3. 自动创建的文件

- `ip_whitelist.json` 和 `logs/` 目录会在应用首次运行时自动创建。

### 运行服务

1. 在 `wlbj` 目录下，启动应用服务器：
   ```bash
   node app.js
   ```
2. 服务器启动后，默认在 `http://localhost:3000` 上运行。
3. 访问地址：
   - 应用主页: `http://localhost:3000/`
   - 用户端: `http://localhost:3000/user` (首次访问需要密码认证)
   - 物流供应商端: 通过用户端生成的专属链接访问

## 身份认证 (用户端 `/user`)

为了增强用户端的访问安全性，同时为内部用户提供便利，系统采用了 IP 白名单结合密码的认证方式：

- **主密码**: 在 `wlbj/auth_config.json` 文件中配置。此密码用于首次认证来自新 IP 地址的访问请求。
- **IP 白名单**:
  - 存储在 `wlbj/ip_whitelist.json` 文件中。
  - 当一个 IP 地址的用户通过主密码成功认证后，该 IP 地址会被自动添加到白名单中。
  - 后续来自白名单中 IP 地址的访问将无需再次输入密码，可直接进入用户端。
- **密码变更与白名单失效**:
  - 如果 `auth_config.json` 中的主密码被修改，整个 IP 白名单将自动失效。
  - 所有 IP 都需要使用新的主密码重新进行认证。

## 日志记录

系统集成了完善的日志记录功能：

- **HTTP 请求日志**: 使用 `morgan` 记录所有传入的 HTTP 请求
- **应用级日志**: 使用 `winston` 进行结构化日志记录
- **日志输出**:
  - **控制台**: 实时输出到控制台，方便开发和调试
  - **文件**:
    - `wlbj/logs/app.log`: 记录所有应用日志和HTTP请求日志
    - `wlbj/logs/error.log`: 专门记录错误级别的日志
- **日志轮替**: 配置了基于大小的自动轮替功能
- **配置**: 详细配置位于 `wlbj/config/logger.js`

## 数据库

- **数据库类型**: SQLite
- **数据库文件**: `wlbj/data/logistics.db`
- **主要数据表**:
  - `orders`: 存储物流订单信息
  - `quotes`: 存储物流供应商的报价信息
  - `providers`: 存储物流公司的信息

## API 端点

### 订单相关

- `POST /api/orders`: 创建新订单
- `GET /api/orders`: 获取订单列表 (支持按状态和分页)
- `PUT /api/orders/:id`: 更新指定订单
- `PUT /api/orders/:id/close`: 关闭指定订单
- `GET /api/orders/available`: (物流端) 获取可报价订单
- `GET /api/orders/:id/quotes`: 获取指定订单的所有报价

### 报价相关

- `POST /api/quotes`: 提交新报价 (物流端)
- `GET /api/quotes`: 获取报价列表 (物流端)

### 物流公司相关

- `POST /api/providers`: (用户端) 添加新的物流公司
- `GET /api/providers`: (用户端) 获取物流公司列表
- `GET /api/provider-details`: (物流端) 获取物流公司信息

### 导出功能 **新增**

- `GET /api/export/orders/active`: 导出活跃订单
- `GET /api/export/orders/closed`: 导出历史订单
- `GET /api/export/provider/available-orders`: 导出可报价订单 (供应商端)
- `GET /api/export/provider/quote-history`: 导出报价历史 (供应商端)

### AI 服务 **新增**

- `POST /api/ai/recognize-order`: AI 识别订单信息

## 安全性

### 已修复的安全问题

1. **依赖漏洞**: 移除 `xlsx@0.18.5` 高危漏洞，升级至 `exceljs`
2. **API密钥泄露**: 移除前端硬编码密钥，改为后端环境变量管理
3. **SQL注入防护**: 使用参数化查询防止SQL注入
4. **访问控制**: 用户端IP白名单机制，供应商端accessKey机制

### 安全最佳实践

- 所有敏感配置使用环境变量管理
- API密钥等敏感信息后端处理
- 定期运行 `npm audit` 检查依赖安全
- 强密码策略和访问控制

## 错误修复历史

### v1.0.0 修复记录

1. **SQL聚合函数错误** - 修复订单查询中的嵌套聚合函数问题
2. **Excel库404错误** - 移除对已卸载xlsx库的引用
3. **环境变量缺失** - 添加完整的.env配置支持
4. **中文文件名编码** - 修复Excel导出中文文件名显示问题

## 注意事项

### 安全相关

- **环境变量**: `.env` 文件包含敏感信息，切勿提交到公共代码仓库
- **密码安全**: `auth_config.json` 中的密码至关重要，请设置强密码
- **API密钥**: SiliconFlow API密钥应保密，仅在后端使用

### 部署相关

- **反向代理**: 如部署在反向代理后，请正确配置 `trust proxy`
- **环境配置**: 生产环境请确保所有环境变量正确配置
- **依赖安全**: 定期运行 `npm audit` 检查安全漏洞

### 性能相关

- **SQLite 并发**: 适合小型应用，大型应用建议升级到PostgreSQL/MySQL
- **文件上传**: Excel导出功能消耗内存，建议监控服务器资源

## 技术支持

如遇到问题，请检查：

1. 所有环境变量是否正确配置
2. `npm audit` 是否显示0个安全漏洞
3. 日志文件 `logs/error.log` 中的错误信息
4. 服务器端口是否被占用

---

**版本**: v1.0.0
**状态**: 生产就绪
**安全等级**: 0 漏洞
**最后更新**: 2025年5月
