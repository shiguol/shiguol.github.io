---
cover: /images/cover/cppdebug/ide-cheatsheet.webp
title: C++ 调试实战（08）：IDE 图形化调试与 GDB / LLDB 速查表
date: 2026-10-08 20:00:00
categories:
  - CppDebug
tags:
- C++
- 调试
- GDB
- LLDB
- VS Code
- 编程
- 2026
- 开发工具
- 速查表
---

前面七篇全是命令行。命令行是调试的「内功」：服务器上、容器里、SSH 远程，只有命令行可用；很多高级功能（`dprintf`、`watch -l`、`thread apply all bt`）也只有命令行里才用得顺手。但日常写代码时，在编辑器里点一下行号就下断点、鼠标悬停就看变量值，确实更舒服。这一篇介绍 VS Code 里的图形化调试配置，以及它和命令行的对应关系，最后把整个系列的命令整理成一张速查表。

<!-- more -->

> 这是「C++ 调试实战」系列的第 8 篇，也是最后一篇。IDE 的调试界面本质上只是 GDB / LLDB 的一层「外壳」，理解了前面的命令，图形界面上的每个按钮都知道它在做什么。

## 一、IDE 调试的本质

VS Code、CLion、Xcode、Qt Creator 这些 IDE 自己都不会调试程序，它们是在后台启动 GDB 或 LLDB，把你在界面上的操作翻译成调试器命令：

| 你在界面上做的 | 背后执行的命令（大致相当于） |
|----------------|------------------------------|
| 点击行号左侧下断点 | `break orders.cpp:22` |
| 右键断点 → 编辑条件 | `condition 1 o.quantity >= 10` |
| F5 开始调试 | `run` |
| F10 单步跳过 | `next` |
| F11 单步进入 | `step` |
| Shift+F11 单步跳出 | `finish` |
| 「变量」面板 | `info locals` / `frame variable` |
| 「监视」面板 | 每次停下时对表达式求值，类似 `display` |
| 「调用堆栈」面板 | `bt`，点击某一帧相当于 `frame N` |

所以 IDE 调试遇到的问题（断点不生效、变量显示 `<optimized out>`、钻进了 STL），原因和解决办法与命令行完全一样：检查 `-g`、`-O0`，检查二进制是不是最新编译的。

## 二、VS Code 调试 C++

### 2.1 选择调试扩展

| 扩展 | 调试类型（`type`） | 后端 | 适合 |
|------|--------------------|------|------|
| C/C++（Microsoft） | `cppdbg` | GDB 或 LLDB（通过 MI 接口） | Linux + GDB；和 IntelliSense 同一个扩展 |
| CodeLLDB | `lldb` | LLDB | macOS；Linux 上想用 LLDB 时 |

macOS 推荐 CodeLLDB；Linux 用 C/C++ 扩展配 GDB 最省事。

### 2.2 先确保编译带调试信息

用 CMake 的项目，Debug 构建默认就有 `-g`：

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
```

可以在 `.vscode/tasks.json` 里定义一个构建任务，让每次调试前自动编译：

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build",
      "type": "shell",
      "command": "cmake --build build",
      "group": "build",
      "problemMatcher": ["$gcc"]
    }
  ]
}
```

### 2.3 `launch.json`：启动调试

