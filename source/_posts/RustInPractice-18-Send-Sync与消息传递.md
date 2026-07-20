---
cover: /images/cover/rust/send-sync-channels.webp
title: RustInPractice（18）：Send、Sync 与消息传递
date: 2026-07-22 12:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - Send
  - Sync
  - 并发
  - Channel
---

当 Rust 拒绝把某个值送进线程时，它不是在“限制你”，而是在检查线程边界上的安全契约。`Send` 描述值能否转移给另一个线程，`Sync` 描述共享引用能否被多个线程安全访问。

<!-- more -->

> RustInPractice 第 18 篇。前置：第 17 篇原生线程。下一篇进入 Tokio async。

## 一、两个 marker trait

| trait | 含义 |
|---|---|
| `Send` | 类型的所有权可安全转移到另一个线程 |
| `Sync` | `&T` 可安全被多个线程共享 |

大多数普通值自动实现二者。`Rc<T>` 不是 `Send`，因为引用计数不是原子操作；`Arc<T>` 使用原子计数，因此可跨线程共享。

```rust
let data = std::sync::Arc::new(vec![1, 2, 3]);
let worker = std::sync::Arc::clone(&data);
std::thread::spawn(move || println!("{:?}", worker));
```

## 二、优先传递所有权和消息

如果任务不必共同修改同一份状态，channel 往往比 `Arc<Mutex<T>>` 简单：

```rust
let (tx, rx) = std::sync::mpsc::channel();
std::thread::spawn(move || tx.send(42).unwrap());
println!("{}", rx.recv().unwrap());
```

发送端转移消息所有权，接收端成为新拥有者。这样数据在同一时刻只由一个任务处理，许多锁和死锁问题自然消失。

## 三、有界队列是背压基础

无界 channel 在生产者比消费者快时会持续占用内存。有界 `sync_channel(n)` 会在满时阻塞发送方；Tokio 也有 `mpsc::channel(n)`。容量不是随便选的常数，而是系统对峰值、延迟和拒绝策略的明确承诺。

## 四、不要手写 `unsafe impl Send`

Rust 会根据字段自动推导 marker trait。手写 `unsafe impl Send` 等于向编译器保证“即使跨线程也绝对安全”，只有实现底层同步原语时才可能需要。普通业务代码应通过 Arc、Mutex、channel 和所有权设计获得正确 trait。

## 五、小结

- `Send` 处理所有权跨线程转移，`Sync` 处理共享引用跨线程访问。
- `Rc` 与 `Arc` 的区别来自线程安全计数。
- 不共享状态时，优先使用 channel 传递消息。
- 有界队列让背压成为显式设计，而非内存耗尽后的事故。

> 下一篇：Future、Tokio runtime、任务和取消，理解 async 的运行模型。
