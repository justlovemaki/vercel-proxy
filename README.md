# 🚀 Vercel API Proxy

这是一个部署在 Vercel 上的轻量级 API 代理服务，专为解决跨域（CORS）问题、隐藏敏感凭证而设计。

[![一键部署到 Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/justlovemaki/vercel-proxy)

---

## ✨ 核心特性

*   **一键部署** 🚀：通过 Vercel 按钮，只需点击几下即可将项目部署到您自己的账户下。
*   **安全可控** 🛡️：通过环境变量配置允许代理的目标域名白名单，防止代理被滥用。
*   **隐私保护** 🤫：支持移除请求头中的敏感信息（如 `Cookie`、`Authorization`），保护用户隐私和凭证安全。
*   **轻量专注** 🎯：项目只做一件事——代理 API 请求，保持了极高的性能和简洁性。

## 🛠️ 如何使用

项目部署成功后，您会得到一个专属的 Vercel 域名。使用以下格式来代理您的目标 API：

https://{你的 Vercel 域名}/api/pp?target={目标路径}


> **参数说明**：
> *   `{你的 Vercel 域名}`：您在 Vercel 上部署成功后自动生成的域名，例如 `my-proxy.vercel.app`。
> *   `{目标路径}`：您想要代理的 API 完整路径。
>
> **举个例子**：
>
> 假设您的 Vercel 域名是 `vercel-proxy-xxx.vercel.app`，您想代理的 API 是 `https://api.github.com/users/justlovemaki`。
>
> 那么您需要访问的 URL 应该是：
>
> ```
> https://vercel-proxy-xxx.vercel.app/api/pp?target=https://api.github.com/users/justlovemaki
> ```

## ⚙️ 配置指南

通过在 Vercel 项目中设置环境变量，您可以轻松自定义代理的行为。

*   ### `ALLOWED_TARGETS` (必需)
    *   **功能**：配置允许代理的目标域名白名单。只有在此列表中的域名才会被成功代理。
    *   **格式**：多个域名请使用英文逗号 `,` 分隔。
    *   **示例**：
        ```
        github.com,api.example.com,another.service.org
        ```

*   ### `HEADERS_TO_REMOVE` (可选)
    *   **功能**：配置在转发请求到目标服务器前，需要从原始请求头中移除的字段。这对于安全和隐私至关重要。
    *   **格式**：多个 Header 字段请使用英文逗号 `,` 分隔（不区分大小写）。
    *   **示例**：
        ```
        cookie,authorization,referer,x-custom-auth
        ```

## 🚀 一键部署

您可以非常方便地将此项目部署到自己的 Vercel 账号中。

1.  点击下方的 "Deploy with Vercel" 按钮。
2.  在 Vercel 的导入页面，它会提示您创建一个 Git 仓库，直接授权即可。
3.  进入项目配置页面，**展开 "Environment Variables" 选项卡**，并添加必要的环境变量（至少需要 `ALLOWED_TARGETS`）。
4.  点击 "Deploy"，稍等片刻即可完成部署！

[![一键部署到 Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/justlovemaki/vercel-proxy)

---

希望这个项目能对您有所帮助！欢迎提出 Issue 或 Pull Request。