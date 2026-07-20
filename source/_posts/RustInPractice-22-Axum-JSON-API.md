---
cover: /images/cover/rust/axum-json-api.webp
title: RustInPractice（22）：用 Axum 写 JSON API
date: 2026-07-23 09:00:00
categories: [RustInPractice]
tags: [Rust, 编程, 2026, Axum, HTTP, JSON]
---

Axum 将路由、提取器和返回值组合成类型安全的 HTTP API。demo 用 `Router`、`Json` 和共享状态完成一个最小用户接口。

<!-- more -->

> 对应 `networking/http_json`。下一篇：WebSocket 与异步流。

## 路由与提取器

```rust
Router::new()
    .route("/users", get(list_users).post(create_user))
    .route("/users/:id", get(get_user))
```

`State(store)` 取得应用状态，`Path(id)` 解析路径参数，`Json(body)` 反序列化请求体。handler 返回 `Json<T>`，Serde 负责序列化。

## 状态与错误

demo 用 `Arc<Mutex<HashMap<...>>>` 保存内存数据，锁只在同步读取或写入期间持有，绝不能跨 `.await`。真实 API 应增加输入验证、`201 Created`、结构化错误体、稳定排序和 handler 集成测试。

这个 store 会在重启后丢失，ID 生成也只适用于单进程 demo；它是路由学习材料，不是数据库设计。

## 小结

- Router 描述端点，extractor 让输入类型化。
- 应用状态应小、可同步，锁范围必须短。
- 对外响应和内部错误日志需分层，不能泄露私有数据。

> 下一篇：WebSocket 与异步流。
