---
cover: /images/cover/rust/result-error-design.webp
title: RustInPractice（05）：Option、Result 与错误设计
date: 2026-07-20 14:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - 错误处理
  - Result
  - Option
  - thiserror
---

Rust 没有传统意义的异常。可预期失败不靠隐式跳转，而是出现在函数签名中：`Option<T>` 表示可能没有值，`Result<T, E>` 表示成功值或明确错误。调用者不能假装没看见这个分支。

<!-- more -->

> 这是 RustInPractice 的第 05 篇。对应 demo：`error_handling_demo`。下一篇转向 Cargo 依赖、模块和 workspace。

## 一、先区分“不存在”和“失败”

```rust
fn find_user(id: u64) -> Option<String> {
    (id == 1).then(|| "Ada".to_string())
}

fn parse_port(text: &str) -> Result<u16, std::num::ParseIntError> {
    text.parse()
}
```

找不到用户可能是正常查询结果，因此使用 `Option`。端口文本格式不合法则是可诊断的失败，使用 `Result` 并保留错误原因。

不要为了省事把所有错误变成 `None`。一旦丢弃错误信息，调用者就无法区分“没找到”“权限不足”和“数据损坏”。

## 二、`?` 只做一件事：早返回错误

demo 的配置解析会从 `HashMap` 取出文本，并逐行转换字段：

```rust
fn read_port(text: &str) -> Result<u16, ParseError> {
    let port = text
        .parse::<u16>()
        .map_err(|_| ParseError::InvalidFormat(text.to_string()))?;
    Ok(port)
}
```

`?` 遇到 `Ok(value)` 就取出 `value`；遇到 `Err(error)` 就从当前函数提前返回。它不是忽略错误，也不是异常。函数返回类型必须允许该错误传播或转换。

## 三、把领域错误建成 enum

`thiserror` 很适合库或模块内的明确错误类型：

```rust
use thiserror::Error;

#[derive(Debug, Error)]
enum ParseError {
    #[error("file not found: {0}")]
    FileNotFound(String),
    #[error("invalid format: {0}")]
    InvalidFormat(String),
    #[error("missing key: {0}")]
    MissingKey(String),
}
```

这种设计的好处是调用方可按变体做处理，日志也能输出可读消息。对于顶层二进制程序，`anyhow::Result` 常用于集中呈现错误；对于可复用库，更应暴露具体、可匹配的错误 enum。

## 四、常见转换方法

| 操作 | 作用 |
|---|---|
| `.ok_or_else(...)` | 把 `Option<T>` 转为 `Result<T, E>` |
| `.ok()` | 把 `Result<T, E>` 转为 `Option<T>`，丢弃错误 |
| `.map_err(...)` | 将一种错误转换为另一种错误 |
| `.unwrap_or(default)` | `Option` 为空时提供默认值 |
| `?` | 传播当前函数无法处理的错误 |

`unwrap()` 与 `expect()` 适合测试、不可失败的固定初始化，或错误发生时程序确实无法继续的断言点。它们不应成为网络、文件、用户输入等边界上的常规控制流。

## 五、错误信息也要考虑安全性

错误需要帮助定位问题，但不应把凭据、完整私有配置或用户敏感数据写进消息。一个安全的边界原则是：

```text
对开发者保留足够上下文；对外部响应只暴露可公开的信息。
```

后面的 HTTP 与 CLI 文章会把“领域错误、日志、对外响应”分开处理。本篇先记住：用类型让失败可见，用 `?` 把暂时无法处理的失败向上传递。

## 六、小结

- 正常的“没有结果”用 `Option<T>`，可诊断失败用 `Result<T, E>`。
- `?` 是显式的错误早返回，不会吞掉错误。
- `thiserror` 适合定义可匹配、可读的领域错误。
- 不要在输入边界随意 `unwrap()`，也不要在错误信息中泄露敏感数据。

> RustInPractice 第 05 篇完。下一篇：Cargo 依赖、package、module 与 workspace，组织多 crate 项目。
