---
cover: /images/cover/rust/strings-utf8.webp
title: RustInPractice（03）：String、切片与 UTF-8
date: 2026-07-20 12:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - String
  - UTF-8
  - 切片
---

Rust 不支持 `text[0]` 这种字符串下标，不是少了功能，而是拒绝把“第 0 个元素”伪装成一个没有歧义的操作。UTF-8 的一个字符可能占多个字节，字符、人眼看到的字形、字节索引也未必是一回事。

<!-- more -->

> 这是 RustInPractice 的第 03 篇。`regex_demo` 使用了字符串切片和原始字符串。下一篇进入数组、`Vec`、元组与迭代器。

## 一、`String` 和 `&str` 的边界

| 类型 | 含义 | 常见来源 |
|---|---|---|
| `String` | 拥有文本，可增长、可修改 | 文件、网络、拼接、`String::from` |
| `&str` | 借用的 UTF-8 文本切片 | 字符串字面量、`String` 的只读视图 |

```rust
let mut name = String::from("Rust");
name.push_str(" language");

let first_word: &str = &name[..4];
println!("{first_word}");
```

函数如果只需要读取文本，优先接受 `&str`：调用方传 `String` 和字符串字面量都可以。只有函数需要保存、修改或转移文本时，才需要 `String`。

## 二、为什么不能按下标取字符？

UTF-8 是变长编码。下列文本的字节长度和 `char` 数量不同：

```rust
let text = "Rust语言";
println!("bytes = {}", text.len());
println!("chars = {}", text.chars().count());
```

`len()` 返回字节数，适合缓冲区、协议和存储；`chars()` 迭代 Unicode scalar value，适合多数逐字符逻辑。若要按用户感知的“字形”切分，还需要 grapheme cluster 级别的库支持。

字符串切片必须落在有效 UTF-8 边界：

```rust
let text = "Rust语言";
let prefix = &text[..4]; // "Rust"，4 是有效边界
println!("{prefix}");
```

任意字节偏移并不一定合法，所以 Rust 不提供常数时间的字符串下标。先决定你的问题需要字节、`char` 还是字形，再选择 API。

## 三、原始字符串适合正则与路径式文本

正则常含有反斜杠。普通字符串要双重转义，原始字符串 `r"..."` 更直观：

```rust
use regex::Regex;

let date = Regex::new(r"(?P<year>\d{4})-(?P<month>\d{2})").unwrap();
let captures = date.captures("2026-07").unwrap();
println!("{}", &captures["year"]);
```

这里的 `unwrap()` 只适合“写死在源码里的模式已经被测试过”的小示例。运行时输入的模式必须处理 `Regex::new` 返回的 `Result`。对于频繁调用的固定正则，应编译一次并复用，而不是每次进入函数都创建它。

## 四、解析时保持索引单位一致

字符串搜索 demo 按 UTF-8 字节处理，KMP 返回的是**字节偏移**。这对 ASCII、协议文本或明确以字节定义的问题很合适；若拿结果切分非 ASCII 的 `&str`，必须先确认偏移位于字符边界。

```rust
let text = "a语言b";
for (byte_index, ch) in text.char_indices() {
    println!("{byte_index}: {ch}");
}
```

`char_indices()` 同时给出字符和其字节起点，是在文本中记录安全边界的常用办法。

## 五、小结

- `String` 拥有文本，`&str` 借用文本；只读参数优先写 `&str`。
- Rust 字符串保证 UTF-8，`len()` 是字节数而不是字符数。
- 不支持字符串下标，避免在变长编码上制造错误的复杂度承诺。
- 正则适合使用原始字符串；固定模式要复用编译结果。

> RustInPractice 第 03 篇完。下一篇：数组、`Vec`、元组与迭代器，开始处理一组数据。
