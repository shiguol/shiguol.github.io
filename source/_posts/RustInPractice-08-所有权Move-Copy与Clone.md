---
cover: /images/cover/rust/ownership-move.webp
title: RustInPractice（08）：所有权、Move、Copy 与 Clone
date: 2026-07-21 09:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - 所有权
  - Move
  - Copy
  - Clone
---

Rust 的所有权不是“手动管理内存”的另一种说法，而是一套资源责任规则：一个值在任意时刻只有一个拥有者；拥有者离开作用域时，值会被自动清理；赋值和传参默认会转移所有权。

<!-- more -->

> 这是 RustInPractice 第二季的第 08 篇。对应 demo：`ownership/move_demo`。下一篇讲借用：不转移所有权，如何安全地访问一个值。

## 一、Move：责任转移，不是字节复制

```rust
let first = String::from("hello");
let second = first;
// println!("{first}"); // 编译错误：first 已被移动
println!("{second}");
```

`String` 管理一段堆内存。若赋值后两个变量都可用，它们可能在作用域结束时重复释放同一块资源。Rust 因而将赋值定义为 move：`second` 接管资源，`first` 失效。

这条规则也适用于函数：

```rust
fn consume(text: String) {
    println!("{text}");
}

let text = String::from("payload");
consume(text);
```

函数参数按值接收，代表调用者把所有权交给函数。若只需查看数据，下一篇会改用 `&str` 或 `&T`。

## 二、`Copy` 必须显式选择

简单数值如 `i32` 会复制：

```rust
let x = 42;
let y = x;
println!("{x}, {y}");
```

这是因为 `i32` 实现了 `Copy`。自定义类型必须显式派生：

```rust
#[derive(Copy, Clone)]
struct Point { x: i32, y: i32 }
```

字段都是 `Copy` **不会**让 struct 自动实现 `Copy`。这是刻意设计：复制语义属于 API 承诺，类型作者应主动声明它。

## 三、`Clone` 是显式的可能昂贵操作

```rust
let original = String::from("data");
let duplicate = original.clone();
println!("{original}, {duplicate}");
```

`clone()` 说明调用者要一份独立副本。对 `String`、`Vec`、复杂树等类型，它可能分配内存并复制大量数据。不要为了绕过借用检查器而习惯性 `clone()`；先问自己：函数是否其实只需要借用？

## 四、返回值自然交还所有权

```rust
fn make_message() -> String {
    String::from("created")
}

let message = make_message();
```

返回值将所有权交回调用方。Rust 会在合适时优化移动，不需要为了“避免复制”写复杂的指针技巧。先让 API 的所有权语义正确，再考虑性能测量。

## 五、API 选择表

| 需求 | 参数形式 | 含义 |
|---|---|---|
| 函数需要接管数据 | `T` | 调用方转移所有权 |
| 函数只读取数据 | `&T` | 不转移，不复制 |
| 函数需要原地修改 | `&mut T` | 独占的可变借用 |
| 函数需要独立副本 | `T` + 调用方 `clone()` | 复制成本显式可见 |

## 六、小结

- 非 `Copy` 值的赋值、传参和返回会表达所有权转移。
- `Copy` 是显式、廉价复制的 trait；不是字段属性自动推导出的行为。
- `Clone` 是主动复制，可能分配和消耗时间。
- 所有权不是限制，它让资源释放责任始终可追踪。

> RustInPractice 第 08 篇完。下一篇：借用与可变借用，访问数据但不夺走它。
