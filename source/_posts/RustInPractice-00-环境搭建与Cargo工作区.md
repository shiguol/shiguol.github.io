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
  - macOS
---

学 Rust 的第一道门槛通常不是所有权，而是「这段代码到底该怎么编译、依赖放哪里、为什么一个仓库里能有这么多程序」。本篇先不讲语法，只完成三件事：在 macOS 上装好工具链（含国内镜像加速）、认识 Cargo、跑通本系列的 demo 工作区。

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

这几个工具都由 `rustup` 统一安装和升级，不需要逐个下载。本系列 demo 使用 Rust 2021 edition。edition 是语言解析和预导入规则的版本选择，不是某个特定编译器版本；Cargo 会在 `Cargo.toml` 中记录它。

## 二、在 macOS 上安装工具链

### 为什么不用 Docker

学语言阶段直接装在 macOS 上就够了，原因有三点：原生编译速度明显快于容器（尤其 Apple Silicon 不必再过一层虚拟化）；能直接对接 LLDB 调试器和编辑器；不必额外维护镜像和卷。Docker 更适合后续做后端服务（例如需要连 PostgreSQL）或团队统一环境时再引入，本系列后面几篇的批量验证脚本会用到它。

### 1. 装 C 编译器与链接器

Rust 编译最终要调用系统链接器，所以先装 Xcode 命令行工具：

```bash
xcode-select --install
```

如果机器上装的是完整版 Xcode，还需要把活动开发目录指过去，否则可能报找不到 `cc`：

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### 2. 先配镜像，再装工具链

工具链本身就有一两百 MB，国内网络下建议**先设置镜像环境变量再执行安装脚本**，否则大概率卡在下载阶段。当前终端里临时导出即可：

```bash
export RUSTUP_DIST_SERVER="https://rsproxy.cn"
export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup"
```

### 3. 用 rustup 安装

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

交互提示直接选 `1) Proceed with standard installation` 即可。脚本会把工具链装到 `~/.rustup`，把 Cargo 相关目录放在 `~/.cargo`，并向 shell 配置追加 PATH。

> 不要用 `brew install rust`。Homebrew 装的是固定版本的 `rustc`，无法用 `rustup` 切换工具链和添加组件，还容易和 `~/.cargo/bin` 里的同名命令抢 PATH。如果之前装过，先 `brew uninstall rust` 再走上面的流程。

### 4. 让 PATH 生效并验证

安装完成后**重开终端**，或手动加载一次：

```bash
source "$HOME/.cargo/env"
```

然后确认三个版本号都能打印出来：

```bash
rustc --version
cargo --version
rustup --version
```

`rustup show` 可以确认默认工具链和宿主平台。Apple Silicon 应显示 `aarch64-apple-darwin`，Intel 机型是 `x86_64-apple-darwin`；如果装反了，编译出的二进制会走 Rosetta，性能白丢一截。

### 5. 补齐组件

标准安装已包含 `rustfmt` 和 `clippy`，缺失时按需补：

```bash
rustup component add rustfmt clippy
```

日常维护只有两条命令：`rustup update` 升级全部工具链，`rustup self uninstall` 干净卸载（会一并删除 `~/.rustup` 和 `~/.cargo`）。

## 三、国内网络：env 与 config.toml 各管一段

这是最容易配错的地方。两套配置管的是**两件不同的事**，缺一个就会出现「工具链装得飞快，但 `cargo build` 拉依赖卡死」这类现象。

| 配置位置 | 生效对象 | 管什么 |
|---|---|---|
| shell 环境变量 | `rustup` | 工具链、组件、标准库的下载 |
| `~/.cargo/config.toml` | `cargo` | crates.io 索引与第三方依赖包的下载 |

### 1. 环境变量写进 shell 配置

macOS 默认 shell 是 zsh，把上一节临时导出的两行固化到 `~/.zshrc`：

