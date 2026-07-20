---
cover: /images/cover/rust/traits-dispatch.webp
title: RustInPractice（14）：泛型、Trait 与静态/动态分发
date: 2026-07-21 15:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - 泛型
  - Trait
  - 动态分发
  - 设计模式
---

Rust 不以 class 继承为核心。它把数据放进 struct 或 enum，把可替换行为写成 trait，再根据场景选择泛型的静态分发或 trait object 的动态分发。结果是组合关系清楚，抽象成本也更可见。

<!-- more -->

> 这是 RustInPractice 第二季收官篇。对应 demo：`oop_demo`、`pimpl_demo`、`design_patterns`。下一季进入集合、测试与并发工程实践。

## 一、泛型消除重复

```rust
fn swap<T, U>(pair: (T, U)) -> (U, T) {
    (pair.1, pair.0)
}
```

`T`、`U` 是类型参数。编译器会为实际使用的具体类型生成对应实现，这通常称为单态化。泛型函数不必事先知道具体类型，只需声明它需要的能力。

## 二、trait 定义能力而非继承层级

```rust
trait Compress {
    fn compress(&self, data: &str) -> String;
}

struct Plain;

impl Compress for Plain {
    fn compress(&self, data: &str) -> String {
        data.to_string()
    }
}
```

一个类型可实现多个 trait；一个 trait 也可被很多无关类型实现。`design_patterns` 的 Strategy 示例正是把“压缩行为”从数据类型中抽离出来。

## 三、静态分发：`impl Trait` 或 trait bound

```rust
fn encode(data: &str, strategy: impl Compress) -> String {
    strategy.compress(data)
}
```

这意味着调用点的 `strategy` 具体类型在编译期已知。编译器可内联和优化，没有虚表间接调用；代价是每种具体类型可能生成一份代码。

复杂约束可写为：

```rust
fn render<T>(value: T) -> String
where
    T: std::fmt::Display + Clone,
{
    value.to_string()
}
```

## 四、动态分发：`dyn Trait`

当一组不同具体类型必须放进同一个集合，或在运行时选择实现时，使用 trait object：

```rust
fn encode_dynamic(data: &str, strategy: &dyn Compress) -> String {
    strategy.compress(data)
}
```

`&dyn Compress` 包含数据指针和虚表指针，调用经由虚表发生。它需要 object-safe trait，并带来一次间接调用；通常这点成本远不如清晰的架构重要，但不该假装它不存在。

## 五、组合、封装与 Pimpl

`oop_demo` 用 struct 包含另一个 struct 表达组合，而不是继承。`pimpl_demo` 则将私有实现放在 `Box<WidgetImpl>` 后：公开 `Widget` API 稳定，内部字段可替换。

Rust 的模块私有性已经能隐藏大量细节，Box 并非总是必要。只有需要稳定对象大小、隐藏具体实现或减少公共类型耦合时，才引入额外间接层。

## 六、选型速查

| 场景 | 推荐 |
|---|---|
| 调用点知道具体类型 | 泛型 / `impl Trait` |
| 运行时混合不同实现 | `dyn Trait` |
| 一个类型有多种可选状态 | enum + `match` |
| 需要复用行为 | trait |
| 需要复用数据实现 | struct 组合 |

## 七、小结

- 泛型按所需能力抽象，trait 定义能力契约。
- 静态分发利于优化，动态分发利于运行时异构。
- trait 与组合通常比继承层级更直接。
- enum、泛型、trait object 各有边界，按数据是否异构、类型是否运行时决定选择。

> RustInPractice 第 14 篇完，第二季完结。下一篇：集合选择，从 `Vec`、`VecDeque`、`HashMap` 开始进入工程实践。
