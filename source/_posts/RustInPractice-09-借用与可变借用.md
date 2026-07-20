---
cover: /images/cover/rust/borrowing-references.webp
title: RustInPractice（09）：借用与可变借用
date: 2026-07-21 10:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - 所有权
  - 借用
  - 引用
---

按值传参会移动所有权，但多数函数只需要读取或修改调用者已有的数据。Rust 用引用表达这种临时访问，并用一条核心规则消除数据竞争：**任意时刻，要么有多个只读引用，要么恰好有一个可变引用。**

<!-- more -->

> 这是 RustInPractice 的第 09 篇。下一篇讲生命周期，解释编译器如何判断引用不会比它指向的数据活得更久。

## 一、不可变借用 `&T`

```rust
fn length(text: &str) -> usize {
    text.len()
}

let name = String::from("Rust");
println!("{}", length(&name));
println!("{name}");
```

`length` 得到的是只读视图，而不是 `String` 的所有权。函数结束后借用失效，原值仍由 `name` 拥有。对于文本参数，`&str` 比 `&String` 更通用：既能接收 `String`，也能接收字符串字面量。

## 二、可变借用 `&mut T`

```rust
fn append_suffix(text: &mut String) {
    text.push_str(" language");
}

let mut name = String::from("Rust");
append_suffix(&mut name);
println!("{name}");
```

要创建可变引用，绑定本身必须是 `mut`。这不是重复限制：第一个 `mut` 允许变量被修改，`&mut` 则把“当前函数独占修改权”交给调用者或被调用函数。

## 三、别名 XOR 可变性

以下代码不能通过：

```rust
let mut text = String::from("hello");
let read = &text;
// let write = &mut text; // 错误：read 仍在使用
println!("{read}");
```

如果读者和写者同时存在，读到的内容可能在观察期间改变。Rust 选择在编译期拒绝它，而不是让调用者自行加锁或赌运行顺序。

相反，多个只读引用没有问题：

```rust
let first = &text;
let second = &text;
println!("{first} {second}");
```

## 四、借用范围通常比代码块更短

现代 Rust 使用 non-lexical lifetimes：引用的存活期通常结束于最后一次使用，而不是所在的整个 `{}` 块。

```rust
let mut text = String::from("hello");
let count = text.len();
text.push('!'); // count 已不再借用 text
println!("{count}, {text}");
```

遇到借用错误时，先缩短引用实际使用范围，不要立刻 `clone()`。常见做法是先计算或拷贝需要的小值，再开始可变操作。

## 五、从 demo 看接口语义

`move_demo` 中 `borrow(&a)` 在读取 `Movable` 后，`a` 仍可移动给 `b`。这正是借用的边界：读取不改变拥有者；需要消费资源的 `take_ownership(b)` 才按值接收。

## 六、小结

- `&T` 允许共享只读访问，`&mut T` 允许独占修改。
- 同一数据不能同时拥有可变借用和其他借用。
- 借用会在最后一次使用后结束，尽量让引用范围小而清晰。
- 参数优先选择最弱但足够的能力：只读用 `&T`，原地修改才用 `&mut T`。

> RustInPractice 第 09 篇完。下一篇：生命周期，理解引用关系如何被类型系统描述。
