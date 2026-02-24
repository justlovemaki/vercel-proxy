// /api/proxy/[[...path]].ts

export const config = {
  runtime: 'edge',
};

// 白名单及 header 移除配置
const ALLOWED_TARGETS_STR = process.env.ALLOWED_TARGETS || '';
const ALLOWED_TARGETS = ALLOWED_TARGETS_STR.split(',').map(s => s.trim()).filter(Boolean);
const HEADERS_TO_REMOVE_STR = process.env.HEADERS_TO_REMOVE || '';

export default async function handler(request: Request) {
  const rawUrl = request.url; // 获取最原始的请求链接
  const url = new URL(rawUrl);

  // 1. 【核心终极优化】：放弃 searchParams 解析，直接暴力截取字符串
  // 这样无论目标链接里有几个 `?` 几个 `&`，都不会被框架吃掉参数
  const targetKey = 'target=';
  const targetIndex = rawUrl.indexOf(targetKey);

  if (targetIndex === -1) {
    return new Response('Bad Request: "target" query parameter is required.', { status: 400 });
  }

  // 截取 target= 后面的所有字符，得到的就是完美的完整微信 URL
  const finalTargetUrl = rawUrl.substring(targetIndex + targetKey.length);

  let targetUrlObj: URL;
  try {
    targetUrlObj = new URL(finalTargetUrl);
  } catch (error) {
    return new Response('Bad Request: Invalid "target" query parameter.', { status: 400 });
  }

  // 2. 检查目标域名是否在白名单内
  if (ALLOWED_TARGETS.length > 0) {
    const targetDomain = targetUrlObj.hostname;
    const isAllowed = ALLOWED_TARGETS.some(allowedDomain => 
      targetDomain === allowedDomain || targetDomain.endsWith(`.${allowedDomain}`)
    );
    if (!isAllowed) {
      return new Response(`Forbidden: Target "${targetDomain}" is not allowed.`, { status: 403 });
    }
  }

  console.log('Proxying to:', finalTargetUrl); // 这里的日志打印出来一定是包含 grant_type 的完整链接

  // 3. 处理 headers
  const headers = new Headers(request.headers);
  const headersToRemove = HEADERS_TO_REMOVE_STR.split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  
  for (const headerName of headersToRemove) { 
    headers.delete(headerName); 
  }
  
  headers.delete('host');
  headers.set('X-Forwarded-Host', url.host); 
  headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1));

  try {
    // 4. 使用截取出的完整 finalTargetUrl 发起请求
    const response = await fetch(finalTargetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual', 
    });
    
    return new Response(response.body, { 
      status: response.status, 
      statusText: response.statusText, 
      headers: response.headers 
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Proxy error', { status: 500 });
  }
}
