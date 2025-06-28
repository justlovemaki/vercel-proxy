// /api/proxy/[[...path]].ts

export const config = {
  runtime: 'edge',
};

// 从环境变量获取目标主机
const TARGET_HOST = process.env.TARGET_HOST;
// 从环境变量读取要移除的头列表，以逗号分隔，例如 "cookie,user-agent"
const HEADERS_TO_REMOVE_STR = process.env.HEADERS_TO_REMOVE || '';

export default async function handler(request: Request) {
  if (!TARGET_HOST) {
    return new Response('Target host is not configured. Please set TARGET_HOST environment variable.', { status: 500 });
  }

  // 1. 构造目标 URL
  const url = new URL(request.url);
  const targetPath = url.pathname.replace(/^\/api\/proxy/, '');
  const targetUrl = `${TARGET_HOST}${targetPath}${url.search}`;

  // 2. 创建可修改的请求头副本
  const headers = new Headers(request.headers);

  // 3. 移除指定的请求头
  const headersToRemove = HEADERS_TO_REMOVE_STR.split(',')
    .map(h => h.trim().toLowerCase())
    .filter(h => h);

  if (headersToRemove.length > 0) {
    for (const headerName of headersToRemove) {
      headers.delete(headerName);
    }
  }

  // 总是移除 Host 头，让 fetch 根据 targetUrl 自动生成正确的 Host
  headers.delete('host');
  
  // 添加一些代理特定的头
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1));

  try {
    // 4. 使用修改后的请求头发起请求
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual',
    });

    // 5. 返回响应
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Proxy error', { status: 500 });
  }
}