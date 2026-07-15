---
cover: /images/cover/cpp/cmake-build.webp
title: 现代 C++ 实战（01）：CMake 与现代构建
date: 2026-06-14 14:00:00
categories:
  - CppInPractice
tags:
- C++
- 现代C++
- 编程
- 2026
- CMake
- FetchContent
- 构建系统
- 现代构建
---

上一篇我们把环境跑通了。从这一篇开始，我们真正进入 C++ 工程的地基：**CMake**。本系列 39 个 demo 全部用 CMake 构建，其中 `projects/fetch_content/` 是一个「集大成」示例——它用 **FetchContent** 自动拉取 gtest、json、fmt、spdlog 等 6 个第三方库，演示现代 C++ 项目最常见的依赖管理方式。

搞懂这篇，后面所有带外部库的 demo 你都不会慌。

<!-- more -->

> 这是「现代 C++ 实战」系列的第 1 篇。对应 demo：`ref/cpp_demo/projects/fetch_content/`。建议先读 [第 00 篇：环境搭建与项目导览](/2026/06/13/现代C++实战-00-环境搭建与项目导览/)。

## 一、为什么需要 CMake？

手写 Makefile 在小项目里够用，但现代 C++ 项目很快会遇到天花板：

| 痛点 | Makefile 的局限 | CMake 的做法 |
|------|----------------|--------------|
| **跨平台** | Windows / macOS / Linux 语法不同 | 一套 `CMakeLists.txt`，生成对应平台的构建文件 |
| **依赖管理** | 手动下载、编译、写 `-I` / `-L` | `FetchContent`、`find_package` 等模块 |
| **C++ 标准** | 编译器 flag 各写各的 | `CMAKE_CXX_STANDARD` 统一声明 |
| **IDE 集成** | 难以生成索引数据库 | `CMAKE_EXPORT_COMPILE_COMMANDS` → clangd |
| **目标抽象** | 文件列表散落各处 | `add_library` / `add_executable` / `target_link_libraries` |

CMake 不是编译器，而是**构建系统生成器**：它读 `CMakeLists.txt`，输出 Makefile、Ninja 或 Visual Studio 工程，再由底层工具完成编译链接。

可以把它想成「建筑蓝图」：你画的是房间和管线（target 与依赖），至于用什么施工队（Make / Ninja / MSBuild），CMake 帮你对接。

## 二、最小 CMake 项目

一个能编译运行的 C++ 程序，最少需要三行 CMake：

```cmake
cmake_minimum_required(VERSION 3.14)
project(Hello VERSION 1.0.0)

add_executable(hello src/main.cpp)
```

| 指令 | 作用 |
|------|------|
| `cmake_minimum_required` | 声明所需最低 CMake 版本，低于此版本直接报错 |
| `project` | 定义项目名、版本，并初始化编译器检测 |
| `add_executable` | 从源文件生成可执行目标 |

典型工作流：

```bash
mkdir build && cd build
cmake ..                          # 配置：生成构建文件
cmake --build . -j$(nproc)        # 编译：并行构建
./hello                           # 运行
```

本系列 demo 把上述步骤封装进了 `./build.sh`，等价于：

```bash
cd ref/cpp_demo/projects/fetch_content
./build.sh          # 增量编译
./build.sh -c       # 清理后重建
./build.sh --run    # 编译后运行
```

## 三、C++ 标准设置

不同 demo 需要不同标准（C++11 ~ C++23）。在 CMake 里推荐这样写：

```cmake
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
```

| 选项 | 含义 |
|------|------|
| `CMAKE_CXX_STANDARD` | 目标 C++ 标准版本 |
| `CMAKE_CXX_STANDARD_REQUIRED ON` | 编译器不支持该标准时**失败**，而不是静默降级 |
| `CMAKE_CXX_EXTENSIONS OFF` | 禁用 GNU 扩展，保证可移植性 |

也可以在单个 target 上覆盖：

```cmake
target_compile_features(my_app PRIVATE cxx_std_20)
```

`fetch_content` demo 使用 C++17，因为它依赖的 fmt 10.x 和 nlohmann/json 3.11 在 C++17 下体验最好。后面讲 C++20 特性的 demo 会把标准调到 20 或 23。

## 四、FetchContent：自动拉取依赖

