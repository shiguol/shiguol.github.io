---
cover: /images/cover/rust/tokio-async.webp
title: RustInPractice（19）：Tokio 异步基础
date: 2026-07-22 13:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - Tokio
  - 异步
  - Future
---

async 不是“自动开线程”。Rust 的 `async fn` 返回 Future，Future 只有被 runtime 轮询时才推进；遇到 `.await` 无法继续时，它让出执行权，其他任务可以运行。

<!-- more -->

> RustInPractice 第 19 篇。对应 demo：`learning_guide` 的 async 子命令、`thread_pool`。下一篇讨论有界并发与后台任务。

## 一、Future 是惰性的描述

```rust
async fn fetch_name() -> String {
    "Rust".to_string()
}
```

调用 `fetch_name()` 得到的是 Future，不会立刻执行。需要在 async 上下文 `.await`，并由 Tokio runtime 等 executor 轮询：

```rust
#[tokio::main]
async fn main() {
    let name = fetch_name().await;
    println!("{name}");
}
```

## 二、任务不是 OS 线程

```rust
let first = tokio::spawn(async { 1 + 1 });
let second = tokio::spawn(async { "hello".to_string() });
println!("{}", first.await?);
println!("{}", second.await?);
```

Tokio task 是 runtime 调度的轻量任务。大量等待网络或计时器的任务可复用少量 OS 线程；但 CPU 密集循环或阻塞文件操作会占住 runtime worker，应该使用专用线程池或 `spawn_blocking`。

## 三、取消是 drop，不是异常

一个 task 的 JoinHandle 被 abort，或 Future 被丢弃时，Future 会在下一个可取消点停止。资源仍会执行 Drop，但外部副作用可能已经完成一部分。因此要设计幂等操作、超时和明确的关闭信号。

`tokio::select!` 可等待多个事件中的第一个：超时、取消信号、channel 消息等。它是 async 服务优雅退出和请求超时的基本工具。

## 四、不要在 async 中阻塞

| 工作 | 合适方式 |
|---|---|
| 网络、Tokio timer、async channel | `.await` |
| 短小同步计算 | 直接执行 |
| CPU 密集或阻塞库调用 | `spawn_blocking` / 专用线程池 |
| 长时间持有同步 Mutex | 重构，避免跨 `.await` |

## 五、小结

- async 函数返回惰性 Future，runtime 负责轮询。
- Tokio task 不等于线程，适合高并发等待。
- Future drop 即取消，需要设计超时与幂等性。
- 阻塞工作不能占用 async runtime worker。

> 下一篇：Semaphore、背压与后台任务，限制并发比无限 spawn 更重要。
