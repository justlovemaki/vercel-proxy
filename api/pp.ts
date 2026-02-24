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

  // 1. 获取 target 参数。
  // 注意：url.searchParams.get 会【自动解码】带有 %3A 等转义字符的 URL
  const targetParam = url.searchParams.get('target');
  if (!targetParam) {
    return new Response('Bad Request: "target" query parameter is required.', { status: 400 });
  }

  let targetUrlObj: URL;
  try {
    targetUrlObj = new URL(targetParam);
  } catch (error) {
    // 错误提示里打印出实际接收到的值，方便查错
    return new Response(`Bad Request: Invalid target URL. Received: ${targetParam}`, { status: 400 });
  }

  // 2. 【核心修复】：将被 '&' 截断的微信参数完美组装回去
  // 遍历你请求中的所有参数，把属于微信API的参数塞回目标链接里
  url.searchParams.forEach((value, key) => {
    // 排除掉代理服务本身的参数（target 以及可能被底层框架加上的 path）
    if (key !== 'target' && key !== 'path') {
      // 只有当目标 URL 里还没有这个参数时才添加，防止转义链接导致参数重复
      if (!targetUrlObj.searchParams.has(key)) {
        targetUrlObj.searchParams.append(key, value);
      }
    }
  });

  // 3. 生成最终的请求 URL
  const finalTargetUrl = targetUrlObj.toString();
  
  // 你可以在服务器控制台查看这行日志，这里的链接一定 100% 完整，grant_type 绝对不会丢
  console.log('Proxying to:', finalTargetUrl); 

  // 4. 检查目标域名是否在白名单内
  if (ALLOWED_TARGETS.length > 0) {
    const targetDomain = targetUrlObj.hostname;
    const isAllowed = ALLOWED_TARGETS.some(allowedDomain => 
      targetDomain === allowedDomain || targetDomain.endsWith(`.${allowedDomain}`)
    );
    if (!isAllowed) {
      return new Response(`Forbidden: Target "${targetDomain}" is not allowed.`, { status: 403 });
    }
  }

  // 5. 处理 headers
  const headers = new Headers(request.headers);
  const headersToRemove = HEADERS_TO_REMOVE_STR.split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  
  for (const headerName of headersToRemove) { 
    headers.delete(headerName); 
  }
  
  headers.delete('host');
  headers.set('X-Forwarded-Host', url.host); 
  headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1));

  try {
    // 6. 使用组装好的终极 finalTargetUrl 发起请求
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
