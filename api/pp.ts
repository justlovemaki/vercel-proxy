// /api/proxy/[[...path]].ts

export const config = {
  runtime: 'edge',
};

// 白名单及 header 移除配置
const ALLOWED_TARGETS_STR = process.env.ALLOWED_TARGETS || '';
const ALLOWED_TARGETS = ALLOWED_TARGETS_STR.split(',').map(s => s.trim()).filter(Boolean);
const HEADERS_TO_REMOVE_STR = process.env.HEADERS_TO_REMOVE || '';

export default async function handler(request: Request) {
  const url = new URL(request.url);

  // 1. 获取 target 参数
  const targetParam = url.searchParams.get('target');
  if (!targetParam) {
    return new Response('Bad Request: "target" query parameter is required.', { status: 400 });
  }

  let targetUrlObj: URL;
  try {
    targetUrlObj = new URL(targetParam);
  } catch (error) {
    return new Response('Bad Request: Invalid "target" query parameter.', { status: 400 });
  }

  // 【核心优化点】：将被 '&' 截断的未转义参数（如 appid, secret 等）重新挂载回目标 URL
  url.searchParams.forEach((value, key) => {
    // 排除掉代理服务本身的 'target' 参数
    if (key !== 'target') {
      targetUrlObj.searchParams.append(key, value);
    }
  });

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

  // 3. 生成最终的请求 URL
  const finalTargetUrl = targetUrlObj.toString();
  console.log('Proxying to:', finalTargetUrl); // 调试日志：确认完整链接正确

  // 4. 处理 headers
  const headers = new Headers(request.headers);
  const headersToRemove = HEADERS_TO_REMOVE_STR.split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  
  for (const headerName of headersToRemove) { 
    headers.delete(headerName); 
  }
  
  headers.delete('host');
  // 保持原始请求的 host 和协议
  headers.set('X-Forwarded-Host', url.host); 
  headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1));

  try {
    // 5. 使用组装好的 finalTargetUrl 发起请求
    const response = await fetch(finalTargetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual', // 视需求而定，也可以改成 'follow' 以自动跟随重定向
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
