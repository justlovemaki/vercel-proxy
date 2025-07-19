// /api/proxy/[[...path]].ts

export const config = {
  runtime: 'edge',
};

// ... (其他配置如白名单、移除 headers 的部分保持不变)
const ALLOWED_TARGETS_STR = process.env.ALLOWED_TARGETS || '';
const ALLOWED_TARGETS = ALLOWED_TARGETS_STR.split(',').map(s => s.trim()).filter(Boolean);
const HEADERS_TO_REMOVE_STR = process.env.HEADERS_TO_REMOVE || '';


export default async function handler(request: Request) {
  const url = new URL(request.url);

  // 1. 获取并验证 target 参数
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

  // 2. [可选但推荐] 检查目标域名是否在白名单内
  if (ALLOWED_TARGETS.length > 0) {
    const targetDomain = targetUrlObj.hostname;
    const isAllowed = ALLOWED_TARGETS.some(allowedDomain => 
      targetDomain === allowedDomain || targetDomain.endsWith(`.${allowedDomain}`)
    );
    if (!isAllowed) {
      return new Response(`Forbidden: Target "${targetDomain}" is not allowed.`, { status: 403 });
    }
  }

  // 3. 【核心修改】直接使用 target 参数作为最终请求的 URL
  const finalTargetUrl = targetParam;

  console.log('Proxying to:', finalTargetUrl); // 添加日志，方便调试

  // 4. 处理 headers (逻辑不变)
  const headers = new Headers(request.headers);
  // ... (移除和设置 headers 的逻辑同上)
  const headersToRemove = HEADERS_TO_REMOVE_STR.split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  for (const headerName of headersToRemove) { headers.delete(headerName); }
  headers.delete('host');
  headers.set('X-Forwarded-Host', url.host); // 仍然使用原始请求的 host
  headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1));
  headers.set('User-Agent', 'clash');


  try {
    // 5. 使用新的 finalTargetUrl 发起请求
    const response = await fetch(finalTargetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual',
    });
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Proxy error', { status: 500 });
  }
}
