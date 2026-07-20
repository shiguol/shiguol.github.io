---
cover: /images/cover/rust/backpressure-tasks.webp
title: RustInPractice（20）：限流、背压与后台任务
date: 2026-07-22 14:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - Tokio
  - Semaphore
  - 背压
  - 异步
---

每个请求都 `spawn` 一个任务看起来很轻松，但高峰时会把内存、连接和下游服务推向失控。生产级异步系统的关键不是“能并发”，而是“知道什么时候必须慢下来”。

<!-- more -->

> RustInPractice 第 20 篇。对应 demo：`concurrency/thread_pool`。下一篇用 CLI、配置、文件和日志组织一个真实入口。

## 一、demo 实际是什么？

`TaskPool` 使用 `tokio::sync::Semaphore`：

```rust
let _permit = semaphore.acquire().await?;
run_task().await;
```

它限制同一时刻运行的任务数量，但每个提交仍会创建 Tokio task。因此它准确的名称是**异步并发限制器**，不是固定 worker 线程池。真正 worker pool 通常还需要有界 channel、固定 worker 集合和关闭协议。

## 二、背压策略必须可见

队列或 semaphore 满时，系统可以：

| 策略 | 结果 |
|---|---|
| 等待 | 提高延迟，保护下游 |
| 拒绝 | 快速返回，调用方重试或降级 |
| 超时 | 避免无限等待 |
| 丢弃 | 只适合可丢失事件 |

不设上限等于把背压转嫁给内存。选择容量前应明确任务耗时、峰值吞吐、可接受延迟和调用方重试行为。

## 三、后台任务服务的边界

demo 的 HTTP 服务保存任务状态、后台执行并提供查询接口，适合理解状态流转。它不具备生产 job system 的关键能力：任务数量无限增长、`duration_ms` 没有上限、没有取消/TTL/持久化、同步 Mutex 只适合短临界区。

文章或项目中应明确标记这些边界，避免把“可运行 demo”误称为生产队列。

## 四、一个更稳妥的方向

```text
请求 -> 有界 channel -> 固定 worker -> 结果/状态存储
          | 满时拒绝或超时 |
```

再配合 cancellation token、优雅关闭和指标，才能让队列在负载下仍可控。

## 五、小结

- semaphore 限制并发，不自动形成 worker pool。
- 背压应体现在有界容量、超时和拒绝策略中。
- 后台任务必须考虑生命周期、清理、取消和可观测性。
- 不要在 async handler 中长时间持有同步锁或无限创建任务。

> 下一篇：CLI、配置、文件与日志，将多个能力组织为可维护程序。
