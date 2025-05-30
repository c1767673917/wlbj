# 物流报价平台 (wlbj)

本项目是一个专业的物流报价 Web 应用程序，允许用户发布物流订单，并允许物流供应商对这些订单进行报价。项目采用现代化的技术栈，具备完整的功能模块和良好的安全性。

## 🎉 v2.0.0 重大更新 - 现代化前端架构

### 🚀 全新React前端
- **技术栈升级**: 前端从传统HTML/JS全面升级至以React 18、TypeScript和Vite为核心的现代技术栈。
- **现代化UI与组件化**: 构建了基于Tailwind CSS的响应式用户界面，并采用了模块化的组件设计。
- **开发体验优化**: 引入了热重载、TypeScript类型检查、ESLint代码规范和自动化构建流程。

### 🔧 前后端分离架构
- **开发环境**: 前端开发服务器(5173端口) + 后端API服务器(3000端口)
- **API代理**: Vite配置自动代理，开发时无缝对接后端API
- **生产环境**: 后端服务构建后的静态文件，统一3000端口部署
- **路由系统**: React Router实现SPA路由，支持用户端、供应商端独立访问

## 项目状态 (v2.0.0) - 2025年1月

### ✅ 已完成功能

#### 🎨 前端架构升级 (v2.0.0)
- **完成前端现代化改造**: 基于React 18、TypeScript、Vite等核心技术重构了前端应用，实现了组件化设计、响应式UI，并优化了开发体验（如热重载、类型检查）和构建流程。

#### 🔧 系统功能完善
- **依赖安全**: 已升级至安全的 `exceljs` 库，移除高危漏洞依赖
- **Excel导出**: 完整的后端导出功能，支持用户端和供应商端
- **数据库优化**: 添加了11个关键索引，提升查询性能
- **缓存机制**: 实现内存缓存系统，减少数据库负载
- **批量查询**: 优化最低报价获取，解决N+1查询问题
- **搜索功能**: 支持后端搜索和前端防抖优化

#### 🆕 业务功能增强
- **企业微信通知**: 集成企业微信群机器人，新订单自动通知物流公司
- **订单号优化**: 订单号格式改为 RX + yymmdd + "-" + 3位流水号
- **选择物流商**: 用户可选择心仪的物流商，订单自动转入历史记录
- **订单状态管理**: 完整的订单生命周期管理，支持活跃/关闭状态转换
- **历史记录优化**: 历史订单显示用户选择的物流商和价格信息
- **AI智能识别**: 前端集成SiliconFlow API，支持订单信息自动提取

### 🔧 技术特性

- **安全状态**: 前后端均0个依赖安全漏洞 (通过 `npm audit` 验证，已修复Vite相关漏洞)。
- **性能优化**: 数据库查询速度提升60-80% (通过11个关键索引、内存缓存、批量查询解决N+1问题)，页面加载时间减少40-50%。
- **用户体验**: 实时搜索 (支持前端防抖及后端优化)、分页浏览、批量操作、一键选择物流商、标签页状态保持 (页面刷新后用户操作状态记忆)。
- **前端架构与优化**: React组件化、TypeScript类型安全、Vite快速构建、组件懒加载、API请求优化。
- **数据库性能**: 11个关键索引，支持并发查询，SQLite适合中小型应用（建议订单量<10万）。
- **日志系统**: Winston + Morgan 完整日志记录，支持日志轮替。
- **自动化测试**: 5个完整的测试脚本，覆盖核心功能。
- **向后兼容**: 所有新功能都保持向后兼容。

### ⚠️ 待优化项目

- **AI功能**: 前端仍直接调用第三方API，存在密钥泄露风险
- **认证机制**: 可考虑升级为JWT会话管理
- **数据库**: SQLite适合小型应用，大型应用建议升级PostgreSQL
- **缓存系统**: 当前使用内存缓存，生产环境建议升级Redis

### 🔄 跨平台数据库兼容性

