# 物流报价平台

本项目是一个简单的物流报价 Web 应用程序，允许用户发布物流订单，并允许物流供应商对这些订单进行报价。

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
- **标签页状态保持**: 刷新页面后，保持在用户上次查看的标签页。
- **搜索与分页**: 支持对订单列表进行搜索和分页浏览。

### 物流供应商端
- **专属链接访问**: 每个物流公司通过用户端生成的唯一专属链接访问其操作界面，无需注册或登录。
- **查看可报价订单**: 自动显示当前所有状态为"活跃"且该物流商尚未报价的订单列表。
- **提交报价**: 对可报价的订单提交价格和预计送达时间。
- **查看我的报价**: 查看自己已提交的所有报价历史。
- **搜索与分页**: 可报价订单和报价历史均支持分页显示和条件搜索。
- **数据导出**: 支持将可报价订单列表和我的报价历史列表导出为 Excel (XLSX) 文件。
    - 导出时会根据当前是否设置搜索条件来决定导出内容（搜索结果或全部内容）。

## 技术栈

- **后端**: Node.js, Express.js
- **数据库**: SQLite
- **前端**: HTML5, CSS3, JavaScript (原生)
- **HTTP 请求日志**: Morgan
- **应用日志**: Winston (日志记录到控制台和文件 `logs/app.log`, `logs/error.log`)
- **Excel 处理**: [SheetJS (xlsx)](https://sheetjs.com/) (通过静态服务提供)
- **AI 服务**: [SiliconFlow API](https://siliconflow.cn/) (用于订单信息智能识别)
- **唯一ID生成**: UUID

## 项目结构

项目的主要代码位于 `wlbj/` 目录下：

```
wlbj/
├── app.js                  # Express 应用主文件 (应用初始化, 中间件, 路由, 认证, 日志)
├── auth_config.json        # (需手动创建) 用户端访问密码配置文件
├── ip_whitelist.json       # (自动生成/管理) 用户端IP白名单
├── config/                 # 应用配置目录
│   └── logger.js           # Winston 日志系统配置
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
│       ├── user.js         # 用户端前端逻辑
│       └── provider.js     # 物流供应商端前端逻辑
├── routes/                 # API 路由定义模块
│   ├── ordersRoutes.js     # 订单相关API路由
│   ├── quotesRoutes.js     # 报价相关API路由
│   └── providersRoutes.js  # 物流公司相关API路由
├── views/                  # 存放 HTML 视图文件
│   ├── home.html           # 应用首页 (提示联系管理员)
│   ├── index.html          # 用户端主操作界面
│   ├── login_user.html     # 用户端密码认证页面
│   └── provider.html       # 物流供应商端操作界面
├── package.json            # 项目依赖和脚本配置
├── package-lock.json       # 精确依赖版本锁定
└── README.md               # 项目说明文件 (本文件)
```

## 安装与运行

### 前提条件
- [Node.js](https://nodejs.org/) (建议使用 LTS 版本)
- npm (通常随 Node.js 一起安装)

### 安装步骤
1. 克隆或下载本项目代码。
2. 打开终端，进入项目根目录下的 `wlbj` 文件夹：
   ```bash
   cd path/to/your/project/wlbj
   ```
3. 安装项目依赖 (包括 `morgan` 和 `winston`)：
   ```bash
   npm install
   ```
   *注意: `npm install` 的输出中可能提示安全漏洞，建议运行 `npm audit` 查看详情并酌情处理。*

### 首次运行与配置
1.  **配置用户访问密码**: 
    在 `wlbj/` 目录下手动创建 `auth_config.json` 文件。如果首次启动时此文件不存在，应用会自动生成一个包含默认密码的文件，并提示您修改。**请务必设置一个强密码！**
    文件内容示例：
    ```json
    { 
      "password": "your_secure_password_here" 
    }
    ```
2.  `ip_whitelist.json` 和 `logs/` 目录会在应用首次运行时自动创建（如果不存在）。

### 运行服务
1. 在 `wlbj` 目录下，通过以下命令启动应用服务器：
   ```bash
   node app.js
   ```
2. 服务器启动后，默认会在 `http://localhost:3000` 上运行。
3. 打开浏览器访问以下地址：
    - 应用主页: `http://localhost:3000/` (将显示提示信息)
    - 用户端: `http://localhost:3000/user` (首次访问需要密码认证)
    - 物流供应商端: 通过用户端生成的专属链接访问，例如 `http://localhost:3000/provider/UNIQUE_ACCESS_KEY`

## 身份认证 (用户端 `/user`)

为了增强用户端的访问安全性，同时为内部用户提供便利，系统采用了 IP 白名单结合密码的认证方式：

- **主密码**: 在 `wlbj/auth_config.json` 文件中配置。此密码用于首次认证来自新 IP 地址的访问请求。
- **IP 白名单**: 
    - 存储在 `wlbj/ip_whitelist.json` 文件中。
    - 当一个 IP 地址的用户通过主密码成功认证后，该 IP 地址会被自动添加到白名单中。
    - 后续来自白名单中 IP 地址的访问将无需再次输入密码，可直接进入用户端。
- **密码变更与白名单失效**: 
    - 如果 `auth_config.json` 中的主密码被修改，整个 IP 白名单 (`ip_whitelist.json` 中的IP列表) 将自动失效（被清空）。
    - 所有 IP（包括之前在白名单中的）都需要使用新的主密码重新进行认证，认证成功后其 IP 会被重新加入到新的白名单中。
- **登录页面**: 未在白名单中的 IP 访问 `/user` 时，会被重定向到 `/login-user-page` 进行密码输入。

## 日志记录

系统集成了日志记录功能，以便于问题追踪和系统监控：

- **HTTP 请求日志**: 使用 `morgan` 记录所有传入的 HTTP 请求。在开发模式下，日志格式更简洁并带有颜色；在生产模式下，使用 `combined` 格式记录更详细的信息。
- **应用级日志**: 使用 `winston` 进行结构化日志记录。
- **日志输出**: 
    - **控制台**: 所有日志（包括 HTTP 请求和应用日志）都会实时输出到控制台，方便开发和调试。
    - **文件**: 
        - `wlbj/logs/app.log`: 记录所有 `info` 级别及以上的应用日志和 HTTP 请求日志。
        - `wlbj/logs/error.log`: 专门记录 `error` 级别的日志，以及未捕获的服务器异常和未处理的 Promise rejections。
- **日志轮替**: 日志文件配置了基于大小的自动轮替功能，以防止单个日志文件过大。
- **配置**: 日志系统的详细配置位于 `wlbj/config/logger.js`。

## 数据库

- 数据库类型: SQLite
- 数据库文件: `wlbj/data/logistics.db`
- 主要数据表:
    - `orders`: 存储物流订单信息 (id, warehouse, goods, deliveryAddress, createdAt, updatedAt, status)。
    - `quotes`: 存储物流供应商的报价信息 (id, orderId, provider, price, estimatedDelivery, createdAt)。
    - `providers`: 存储物流公司的信息 (id, name, accessKey, createdAt)。

## 主要 API 端点 (部分列举)

- `POST /api/orders`: 创建新订单。
- `GET /api/orders`: 获取订单列表 (支持按状态和分页)。
- `PUT /api/orders/:id`: 更新指定订单。
- `PUT /api/orders/:id/close`: 关闭指定订单。
- `GET /api/orders/available`: (物流端) 获取可报价订单 (基于 accessKey, 自动过滤已报价和非活跃订单)。
- `GET /api/orders/:id/quotes`: 获取指定订单的所有报价。

- `POST /api/quotes`: 提交新报价 (物流端，基于 accessKey)。
- `GET /api/quotes`: 获取报价列表 (物流端，基于 accessKey)。

- `POST /api/providers`: (用户端) 添加新的物流公司，生成 accessKey。
- `GET /api/providers`: (用户端) 获取所有已添加的物流公司列表。
- `GET /api/provider-details`: (物流端) 根据 accessKey 获取物流公司信息。

## 注意事项
- **安全**: `auth_config.json` 文件中的密码至关重要，请务必设置为强密码并妥善保管。切勿将其提交到公共代码仓库。
- **反向代理与 IP 地址**: 如果应用部署在反向代理（如 Nginx）之后，为了 `req.ip` 能正确获取客户端真实 IP 地址（用于IP白名单功能），请在 `wlbj/app.js` 中正确配置 `app.set('trust proxy', true);` 或更具体的代理设置。
- **依赖安全**: `npm install` 可能会报告依赖项中的安全漏洞。建议运行 `npm audit` 并根据报告采取适当措施。
- **SQLite 并发**: 项目目前使用 SQLite 文件数据库，并发性能有限，适合小型应用或演示。
- **物流商访问**: 物流供应商的访问权限控制依赖于 `accessKey` 的保密性。
- **AI 功能**: AI 识别功能依赖于 SiliconFlow API Key 的有效性。

---

这个 README 文件提供了项目的概览、功能、技术选型、如何运行以及一些关键的实现细节。