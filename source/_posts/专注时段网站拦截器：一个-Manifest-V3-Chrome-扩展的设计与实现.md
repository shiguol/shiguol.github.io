---
title: "专注时段网站拦截器：一个 Manifest V3 Chrome 扩展的设计与实现"
date: 2026-08-09 16:48:02
cover: /images/cover/focus-blocker.jpg
categories:
  - Programming
tags:
  - Chrome 扩展
  - Manifest V3
  - JavaScript
  - declarativeNetRequest
  - 效率工具
  - 2026
---

写代码的时候手比脑子快：编译还没跑完，标签页已经切到视频网站了。等回过神来，半小时没了。意志力这东西在「一个快捷键就能打开的诱惑」面前基本不设防，所以我干脆写了个 Chrome 扩展，把这件事交给规则去管——**专注时段网站拦截器**，现已上架 Chrome 应用商店。

这篇记录它做了什么，以及 Manifest V3 下几个不那么显然的实现细节。

<!-- more -->

## 一、它解决什么问题

思路很朴素：**在你自己设定的时间段里，自动拦截你自己设定的网站**。不做番茄钟，不做任务管理，不做数据统计，就这一件事。

- 🚫 **自定义黑名单** —— 每行一个域名，自动覆盖子域名
- ⏰ **多个专注时段** —— 可以建多条规则，互不干扰
- 📅 **按星期生效** —— 工作日专注，周末放过自己
- ⏸️ **15 分钟临时通行** —— 真有急事时给自己开个口子，到点自动恢复
- 🌐 **中英双语** —— 跟随浏览器语言，也可手动指定
- 🔒 **纯本地运行** —— 无账号、无埋点、无服务器

装好后点扩展图标，弹窗就是一个「今天拦不拦」的控制台：

![扩展弹窗：专注控制台](/images/focus-blocker/popup.jpg)

设置页分两块，上面填网站，下面排时段：

![设置页：网站黑名单与专注时段](/images/focus-blocker/options.jpg)

专注时段里访问被拦的网站，会看到这个页面而不是原网站：

![拦截提示页](/images/focus-blocker/blocked.jpg)

安装地址：[Chrome 应用商店 · 专注时段网站拦截器](https://chromewebstore.google.com/detail/idfioimbbdlbeibhioadcknkkjmchgjh)

## 二、Manifest V3 怎么拦网站

MV2 时代拦请求靠 `webRequest` 的阻塞式回调——每个请求都进 JS，你想怎么改就怎么改。MV3 把这条路封了，取而代之的是 **`declarativeNetRequest`（DNR）**：你把规则声明给浏览器，匹配和拦截在浏览器内部完成，扩展代码根本不参与请求流程。

这个设计对拦截类扩展是好事：性能损耗基本为零，也不需要「读取你所有网页内容」这种吓人的权限语义。代价是规则表达能力受限，很多逻辑得换个姿势写。

清单里的权限就这些：

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "declarativeNetRequest", "alarms", "tabs"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js", "type": "module" }
}
```

`<all_urls>` 看着吓人，但它在这里只用于「把用户自己配置的域名重定向到拦截页」，不读取任何页面内容。

## 三、时段判断：Service Worker 会被杀

MV3 的后台是 Service Worker，**空闲几十秒就会被浏览器回收**。所以「每分钟检查一次现在是不是专注时段」不能用 `setInterval`——worker 一死定时器就没了。

正确姿势是 `chrome.alarms`，它由浏览器托管，到点会把 worker 唤醒：

```js
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  await chrome.storage.local.set(stored);
  chrome.alarms.create("refresh-schedule", { periodInMinutes: 1 });
  await refreshRules(stored);
});

chrome.alarms.onAlarm.addListener(refreshFromStorage);
chrome.storage.onChanged.addListener(refreshFromStorage);
```

三个触发源：安装/启动时、每分钟闹钟、设置变更。它们最后都汇到同一个 `refreshRules`——**所有状态都从 `storage` 重新读，worker 里不留任何内存状态**。这是 MV3 后台代码的基本纪律，一旦你在 worker 里缓存了什么，它下次醒来就是空的。

时段判断本身要处理跨零点的情况（比如 22:00–02:00）：

```js
return start <= end
  ? current >= start && current < end   // 常规时段
  : current >= start || current < end;  // 跨零点
