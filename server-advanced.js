const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

// 创建Express应用
const app = express();

// 启用CORS和JSON解析
app.use(cors());
app.use(express.json());

// 创建Redis客户端
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || '',
});

// Redis订阅客户端（用于发布/订阅模式）
const redisSub = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || '',
});

// 订阅SSE频道
redisSub.subscribe('sse-events');

// 当前服务器实例ID
const SERVER_ID = uuidv4();

// 客户端连接集合，用于广播消息
const clients = new Map();

// 监听Redis消息
redisSub.on('message', (channel, message) => {
  try {
    if (channel === 'sse-events') {
      const data = JSON.parse(message);
      
      // 如果是来自其他服务器实例的消息，则广播给当前服务器的客户端
      if (data.serverId !== SERVER_ID) {
        broadcastToClients(data.eventType, data.payload);
      }
    }
  } catch (err) {
    console.error('Redis消息处理错误:', err);
  }
});

// SSE路由
app.get('/events', async (req, res) => {
  // 设置SSE所需的响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 生成客户端ID
  const clientId = uuidv4();
  
  // 发送初始消息
  const initialData = JSON.stringify({ message: '连接已建立', clientId });
  res.write(`id: ${Date.now()}\n`);
  res.write(`event: connected\n`);
  res.write(`data: ${initialData}\n\n`);

  // 将客户端添加到连接集合
  clients.set(clientId, res);
  
  // 从Redis获取最近10条消息历史
  try {
    const historyItems = await redis.lrange('sse-message-history', 0, 9);
    
    if (historyItems.length > 0) {
      // 发送历史消息
      const historyData = JSON.stringify({ 
        items: historyItems.map(item => JSON.parse(item)),
        count: historyItems.length
      });
      
      res.write(`id: ${Date.now()}\n`);
      res.write(`event: history\n`);
      res.write(`data: ${historyData}\n\n`);
    }
  } catch (err) {
    console.error('获取历史消息失败:', err);
  }

  // 客户端断开连接时清理
  req.on('close', () => {
    clients.delete(clientId);
    console.log(`客户端 ${clientId} 已断开连接，当前连接数: ${clients.size}`);
  });
});

// 仅广播给当前服务器实例上的客户端
function broadcastToClients(eventType, data) {
  const eventData = JSON.stringify(data);
  const eventId = Date.now();
  
  clients.forEach((client) => {
    client.write(`id: ${eventId}\n`);
    client.write(`event: ${eventType}\n`);
    client.write(`data: ${eventData}\n\n`);
  });
}

// 广播消息到所有服务器实例
async function broadcastMessage(eventType, data) {
  try {
    // 创建消息对象
    const message = {
      serverId: SERVER_ID,
      eventType,
      payload: data,
      timestamp: Date.now()
    };
    
    // 保存到Redis历史记录
    await redis.lpush('sse-message-history', JSON.stringify({
      eventType,
      data,
      timestamp: message.timestamp
    }));
    
    // 只保留最近100条消息
    await redis.ltrim('sse-message-history', 0, 99);
    
    // 发布到Redis频道
    await redis.publish('sse-events', JSON.stringify(message));
    
    // 广播给当前服务器实例上的客户端
    broadcastToClients(eventType, data);
    
    return true;
  } catch (err) {
    console.error('广播消息失败:', err);
    return false;
  }
}

// 发送消息API端点
app.post('/send', async (req, res) => {
  const { event = 'message', data } = req.body;
  
  if (!data) {
    return res.status(400).json({ error: '消息数据不能为空' });
  }
  
  const success = await broadcastMessage(event, data);
  
  if (success) {
    res.json({ 
      success: true, 
      clientCount: clients.size,
      serverId: SERVER_ID
    });
  } else {
    res.status(500).json({ 
      success: false, 
      error: '消息发送失败' 
    });
  }
});

// API获取消息历史
app.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const historyItems = await redis.lrange('sse-message-history', 0, limit - 1);
    
    res.json({
      success: true,
      history: historyItems.map(item => JSON.parse(item)),
      count: historyItems.length
    });
  } catch (err) {
    console.error('获取历史消息失败:', err);
    res.status(500).json({ success: false, error: '获取历史记录失败' });
  }
});

