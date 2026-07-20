---
cover: /images/cover/rust/collections-iterators.webp
title: RustInPractice（04）：数组、Vec、元组与迭代器
date: 2026-07-20 13:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - Vec
  - 迭代器
  - 闭包
  - 元组
---

集合是所有权规则最容易“看得见”的地方：同样是遍历，`for item in values`、`for item in &values`、`for item in &mut values` 的语义完全不同。本篇借 `array_demo`、`tuple_demo` 和 `closure_demo` 建立容器与迭代的基本选择。

<!-- more -->

> 这是 RustInPractice 的第 04 篇。对应 demo：`array_demo`、`tuple_demo`、`closure_demo`。下一篇用 `Option`、`Result` 和 `?` 处理可恢复错误。

## 一、固定数组和动态 `Vec`

`[T; N]` 的长度是类型的一部分，适合编译期已知数量的数据：

```rust
let weekdays: [&str; 3] = ["Mon", "Tue", "Wed"];
```

`Vec<T>` 是可增长的连续容器，适合运行时才能知道长度的数据：

```rust
let mut scores = vec![80, 92, 76];
scores.push(88);
scores.resize(6, 0);
println!("len={}, capacity={}", scores.len(), scores.capacity());
```

`len()` 是实际元素数，`capacity()` 是已分配空间可容纳的元素数。容量通常比长度大，这是为了让连续 `push` 具备摊还常数时间复杂度；不要把 capacity 当作业务数据。

## 二、遍历方式就是所有权策略

```rust
let values = vec![1, 2, 3];

for value in &values {
    println!("read: {value}");
}
// values 仍可使用

for value in values {
    println!("owned: {value}");
}
// values 在这里已被消费
```

三个常用入口：

| 写法 | 产出 | 原集合后续可用？ |
|---|---|---|
| `.iter()` 或 `&values` | `&T` | 可以 |
| `.iter_mut()` 或 `&mut values` | `&mut T` | 可以，但借用期间受限 |
| `.into_iter()` 或按值 `values` | `T` | 通常不可以 |

`i32` 等 `Copy` 元素看起来像没有被移动，是因为元素被复制；不要把这个体验推广到 `String` 等拥有资源的类型。

## 三、元组适合固定、异质的小组合

```rust
fn swap<T, U>(pair: (T, U)) -> (U, T) {
    (pair.1, pair.0)
}

let (host, port, secure) = ("127.0.0.1", 8080_u16, true);
println!("{host}:{port}, secure={secure}");
```

元组适合临时返回两个或三个不同类型值。若字段有稳定业务含义，改用具名 struct 更清晰，也能避免 `.0`、`.1` 在维护中失去含义。

## 四、迭代器和闭包：描述“做什么”

demo 用一条管道计算偶数的十倍和：

```rust
let nums = vec![1, 2, 3, 4, 5];
let sum: i32 = nums
    .iter()
    .filter(|&&x| x % 2 == 0)
    .map(|x| x * 10)
    .sum();
assert_eq!(sum, 60);
```

迭代器适配器通常是惰性的。`filter`、`map` 只是描述流水线；`sum`、`collect`、`for` 这类消费者才会真正驱动计算。

闭包会按使用方式实现 `Fn`、`FnMut` 或 `FnOnce`：

| trait | 捕获方式直觉 | 调用次数 |
|---|---|---|
| `Fn` | 只读借用 | 可多次 |
| `FnMut` | 可变借用 | 可多次 |
| `FnOnce` | 消耗捕获值 | 至少一次 |

先写自然的闭包，让编译器推断；只有 API 约束需要时才显式写 trait bound。

## 五、小结

- 固定长度用数组，运行时可增长序列用 `Vec`。
- 迭代方式决定借用、可变借用还是转移所有权。
- 元组适合轻量组合，有业务字段时优先 struct。
- 迭代器管道在消费者出现前不会执行，闭包的捕获方式由使用场景决定。

> RustInPractice 第 04 篇完。下一篇：`Option`、`Result`、`?` 与错误设计。
