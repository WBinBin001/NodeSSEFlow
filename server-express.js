const express = require('express');
const cors = require('cors');

// 创建Express应用
const app = express();

// 启用CORS和JSON解析
app.use(cors());
app.use(express.json());

// 客户端连接集合，用于广播消息
const clients = new Set();

// SSE路由
app.get('/events', (req, res) => {
  // 设置SSE所需的响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 发送初始消息
  const data = JSON.stringify({ message: '连接已建立' });
  res.write(`id: ${Date.now()}\n`);
  res.write(`event: connected\n`);
  res.write(`data: ${data}\n\n`);

  // 将此客户端添加到客户端集合
  clients.add(res);

  // 客户端断开连接时清理
  req.on('close', () => {
    clients.delete(res);
    console.log('客户端已断开连接，当前连接数:', clients.size);
  });
});

// 广播消息到所有连接的客户端
function broadcastMessage(eventType, data) {
  const eventData = JSON.stringify(data);
  clients.forEach(client => {
    client.write(`id: ${Date.now()}\n`);
    client.write(`event: ${eventType}\n`);
    client.write(`data: ${eventData}\n\n`);
  });
}

// 发送消息API端点
app.post('/send', (req, res) => {
  const { event = 'message', data } = req.body;
  
  if (!data) {
    return res.status(400).json({ error: '消息数据不能为空' });
  }
  
  broadcastMessage(event, data);
  res.json({ success: true, clientCount: clients.size });
});

// 提供HTML页面
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SSE 示例</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    #events { border: 1px solid #ccc; padding: 10px; height: 300px; overflow-y: auto; margin-bottom: 20px; }
    .event { margin-bottom: 5px; padding: 5px; border-bottom: 1px solid #eee; }
    .time { color: #999; font-size: 0.8em; }
    form { display: flex; gap: 10px; margin-bottom: 20px; }
    input, button { padding: 8px; }
    input { flex-grow: 1; }
    .connected { color: green; }
    .error { color: red; }
  </style>
</head>
<body>
  <h1>Express SSE 示例</h1>
  <div>状态: <span id="status">连接中...</span></div>
  <form id="messageForm">
    <input type="text" id="messageInput" placeholder="输入要发送的消息" required>
    <button type="submit">发送消息</button>
  </form>
  <div id="events"></div>
  
  <script>
    const eventsDiv = document.getElementById('events');
    const statusSpan = document.getElementById('status');
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    
    // 初始化EventSource
    const eventSource = new EventSource('/events');
    
    // 连接成功事件
    eventSource.addEventListener('connected', function(e) {
      statusSpan.textContent = '已连接';
      statusSpan.className = 'connected';
      const data = JSON.parse(e.data);
      addEvent('系统', data.message);
    });
    
    // 消息事件
    eventSource.addEventListener('message', function(e) {
      const data = JSON.parse(e.data);
      addEvent('消息', data.text);
    });
    
    // 更新事件
    eventSource.addEventListener('update', function(e) {
      const data = JSON.parse(e.data);
      addEvent('更新', data.text);
    });
    
    // 错误处理
    eventSource.onerror = function() {
      statusSpan.textContent = '连接错误 - 尝试重新连接...';
      statusSpan.className = 'error';
    };
    
    // 添加事件到显示区域
    function addEvent(type, message) {
      const time = new Date().toLocaleTimeString();
      const eventDiv = document.createElement('div');
      eventDiv.className = 'event';
      eventDiv.innerHTML = '<strong>' + type + ':</strong> ' + message + 
                          '<span class="time">' + time + '</span>';
      eventsDiv.appendChild(eventDiv);
      eventsDiv.scrollTop = eventsDiv.scrollHeight;
    }
    
    // 表单提交处理
    messageForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const text = messageInput.value.trim();
      if (!text) return;
      
      try {
        const response = await fetch('/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: { text } })
        });
        
        if (response.ok) {
          messageInput.value = '';
        } else {
          console.error('发送失败');
        }
      } catch (err) {
        console.error('发送出错:', err);
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
  console.log(`Express SSE服务器运行在 http://localhost:${PORT}`);
  
  // 定时广播系统消息
  setInterval(() => {
    broadcastMessage('update', { 
      text: '服务器时间: ' + new Date().toLocaleTimeString(),
      clients: clients.size
    });
  }, 10000);
}); 