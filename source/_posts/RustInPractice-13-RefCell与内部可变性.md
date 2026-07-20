---
cover: /images/cover/rust/interior-mutability.webp
title: RustInPractice（13）：RefCell 与内部可变性
date: 2026-07-21 14:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - RefCell
  - 内部可变性
  - Rc
---

默认情况下，只有拿到 `&mut T` 才能修改 `T`。`RefCell<T>` 是一个刻意的例外：它允许通过 `&self` 修改内部值，但把借用规则从编译期挪到运行时检查。它很有用，也因此需要更克制地使用。

<!-- more -->

> 这是 RustInPractice 的第 13 篇。对应 demo：`refcell_demo`、`design_patterns`。下一篇用泛型与 trait 组织可组合行为。

## 一、内部可变性是什么？

demo 的计数器方法接收 `&self`，却能增加内部数值：

```rust
use std::cell::RefCell;

struct Counter {
    value: RefCell<i32>,
}

impl Counter {
    fn increment(&self) {
        *self.value.borrow_mut() += 1;
    }
}
```

`borrow()` 返回只读 guard，`borrow_mut()` 返回可写 guard。guard 存在期间，RefCell 会在运行时记录借用状态。

## 二、规则没有消失，只是失败时机改变

```rust
let cell = RefCell::new(1);
let read = cell.borrow();
// let write = cell.borrow_mut(); // 运行时 panic
println!("{read}");
```

与普通引用不同，这段冲突不会在编译阶段被拒绝，而会在实际执行到 `borrow_mut` 时 panic。因此应让 guard 的作用域尽可能短：

```rust
let next = {
    let mut value = cell.borrow_mut();
    *value += 1;
    *value
};
println!("{next}");
```

## 三、`Rc<RefCell<T>>` 的含义

```rust
use std::cell::RefCell;
use std::rc::Rc;

let state = Rc::new(RefCell::new(0));
let first = Rc::clone(&state);
let second = Rc::clone(&state);
*first.borrow_mut() += 10;
*second.borrow_mut() += 5;
```

这个组合表示“多个单线程拥有者共享一份可变状态”。观察者 demo 用它保存可调用回调，这适合 UI 树、测试替身和图结构等确有共享关系的场景。

它不能跨线程使用。多线程共享可变状态通常是 `Arc<Mutex<T>>`，但也要谨慎处理锁范围、死锁和阻塞问题。

## 四、何时选其他工具？

| 需求 | 优先选择 |
|---|---|
| 已能拿到 `&mut T` | 普通可变借用 |
| 简单 Copy 值的内部更新 | `Cell<T>` |
| 单线程共享可变状态 | `Rc<RefCell<T>>` |
| 多线程共享可变状态 | `Arc<Mutex<T>>` 或消息传递 |
| 只读共享 | `Rc<T>`、`Arc<T>` 或引用 |

## 五、小结

- `RefCell` 允许内部可变性，但在运行时执行借用检查。
- 冲突借用会 panic，因此 guard 应短小、局部。
- `Rc<RefCell<T>>` 适合单线程共享可变模型，不是默认状态管理方案。
- 能用普通 `&mut T` 时，优先使用编译期检查的普通借用。

> RustInPractice 第 13 篇完。下一篇：泛型、trait 与静态/动态分发。