// 提供HTML页面
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>高级SSE示例</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    #events { border: 1px solid #ccc; padding: 10px; height: 300px; overflow-y: auto; margin-bottom: 20px; }
    .event { margin-bottom: 5px; padding: 5px; border-bottom: 1px solid #eee; }
    .system { background-color: #f8f9fa; }
    .message { background-color: #e8f4fd; }
    .update { background-color: #f0f8e8; }
    .time { color: #999; font-size: 0.8em; }
    .status-bar { display: flex; justify-content: space-between; margin-bottom: 10px; }
    form { display: flex; gap: 10px; margin-bottom: 20px; }
    input, button, select { padding: 8px; }
    input { flex-grow: 1; }
    .connected { color: green; }
    .error { color: red; }
  </style>
</head>
<body>
  <h1>高级SSE示例 - Redis支持</h1>
  <div class="status-bar">
    <div>状态: <span id="status">连接中...</span></div>
    <div>客户端ID: <span id="clientId">-</span></div>
  </div>
  <form id="messageForm">
    <select id="eventType">
      <option value="message">消息</option>
      <option value="update">更新</option>
      <option value="alert">提醒</option>
    </select>
    <input type="text" id="messageInput" placeholder="输入要发送的消息" required>
    <button type="submit">发送</button>
  </form>
  <div>
    <button id="historyBtn">加载历史记录</button>
  </div>
  <div id="events"></div>
  
  <script>
    const eventsDiv = document.getElementById('events');
    const statusSpan = document.getElementById('status');
    const clientIdSpan = document.getElementById('clientId');
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const eventTypeSelect = document.getElementById('eventType');
    const historyBtn = document.getElementById('historyBtn');
    
    let clientId = null;
    
    // 初始化EventSource
    const eventSource = new EventSource('/events');
    
    // 连接成功事件
    eventSource.addEventListener('connected', function(e) {
      statusSpan.textContent = '已连接';
      statusSpan.className = 'connected';
      
      const data = JSON.parse(e.data);
      clientId = data.clientId;
      clientIdSpan.textContent = clientId;
      
      addEvent('系统', data.message, 'system');
    });
    
    // 历史消息事件
    eventSource.addEventListener('history', function(e) {
      const data = JSON.parse(e.data);
      
      if (data.items && data.items.length > 0) {
        addEvent('系统', `加载了 ${data.count} 条历史消息`, 'system');
        
        // 按时间顺序显示历史消息
        const sortedItems = [...data.items].sort((a, b) => a.timestamp - b.timestamp);
        
        for (const item of sortedItems) {
          addEvent(
            item.eventType.charAt(0).toUpperCase() + item.eventType.slice(1), 
            item.data.text || JSON.stringify(item.data),
            item.eventType
          );
        }
      }
    });
    
    // 消息事件
    eventSource.addEventListener('message', function(e) {
      const data = JSON.parse(e.data);
      addEvent('消息', data.text, 'message');
    });
    
    // 更新事件
    eventSource.addEventListener('update', function(e) {
      const data = JSON.parse(e.data);
      addEvent('更新', data.text, 'update');
    });
    
    // 提醒事件
    eventSource.addEventListener('alert', function(e) {
      const data = JSON.parse(e.data);
      addEvent('提醒', data.text, 'alert');
    });
    
    // 错误处理
    eventSource.onerror = function() {
      statusSpan.textContent = '连接错误 - 尝试重新连接...';
      statusSpan.className = 'error';
    };
    
    // 添加事件到显示区域
    function addEvent(type, message, className) {
      const time = new Date().toLocaleTimeString();
      const eventDiv = document.createElement('div');
      eventDiv.className = 'event ' + (className || '');
      eventDiv.innerHTML = '<strong>' + type + ':</strong> ' + message + 
                          '<span class="time"> ' + time + '</span>';
      eventsDiv.appendChild(eventDiv);
      eventsDiv.scrollTop = eventsDiv.scrollHeight;
    }
    
    // 表单提交处理
    messageForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const text = messageInput.value.trim();
      const eventType = eventTypeSelect.value;
      
      if (!text) return;
      
      try {
        const response = await fetch('/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            event: eventType,
            data: { text } 
          })
        });
        
        if (response.ok) {
          messageInput.value = '';
        } else {
          const error = await response.json();
          console.error('发送失败:', error);
        }
      } catch (err) {
        console.error('发送出错:', err);
      }
    });
    
    // 加载历史记录
    historyBtn.addEventListener('click', async function() {
      try {
        const response = await fetch('/history?limit=20');
        const data = await response.json();
        
        if (data.success && data.history.length > 0) {
          // 清空现有消息
          eventsDiv.innerHTML = '';
          
          addEvent('系统', `加载了 ${data.count} 条历史消息`, 'system');
          
          // 按时间顺序显示历史消息
          const sortedHistory = [...data.history].sort((a, b) => a.timestamp - b.timestamp);
          
          for (const item of sortedHistory) {
            addEvent(
              item.eventType.charAt(0).toUpperCase() + item.eventType.slice(1), 
              item.data.text || JSON.stringify(item.data),
              item.eventType
            );
          }
        } else {
          addEvent('系统', '没有历史消息', 'system');
        }
      } catch (err) {
        console.error('获取历史记录失败:', err);
        addEvent('系统', '获取历史记录失败', 'system');
      }
    });
  </script>
</body>
</html>
  `);
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`高级SSE服务器(ID: ${SERVER_ID})运行在 http://localhost:${PORT}`);
  
  // 定时广播系统消息
  setInterval(async () => {
    await broadcastMessage('update', { 
      text: '服务器时间: ' + new Date().toLocaleTimeString(),
      clients: clients.size,
      serverId: SERVER_ID
    });
  }, 10000);
  
  // 发送服务器启动消息
  broadcastMessage('system', {
    text: `服务器实例 ${SERVER_ID} 已启动`,
    timestamp: Date.now()
  });
}); 