手动管理第三方库的痛苦，做过的人都懂：下载 tarball、写 include 路径、处理版本冲突、CI 上还要再配一遍。

CMake 3.11 引入的 **FetchContent** 模块，可以在配置阶段自动下载并纳入构建：

```cmake
include(FetchContent)

FetchContent_Declare(
  fmt
  URL https://github.com/fmtlib/fmt/archive/refs/tags/10.1.1.tar.gz
)

FetchContent_MakeAvailable(fmt)

add_executable(demo main.cpp)
target_link_libraries(demo PRIVATE fmt::fmt)
```

### 为什么用 URL 而不是 Git？

`fetch_content` demo 对所有依赖都用 **URL + 版本 tag** 的方式：

```cmake
FetchContent_Declare(
  nlohmann_json
  URL https://github.com/nlohmann/json/archive/refs/tags/v3.11.3.tar.gz
)
```

| 方式 | 优点 | 缺点 |
|------|------|------|
| **URL (tar.gz)** | 不依赖 git；CI / 防火墙环境更友好 | 需要知道 release 包的 URL |
| **Git 仓库** | 可以锁定 commit | 需要 git；浅克隆有时踩坑 |

### demo 中的 6 个依赖

| 库 | 版本 | 用途 |
|---|---|---|
| Google Test | v1.14.0 | 单元测试（第 16 篇详讲） |
| nlohmann/json | v3.11.3 | JSON 解析 |
| fmt | 10.1.1 | 类型安全格式化 |
| spdlog | v1.13.0 | 高性能日志 |
| cpp-httplib | v0.15.3 | HTTP 客户端/服务端 |
| CLI11 | v2.4.1 | 命令行参数解析 |

一次性拉取全部依赖：

```cmake
FetchContent_MakeAvailable(googletest nlohmann_json fmt spdlog httplib CLI11)
```

首次 `./build.sh` 时，CMake 会下载这些库到 `build/_deps/`（已在 `.gitignore` 中忽略），之后增量编译不再重复下载。

### 关闭依赖自带的测试

很多库默认会构建自己的测试套件，拖慢编译。demo 里显式关闭：

```cmake
set(BUILD_GMOCK OFF CACHE BOOL "" FORCE)
set(JSON_BuildTests OFF CACHE BOOL "" FORCE)
set(FMT_TEST OFF CACHE BOOL "" FORCE)
```

这是工程实践中的常见优化：**只引入你需要的 target，关掉上游的 test / example**。

## 五、目录组织：src / include / build

`fetch_content` 采用经典布局：

```
projects/fetch_content/
├── CMakeLists.txt          # 顶层构建配置
├── build.sh                # 统一构建脚本
├── compile_commands.json   # → build/ 的符号链接
├── build/                  # 构建产物（不提交 Git）
└── src/
    ├── mylib.h             # 库头文件
    ├── mylib.cpp           # 库实现
    └── main.cpp            # 程序入口
```

CMake 里拆成**库 + 可执行文件**两个 target：

```cmake
add_library(my_lib STATIC src/mylib.cpp src/mylib.h)
target_include_directories(my_lib PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)
target_link_libraries(my_lib PUBLIC
    nlohmann_json::nlohmann_json
    fmt::fmt
    spdlog::spdlog_header_only
    httplib::httplib
    CLI11::CLI11
)

add_executable(my_app src/main.cpp)
target_link_libraries(my_app PRIVATE my_lib)
```

几个要点：

| 概念 | 说明 |
|------|------|
| `STATIC` 库 | 编译期把代码链进最终二进制，demo 够用；大项目可换 `SHARED` |
| `PUBLIC` include | 链接 `my_lib` 的目标自动获得头文件搜索路径 |
| `PUBLIC` link | 依赖沿传递链传播——`my_app` 链 `my_lib`，就间接拥有 json/fmt 等 |
| `PRIVATE` link | 仅自己用，不传播给下游 |

比「全局 `include_directories` + `link_libraries`」更安全：依赖关系绑定在具体 target 上，不会污染整个项目。

## 六、compile_commands.json 与 clangd

写 C++ 时，IDE 的跳转、补全、报错提示，依赖编译数据库。开启方式只需一行：

```cmake
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
```

CMake 会在 `build/` 下生成 `compile_commands.json`。demo 在根目录做了符号链接：

