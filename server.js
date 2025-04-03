const http = require('http');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 设置CORS头，允许跨域访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  // SSE连接路由
  if (req.url === '/events') {
    // 设置SSE所需的响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // 发送初始消息
    res.write('data: 连接已建立\n\n');

    // 定时发送消息
    const intervalId = setInterval(() => {
      const data = JSON.stringify({ time: new Date().toISOString() });
      res.write(`data: ${data}\n\n`);
    }, 1000);

    // 客户端断开连接时清除定时器
    req.on('close', () => {
      clearInterval(intervalId);
      console.log('客户端已断开连接');
    });
  } else if (req.url === '/') {
    // 提供简单的HTML页面
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>SSE 示例</title>
        </head>
        <body>
          <h1>SSE 示例</h1>
          <div id="events"></div>
          <script>
            const eventsDiv = document.getElementById('events');
            const eventSource = new EventSource('/events');
            
            eventSource.onmessage = function(event) {
              const newElement = document.createElement('div');
              const eventData = event.data;
              newElement.textContent = eventData;
              eventsDiv.appendChild(newElement);
            };
            
            eventSource.onerror = function() {
              eventSource.close();
              console.log('SSE连接已关闭');
            };
          </script>
        </body>
      </html>
    `);
  } else {
    // 处理其他路由
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SSE服务器运行在 http://localhost:${PORT}`);
}); 