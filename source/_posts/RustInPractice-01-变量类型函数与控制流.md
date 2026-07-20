---
cover: /images/cover/rust/expressions-control-flow.webp
title: RustInPractice（01）：变量、类型、函数与控制流
date: 2026-07-20 10:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - 基础语法
  - 控制流
---

Rust 初看有不少符号：`let`、`mut`、`->`、末尾分号。真正值得先建立的直觉只有一句：**Rust 用不可变绑定做默认值，并把很多控制结构设计成会产生值的表达式。**

<!-- more -->

> 这是 RustInPractice 的第 01 篇。上一篇完成 Cargo 环境；本篇的示例可以直接放进任意 `main.rs` 运行。下一篇进入 struct、enum 和模式匹配。

## 一、绑定默认不可变

`let` 创建的是一个绑定。默认不能通过该绑定修改值：

```rust
let retries = 3;
// retries += 1; // 编译错误

let mut remaining = 3;
remaining -= 1;
```

这不是说数据永远不能变，而是要求修改意图写在 `mut` 上。读到函数时，读者能先判断哪些局部状态会变化。

Rust 也允许 shadowing：同名新绑定遮住旧绑定。

```rust
let input = "42";
let input: u32 = input.parse().expect("literal is a valid integer");
```

这里前一个 `input` 是字符串切片，后一个是整数。shadowing 适合“同一个业务概念经过转换”的场景；若只是反复改变计数器，`mut` 更清楚。

## 二、类型和字面量

编译器通常能推断类型；公共 API、转换边界和容易歧义的数字应当显式标注：

```rust
let port: u16 = 8080;
let ratio = 0.75_f64;
let enabled: bool = true;
let marker: char = 'R';
```

常见数值类型是有符号 `i32`、无符号 `u32`、平台相关 `usize` 和浮点 `f64`。`usize` 常用于容器下标和长度，不要把外部传入的负数直接转换成它。

## 三、函数的返回值来自最后一个表达式

函数体中的“没有分号的一行”可以成为返回值：

```rust
fn clamp(value: i32, min: i32, max: i32) -> i32 {
    if value < min {
        min
    } else if value > max {
        max
    } else {
        value
    }
}
```

`if` 的每个分支都返回一个 `i32`，整个 `if` 也就是一个 `i32`。如果最后写成 `value;`，它会变成语句，函数返回的则是 `()`，也就是空元组。

## 四、控制流也能赋值

`if` 是表达式，因此可直接赋给变量：

```rust
let level = if retries == 0 { "stop" } else { "retry" };
```

循环有不同职责：

| 形式 | 典型用途 |
|---|---|
| `loop` | 明确的无限循环，需要 `break` 退出 |
| `while` | 条件驱动的循环 |
| `for` | 遍历范围或迭代器，最常用 |

`loop` 甚至能通过 `break` 返回值：

```rust
let mut attempt = 0;
let accepted_at = loop {
    attempt += 1;
    if attempt == 3 {
        break attempt;
    }
};
assert_eq!(accepted_at, 3);
```

遍历集合优先使用 `for item in collection` 或 `for item in &collection`，而不是手写递增下标。后面讲迭代器时会解释两者的所有权差异。

## 五、一个完整小例子

```rust
fn label(score: u32) -> &'static str {
    if score >= 90 {
        "excellent"
    } else if score >= 60 {
        "pass"
    } else {
        "retry"
    }
}

fn main() {
    let scores = [96, 74, 52];
    for score in scores {
        println!("{score}: {}", label(score));
    }
}
```

`&'static str` 表示返回的是程序整个运行期都有效的字符串字面量。它不是“所有字符串都该用的类型”；需要动态拼接或读取的文本通常会用 `String`，第 03 篇会展开。

## 六、小结

- `let` 默认不可变，`mut` 让状态变化显式化。
- 省略类型依赖推断，边界处用类型标注消除歧义。
- Rust 函数与 `if` 都是表达式，最后一个无分号表达式可返回值。
- 优先使用 `for` 遍历，使用 `loop { break value }` 表达有结果的循环。

> RustInPractice 第 01 篇完。下一篇：struct、方法、enum 与模式匹配，用类型把状态写清楚。
