---
cover: /images/cover/rust/websocket-streams.webp
title: RustInPractice（23）：WebSocket 与异步流
date: 2026-07-23 10:00:00
categories: [RustInPractice]
tags: [Rust, 编程, 2026, WebSocket, Tokio, 异步]
---

WebSocket 在 HTTP upgrade 后保持双向消息通道。`tokio-tungstenite` 将连接同时实现 Stream 与 Sink，接收用 `next().await`，发送用 `send().await`。

<!-- more -->

> 对应 `networking/websocket`。下一篇：SQLite。

```rust
while let Some(message) = ws.next().await {
    let message = message?;
    ws.send(Message::Text("Echo: hello".into())).await?;
}
```

服务端通常为每条连接 spawn 一个 task，连接结束后 task 自动结束。需要显式处理 text、binary、ping、pong、close 和错误；demo 将 binary 转成文本提示，因此它是**文本 echo**，不是保留二进制 payload 的 echo 服务。

accept 循环也不应静默吞掉 listener 错误。生产服务还需要连接上限、超时、认证和关闭协议。

> 下一篇：SQLite 与 rusqlite。