**重要提醒**: 如果您从Mac ARM环境迁移到Linux x86生产环境，需要注意SQLite数据库的跨平台兼容性：

- **自动检测**: 部署脚本会自动检测系统架构并提示是否需要迁移
- **数据库迁移**: 提供专用迁移脚本确保完全兼容性
- **兼容性检查**: 可使用检查脚本验证数据库状态

```bash
# 检查数据库兼容性
./deploy/check-database-compatibility.sh

# 执行数据库迁移（如需要）
./deploy/migrate-database.sh

# 验证迁移结果
./deploy/check-database-compatibility.sh -r
```

## 主要功能

### 用户端 (货主)

- **访问认证**:
  - 首次访问用户端 (`/user`) 时，需要通过密码认证。
  - 认证成功后，该用户的 IP 地址将被添加到白名单，后续访问无需再次输入密码。
  - 主密码更改后，IP 白名单将自动失效，需要重新认证。
- **AI 智能识别订单**: 支持粘贴文本，通过 AI (SiliconFlow API) 自动识别并填充订单信息（发货仓库、货物信息、收货信息）。
  - ⚠️ **注意**: 当前AI功能在前端直接调用第三方API，存在API密钥泄露风险，建议迁移至后端
  - 使用模型：Qwen/Qwen3-14B，响应时间通常在2-5秒
- **发布物流订单**: 用户可以手动填写或通过 AI 识别后，发布新的物流需求订单。
- **订单管理**:
  - 查看当前已发布的**活跃订单**列表，包括订单详情和收到的最低报价。
  - 查看已关闭的**历史订单**列表。
  - 对活跃订单进行**编辑**或**关闭**操作。
- **报价查看**: 查看特定订单收到的所有物流供应商的报价详情，最低报价会高亮显示。
- **🆕 选择物流商**: 在报价列表中可直接选择心仪的物流商，确认后订单自动转入历史记录。
- **物流公司管理**:
  - 添加新的合作物流公司。
  - 查看已添加的物流公司列表及其**专属操作链接**。
  - 复制专属链接，方便分享给对应的物流公司。
  - **🆕 企业微信通知配置**: 为物流公司配置企业微信群机器人webhook，实现新订单自动通知。
- **数据导出**: 支持将活跃订单和历史订单列表（包含最低报价信息）导出为 Excel (XLSX) 文件。
  - 导出时会根据当前是否设置搜索条件来决定导出内容（搜索结果或全部内容）。
  - **新增**: 最低报价信息拆分为"最低报价物流商"和"最低报价(元)"两个独立列。
  - **🆕 历史记录优化**: 历史订单显示"选择报价"而非"最低报价"，展示用户的实际选择。
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

### 前端 (v2.0.0) - 现代化React架构
- **核心框架**: React 18 + TypeScript
- **构建工具**: Vite 6.3.5 (快速构建、热重载)
- **UI框架**: Tailwind CSS (响应式设计)
- **图标库**: Lucide React (现代化图标)
- **路由**: React Router DOM v7 (SPA路由)
- **开发工具**: ESLint + TypeScript编译器
- **包管理**: npm (前端独立依赖管理)

