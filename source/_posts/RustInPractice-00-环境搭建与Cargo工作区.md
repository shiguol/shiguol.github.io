---
cover: /images/cover/rust/cargo-workspace.webp
title: RustInPractice（00）：环境搭建、Cargo 与 Demo 工作区
date: 2026-07-20 09:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - Cargo
  - 开发环境
  - 工具链
---

学 Rust 的第一道门槛通常不是所有权，而是「这段代码到底该怎么编译、依赖放哪里、为什么一个仓库里能有这么多程序」。本篇先不讲语法，只完成三件事：装好工具链、认识 Cargo、跑通本系列的 demo 工作区。

<!-- more -->

> 这是 RustInPractice 的第 00 篇。系列主线共 28 篇，按基础、所有权、工程并发、应用算法四季推进；另有 5 篇终端 UI 番外。下一篇从变量、类型、函数和控制流开始。

## 一、Rust 工具链由什么组成？

Rust 的官方安装器是 `rustup`。它负责安装和切换编译器；日常真正高频使用的是 Cargo。

| 工具 | 职责 |
|---|---|
| `rustc` | Rust 编译器，负责把源代码编译为可执行文件或库 |
| `cargo` | 包管理、构建、测试、运行与文档工具 |
| `rustfmt` | 统一代码格式 |
| `clippy` | 静态检查器，专门提示常见 Rust 误用和可改进写法 |
| `rust-analyzer` | 编辑器语言服务，提供补全、跳转和诊断 |

安装完成后先确认版本：

```bash
rustc --version
cargo --version
```

本系列 demo 使用 Rust 2021 edition。edition 是语言解析和预导入规则的版本选择，不是某个特定编译器版本；Cargo 会在 `Cargo.toml` 中记录它。

## 二、Cargo 的最小闭环

任何 Rust 项目都可以从这三条命令起步：

```bash
cargo new hello_rust
cd hello_rust
cargo run
```

`cargo new` 创建的核心文件只有两个：

```text
hello_rust/
├── Cargo.toml       # 包元数据与依赖声明
└── src/
    └── main.rs      # 二进制程序入口
```

常用命令如下：

| 命令 | 用途 |
|---|---|
| `cargo run` | 编译并运行当前包 |
| `cargo build` | 只编译 |
| `cargo test` | 编译并运行测试 |
| `cargo fmt --check` | 检查格式，不修改文件 |
| `cargo clippy -- -D warnings` | 将 Clippy 警告视为错误 |
| `cargo doc --open` | 生成并打开 API 文档 |

开发时默认是 debug 构建，便于快速增量编译；需要测量性能或交付二进制时再加 `--release`。不要把 debug 与 release 的运行时间混在一起比较。

## 三、从一个包到一个工作区

本系列的代码不是一个巨型程序，而是一个 Cargo workspace：很多独立 crate 共用依赖版本和工具链约定。

```text
rust_demo/
├── Cargo.toml             # workspace 成员和共享依赖
├── basics/                # 语言基础
├── ownership/             # 所有权与智能指针
├── concurrency/           # 原生线程与 Tokio
├── algorithms/            # 数据结构和算法
├── networking/            # HTTP、WebSocket
├── database/              # SQLite
├── projects/              # CLI 与综合示例
└── turbo-vision/          # 可选 TUI 番外
```

每个 demo 都是可单独运行的二进制 crate。例如运行数组示例：

```bash
cargo run -p array_demo
```

`-p` 表示选择一个 package。这是 workspace 最重要的日常操作：不必每次运行所有示例，也不需要进入子目录。

## 四、先跑一个 demo

在 demo 工作区根目录执行：

```bash
cargo run -p array_demo
```

也可以使用仓库提供的封装脚本：

```bash
./build.sh -p array_demo --run
```

前者是通用 Cargo 命令，应该优先记住；后者统一了 release、测试和指定包的操作，适合批量演示。完整验证建议分层执行：

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test -p testing_demo
```

> 批量脚本会使用 `timeout`。部分系统默认没有 GNU 版本的该命令，此时可使用容器环境，或直接运行上面的 Cargo 命令。

## 五、为什么第一篇就强调检查？

Rust 的编译器已经能发现大量内存与并发问题，但它不理解业务是否正确。一个可靠的日常循环是：

```text
改代码 -> cargo fmt -> cargo clippy -> cargo test -> cargo run
```

后面每篇都沿用这个循环。先让命令稳定，再讨论复杂概念，学习成本会低很多。

## 六、小结

- `rustup` 管工具链，Cargo 管项目生命周期。
- 一个 package 可以有二进制或库；workspace 管理多个 package。
- 用 `cargo run -p <crate>` 精确运行一个 demo。
- 格式化、静态检查和测试不是收尾工作，而是每次修改后的反馈环。

> RustInPractice 第 00 篇完。下一篇：变量、类型、函数与控制流，理解 Rust 为什么是一门“表达式优先”的语言。