```

## 四、域名匹配的边界：别误伤

规则按域名动态生成，需要匹配域名本身和它的所有子域名。第一版用 `urlFilter: "||bilibili.com^"`，够用但拿不到原始 URL（下一节会说为什么需要），于是改成正则：

```js
function domainRegex(domain) {
  return `^https?://([^/:?#]+\\.)?${domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([:/?#].*)?$`;
}
```

几个刻意处理的点：

- `([^/:?#]+\.)?` 匹配任意层级子域名，同时**不允许**跨过 `/`、`?`、`#`——否则 `https://example.com/?r=https://bilibili.com` 这种把域名塞在参数里的地址会被误拦；
- 用户输入先做 `replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` 转义，避免用户填个 `a.b` 就意外匹配到 `axb`；
- 结尾用 `([:/?#].*)?$` 收口，挡住 `notbilibili.com`、`evil-bilibili.com`、`bilibili.com.evil.net` 这类形近域名。

这几条边界后来专门写了用例逐个验证，因为**拦截类工具误伤一次，用户就再也不信任它了**。

## 五、临时放行：把原始 URL 带过去

这是 1.1.0 版本改动最大的地方，也是我觉得最有意思的一处。

**旧版行为**：拦截时用 `redirect: { extensionPath: "/blocked.html" }` 跳转，原始 URL 在这一步就丢了。所以拦截页上的「临时放行」按钮只能 `history.back()` 回上一页。问题在于——如果用户是从新标签页直接敲网址进来的，压根没有「上一页」，点了放行就卡在拦截页上，功能等于失效。

**新版思路**：用 DNR 的 `regexSubstitution`，把匹配到的完整 URL（`\0`）拼到拦截页的 hash 上：

```js
action: {
  type: "redirect",
  redirect: { regexSubstitution: `${blockedPage}#target=\\0` }
},
condition: { regexFilter: domainRegex(domain), resourceTypes: ["main_frame"] }
```

**为什么放 hash 而不是 query**：原始 URL 里经常自带 `?` 和 `&`，塞进 query 会破坏参数解析；hash 在最末尾，可以整段原样取出来。

**拦截页这侧必须校验**。hash 是用户可以手工构造的，直接 `location.href = raw` 就等于开了个跳转任意协议的口子，所以只放行 http/https：

```js
function targetUrl() {
  const raw = location.hash.startsWith("#target=") ? location.hash.slice(8) : "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
```

`javascript:`、`chrome-extension:`、`file:` 以及各种非法 URL 一律返回空字符串，退回 `history.back()` 的旧行为。

**还有个时序坑**：点放行后如果立刻跳转，DNR 规则可能还没撤下来，跳过去又被拦一次，视觉上就是「点了没反应」。所以后台改成等规则真正更新完再回复消息：

```js
if (message.type === "allow-temporarily") {
  (async () => {
    await chrome.storage.local.set({ allowUntil: Date.now() + message.minutes * 60 * 1000 });
    await refreshFromStorage();   // 等规则撤下来
    sendResponse({ ok: true });   // 再回复
  })();
}
return true;   // 保持消息通道开着，异步回复必须写
```

跳转时用 `location.replace` 而不是赋值 `location.href`，让拦截页不留在历史记录里——用户按返回键时不该再看到它一次。

## 六、两个踩过的坑

**规则残留**。旧代码清理规则时按 `websites.length` 生成待删 ID：

```js
// ❌ 用户从 5 个网站删到 2 个，剩下 3 条旧规则永远删不掉
const removeRuleIds = websites.map((_, i) => BLOCK_RULE_ID_START + i);
```

用户删减网站后，多出来的旧规则会一直挂在浏览器里继续拦截，而设置页上已经看不到它了——非常难排查的那种 bug。正确做法是从浏览器实际状态出发全量清理：

```js
// ✅ 以浏览器里真实存在的规则为准
const existing = await chrome.declarativeNetRequest.getDynamicRules();
const removeRuleIds = existing.map((rule) => rule.id);
```

**给新方案留兜底**。`regexSubstitution` 生成 `chrome-extension://` 目标这个用法，文档没有明确背书，不同 Chrome 版本行为可能不一致。万一规则被拒，整个拦截功能就全废了——比不更新还糟。所以包了一层 fallback，规则被拒时自动退回旧的固定跳转：

```js
try {
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
} catch (error) {
  console.warn("Focus Blocker: regex rules rejected, falling back", error);
  // 退回 urlFilter + extensionPath，功能退化但拦截不失效
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: fallback });
}
```

**新功能可以不生效，老功能不能坏**——这条在自己维护的小工具上同样适用。真机验证时特意去 Service Worker 控制台确认没有打出那行 warning，才确定新方案确实走通了。

## 七、隐私：为什么它不需要联网

扩展不读取、不收集、不上传任何网页内容和浏览记录。黑名单、时间表、语言偏好全部存在 `chrome.storage.local`，也就是你本地的 Chrome 配置里。没有账号体系，没有统计脚本，没有任何一个出站请求。

这不是什么道德优势，纯粹是**这个功能压根不需要联网**——时间判断在本地，域名匹配在浏览器内部完成。一个不需要联网的工具去申请联网，本身就该被怀疑。

## 八、它拦不住什么

必须说清楚的局限：**Chrome 扩展没法阻止你关掉它、卸载它，或者换个浏览器**。任何声称能做到「强制锁定」的扩展多半在夸大其词。

它真正解决的是「无意识切换标签页」这类肌肉记忆——手已经把网址敲进去了，脑子还没反应过来，这时候一个拦截页足以把你拽回来。至于你铁了心要去禁用它，那就不是工具能解决的问题了。

**定位是专注辅助，不是自我惩罚系统。** 想清楚这点，期望值就对了。

## 九、小结

功能极简的工具反而容易踩到平台细节：MV3 的 Service Worker 生命周期、DNR 的规则表达能力、正则的匹配边界、异步消息的时序——每个都不难，但漏一个就是一个用户能感知到的 bug。

代码总共不到 500 行，权限只要 4 个，没有任何依赖和构建步骤。有类似需求的可以去商店装来试试，也欢迎聊聊你是怎么和分心这件事和解的。

> 相关文档：[declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) · [Manifest V3 迁移指南](https://developer.chrome.com/docs/extensions/develop/migrate)
