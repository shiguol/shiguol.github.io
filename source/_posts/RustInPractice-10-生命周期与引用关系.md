---
cover: /images/cover/rust/lifetimes.webp
title: RustInPractice（10）：生命周期与引用关系
date: 2026-07-21 11:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - 生命周期
  - 借用
  - 引用
---

生命周期不是对象在运行时倒计时，也不是必须到处手写的神秘标记。它描述的是：**一个引用至少要和它所指向的数据一样久。** 大多数函数依靠省略规则自动推断；只有返回引用或在 struct 中保存引用时，才需要把关系写出来。

<!-- more -->

> 这是 RustInPractice 的第 10 篇。下一篇进入 `Box<T>` 和递归数据结构。

## 一、悬垂引用为何被禁止？

```rust
// fn broken() -> &str {
//     let text = String::from("temporary");
//     &text
// }
```

`text` 在函数结束时被销毁，返回的引用会指向无效内存，所以编译器拒绝它。正确方案通常是返回拥有的数据：

```rust
fn make_text() -> String {
    String::from("owned result")
}
```

## 二、标注的是关系，不是具体时长

从两个切片返回较长者：

```rust
fn longer<'a>(left: &'a str, right: &'a str) -> &'a str {
    if left.len() >= right.len() { left } else { right }
}
```

`'a` 的含义是：返回引用的有效期不超过两个输入引用共同有效的部分。它不让任何值活得更久，也不改变运行时行为；它只是让编译器能验证调用关系。

## 三、生命周期省略规则覆盖常见方法

```rust
struct Label {
    text: String,
}

impl Label {
    fn as_str(&self) -> &str {
        &self.text
    }
}
```

这里无需写生命周期，因为方法接收者是 `&self`，返回引用自然与 `self` 关联。只有关系无法从参数形式唯一推断时，才需要显式标注。

## 四、保存引用的 struct

若 struct 不拥有文本而只借用它，必须声明关系：

```rust
struct Excerpt<'a> {
    text: &'a str,
}

let article = String::from("Rust makes ownership explicit.");
let excerpt = Excerpt { text: &article[..4] };
println!("{}", excerpt.text);
```

`Excerpt` 不能比 `article` 活得更久。若类型需要脱离原始输入长期保存，通常改为持有 `String`，而不是与复杂的借用图搏斗。

## 五、`'static` 不等于“永远正确”

字符串字面量位于程序二进制中，类型是 `&'static str`：

```rust
let message: &'static str = "fixed text";
```

`'static` 表示引用可在整个程序运行期间有效。它不表示所有数据都应使用静态生命周期，也不应被用作绕过生命周期错误的手段。

## 六、小结

- 生命周期防止返回或保存悬垂引用。
- 标注表达引用之间的约束，不会延长数据实际寿命。
- 普通函数和方法通常由省略规则解决。
- 保存借用会让类型带上生命周期；需要长期持有时优先拥有数据。

> RustInPractice 第 10 篇完。下一篇：`Box<T>`、自动 Drop 与递归数据结构。
