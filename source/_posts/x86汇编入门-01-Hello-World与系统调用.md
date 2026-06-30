---
cover: /images/cover/asm/hello-world.png
title: x86 汇编入门（01）：Hello World 与系统调用
date: 2026-07-02 10:00:00
categories:
  - Assembly
tags:
  - 汇编
  - NASM
  - x86_64
  - 编程
  - 2026
---

每个程序员的第一课都是 Hello World。汇编版也不例外——只不过这次没有 `printf`，没有标准库，只有你和内核之间四条寄存器传话。搞懂这一篇，你就摸到了 Linux 程序最底层的「打电话」方式。

<!-- more -->

> 这是「x86 汇编入门」系列的第 1 篇。上一篇我们搭好了 Docker 环境和编译流程。这一篇从 `01_hello.asm` 出发，理解汇编程序的基本结构和 Linux 系统调用机制。

## 一、程序长什么样？

汇编程序可以粗分为两块：**数据**放哪里，**代码**放哪里。

```asm
section .data
    msg     db  "Hello, Assembly World!", 10
    msg_len equ $ - msg

section .text
    global _start

_start:
    ; ... 系统调用写在这里 ...
```

| 部分 | 作用 |
|------|------|
| `section .data` | 存放已初始化的数据，比如字符串 |
| `section .text` | 存放可执行的机器指令 |
| `global _start` | 告诉链接器：程序从这里开始执行 |
| `_start:` | 入口标签，相当于 C 语言的 `main` |

`db` 是 define byte，按字节定义数据。`, 10` 是换行符 `\n` 的 ASCII 码。`equ $ - msg` 用当前位置减去 `msg` 标签，自动算出字符串长度——省得手动数。

## 二、系统调用：程序怎么跟内核说话？

高级语言里你写 `print("hello")`，底层其实是操作系统在帮你干活。在 Linux x86_64 上，这件事通过 **`syscall` 指令**完成，参数放在寄存器里：

| 寄存器 | 角色 |
|--------|------|
| `rax` | 系统调用号 |
| `rdi` | 第 1 个参数 |
| `rsi` | 第 2 个参数 |
| `rdx` | 第 3 个参数 |

本篇用到的两个调用：

| 调用号 | 名称 | 作用 |
|--------|------|------|
| 1 | `sys_write` | 向文件描述符写入数据 |
| 60 | `sys_exit` | 结束进程 |

文件描述符也要记三个：

| fd | 含义 |
|----|------|
| 0 | stdin（标准输入） |
| 1 | stdout（标准输出） |
| 2 | stderr（标准错误） |

## 三、代码走读

### 第一步：输出字符串

```asm
mov     rax, 1          ; sys_write
mov     rdi, 1          ; stdout
mov     rsi, msg        ; 字符串地址
mov     rdx, msg_len    ; 字节数
syscall
```

四行 `mov` 填好参数，一行 `syscall` 触发内核执行 `write(1, msg, msg_len)`。效果就是在终端打印 `Hello, Assembly World!` 加换行。

### 第二步：正常退出

```asm
mov     rax, 60         ; sys_exit
mov     rdi, 0          ; 退出码 0 = 成功
syscall
```

没有这一步，程序跑完可能异常终止。`rdi = 0` 告诉 shell：「我正常结束了。」

## 四、编译与运行

在容器内（参考第 0 篇环境）：

```bash
make
./build/01_hello
```

输出：

```
Hello, Assembly World!
```

想亲眼看到系统调用，可以：

```bash
strace ./build/01_hello
```

你会看到类似 `write(1, "Hello, Assembly World!\n", 23)` 和 `exit(0)`——和汇编代码一一对应。

## 五、和 C 语言对照

用 C 写大概是：

```c
#include <unistd.h>

int main() {
    write(1, "Hello, Assembly World!\n", 23);
    return 0;
}
```

汇编版没有 `main`、没有 libc，但干的是同一件事：**通过 write 系统调用把字节送到 stdout**。区别只是参数从函数实参变成了寄存器赋值。

## 六、小结

本篇你学到了：

- 汇编程序的 `.data` / `.text` 基本结构
- `rax` / `rdi` / `rsi` / `rdx` 在 syscall 中的角色
- `sys_write` 和 `sys_exit` 的用法
- 用 `strace` 验证底层行为

> x86 汇编入门系列第 1 篇完。下一篇程序不再只是「往外说」，还要「听你说」——用 `sys_read` 从键盘读入你的名字并回显。
