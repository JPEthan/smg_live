# SMG 网页直播观看增强（社区修复版）

这是 [`Popukok/smg_live`](https://github.com/Popukok/smg_live) 的社区修复版本，面向看看新闻的 SMG 电视直播与节目回看页面。

本 Fork 保留原项目的播放器增强、节目回看、移动端和全屏适配逻辑，并补充了跨域请求兼容、接口重新签名、WAF 非 JSON 响应识别及回看 URL 拼接修复。

> 本项目不会修改服务端权限，也不能绕过服务端 WAF、地区限制、账号权限或媒体 DRM。请仅在服务条款和内容授权允许的范围内使用。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 点击安装社区修复版：

   [安装 `smg_fivestar.user.js`](https://raw.githubusercontent.com/JPEthan/smg_live/main/smg_fivestar.user.js)

3. 打开 [SMG 直播页面](https://live.kankanews.com/huikan?id=10)。
4. 如果曾安装原版或旧修复版，请确保 Tampermonkey 中只启用一份同名脚本，然后完全关闭并重新打开直播页面。

## 0.21.1 修复内容

### KAPI 跨域请求桥

页面发往 `https://kapi.kankanews.com` 的 `XMLHttpRequest` 和 `fetch` 请求可通过 Tampermonkey 的 `GM_xmlhttpRequest` 发送，避免浏览器在 CORS 预检阶段直接阻止请求。

桥接范围严格限制为 `kapi.kankanews.com`，不会代理其他站点。

### 请求重新签名

对 KAPI GET 请求重新生成客户端所需的：

- `platform`
- `version`
- `nonce`
- `timestamp`
- `Api-Version`
- `sign`
- `M-Uuid`

同时补充正常的 `Accept`、`User-Agent`、`Origin` 和 `Referer` 请求信息，减少因旧签名、缺失请求头或来源信息不完整造成的接口拒绝。

### WAF 响应识别

接口被服务器 WAF 拦截时，正文通常是以 `<!DOCTYPE html>` 开头的 HTML，而不是 JSON。脚本现在会先检查响应类型，不再对 WAF 页面盲目执行 `JSON.parse()`。

控制台会输出不含签名和播放令牌的诊断信息：

```text
[SMGTV] 接口返回非 JSON，可能被 WAF 拦截
```

其中包含接口路径、HTTP 状态码、内容类型和最终地址。

如果状态仍为 `403`，说明请求已经到达服务器，但被服务端安全策略拒绝。这种情况无法仅靠用户脚本修复，应确认该服务是否在当前地区和网络正式可用，或将 WAF 页面上的请求 UUID 提供给网站运维人员。

### 回看地址拼接

修复桌面端回看地址固定使用 `&start=` 的问题。现在会根据基础 URL 是否已有查询参数自动选择 `?` 或 `&`，并对节目开始、结束时间进行编码。

### 其他处理

- 不使用旧版中不稳定的 webpack chunk 注入。
- 保留节目列表、播放器初始化、加载状态和错误恢复逻辑。
- 保留原生全屏、iOS 视频全屏和 CSS 全屏回退。
- 移除本 Fork 脚本中的上游自动更新地址，防止修复版本被其他版本自动覆盖。

## 常见问题

### 控制台仍出现 `unload is not allowed`

以下信息一般来自网站自身的 jQuery 或页面代码：

```text
Permissions policy violation: unload is not allowed in this document
```

这是新版 Chromium 对旧式 `unload` 事件的策略提示，通常不是视频播放失败的原因。

### 控制台显示 WAF 403

这不是 JSON 解析错误，也不是普通 CORS 错误，而是服务器已经拒绝请求。脚本只负责准确识别和报告，不会尝试规避服务端安全策略。

### 页面仍在运行旧代码

请检查 Tampermonkey 中脚本头部版本是否为：

```text
0.21.1
```

然后停用其他同名脚本，并重新打开页面。仅普通刷新可能保留旧页面建立的网络钩子。

## 兼容性

- 推荐使用最新版 Chrome、Edge 或 Firefox 配合 Tampermonkey。
- Safari 可使用 Tampermonkey 或 [Userscripts App](https://apps.apple.com/app/userscripts/id1463198887)。
- iOS/iPadOS 需要在 Safari 扩展设置中允许用户脚本访问 `kankanews.com`。
- Violentmonkey 与 Tampermonkey 的跨域请求实现存在差异，本修复版优先针对 Tampermonkey 验证。

## 安全边界

- 脚本只声明连接 `kapi.kankanews.com`。
- 脚本会读取看看新闻页面 `localStorage` 中的 `uuid`，作为 `M-Uuid` 发送回看看新闻 API。
- 不读取 Cookie、密码、表单或剪贴板。
- 不会把页面数据、节目地址或播放令牌发送给第三方服务。
- 播放地址缓存只保存在当前页面内存中。

## 致谢与上游

- 原项目与主要功能实现：[`Popukok/smg_live`](https://github.com/Popukok/smg_live)
- 本仓库用于提交兼容性修复并向上游发起 Pull Request。

建议优先关注上游项目；如果修复被上游合并，请改用上游正式版本。

## 免责声明

本项目仅供学习、调试和兼容性研究。使用者应自行遵守网站服务条款、节目版权、地区授权及当地法律法规。项目维护者不提供内容、账号、网络代理或服务端访问权限。