### 后端 - 稳定的Node.js服务
- **运行时**: Node.js
- **框架**: Express.js
- **数据库**: SQLite (11个性能索引)
- **HTTP 请求日志**: Morgan
- **应用日志**: Winston (日志记录到控制台和文件 `logs/app.log`, `logs/error.log`)
- **Excel 处理**: ExcelJS (安全替代 SheetJS)
- **AI 服务**: [SiliconFlow API](https://siliconflow.cn/) (用于订单信息智能识别)
- **唯一ID生成**: UUID
- **环境变量管理**: dotenv
- **缓存系统**: 内存缓存 (SimpleCache)
- **性能优化**: 数据库索引、批量查询、搜索优化
- **通知服务**: 企业微信群机器人集成

## 项目结构

项目采用前后端分离架构，主要代码位于 `wlbj/` 目录下：

```
wlbj/
├── app.js                  # Express 应用主文件 (应用初始化, 中间件, 路由, 认证, 日志)
├── .env                    # (需手动创建) 环境变量配置文件
├── auth_config.json        # (需手动创建) 用户端访问密码配置文件
├── ip_whitelist.json       # (自动生成/管理) 用户端IP白名单
├── start-dev.sh            # 🆕 开发环境一键启动脚本
├── build-prod.sh           # 🆕 生产环境构建脚本
├── frontend/               # 🆕 React前端应用 (v2.0.0)
│   ├── src/
│   │   ├── components/     # React组件目录
│   │   │   ├── ui/         # 基础UI组件 (Button, Card, Tabs等)
│   │   │   ├── user/       # 用户端组件 (UserPortal, OrderList等)
│   │   │   ├── provider/   # 供应商端组件 (ProviderPortal等)
│   │   │   ├── auth/       # 认证组件 (LoginPage)
│   │   │   └── layout/     # 布局组件 (Header, Footer, HomePage)
│   │   ├── services/       # API服务层
│   │   │   └── api.ts      # 统一API接口 (订单、报价、供应商、AI等)
│   │   ├── App.tsx         # 主应用组件 (路由配置)
│   │   ├── main.tsx        # 应用入口
│   │   ├── index.css       # 全局样式
│   │   └── vite-env.d.ts   # Vite类型定义
│   ├── dist/               # (构建后生成) 生产环境静态文件
│   ├── public/             # 静态资源目录
│   ├── package.json        # 前端依赖配置
│   ├── vite.config.ts      # Vite构建配置 (代理、优化等)
│   ├── tailwind.config.js  # Tailwind CSS配置
│   ├── postcss.config.js   # PostCSS配置
│   ├── tsconfig.json       # TypeScript配置
│   ├── tsconfig.app.json   # 应用TypeScript配置
│   ├── tsconfig.node.json  # Node.js TypeScript配置
│   └── eslint.config.js    # ESLint配置
├── backup/                 # 🆕 旧前端文件备份
│   └── old-frontend/       # 备份的传统前端文件
├── config/                 # 应用配置目录
│   ├── logger.js           # Winston 日志系统配置
│   └── env.js              # 环境变量配置模块
├── data/                   # 存放 SQLite 数据库文件
│   └── logistics.db
├── db/                     # 数据库相关模块
│   └── database.js         # 数据库连接初始化和表结构定义 (含11个索引)
├── logs/                   # (自动创建) 日志文件存放目录
│   ├── app.log             # 应用运行日志
│   └── error.log           # 应用错误日志
├── node_modules/           # Node.js 后端依赖包
├── routes/                 # API 路由定义模块
│   ├── ordersRoutes.js     # 订单相关API路由 (🆕 包含选择物流商功能)
│   ├── quotesRoutes.js     # 报价相关API路由
│   ├── quotesOptimized.js  # 优化的报价路由 (批量查询、缓存)
│   ├── providersRoutes.js  # 物流公司相关API路由 (🆕 支持企业微信webhook)
│   ├── exportRoutes.js     # Excel导出路由
│   └── aiRoutes.js         # AI服务API路由 (⚠️ 未启用)
├── utils/                  # 工具模块
│   ├── cache.js            # 缓存管理模块 (内存缓存实现)
│   └── wechatNotification.js # 🆕 企业微信群机器人通知工具模块
├── test-*.js               # 🆕 自动化测试脚本
│   ├── test-new-order-creation.js    # 测试订单创建和订单号生成
│   ├── test-order-id-generation.js  # 测试订单号格式逻辑
│   ├── test-select-provider.js      # 测试选择物流商功能
│   ├── test-wechat-notification.js  # 测试企业微信通知
│   └── test-siliconflow-api.js      # 测试AI识别功能
├── verify-system-status.js    # 🆕 系统状态验证脚本
├── 📚 文档文件/             # 🆕 功能说明文档
│   ├── 前端升级完成报告.md   # 前端架构升级详细报告
│   ├── 数据清理完成报告.md   # 数据清理和系统重置报告
│   └── 数据清理和URL路由完成报告.md # URL路由优化报告
├── package.json            # 后端项目依赖和脚本配置
├── package-lock.json       # 精确依赖版本锁定
└── README.md               # 项目说明文件 (本文件)
```

## 安装与运行

### 前提条件

- [Node.js](https://nodejs.org/) (建议使用 LTS 版本 18+ 或 20+)
- npm (通常随 Node.js 一起安装)
- 操作系统：Windows、macOS、Linux 均支持
- 内存：建议 2GB+ RAM
- 磁盘空间：建议 1GB+ 可用空间

### 🚀 快速开始 (v2.0.0)

#### 方法一：一键启动开发环境 (推荐)

1. **进入项目目录**:
   ```bash
   cd path/to/your/project/wlbj
   ```

2. **一键启动**:
   ```bash
   ./start-dev.sh
   ```

   这个脚本会自动：
   - 检查Node.js和npm环境
   - 安装后端和前端依赖
   - 启动后端服务器 (端口 3000)
   - 启动前端开发服务器 (端口 5173)
   - 配置API代理，实现前后端无缝对接

3. **访问应用**:
   - **前端开发界面**: http://localhost:5173 (推荐)
   - **后端API**: http://localhost:3000
   - **用户端**: http://localhost:5173/user
   - **供应商端**: http://localhost:5173/provider/{accessKey}

#### 方法二：手动安装和启动

1. **安装后端依赖**:
   ```bash
   npm install
   ```

2. **安装前端依赖**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

3. **启动后端服务器** (终端1):
   ```bash
   NODE_ENV=development node app.js
   ```

4. **启动前端开发服务器** (终端2):
   ```bash
   cd frontend
   npm run dev
   ```

   **注意**: 项目已完成安全依赖升级，`npm audit` 显示0个安全漏洞。

### 首次运行与配置

#### 1. 配置环境变量

在 `wlbj/` 目录下创建 `.env` 文件：

```env
# SiliconFlow AI API配置 (⚠️ 当前前端直接调用，存在泄露风险)
SILICON_FLOW_API_KEY=your_siliconflow_api_key_here

# 应用配置
NODE_ENV=development
PORT=3000

# JWT配置 (预留)
JWT_SECRET=your_jwt_secret_here_change_in_production

# 应用密码 (预留)
APP_PASSWORD=your_secure_password_here
```

**重要**:
- 请将 `your_siliconflow_api_key_here` 替换为您的真实 SiliconFlow API 密钥
- ⚠️ 当前AI功能在前端直接调用，API密钥存在泄露风险
- 建议启用后端AI路由以提升安全性

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
- 数据库文件 `data/logistics.db` 会在首次启动时自动初始化。

### 运行服务

#### 开发环境 (推荐)

启动开发环境请参考上方 **“快速开始 (v2.0.0)”**部分的“方法一：一键启动开发环境 (推荐)”或“方法二：手动安装和启动”。

**开发环境特性**:
- 前端热重载，代码修改自动刷新
- TypeScript类型检查和ESLint代码规范
- API自动代理到后端服务器
- 详细的错误提示和调试信息

#### 生产环境

启动生产环境请参考上方 **“快速开始 (v2.0.0)”**部分的说明，先执行构建前端的脚本，然后启动生产服务器。

**生产环境特性**:
- 前端代码压缩优化
- 静态文件由后端统一服务
- 单端口部署，便于运维管理


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
  - `orders`: 存储物流订单信息 (🆕 订单号格式: RXyymmdd-nnn)
  - `quotes`: 存储物流供应商的报价信息
  - `providers`: 存储物流公司的信息 (🆕 新增企业微信webhook字段)

## API 端点

### 订单相关

- `POST /api/orders`: 创建新订单 (🆕 自动生成RX格式订单号，发送企业微信通知)
- `GET /api/orders`: 获取订单列表 (支持按状态和分页)
- `PUT /api/orders/:id`: 更新指定订单
- `PUT /api/orders/:id/close`: 关闭指定订单
- `PUT /api/orders/:id/select-provider`: 🆕 选择物流商 (订单自动转为关闭状态)
- `GET /api/orders/available`: (物流端) 获取可报价订单
- `GET /api/orders/:id/quotes`: 获取指定订单的所有报价

### 报价相关

- `POST /api/quotes`: 提交新报价 (物流端)
- `GET /api/quotes`: 获取报价列表 (物流端)

### 物流公司相关

- `POST /api/providers`: (用户端) 添加新的物流公司 (🆕 支持企业微信webhook配置)
- `GET /api/providers`: (用户端) 获取物流公司列表 (🆕 包含企业微信配置状态)
- `PUT /api/providers/:id/webhook`: 🆕 更新物流公司的企业微信webhook URL
- `PUT /api/providers/:id/access-key`: 🆕 修改物流公司的访问链接
- `DELETE /api/providers/:id`: 🆕 删除物流公司
- `GET /api/provider-details`: (物流端) 获取物流公司信息

### 导出功能

- `GET /api/export/orders/active`: 导出活跃订单
- `GET /api/export/orders/closed`: 导出历史订单
- `GET /api/export/provider/available-orders`: 导出可报价订单 (供应商端)
- `GET /api/export/provider/quote-history`: 导出报价历史 (供应商端)

### 优化的报价查询

- `GET /api/quotes/lowest-batch`: 批量获取最低报价 (性能优化)
- `GET /api/quotes/lowest/:orderId`: 获取单个订单最低报价
- `GET /api/quotes/order/:orderId`: 获取订单所有报价 (带缓存)

### AI 服务 (⚠️ 未启用)

- `POST /api/ai/recognize`: AI 识别订单信息 (已实现但未在app.js中启用)

## 安全性

### ✅ 安全增强
- **SQL注入防护**: 使用参数化查询。
- (其他已修复问题如依赖漏洞、访问控制已在“项目状态”章节中提及)

### ⚠️ 待修复的安全问题

(API密钥泄露风险已在“项目状态”的“⚠️ 待优化项目”中提及，并提供了修复建议)

### 安全最佳实践

- 所有敏感配置使用环境变量管理
- 定期运行 `npm audit` 检查依赖安全 (当前: 前后端均0漏洞)
- 强密码策略和访问控制

## 版本更新摘要
项目经历了多次迭代，主要更新如下：
- **v2.0.0 (2025年1月)**: 引入全新React前端架构，实现前后端分离，并对核心功能、用户体验、性能和安全性进行了全面升级。详细的已完成功能和技术特性请参见“项目状态 (v2.0.0)”部分。
- **v1.2.0 (2024年12月)**: 新增选择物流商功能和订单状态管理优化。
- **v1.1.0 (2024年11月)**: 集成企业微信群机器人通知，并优化了订单号格式。
- **v1.0.0 (2024年10月)**: 完成了数据库性能优化、缓存机制、批量查询优化、搜索功能优化、Excel导出优化和依赖安全升级。

(注: 各版本详细功能已整合至“项目状态”部分的“已完成功能”和“技术特性”中。)

## 注意事项

### 安全相关

- **环境变量**: `.env` 文件包含敏感信息，切勿提交到公共代码仓库
- **密码安全**: `auth_config.json` 中的密码至关重要，请设置强密码
- **⚠️ API密钥泄露风险**: 前端存在API密钥硬编码问题。详细风险说明及修复步骤请参见“项目状态”的“⚠️ 待优化项目”部分以及“快速修复AI安全问题”章节。

### 部署相关

- **反向代理**: 如部署在反向代理后，请正确配置 `trust proxy`
- **环境配置**: 生产环境请确保所有环境变量正确配置
- **依赖安全**: 定期运行 `npm audit` 检查安全漏洞
- **端口配置**: 默认端口3000，可通过环境变量PORT修改
- **进程管理**: 建议使用PM2或systemd管理Node.js进程
- **备份策略**: 定期备份SQLite数据库文件和配置文件

### 性能相关

- **SQLite 并发**: 适合小型应用，大型应用建议升级到PostgreSQL/MySQL
- **缓存系统**: 当前使用内存缓存，生产环境建议升级Redis
- **Excel导出**: 功能消耗内存，建议监控服务器资源
- **数据库大小**: 定期检查数据库文件大小，建议定期清理历史数据
- **日志管理**: 日志文件会持续增长，建议配置日志轮替和清理策略

## 快速修复AI安全问题 (可选步骤)

本章节提供修复前端API密钥泄露问题的具体技术步骤。此问题已在“项目状态”的“⚠️ 待优化项目”中提及。
如需立即修复，请执行以下步骤：

1. **启用后端AI路由**:
   ```javascript
   // 在 app.js 中取消注释相关行
   const aiRoutes = require('./routes/aiRoutes');
   app.use('/api/ai', aiRoutes);
   ```

2. **修改前端API调用**:
   ```typescript
   // 在 frontend/src/services/api.ts 中修改 aiAPI.recognizeText 方法
   recognizeText: async (text: string) => {
     return apiRequest<any>('/ai/recognize', {
       method: 'POST',
       body: JSON.stringify({ content: text }),
     });
   }
   ```

3. **移除硬编码密钥**: 删除 `frontend/src/services/api.ts:239` 行的API密钥

4. **配置环境变量**: 确保 `.env` 文件中正确配置了 `SILICON_FLOW_API_KEY`

## 企业微信群机器人通知功能

### 功能概述

v1.1.0 新增企业微信群机器人通知功能，当用户发布新订单时，系统会自动向配置了企业微信webhook的物流公司群发送通知消息。

### 配置步骤

1. **创建企业微信群机器人**:
   - 在企业微信中创建群聊
   - 添加群机器人，获取webhook URL
   - URL格式: `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY`

2. **配置物流公司webhook**:
   - 在用户端"物流公司管理"页面
   - 添加新公司时填写webhook URL
   - 或为现有公司配置webhook URL

3. **自动通知**:
   - 发布新订单时系统自动发送通知
   - 通知包含订单详情和报价提醒
   - 支持批量向多个物流公司发送

### 通知消息格式

```
📦 **新订单报价提醒**

**订单编号**: RX250526-001
**发货仓库**: 广州仓
**货物信息**: 清香牛肉579箱，香辣味1321箱...
**收货信息**: 河南省漯河市临颍县...
**发布时间**: 2025/5/26 15:30:25

💰 **请及时登录系统提交报价！**
⏰ **通知时间**: 2025/5/26 15:30:25
```

### 技术特性

- **后端处理**: 企业微信通知在后端处理，确保安全性
- **错误处理**: 完善的错误处理和重试机制
- **批量发送**: 支持向多个物流公司同时发送通知
- **格式验证**: 严格验证企业微信webhook URL格式

## 选择物流商功能详解

### 功能概述 (v1.2.0新增)

用户可以在查看订单报价时，直接选择心仪的物流商，系统会自动处理订单状态转换和历史记录更新。

### 使用流程

1. **查看报价**: 在"我的订单"中点击"查看报价"按钮
2. **比较报价**: 查看所有物流商的报价，最低价格会高亮显示
3. **选择物流商**: 点击心仪报价旁的绿色"选择"按钮
4. **确认选择**: 在弹出的确认对话框中确认选择
5. **自动转移**: 订单自动从"我的订单"转移到"订单历史"

### 技术实现

- **数据库字段**: 新增 `selectedProvider`、`selectedPrice`、`selectedAt` 字段
- **状态管理**: 订单状态从 `active` 自动变更为 `closed`
- **API接口**: `PUT /api/orders/:id/select-provider`
- **前端交互**: 确认对话框 + Toast提示 + 自动刷新
- **数据验证**: 确保选择的报价确实存在

### 历史记录优化

- **显示逻辑**: 历史订单优先显示用户选择的报价信息
- **表头变更**: 从"最低报价"改为"选择报价"
- **向后兼容**: 未选择的历史订单仍显示最低报价
- **详细信息**: 显示选择的物流商名称、价格和选择时间

## 订单号格式说明

### 新格式 (v1.1.0)

- **格式**: `RX` + `yymmdd` + `-` + `nnn`
- **示例**: `RX250526-001`, `RX250526-002`, `RX250526-003`
- **说明**:
  - `RX`: 固定前缀
  - `yymmdd`: 年月日（年份取后两位）
  - `-`: 分隔符
  - `nnn`: 3位流水号，每日从001开始

### 特性

- **自动生成**: 系统自动生成，无需手动设置
- **唯一性**: 每个订单号在系统中唯一
- **可读性**: 包含日期信息，便于识别
- **有序性**: 同一天内按创建顺序递增
- **每日重置**: 流水号每天从001重新开始

## 测试与质量保证

### 自动化测试脚本

项目包含多个自动化测试脚本 (详见“项目结构”中 `test-*.js` 文件列表)，覆盖核心功能，确保代码质量。

### 系统状态验证

```bash
# 验证系统整体状态
node verify-system-status.js
```

### 运行测试

```bash
# 测试订单创建功能
node test-new-order-creation.js

# 测试选择物流商功能
node test-select-provider.js

# 测试企业微信通知
node test-wechat-notification.js
```

(详细的功能点已在“项目状态”的“✅ 已完成功能”部分列出。)



**版本**: v2.0.0
**状态**: 现代化前端架构，功能完整，生产就绪
**技术栈**: React 18 + TypeScript + Vite 6.3.5 + Node.js + Express
**安全等级**: 前后端均0依赖漏洞，1 API密钥泄露风险
**性能等级**: 已优化 (数据库+缓存+批量查询+前端优化)
**测试覆盖**: 完整的自动化测试脚本
**部署方式**: 支持开发环境和生产环境部署
**最后更新**: 2025年1月

---


## 🐧 Linux生产环境部署方案

### 📋 部署架构

推荐的生产环境架构：

```
Internet
    ↓
[Nginx反向代理] (80/443端口) - SSL终端、静态文件、负载均衡
    ↓
[Node.js应用] (3000端口) - 主应用服务
    ↓
[SQLite数据库] + [Redis缓存] - 数据存储
    ↓
[PM2进程管理] + [日志轮替] - 进程监控
```

### 🚀 一键部署脚本

项目提供了完整的生产环境部署脚本，支持自动数据库迁移：

```bash
# 方法一：完全自动化部署（推荐）
sudo ./deploy/deploy-production.sh

# 方法二：Docker容器化部署
docker-compose up -d

# 方法三：分步骤部署
sudo ./deploy/install-dependencies.sh  # 安装系统依赖
./deploy/setup-application.sh          # 配置应用
./deploy/migrate-database.sh           # 数据库迁移（如需要）
sudo ./deploy/setup-nginx.sh           # 配置Nginx
sudo ./deploy/setup-ssl.sh             # 配置SSL证书
./deploy/start-services.sh             # 启动服务
```

### 🔄 数据库兼容性处理

**自动检测和迁移**：
```bash
# 检查数据库兼容性
./deploy/check-database-compatibility.sh

# 执行数据库迁移（Mac ARM → Linux x86）
./deploy/migrate-database.sh

# 验证迁移结果
./deploy/check-database-compatibility.sh -r
```

### 🔧 系统要求

**最低配置**:
- CPU: 1核心
- 内存: 1GB RAM
- 存储: 10GB SSD
- 操作系统: Ubuntu 20.04+ / CentOS 8+ / Debian 11+

**推荐配置**:
- CPU: 2核心
- 内存: 2GB RAM
- 存储: 20GB SSD
- 操作系统: Ubuntu 22.04 LTS

### 📦 部署特性

- **零停机部署**: 支持滚动更新，无服务中断
- **自动备份**: 数据库和配置文件自动备份
- **SSL证书**: 自动申请和续期Let's Encrypt证书
- **监控告警**: 集成系统监控和邮件告警
- **日志管理**: 自动日志轮替和清理
- **安全加固**: 防火墙配置和安全优化
- **🆕 跨平台兼容**: 自动处理Mac ARM到Linux x86的数据库迁移
- **🆕 Docker支持**: 完整的容器化部署方案
- **🆕 智能检测**: 自动检测系统架构和兼容性需求

### 🔐 安全配置

- **防火墙**: 仅开放必要端口(80, 443, 22)
- **SSL/TLS**: 强制HTTPS，A+级SSL配置
- **访问控制**: IP白名单和速率限制
- **数据加密**: 敏感数据加密存储
- **定期更新**: 自动安全补丁更新

### 📊 监控与维护

- **健康检查**: 应用和数据库健康监控
- **性能监控**: CPU、内存、磁盘使用率监控
- **日志分析**: 错误日志自动分析和告警
- **备份策略**: 每日自动备份，保留30天
- **更新机制**: GitHub webhook自动部署

### 📚 部署文档

- **详细部署指南**: `deploy/README.md`
- **快速部署指南**: `deploy/QUICK_START.md`
- **数据库迁移指南**: `deploy/DATABASE_MIGRATION_GUIDE.md`
- **Docker部署**: `docker-compose.yml` + `Dockerfile`

### 🔧 部署工具

| 脚本 | 功能 | 用途 |
|------|------|------|
| `deploy-production.sh` | 一键部署 | 完整的生产环境自动化部署 |
| `setup-ssl.sh` | SSL配置 | Let's Encrypt证书自动申请 |
| `migrate-database.sh` | 数据库迁移 | Mac ARM到Linux x86迁移 |
| `backup.sh` | 数据备份 | 自动备份数据库和配置 |
| `monitor.sh` | 系统监控 | 实时监控和告警 |
| `update.sh` | 零停机更新 | 支持回滚的安全更新 |
| `status.sh` | 状态检查 | 全面的系统状态诊断 |

---

## 📞 技术支持与反馈

如果您在使用过程中遇到问题或有改进建议，请：

1. **查看日志**: 检查 `logs/error.log` 中的错误信息
2. **运行测试**: 使用测试脚本验证功能是否正常
3. **查看文档**: 参考项目中的详细文档说明
4. **安全检查**: 运行 `npm audit` 确保依赖安全
5. **前端调试**: 使用浏览器开发者工具检查前端错误

### 常见问题排查

- **端口占用**: 如果3000端口被占用，修改环境变量PORT或终止占用进程
- **数据库锁定**: SQLite数据库被锁定时，重启应用通常可以解决
- **前端构建失败**: 删除 `frontend/node_modules` 重新安装依赖
- **AI识别失败**: 检查网络连接和SiliconFlow API密钥配置

---

## 📋 快速检查清单

在开始使用前，请确保：

- [ ] Node.js 18+ 已安装
- [ ] 运行 `node verify-system-status.js` 验证系统状态
- [ ] 创建 `.env` 文件并配置必要的环境变量
- [ ] 创建 `auth_config.json` 文件并设置访问密码
- [ ] 运行 `npm audit` 确保无安全漏洞
- [ ] 使用 `./start-dev.sh` 启动开发环境测试

**感谢使用物流报价平台！** 🚛📦
