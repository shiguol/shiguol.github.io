---
cover: /images/cover/rust/shared-ownership.webp
title: RustInPractice（12）：Rc、Arc 与 Weak
date: 2026-07-21 13:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - Rc
  - Arc
  - Weak
  - 所有权
  - 并发
---

默认的唯一所有权最简单，但有些图结构、缓存和只读共享数据确实需要多个拥有者。Rust 不会隐式开启垃圾回收，而是要求你选择引用计数类型：单线程用 `Rc<T>`，跨线程用 `Arc<T>`，反向或可选关联用 `Weak<T>`。

<!-- more -->

> 这是 RustInPractice 的第 12 篇。对应 demo：`rc_demo`、`weak_demo`。下一篇：`RefCell<T>` 与内部可变性。

## 一、`Rc<T>`：单线程共享所有权

```rust
use std::rc::Rc;

let config = Rc::new(String::from("shared"));
let first = Rc::clone(&config);
let second = Rc::clone(&config);
println!("{} {}", first, second);
```

`Rc::clone` 不会深拷贝 `String`，只增加强引用计数。最后一个强引用离开作用域时，值被释放。使用 `Rc::clone(&value)` 而不是 `value.clone()` 能让读者一眼看出这是计数增加，不是数据复制。

`Rc<T>` 不是线程安全的，不能传进 `thread::spawn`。

## 二、`Arc<T>`：原子引用计数

```rust
use std::sync::Arc;

let data = Arc::new(vec![1, 2, 3]);
let worker_data = Arc::clone(&data);
std::thread::spawn(move || println!("{:?}", worker_data));
```

`Arc` 的计数操作使用原子指令，可以安全地在多线程间共享。代价是计数维护通常比 `Rc` 更贵。它解决的是“多个线程共同拥有一个值”，不是“多个线程可以任意修改一个值”；可变共享需要额外同步原语，后续并发篇会讲。

## 三、强引用会造成循环

父节点拥有子节点，子节点若也用 `Rc` 强拥有父节点，就形成环：计数永远不归零，节点不会释放。反向关联应使用 `Weak<T>`：

```rust
use std::rc::{Rc, Weak};

let parent = Rc::new(String::from("root"));
let link: Weak<String> = Rc::downgrade(&parent);
assert_eq!(link.upgrade().as_deref().map(String::as_str), Some("root"));
```

`Weak` 不增加强引用计数。访问时必须 `upgrade()`，结果是 `Option<Rc<T>>`：目标已释放时得到 `None`。

## 四、选择规则

| 场景 | 类型 |
|---|---|
| 一个拥有者 | `T` 或 `Box<T>` |
| 单线程多个拥有者 | `Rc<T>` |
| 多线程多个拥有者 | `Arc<T>` |
| 不拥有的可选反向链接 | `Weak<T>` |

共享所有权是例外而非默认。若数据只需被多处读取，借用 `&T` 往往更简单；若任务之间只需交换消息，channel 可能比共享状态更合适。

## 五、小结

- `Rc` 与 `Arc` 都用引用计数表达共享所有权，区别在于线程安全成本。
- `Rc::clone` / `Arc::clone` 增加计数，不等同于深拷贝。
- `Weak` 不拥有目标，避免父子等双向关系形成内存循环。
- 选择共享所有权前，先考虑能否借用、转移或传消息。

> RustInPractice 第 12 篇完。下一篇：`RefCell<T>`，何时将借用检查从编译期推迟到运行时。