```bash
cat >> ~/.zshrc <<'EOF'
export RUSTUP_DIST_SERVER="https://rsproxy.cn"
export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup"
EOF
source ~/.zshrc
```

不建议改 `~/.cargo/env`：那个文件由 `rustup` 生成和维护，升级时可能被覆盖。

### 2. Cargo 源替换写进 config.toml

新建或编辑 `~/.cargo/config.toml`（注意是 `.toml` 后缀，旧版无后缀的 `config` 仍可用但已不推荐）：

```toml
[source.crates-io]
replace-with = 'rsproxy-sparse'

[source.rsproxy]
registry = "https://rsproxy.cn/crates.io-index"

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"

[registries.rsproxy]
index = "sparse+https://rsproxy.cn/index/"

[net]
git-fetch-with-cli = true
```

三点说明：

- `sparse+` 是稀疏索引协议，只按需拉取用到的 crate 元数据，比克隆整个 git 索引快一个数量级，Cargo 1.70 起对 crates.io 已默认启用，但换成镜像时需要显式写明。
- `git-fetch-with-cli = true` 让 Cargo 调用系统 `git` 去拉 git 依赖，从而复用你已有的代理和 SSH 配置，能规避一类 `failed to authenticate` 报错。
- 源替换不影响安全性：Cargo 要求被替换源提供的 crate 校验和与 crates.io 一致，`Cargo.lock` 里记录的哈希对不上就会直接构建失败。

清华 TUNA、中科大等镜像同理，只是把域名换掉；想回官方源，注释掉 `[source.crates-io]` 下的 `replace-with` 即可，其余配置留着不生效也无害。

### 3. 验证与排错

```bash
cargo new mirror_check && cd mirror_check
cargo add serde          # 触发一次索引和依赖下载
cargo build
```

首次执行会看到 `Updating` 和 `Downloading` 输出。如果这一步依然很慢或报网络错误，按顺序查三件事：`echo $RUSTUP_DIST_SERVER` 是否非空、`~/.cargo/config.toml` 是否写在用户主目录而非项目目录、TOML 里的表名有没有拼错（拼错的表会被静默忽略，不报错但也不生效）。

## 四、编辑器

- **VS Code** + `rust-analyzer` 扩展是最轻量的首选；需要断点调试再加 `CodeLLDB`。
- **RustRover** 是 JetBrains 的 Rust IDE，从 IntelliJ 系迁过来的人会更顺手。

要点是别装老的 `rust-lang.rust` 扩展，它已停止维护，和 `rust-analyzer` 同时启用会出现重复诊断。

## 五、Cargo 的最小闭环

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

## 六、从一个包到一个工作区

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

## 七、先跑一个 demo

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

> 批量脚本会使用 `timeout`。macOS 自带的 BSD 工具集里没有这个命令，可以 `brew install coreutils` 后用 `gtimeout`，也可以改用容器环境，或直接运行上面的 Cargo 命令。

## 八、为什么第一篇就强调检查？

Rust 的编译器已经能发现大量内存与并发问题，但它不理解业务是否正确。一个可靠的日常循环是：

```text
改代码 -> cargo fmt -> cargo clippy -> cargo test -> cargo run
```

后面每篇都沿用这个循环。先让命令稳定，再讨论复杂概念，学习成本会低很多。

## 九、小结

- macOS 上用 `rustup` 原生安装，别用 Homebrew 装 `rustc`；学语言阶段不需要 Docker。
- 国内网络要配两处：环境变量管 `rustup` 下工具链，`~/.cargo/config.toml` 管 Cargo 下依赖。
- `rustup` 管工具链，Cargo 管项目生命周期。
- 一个 package 可以有二进制或库；workspace 管理多个 package。
- 用 `cargo run -p <crate>` 精确运行一个 demo。
- 格式化、静态检查和测试不是收尾工作，而是每次修改后的反馈环。

> RustInPractice 第 00 篇完。下一篇：变量、类型、函数与控制流，理解 Rust 为什么是一门“表达式优先”的语言。
