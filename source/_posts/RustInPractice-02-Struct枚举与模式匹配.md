---
cover: /images/cover/rust/types-pattern-matching.webp
title: RustInPractice（02）：Struct、枚举与模式匹配
date: 2026-07-20 11:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - Struct
  - 枚举
  - 模式匹配
---

很多程序把“状态”藏在整数、空指针或几个布尔字段中。Rust 更倾向于让状态直接出现在类型里：用 `struct` 聚合固定字段，用 `enum` 表达“若干种不同形状的可能性”，再用 `match` 强制处理所有分支。

<!-- more -->

> 这是 RustInPractice 的第 02 篇。对应 demo：`enum_demo` 与 `oop_demo`。下一篇解释 `String`、`&str`、切片和 UTF-8。

## 一、struct：数据与行为分开声明

```rust
struct Server {
    host: String,
    port: u16,
}

impl Server {
    fn new(host: String, port: u16) -> Self {
        Self { host, port }
    }

    fn address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
```

`struct` 定义数据布局；`impl` 为它定义关联函数和方法。`new` 没有 `self`，所以是关联函数；`address(&self)` 借用实例，只读地计算地址。`Self` 是当前实现类型的别名。

还有元组 struct 与单元 struct，但具名字段最适合业务数据：字段名会参与编译器诊断，也更容易避免参数顺序写反。

## 二、enum 不只是整数标签

`enum` 的每个变体可以携带不同数据：

```rust
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
}
```

这比“类型字段 + 多个可选字段”更可靠：`Quit` 根本没有坐标，`Move` 必须有 `x` 和 `y`，`Write` 必须有文本。非法状态无法构造出来。

demo 中还定义了 `Color`：

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Color {
    Red,
    Green,
    Blue,
}
```

`derive` 是让编译器生成 trait 实现的声明。注意 `Copy` **不会自动传播到 struct**：即使一个 struct 的字段全都可复制，仍需显式 `#[derive(Copy, Clone)]` 才拥有复制语义。

## 三、match 是穷尽检查

```rust
fn describe(message: &Message) {
    match message {
        Message::Quit => println!("quit"),
        Message::Move { x, y } => println!("move to ({x}, {y})"),
        Message::Write(text) => println!("write: {text}"),
    }
}
```

`match` 不只比较值，还会解构字段并绑定变量。更关键的是：新增一个变体后，所有不完整的 `match` 都会编译失败。这让状态机的修改不容易遗漏分支。

## 四、`Option` 和简洁匹配

标准库用 `Option<T>` 表示“有值或没有值”：

```rust
fn parse_color(name: &str) -> Option<Color> {
    match name {
        "red" => Some(Color::Red),
        "green" => Some(Color::Green),
        "blue" => Some(Color::Blue),
        _ => None,
    }
}

if let Some(color) = parse_color("red") {
    println!("{color:?}");
}
```

当只关心一个变体时，`if let` 比写一个只有空 `None` 分支的 `match` 更紧凑。需要“不匹配就提前返回”的场景则可以用 `let Some(value) = input else { return; };`。

## 五、什么时候用哪个？

| 需求 | 选择 |
|---|---|
| 一组字段总是同时存在 | `struct` |
| 一个值可能有不同形状 | `enum` |
| 可能没有结果但不是错误 | `Option<T>` |
| 需要针对全部状态做决策 | `match` |
| 只关心一个状态 | `if let` 或 `let else` |

## 六、小结

- `struct` 聚合固定字段，`impl` 定义关联函数和方法。
- `enum` 能携带数据，用类型排除不可能的状态。
- `match` 的穷尽检查是维护状态机的重要保障。
- `Option<T>` 让“可能不存在”成为可见的类型信息。

> RustInPractice 第 02 篇完。下一篇：`String`、`&str`、切片与 UTF-8，理解 Rust 为什么不允许字符串下标。