```bash
compile_commands.json -> build/compile_commands.json
```

配合 clangd（详见 `ref/cpp_demo/docs/CPP_IDE_SETUP.md`），打开 `src/main.cpp` 就能正确解析 `<CLI/CLI.hpp>` 等 FetchContent 下载的头文件。

> **提示**：每次 `build.sh -c` 清理重建后，如果 IDE 报找不到头文件，重启 clangd 或重新打开项目即可。

## 七、动手：编译并运行 fetch_content demo

进入 demo 目录，一键编译运行：

```bash
cd ref/cpp_demo/projects/fetch_content
./build.sh --run
```

首次运行会下载依赖，可能需要 1–3 分钟（视网络而定）。成功后终端大致输出：

```
欢迎使用 MyApp, World! 🎉

[INFO] JSON 库使用示例:
示例 JSON 数据:
{
  "name": "World",
  "features": ["FetchContent", "CMake", "Modern C++"],
  ...
}

[INFO] fmt 格式化示例:
  整数格式化:         42
  浮点格式化: 3.142
  ...
```

### 试试命令行参数

demo 用 CLI11 解析参数，可以玩几个组合：

```bash
./build.sh --run-args '--help'
./build.sh --run-args '--show-config'
./build.sh --run-args '-n Developer -l debug'
./build.sh --run-args '--config {"app_name":"TestApp","port":3000}'
```

| 选项 | 作用 |
|------|------|
| `-n, --name` | 设置用户名 |
| `-l, --log-level` | 日志级别：debug / info / warn / error |
| `-c, --show-config` | 打印当前配置 JSON |
| `--config` | 从 JSON 字符串加载配置 |

### 代码里发生了什么？

`main.cpp` 把 6 个库串成一条演示链：

1. **CLI11** — 解析命令行，带类型检查和范围校验
2. **spdlog** — 初始化彩色日志，按级别过滤输出
3. **fmt** — 类型安全的字符串格式化（C++20 的 `std::format` 同源思路）
4. **nlohmann/json** — 构建和打印 JSON 对象
5. **httplib** — HTTP 客户端已集成（默认注释，避免无意发起网络请求）

`mylib.cpp` 里的 `Config` 类展示了库与库之间的协作：JSON 解析失败时，用 fmt 格式化错误信息，再用 spdlog 输出。

## 八、CMake 常见踩坑

| 现象 | 原因 | 处理 |
|------|------|------|
| 首次 cmake 很慢 | FetchContent 正在下载 | 正常，后续增量编译会快很多 |
| 找不到 `fmt::fmt` | 忘记 `FetchContent_MakeAvailable` | 声明后必须 MakeAvailable |
| clangd 报红但编译通过 | 索引未刷新 | 确认 `compile_commands.json` 链接存在 |
| C++20 demo 编译失败 | 标准版本不够 | 检查 `CMAKE_CXX_STANDARD` 与编译器版本 |
| `_deps/` 目录很大 | 缓存了所有下载的依赖 | `build.sh -c` 可清理；不影响源码 |

## 九、小结

本篇围绕 `fetch_content` demo，把现代 C++ 项目的构建链路串了一遍：

- **CMake 三件套**：`cmake_minimum_required` → `project` → `add_executable`
- **C++ 标准**：`CMAKE_CXX_STANDARD` + `REQUIRED` 防止静默降级
- **FetchContent**：URL 方式拉取依赖，关掉上游多余测试
- **Target 模型**：库与可执行文件分离，`PUBLIC` / `PRIVATE` 控制传播
- **IDE 友好**：`CMAKE_EXPORT_COMPILE_COMMANDS` 喂给 clangd

> 现代 C++ 实战系列第 1 篇完。下一篇我们聊 **C++ 版本演进**——从 C++03 到 C++23，各版本加了什么、为什么加，给后面每一篇特性文章一张路线图。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 00 | [环境搭建与项目导览](/2026/06/13/现代C++实战-00-环境搭建与项目导览/) | ✅ |
| **01** | **CMake 与现代构建（本篇）** | ✅ |
| 02 | C++ 版本演进一览 | 下一篇 |
| 03 | 移动语义与右值引用 | 待写 |

完整大纲见工作区 `docs/CPP_SERIES_OUTLINE.md`。
