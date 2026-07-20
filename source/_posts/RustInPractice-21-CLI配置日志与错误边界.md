---
cover: /images/cover/rust/cli-architecture.webp
title: RustInPractice（21）：CLI、配置、日志与错误边界
date: 2026-07-22 15:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - CLI
  - Clap
  - 文件系统
  - 日志
---

语言特性最终要落到程序入口。一个可靠 CLI 应将参数解析、配置读取、业务逻辑、日志和错误呈现分层，使核心代码可测试、命令行只是薄薄的一层适配器。

<!-- more -->

> RustInPractice 第三季收官篇。对应 demo：`learning_guide`、`argv_demo`、`filesystem_demo`。第四季将进入 Axum、WebSocket、SQLite 与算法实践。

## 一、用 Clap 声明命令结构

```rust
#[derive(clap::Subcommand)]
enum Commands {
    List,
    Demo { name: String },
}
```

`learning_guide` 将 subcommand 解析后交给 `demos::run`。入口只负责输入适配，模块负责业务行为，这让同一逻辑既能被 CLI 调用，也能被测试直接调用。

## 二、配置来源要有优先级

常见顺序是：命令行参数 > 环境变量 > 配置文件 > 安全默认值。不要把密钥写进默认值、示例输出或日志；示例使用 `user@example.com`、`<TOKEN>` 这类占位值，真正凭据从环境变量读取。

## 三、文件操作始终返回 Result

```rust
let content = std::fs::read_to_string(path)?;
```

`filesystem_demo` 展示了 `Path::join`、文件 Drop 和 `?`。实际应用应避免固定共享临时路径：并发运行可能互相清理文件。测试使用独立临时目录，生产使用由配置决定且经过验证的路径。

## 四、日志与对外错误分开

日志给维护者，错误响应给用户。前者可附带安全的诊断上下文，后者只暴露可公开的错误码和说明。无论哪一种，都不能记录令牌、密码、真实邮箱、绝对本机路径或私有配置。

## 五、第三季回顾

本季从集合选型开始，建立测试边界，理解原生线程和 marker trait，再进入 Tokio 限流与 CLI 组织。到这里，Rust 的类型与所有权模型已经可以服务于工程结构；下一季将把它应用到 HTTP、WebSocket、SQLite 和算法。

> RustInPractice 第 21 篇完，第三季完结。下一篇：Axum JSON API。
