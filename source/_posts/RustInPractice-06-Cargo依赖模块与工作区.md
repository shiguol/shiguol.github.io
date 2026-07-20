---
cover: /images/cover/rust/cargo-modules-workspace.webp
title: RustInPractice（06）：Cargo 依赖、模块与工作区
date: 2026-07-20 15:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - Cargo
  - Workspace
  - 模块
  - 依赖管理
---

一个 Rust 项目从单个 `main.rs` 长到多个命令、多个 crate 时，最容易混淆 package、crate、module 三个词。Cargo 的规则并不复杂：**package 是构建单元，crate 是编译单元，module 是代码命名空间。**

<!-- more -->

> 这是 RustInPractice 的第 06 篇。对应 demo：`deps_demo`、`learning_guide`。下一篇收拢格式化、Clippy、测试和文档。

## 一、`Cargo.toml` 管什么？

最常见的依赖声明：

```toml
[dependencies]
clap = { version = "4", features = ["derive"] }
serde = { version = "1", features = ["derive"] }
```

版本范围告诉 Cargo 可以选哪些兼容版本；`Cargo.lock` 记录一次解析后实际使用的精确版本。应用程序通常应提交 lockfile，以保证团队和 CI 使用相同依赖图。

不要手工猜依赖树。需要排查时使用：

```bash
cargo tree
cargo update
```

前者展示依赖关系，后者在允许范围内更新 lockfile。更新后必须重新测试，而不是只看能否编译。

## 二、workspace 统一版本与策略

demo workspace 把成员列在根 `Cargo.toml`，并集中声明公共依赖：

```toml
[workspace.dependencies]
clap = { version = "4", features = ["derive"] }
serde = { version = "1", features = ["derive"] }

# 子 crate 的 Cargo.toml
[dependencies]
clap = { workspace = true }
serde = { workspace = true }
```

这样做不是为了少打几个字，而是避免不同 crate 不小心解析到不兼容的大版本。workspace 仍允许某个 crate 声明自己的专用依赖；“共享”不等于“所有依赖都必须放根目录”。

## 三、module 管代码边界

`learning_guide` 的入口很小：

```rust
mod demos;

fn main() -> anyhow::Result<()> {
    match Cli::parse().command {
        Commands::List => demos::print_list(),
        Commands::Demo { name } => demos::run(&name),
    }
}
```

`mod demos;` 声明一个模块，编译器从同目录的 `demos.rs` 或 `demos/mod.rs` 加载实现。模块默认私有；只有加上 `pub` 的项目才能被外部模块访问。

推荐的方向是：入口负责解析命令和组装依赖，业务逻辑放在模块或 library crate 中。这样测试不必通过终端启动整个程序。

## 四、Clap derive：声明式 CLI

demo 用 derive 宏定义参数：

```rust
#[derive(clap::Parser)]
struct Cli {
    #[arg(long, default_value = "user@example.com")]
    email: String,
}
```

derive 让类型定义成为命令行接口说明，Clap 据此生成解析与帮助文本。公开示例只能使用虚构邮箱和占位符；不要将真实地址、令牌或本地路径写入默认值或帮助文本。

## 五、包、crate、模块速查

| 名词 | 例子 | 作用 |
|---|---|---|
| package | 一个 `Cargo.toml` | Cargo 构建、版本和依赖单位 |
| binary crate | `src/main.rs` | 生成可执行程序 |
| library crate | `src/lib.rs` | 导出可复用 API |
| module | `mod demos` | 在 crate 内组织命名空间和可见性 |
| workspace | 根 `Cargo.toml` 的 members | 管理多个 package |

## 六、小结

- `Cargo.toml` 描述 package、依赖和 feature；lockfile 固定实际依赖图。
- workspace 用共享依赖版本协调多个 crate。
- module 是 crate 内的代码边界，`pub` 决定可见性。
- CLI 解析应留在入口层，核心逻辑放入可测试模块。

> RustInPractice 第 06 篇完。下一篇：格式化、Clippy、单元测试与 Rustdoc，建立可靠反馈环。
