---
cover: /images/cover/rust/native-concurrency.webp
title: RustInPractice（17）：原生线程与同步原语
date: 2026-07-22 11:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - 并发
  - 线程
  - Mutex
  - Condvar
  - 原子操作
---

Rust 消除了大量内存不安全并发，但不会自动让逻辑免于死锁、饥饿或错误同步。先理解 `thread`、`Mutex`、`Condvar`、`Barrier` 和 atomic 的职责，再决定是否需要 async。

<!-- more -->

> RustInPractice 第 17 篇。对应 demo：`thread_demos`、`sync_primitives`。下一篇解释 `Send`、`Sync` 与消息传递。

## 一、线程必须被等待或明确放弃

```rust
let handle = std::thread::spawn(|| "worker done");
let result = handle.join().expect("worker panicked");
println!("{result}");
```

`join` 等待线程结束并取得结果。demo 使用 `unwrap()` 让学习输出简短；生产代码应决定如何处理线程 panic，而不是无条件崩溃。

## 二、Mutex 保护共享可变状态

```rust
use std::sync::{Arc, Mutex};

let value = Arc::new(Mutex::new(0));
*value.lock().expect("lock poisoned") += 1;
```

锁 guard 离开作用域时自动释放，因此锁范围应小。不要持锁执行 IO、等待线程或调用未知回调，这些都是死锁与吞吐下降的常见来源。

## 三、Condvar 等待条件而非忙等

生产者-消费者 demo 的关键是循环等待：

```rust
while queue.is_empty() {
    queue = condvar.wait(queue).expect("lock poisoned");
}
```

必须用 `while` 而不是 `if`，因为唤醒后条件可能已被其他线程改变，或出现虚假唤醒。条件状态放在 Mutex 内，Condvar 只负责等待和通知。

## 四、Barrier 与 atomic

`Barrier` 让一组线程都到达同步点后再继续，适合多阶段计算。`AtomicI64::fetch_add` 则适合简单计数器：

```rust
counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
```

`Relaxed` 只保证该变量的原子读写，不建立其他内存操作的顺序关系。计数器可以用它；发布数据、实现锁或跨变量同步时必须理解更强 ordering，通常优先使用 Mutex 或 channel。

## 五、小结

- `join` 让线程结果和失败可见。
- Mutex 保护共享状态，guard 范围越小越好。
- Condvar 必须配合受锁保护的条件和 `while` 循环。
- Barrier 协调阶段，atomic 处理简单无锁状态。

> 下一篇：`Send`、`Sync` 与消息传递，理解哪些值为什么能跨线程。
