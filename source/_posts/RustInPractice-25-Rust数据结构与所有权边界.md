---
cover: /images/cover/rust/rust-data-structures.webp
title: RustInPractice（25）：数据结构与所有权边界
date: 2026-07-23 12:00:00
categories: [RustInPractice]
tags: [Rust, 编程, 2026, 数据结构, 链表, 树, 图]
---

手写数据结构的最大收获不是替代标准库，而是看清所有权如何塑造节点关系。链表和 BST 用 `Option<Box<Node>>` 表达唯一递归所有权；图用邻接表表达多个边关系。

<!-- more -->

> 对应 `stack_queue_list`、`tree`、`graph`、`hash_table`。

BST 插入的关键是沿着唯一的可变路径递归：

```rust
fn insert(root: &mut Option<Box<TreeNode>>, value: i32) { /* ... */ }
```

图的 BFS 使用 `VecDeque` 队列，DFS 用 visited set 防环。自定义 HashMap 使用链地址法展示碰撞，但没有 resize/remove，不能替代标准库。

选择原则：业务优先标准集合；自定义结构只在需求、学习或性能测量证明需要时出现。

> 下一篇：排序与字符串搜索。
