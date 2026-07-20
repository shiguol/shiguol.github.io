---
cover: /images/cover/rust/box-recursion.webp
title: RustInPractice（11）：Box、Drop 与递归数据结构
date: 2026-07-21 12:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - Box
  - Drop
  - 递归
  - 所有权
---

`Box<T>` 常被误解为“Rust 的手动堆内存”。实际上它仍然是普通拥有者：它拥有 `T`，离开作用域时自动释放 `T`。Box 的价值在于把值放到堆上，或让递归类型拥有一个编译期确定的大小。

<!-- more -->

> 这是 RustInPractice 的第 11 篇。对应 demo：`box_demo`、`tree`、`stack_queue_list`。下一篇讲共享所有权 `Rc`、`Arc` 与 `Weak`。

## 一、`Box<T>` 仍是唯一所有权

```rust
let number = Box::new(42);
println!("{number}");
```

`Box<T>` 自身通常在栈上，内部指针指向堆上的 `T`。它不可隐式复制，移动 Box 就是移动唯一所有权。绝大多数场景不需要显式调用释放函数：作用域结束时自动执行 Drop。

## 二、`Drop` 统一管理各种资源

demo 的 `Resource` 实现 `Drop`：

```rust
impl Drop for Resource {
    fn drop(&mut self) {
        println!("resource released: {}", self.name);
    }
}
```

无论 `Resource` 是直接绑定还是装进 `Box`，离开作用域都会执行 `drop`。这套模式不只针对内存，也适用于文件、锁、socket 和事务。与手动释放相比，它在提前返回和错误传播时更可靠。

## 三、递归类型为什么需要 Box？

如下链表定义无法确定大小：

```rust
// enum List { Node(i32, List), End }
```

`Node` 内直接嵌入另一个 `List`，编译器无法算出一个 `List` 要多大。改为 Box 后，递归位置变成固定大小的指针：

```rust
enum List {
    Node(i32, Box<List>),
    End,
}
```

二叉树常写成 `Option<Box<Node>>`。`Option` 表示空子树，`Box` 切断无限大小递归，节点则拥有左右子树。

## 四、什么时候不要用 Box？

| 需求 | 更自然的选择 |
|---|---|
| 单一拥有者、大小已知 | 直接使用 `T` |
| 连续可增长序列 | `Vec<T>` |
| 共享只读所有权 | `Rc<T>` 或 `Arc<T>` |
| 递归节点或 trait object | `Box<T>` |
| 仅借用外部值 | `&T` |

不要因为“堆比栈大”就把普通值装进 Box。Box 引入一次额外分配和间接访问，应由数据结构或接口边界需要来决定。

## 五、`Box<[T]>`：固定的堆切片

```rust
let values: Box<[i32]> = vec![1, 2, 3].into_boxed_slice();
```

它拥有一段堆上的连续元素，但不再保留 `Vec` 的可增长容量。适合构建完成后只读、且希望减少容量冗余的序列。

## 六、小结

- `Box<T>` 是唯一拥有者，不是手动内存管理工具。
- Drop 让资源在离开作用域时自动清理。
- Box 用固定大小指针打破递归类型的无限布局。
- 先选直接值或标准容器，只有递归、trait object 或明确间接层需要时才引入 Box。

> RustInPractice 第 11 篇完。下一篇：`Rc`、`Arc` 与 `Weak`，什么时候一个值需要多个拥有者？
