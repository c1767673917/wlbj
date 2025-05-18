# 物流报价平台

本项目是一个简单的物流报价 Web 应用程序，允许用户发布物流订单，并允许物流供应商对这些订单进行报价。

## 主要功能

### 用户端 (货主)
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
- **标签页状态保持**: 刷新页面后，保持在用户上次查看的标签页。

### 物流供应商端
- **专属链接访问**: 每个物流公司通过用户端生成的唯一专属链接访问其操作界面，无需注册或登录。
- **查看可报价订单**: 自动显示当前所有状态为"活跃"且该物流商尚未报价的订单列表。
- **提交报价**: 对可报价的订单提交价格和预计送达时间。
- **查看我的报价**: 查看自己已提交的所有报价历史。
- **分页浏览**: 可报价订单和报价历史均支持分页显示。

## 技术栈

- **后端**: Node.js, Express.js
- **数据库**: SQLite
- **前端**: HTML5, CSS3, JavaScript (原生)
- **Excel 处理**: [SheetJS (xlsx)](https://sheetjs.com/) (通过静态服务提供)
- **AI 服务**: [SiliconFlow API](https://siliconflow.cn/) (用于订单信息智能识别)
- **唯一ID生成**: UUID

## 项目结构

项目的主要代码位于 `wlbj/` 目录下：

```
wlbj/
├── app.js             # Express 应用主文件 (应用初始化, 中间件加载, 路由挂载)
├── db/                # 数据库相关模块
│   └── database.js    # 数据库连接初始化和表结构定义
├── routes/            # API 路由定义模块
│   ├── ordersRoutes.js    # 订单相关API路由
│   ├── quotesRoutes.js    # 报价相关API路由
│   └── providersRoutes.js # 物流公司相关API路由
├── data/              # 存放 SQLite 数据库文件
│   └── logistics.db
├── node_modules/      # Node.js 依赖包
├── public/            # 存放前端静态资源
│   ├── css/
│   │   └── styles.css # 全局样式表
│   └── js/
│       ├── user.js    # 用户端前端逻辑
│       └── provider.js# 物流供应商端前端逻辑
├── views/             # 存放 HTML 视图文件
│   ├── home.html      # 应用首页
│   ├── index.html     # 用户端主操作界面
│   └── provider.html  # 物流供应商端操作界面
├── package.json       # 项目依赖和脚本配置
├── package-lock.json  # 精确依赖版本锁定
└── README.md          # 项目说明文件 (本文件)
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
3. 安装项目依赖：
   ```bash
   npm install
   ```

### 运行服务
1. 在 `wlbj` 目录下，通过以下命令启动应用服务器：
   ```bash
   node app.js
   ```
2. 服务器启动后，默认会在 `http://localhost:3000` 上运行。
3. 打开浏览器访问以下地址：
    - 用户端: `http://localhost:3000/user`
    - 物流供应商端: 通过用户端生成的专属链接访问，例如 `http://localhost:3000/provider/UNIQUE_ACCESS_KEY`

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
- 项目目前使用 SQLite 文件数据库，并发性能有限，适合小型应用或演示。
- 物流供应商的访问权限控制依赖于 `accessKey` 的保密性。
- AI 识别功能依赖于 SiliconFlow API Key 的有效性。

---

这个 README 文件提供了项目的概览、功能、技术选型、如何运行以及一些关键的实现细节。