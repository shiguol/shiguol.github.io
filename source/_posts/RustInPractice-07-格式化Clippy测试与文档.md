---
cover: /images/cover/rust/testing-quality-loop.webp
title: RustInPractice（07）：格式化、Clippy、测试与文档
date: 2026-07-20 16:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - 测试
  - Clippy
  - Rustdoc
  - 代码质量
---

能编译不是完成。格式化解决风格噪声，Clippy 捕捉常见误用，测试验证行为，Rustdoc 把 API 的使用方式变成可执行说明。这四项组合起来，才是 Rust 项目的基础反馈环。

<!-- more -->

> 这是 RustInPractice 第一季的收官篇。对应 demo：`format_demo`、`testing_demo`。下一季从所有权、move、`Copy` 与 `Clone` 开始。

## 一、把检查命令放进日常循环

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo doc --no-deps
```

`fmt --check` 只检查不改文件，适合 CI；本地修正格式直接运行 `cargo fmt`。`-D warnings` 让 Clippy 警告阻断流程，能防止“先忽略、以后再说”变成永久债务。规则不是绝对真理，必要时可局部说明原因后允许某条 lint，但不要无理由全局关闭。

## 二、`Display` 与 `Debug` 各司其职

`format_demo` 为坐标实现 `Display`：

```rust
use std::fmt;

struct Point { x: f64, y: f64 }

impl fmt::Display for Point {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({:.2}, {:.2})", self.x, self.y)
    }
}
```

`{}` 面向用户可读输出，`{:?}` 依赖 `Debug`，适合开发诊断。不要把调试输出当稳定外部协议；如果程序要输出 JSON、CSV 等机器接口，应使用对应序列化库并定义版本策略。

## 三、单元测试从行为开始

`testing_demo` 把 `Calculator` 放在 library crate 中，并将测试置于 `#[cfg(test)]` 模块：

```rust
#[test]
fn divide_by_zero_is_an_error() {
    assert!(Calculator::divide(1.0, 0.0).is_err());
}

#[test]
fn factorial_of_zero_is_one() {
    assert_eq!(Calculator::factorial(0), 1);
}
```

测试名描述行为，而不是描述实现细节。优先覆盖边界：空输入、零、最大最小值、非法格式和错误传播。对 `Result`，测试成功值与错误分支；对算法，测试空集合、单元素和重复元素。

demo 中整数计算可以精确比较，但浮点值不总能这样测。对可能有舍入误差的结果，改用容差：

```rust
let actual = 0.1_f64 + 0.2;
assert!((actual - 0.3).abs() < 1e-12);
```

## 四、单元测试之外

| 测试类型 | 放置位置 | 关注点 |
|---|---|---|
| 单元测试 | 与实现同文件的 `#[cfg(test)]` 模块 | 私有函数和局部逻辑 |
| 集成测试 | `tests/` 目录 | 只通过公开 API 使用 crate |
| doctest | Rustdoc 注释代码块 | 文档示例是否仍可运行 |
| 属性测试 | 专用测试框架 | 一类输入必须满足的不变量 |

集成测试很适合 CLI 和 HTTP API：将它们当成黑盒，断言退出状态、响应状态和公开输出。测试输出和 fixture 同样应使用虚构数据，不能把本地路径、真实账号或凭据写进仓库。

## 五、Rustdoc 是 API 的一部分

公开函数应说明：它做什么、参数与返回值的含义、错误条件，以及一个最小示例。生成文档：

```bash
cargo doc --open
```

文档中的 Rust 代码块默认会被编译为 doctest。这个约束很有价值：API 改名或行为变化时，过期示例会尽早暴露。

## 六、第一季回顾

第一季从工具链、表达式、类型、文本、集合、错误和项目组织搭起了地基。下一季的重点是 Rust 最独特的部分：一个值何时被移动、何时被借用、引用为什么必须活得足够久。

> RustInPractice 第 07 篇完，第一季完结。下一篇：所有权，理解 move、`Copy` 与 `Clone`。
