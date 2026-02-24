// /api/proxy/[[...path]].ts

export const config = {
  runtime: 'edge', // 必须保留，确保 fetch API 兼容性
};

// 环境变量处理
const ALLOWED_TARGETS_STR = process.env.ALLOWED_TARGETS || '';
const ALLOWED_TARGETS = ALLOWED_TARGETS_STR.split(',').map(s => s.trim()).filter(Boolean);
const HEADERS_TO_REMOVE_STR = process.env.HEADERS_TO_REMOVE || '';

export default async function handler(request: Request) {
  // 1. 获取完整的请求 URL 字符串
  // 注意：在某些环境下 request.url 可能是相对路径（如 /api/pp?...），这会导致 new URL() 报错
  // 所以我们先把它标准化成一个绝对路径
  const baseHost = 'http://localhost'; 
  const fullReqUrl = request.url.startsWith('http') ? request.url : baseHost + request.url;
  
  // 2. 核心：手动提取 target= 后面的所有内容
  // 我们不信任 url.searchParams，因为他会自作聪明地把 grant_type 切走
  const targetKey = 'target=';
  const targetIndex = fullReqUrl.indexOf(targetKey);

  if (targetIndex === -1) {
    return new Response('Bad Request: "target" query parameter is required.', { status: 400 });
  }

  // 截取 target= 之后的所有字符
  // 例如：...target=https://api.weixin.qq.com...?a=1&b=2
  // 截取结果：https://api.weixin.qq.com...?a=1&b=2 (包含所有的 & 符号)
  let finalTargetUrl = fullReqUrl.substring(targetIndex + targetKey.length);

  // 3. 修复 "Invalid URL" 问题
  // 如果用户实际上转义了 URL (比如 %3A%2F)，我们需要解码一次
  // 但如果用户没转义 (直接是 https://)，decodeURIComponent 也不会报错
  try {
    // 只有当看起来是被编码过的时候才尝试解码（防止过度解码破坏内部参数）
    if (finalTargetUrl.includes('%3A') || finalTargetUrl.includes('%3a')) {
        finalTargetUrl = decodeURIComponent(finalTargetUrl);
    }
  } catch (e) {
    // 解码失败就算了，用原始的
  }

  console.log('🔗 Final Proxy URL:', finalTargetUrl); // 看日志！这里必须是完整的长链接

  // 4. 验证 URL 合法性及白名单
  let targetUrlObj: URL;
  try {
    targetUrlObj = new URL(finalTargetUrl);
  } catch (error) {
    return new Response(`Bad Request: Invalid target URL. Got: ${finalTargetUrl}`, { status: 400 });
  }

  if (ALLOWED_TARGETS.length > 0) {
    const targetDomain = targetUrlObj.hostname;
    const isAllowed = ALLOWED_TARGETS.some(allowedDomain => 
      targetDomain === allowedDomain || targetDomain.endsWith(`.${allowedDomain}`)
    );
    if (!isAllowed) {
      return new Response(`Forbidden: Target "${targetDomain}" is not allowed.`, { status: 403 });
    }
  }

  // 5. 处理 Headers
  const headers = new Headers(request.headers);
  const headersToRemove = HEADERS_TO_REMOVE_STR.split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  
  for (const headerName of headersToRemove) { headers.delete(headerName); }
  
  headers.delete('host');
  // 这里的 host 应该是你代理服务器的 host
  try {
      const reqUrlObj = new URL(fullReqUrl);
      headers.set('X-Forwarded-Host', reqUrlObj.host);
      headers.set('X-Forwarded-Proto', reqUrlObj.protocol.slice(0, -1));
  } catch (e) {}


  // 6. 发起请求
  try {
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
    return new Response('Proxy error: ' + String(error), { status: 500 });
  }
}