在 `.vscode/launch.json` 里配置两种调试方式（按需保留一个即可）：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "GDB: 启动 orders",
      "type": "cppdbg",
      "request": "launch",
      "program": "${workspaceFolder}/build/orders",
      "args": [],
      "cwd": "${workspaceFolder}",
      "MIMode": "gdb",
      "setupCommands": [
        {
          "description": "启用 pretty printer",
          "text": "-enable-pretty-printing",
          "ignoreFailures": true
        }
      ],
      "preLaunchTask": "build"
    },
    {
      "name": "LLDB: 启动 orders",
      "type": "lldb",
      "request": "launch",
      "program": "${workspaceFolder}/build/orders",
      "args": [],
      "cwd": "${workspaceFolder}",
      "preLaunchTask": "build"
    }
  ]
}
```

| 字段 | 作用 |
|------|------|
| `program` | 要调试的可执行文件 |
| `args` | 命令行参数，相当于 `run arg1 arg2` |
| `cwd` | 程序的工作目录，影响相对路径的文件读写 |
| `MIMode` | `cppdbg` 专用：后端用 `gdb` 还是 `lldb` |
| `setupCommands` | 启动时先执行的 GDB 命令，`-enable-pretty-printing` 让 STL 容器正常显示（相当于第 03 篇讲的格式化器） |
| `preLaunchTask` | 调试前先执行的任务，对应 `tasks.json` 里的 `label` |

配置好之后，按 F5 或在「运行和调试」面板里选择配置启动。

### 2.4 attach 到运行中的进程

对应第 07 篇的 `gdb -p PID`：

```json
{
  "name": "GDB: attach",
  "type": "cppdbg",
  "request": "attach",
  "program": "${workspaceFolder}/build/threads",
  "processId": "${command:pickProcess}",
  "MIMode": "gdb"
},
{
  "name": "LLDB: attach",
  "type": "lldb",
  "request": "attach",
  "pid": "${command:pickMyProcess}"
}
```

启动时 VS Code 会弹出进程列表让你选择。Linux 上同样会遇到 `ptrace_scope` 的权限问题（第 07 篇）。

### 2.5 加载 core dump

对应第 06 篇的 `gdb ./prog core`，C/C++ 扩展支持 `coreDumpPath`：

```json
{
  "name": "GDB: 分析 core",
  "type": "cppdbg",
  "request": "launch",
  "program": "${workspaceFolder}/build/crash",
  "coreDumpPath": "${workspaceFolder}/core",
  "cwd": "${workspaceFolder}",
  "MIMode": "gdb"
}
```

启动后直接停在崩溃现场，「调用堆栈」面板就是 `bt` 的结果。

### 2.6 在 Dev Container 里调试

如果你在 VS Code 的 Dev Containers（开发容器）里写代码，和第 00 篇一样要给容器开 `ptrace` 权限，在 `.devcontainer/devcontainer.json` 里加上：

```json
{
  "capAdd": ["SYS_PTRACE"],
  "securityOpt": ["seccomp=unconfined"]
}
```

## 三、图形界面的常用操作

### 3.1 快捷键

| 操作 | 快捷键 | 对应命令 |
|------|--------|----------|
| 开始 / 继续 | F5 | `run` / `continue` |
| 切换断点 | F9 | `break` / `delete` |
| 单步跳过 | F10 | `next` |
| 单步进入 | F11 | `step` |
| 单步跳出 | Shift+F11 | `finish` |
| 停止调试 | Shift+F5 | `kill` |
| 重新开始 | Ctrl+Shift+F5（macOS：Cmd+Shift+F5） | `run`（重新启动） |
| 运行到光标处 | 右键 →「运行到光标处」 | `until` / `advance` |

### 3.2 三种特殊断点

在行号左侧右键，或者右键已有的断点选择「编辑断点」，可以设置：

| 类型 | 界面上的名字 | 对应命令行 |
|------|--------------|------------|
| 条件断点 | 表达式（Expression） | `break ... if 条件`（第 01 篇） |
| 命中次数 | 命中次数（Hit Count） | `ignore 1 N` |
| 日志点 | 日志消息（Log Message），用 `{变量}` 插值 | `dprintf`（第 01 篇），不停下，只打印 |

**日志点**（Logpoint）特别推荐，它就是图形化的 `dprintf`：不用改代码、不用重新编译，就能在任何一行「加一句打印」，比如写 `name={o.name} total={total}`。

「运行和调试」面板底部的「断点」区域还有「C++: on throw」之类的选项（取决于扩展），勾选后在异常抛出时停下，相当于 `catch throw`。

### 3.3 查看数据

- **鼠标悬停**：停下后把鼠标放在变量上就能看到值，结构体、容器可以展开；
- **变量面板**：当前帧的参数和局部变量，可以双击直接修改值（相当于 `set var`）；
- **监视面板**：添加任意表达式，每次停下都会重新求值，相当于 `display`；
- **调用堆栈面板**：点击任意一帧，变量面板就切换到那一帧的变量，相当于 `frame N`。多线程程序会按线程分组，相当于 `info threads` + `thread N`。

在监视面板里，C/C++ 扩展支持用逗号后缀指定格式：`total,x` 按十六进制显示，`ptr,10` 把指针当作 10 个元素的数组显示（相当于 GDB 的 `*ptr@10`）。

### 3.4 调试控制台：图形界面里的命令行

图形界面做不到的事（观察点的高级选项、`thread apply all bt`、`info frame`……），可以在「调试控制台」里直接敲调试器命令：

| 扩展 | 写法 |
|------|------|
| C/C++（`cppdbg`） | 命令前加 `-exec`，例如 `-exec thread apply all bt`、`-exec watch -l l.audit_total` |
| CodeLLDB | 直接输入 LLDB 命令，例如 `bt all`、`watchpoint set variable ledger.audit_total` |

**这就是学命令行的回报**：IDE 覆盖了 80% 的日常操作，剩下 20% 的疑难问题，打开调试控制台，前面七篇的命令都能直接用。

## 四、不用 IDE 的轻量方案

只有终端可用、又想要一点「图形化」的感觉：

| 方案 | 用法 |
|------|------|
| GDB 的 TUI 模式 | `gdb -tui ./prog`，或在 GDB 里 `tui enable`；`layout src` 显示源码窗口、`layout split` 同时显示源码和汇编，`Ctrl+X A` 切换开关 |
| LLDB 的 GUI 模式 | 在 LLDB 里输入 `gui`，出现源码、变量、线程多个窗口 |

TUI 模式下，屏幕上方是源码窗口，当前行和断点都有标记，下方仍然是命令行，适合在服务器上调试时使用。

## 五、配置文件：把常用设置固定下来

每次都要手动敲的设置，可以写进调试器的初始化文件。

### 5.1 `~/.gdbinit`

```text
# 结构体多行显示
set print pretty on
# 输出很长时不要分页暂停
set pagination off
# 保存命令历史，下次启动还能用上下键翻
set history save on
set history filename ~/.gdb_history
# 单步时不进入 STL 迭代器（路径按你的 GCC 版本修改）
skip file /usr/include/c++/15/bits/stl_iterator.h
```

> 出于安全考虑，GDB 默认**不会**自动加载当前目录下的 `.gdbinit`（否则打开一个恶意项目就可能执行任意命令）。如果确实需要项目级配置，要在 `~/.gdbinit` 里用 `add-auto-load-safe-path` 显式信任那个目录。

### 5.2 `~/.lldbinit`

```text
# 停下时显示前后各 3 行源码（这是默认值，按喜好调整）
settings set stop-line-count-before 3
settings set stop-line-count-after 3
# 给常用命令起别名
command alias bt5 thread backtrace -c 5
```

LLDB 同样默认不加载当前目录的 `.lldbinit`：`target.load-cwd-lldbinit` 的默认值是 `warn`，发现文件时只给出提示。确实需要时，在 `~/.lldbinit` 里写 `settings set target.load-cwd-lldbinit true`。

## 六、GDB / LLDB 命令速查表

最后，把整个系列用到的命令汇总在一起。

### 6.1 启动与退出

| 操作 | GDB | LLDB |
|------|-----|------|
| 启动调试器 | `gdb ./prog` | `lldb ./prog` |
| 带参数启动 | `gdb --args ./prog a b` | `lldb -- ./prog a b` |
| attach 到进程 | `gdb -p PID` | `lldb -p PID` / `lldb -n 名字` |
| 加载 core | `gdb ./prog core` | `lldb ./prog -c core` |
| 批处理执行命令 | `gdb -batch -ex "bt" ...` | `lldb -b -o "bt" ...` |
| 脱离进程 | `detach` | `detach` |
| 退出 | `quit` | `quit` |

### 6.2 断点（第 01 篇）

| 操作 | GDB | LLDB |
|------|-----|------|
| 按函数 | `break func` | `b func` |
| 按文件行号 | `break file.cpp:22` | `b file.cpp:22` |
| 当前文件行号 | `break 22` | `b 22` |
| 临时断点 | `tbreak func` | `tbreak func` |
| 条件断点 | `break func if x > 0` | `br set -n func -c 'x > 0'` |
| 修改条件 | `condition 1 x > 0` | `br modify -c 'x > 0' 1` |
| 忽略前 N 次 | `ignore 1 N` | `br modify -i N 1` |
| 列出 | `info breakpoints` | `br list` |
| 禁用 / 启用 | `disable 1` / `enable 1` | `br disable 1` / `br enable 1` |
| 删除 | `delete 1` | `br delete 1` |
| 命中时执行命令 | `commands 1 ... end` | `br command add -o '命令' 1` |
| 打印点 | `dprintf file.cpp:16,"x=%d\n",x` | `br command add` + `br modify -G true` |
| 异常抛出时停 | `catch throw` | `br set -E c++` |

### 6.3 运行与单步（第 02 篇）

| 操作 | GDB | LLDB |
|------|-----|------|
| 运行 | `run` | `run` |
| 从 `main` 开始 | `start` | `tbreak main` + `run` |
| 继续 | `continue` | `continue` |
| 单步跳过 | `next` | `next` |
| 单步进入 | `step` | `step` |
| 跑到函数返回（显示返回值） | `finish` | `finish` |
| 跑到指定行 | `until 24` / `advance 24` | `thread until 24` |
| 指令级单步 | `stepi` / `nexti` | `si` / `ni` |
| 单步时跳过 | `skip file 路径` / `skip -rfu 正则` | `settings set target.process.thread.step-avoid-regexp 正则` |
| 中断运行中的程序 | `Ctrl+C` | `Ctrl+C` |
| 结束被调试程序 | `kill` | `process kill` |

### 6.4 查看与修改数据（第 03 篇）

| 操作 | GDB | LLDB |
|------|-----|------|
| 打印变量 | `print x` | `v x` / `p x` |
| 参数和局部变量 | `info args` / `info locals` | `frame variable` |
| 按格式打印 | `p/x x`、`p/t x` | `v -f x x`、`v -f b x` |
| 查看类型 | `ptype x` / `whatis x` | `type lookup T` |
| 数组 / 连续内存 | `p *ptr@10` | `parray 10 ptr` |
| 自动显示 | `display x` / `undisplay 1` | `display x` / `undisplay 1` |
| 修改变量 | `set var x = 1` | `expr x = 1` |
| 调用函数 | `p func(1)` | `p func(1)` |
| 看内存 | `x/4xw &x` | `memory read -s4 -fx -c4 &x` |
| 结构体换行 | `set print pretty on` | 默认 |

### 6.5 调用栈（第 04 篇）

| 操作 | GDB | LLDB |
|------|-----|------|
| 调用栈 | `bt` | `bt` |
| 只看 N 层 | `bt N` / `bt -N` | `bt N` |
| 带局部变量 | `bt full` | —— |
| 切换帧 | `frame N` | `frame select N` |
| 上 / 下一层 | `up` / `down` | `up` / `down` |
| 帧详情 | `info frame` | `frame info` |

### 6.6 观察点（第 05 篇）

| 操作 | GDB | LLDB |
|------|-----|------|
| 值被修改时停 | `watch x` | `w s v x` |
| 按地址观察 | `watch -l expr` | `watchpoint set expression -- &expr` |
| 读时停 | `rwatch x` | `w s v -w read x` |
| 读写都停 | `awatch x` | `w s v -w read_write x` |
| 列出 | `info watchpoints` | `watchpoint list` |
| 条件 | `watch x if 条件` | `watchpoint modify -c '条件'` |

### 6.7 线程（第 07 篇）

| 操作 | GDB | LLDB |
|------|-----|------|
| 列出线程 | `info threads` | `thread list` |
| 切换线程 | `thread N` | `thread select N` |
| 所有线程的栈 | `thread apply all bt` | `bt all` |
| 线程专属断点 | `break loc thread N` | `br set ... -t TID` |
| 单步只跑当前线程 | `set scheduler-locking step` | `thread step-over -m this-thread` |

### 6.8 编译选项与 Sanitizer（第 00、06、07 篇）

| 目的 | 选项 |
|------|------|
| 生成调试信息 | `-g` |
| 关闭优化 | `-O0`（或 GCC 的 `-Og`） |
| 内存错误 | `-fsanitize=address -fno-omit-frame-pointer` |
| 未定义行为 | `-fsanitize=undefined` |
| 数据竞争 | `-fsanitize=thread` |
| 开启 core dump | `ulimit -c unlimited` |

## 七、系列回顾：遇到问题该用什么

```text
想知道程序走了哪条分支、某个值是怎么算出来的
    └─▶ 断点 + 单步 + print（01、02、03）

想知道某个函数是被谁调用的
    └─▶ 在函数里停下，bt（04）

变量被莫名其妙改掉了
    └─▶ 观察点 watch / watch -l（05）

程序崩溃
    ├─ 能复现 ──▶ 调试器里 run，崩溃后 bt（06）
    └─ 不能复现 ─▶ core dump（06）

内存越界、野指针、use-after-free
    └─▶ AddressSanitizer（06）

程序卡住不动
    └─▶ attach + thread apply all bt，找循环等待（07）

多线程结果偶尔不对
    └─▶ ThreadSanitizer（07）

只想在不停下的情况下加句打印
    └─▶ dprintf / IDE 日志点（01、08）
```

调试没有什么神秘的技巧，核心就是一个循环：**提出假设 → 让程序停在能验证假设的地方 → 看数据 → 修正假设**。调试器的所有命令，都是为了让「停在哪里」和「看什么」这两件事变得更精确、更省力。希望这个系列能让你少写一些 `printf`，多一些「原来如此」的时刻。

> **C++ 调试实战系列 9 篇（含第 00 篇）全部完结。** 感谢阅读，Happy Debugging!
