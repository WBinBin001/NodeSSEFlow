# Node.js SSE 服务器示例

这是一个使用 Node.js 实现服务器发送事件(Server-Sent Events, SSE)的简单示例项目。提供了两个不同的实现方案：
1. 基础版：使用原生 http 模块
2. 优化版：使用 Express 框架实现的功能更完善的版本

## 特性

- 服务器向客户端发送实时更新
- 客户端可以发送消息并广播给所有连接的客户端
- 支持多种事件类型
- 自动重连机制
- 美观的用户界面

## 如何使用

### 安装依赖

```bash
npm install
```

### 运行基础版服务器

```bash
npm run start:basic
```

### 运行优化版服务器

```bash
npm start
```

或者使用开发模式（自动重启）:

```bash
npm run dev
```

## 技术要点

### SSE 头部设置

```javascript
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive'
});
```

### 消息格式

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

1. 增加服务器端事件过滤
2. 添加身份验证和授权
3. 实现消息持久化
4. 添加心跳检测
5. 优化断线重连策略
6. 增加负载均衡支持 