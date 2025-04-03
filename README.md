# Node.js SSE 服务器示例

这是一个使用 Node.js 实现服务器发送事件(Server-Sent Events, SSE)的简单示例项目。提供了三个不同的实现方案：
1. 基础版：使用原生 http 模块
2. 标准版：使用 Express 框架
3. 高级版：使用 Express + Redis 实现分布式部署和消息持久化

## 特性

- 服务器向客户端发送实时更新
- 客户端可以发送消息并广播给所有连接的客户端
- 支持多种事件类型
- 自动重连机制
- 美观的用户界面

### 高级版额外特性

- 使用Redis进行消息持久化
- 支持分布式部署（多服务器实例）
- 消息历史记录
- 自定义事件类型
- 客户端唯一标识

## 如何使用

### 安装依赖

```bash
npm install
```

### 运行基础版服务器

```bash
npm run start:basic
```

### 运行标准版服务器

```bash
npm start
```

### 运行高级版服务器（需要Redis）

确保Redis服务器已经启动，默认连接到localhost:6379，或者通过环境变量配置：

```bash
# 设置Redis连接信息
export REDIS_HOST=your-redis-host
export REDIS_PORT=6379
export REDIS_PASSWORD=your-redis-password

# 启动服务器
npm run start:advanced
```

也可以使用开发模式（自动重启）:

```bash
npm run dev  # 标准版
npm run dev:advanced  # 高级版
```

## 技术要点

### SSE 头部设置

```javascript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
```

### SSE 消息格式

```
id: 1234567890
event: eventname
data: {"key": "value"}

```

注意：消息以两个换行符结束

### 客户端使用

```javascript
const eventSource = new EventSource('/events');

// 监听普通消息
eventSource.onmessage = function(event) {
  console.log(event.data);
};

// 监听自定义事件
eventSource.addEventListener('customEvent', function(event) {
  console.log(event.data);
});
```

## 架构对比

### 基础版（server.js）
- 使用原生http模块
- 最简单的实现
- 单一服务器实例
- 无消息持久化

### 标准版（server-express.js）
- 使用Express框架
- 更好的路由管理
- 更好的错误处理
- 单一服务器实例
- 无消息持久化

### 高级版（server-advanced.js）
- 使用Express框架
- 使用Redis进行消息持久化和分布式部署
- 支持多服务器实例（水平扩展）
- 消息历史记录
- 更完善的前端界面

## SSE 与 WebSocket 对比

SSE (Server-Sent Events):
- 单向通信（服务器到客户端）
- 基于HTTP协议
- 自动重连机制
- 简单易用，无需额外库
- 支持事件ID和自定义事件

WebSocket:
- 双向通信
- 使用自己的协议（ws://，wss://）
- 需要处理重连
- 可能需要额外库
- 更适合聊天等双向通信场景

## 进阶优化建议

1. 添加身份验证和授权
2. 增加服务器端事件过滤
3. 添加消息压缩
4. 实现更精细的消息分类和订阅
5. 添加心跳检测
6. 优化断线重连策略
7. 增加监控和日志系统
8. 添加WebSocket降级方案 