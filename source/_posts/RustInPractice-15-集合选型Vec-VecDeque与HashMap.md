---
cover: /images/cover/rust/collections-selection.webp
title: RustInPractice（15）：集合选型，Vec、VecDeque 与 HashMap
date: 2026-07-22 09:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - 集合
  - Vec
  - HashMap
  - VecDeque
---

先选对标准集合，再考虑自定义数据结构。Rust 标准库的 `Vec`、`VecDeque`、`HashMap`、`BTreeMap` 已覆盖绝大多数工程需求；手写链表和哈希表更适合作为理解所有权与复杂度的练习。

<!-- more -->

> RustInPractice 第三季第 15 篇。对应 demo：`stack_queue_list`、`hash_table`。下一篇将这些容器放进可信的测试体系。

## 一、按访问模式选容器

| 需求 | 首选 | 原因 |
|---|---|---|
| 末尾追加、按下标访问 | `Vec<T>` | 连续内存，缓存友好 |
| 两端进出队 | `VecDeque<T>` | `push_back` / `pop_front` 高效 |
| 键值快速查找 | `HashMap<K, V>` | 平均常数时间访问 |
| 需要稳定有序遍历 | `BTreeMap<K, V>` | 按 key 排序 |
| 去重 | `HashSet<T>` / `BTreeSet<T>` | 只保存 key |

demo 的栈直接用 `Vec`：`push` 与 `pop` 都在末尾进行。队列则使用 `VecDeque`，避免从 `Vec` 头部删除时搬移所有元素。

## 二、`HashMap` 的 Entry API

更新计数不要先 `get` 再 `insert`：

```rust
use std::collections::HashMap;

let mut counts = HashMap::new();
for word in ["rust", "safe", "rust"] {
    *counts.entry(word).or_insert(0) += 1;
}
```

`entry` 将“存在”和“不存在”两条路径统一为一个可修改入口，避免重复哈希和多次查找。`HashMap` 的遍历顺序不稳定，输出、测试或协议需要确定顺序时使用 `BTreeMap` 或在输出前排序。

## 三、自定义实现的边界

`hash_table` 使用链地址法解释碰撞，但它有固定 bucket 数、返回克隆值、没有删除或 resize。它不是 `std::collections::HashMap` 的替代品。类似地，`learning_guide` 的 LRU 用 `VecDeque::retain` 更新顺序，操作是 O(n)，适合教学而非宣称 O(1) 的缓存实现。

## 四、链表是所有权练习，不是默认容器

单链表 demo 用 `Option<Box<Node<T>>>` 表达节点拥有下一个节点。它非常适合理解递归所有权；但日常序列操作通常用 `Vec`，队列用 `VecDeque`。现代 CPU 上连续内存的局部性往往比链表理论上的插入优势更重要。

## 五、小结

- 用访问模式决定集合，而不是按“数据结构名气”选择。
- `Vec`、`VecDeque`、`HashMap` 是工程默认值。
- `entry` 适合聚合与原地初始化。
- 自定义容器应明确教学简化与复杂度边界。

> 下一篇：测试设计，让容器和算法输出从“看起来正确”变成可重复验证。
