---
cover: /images/cover/rust/sqlite-rusqlite.webp
title: RustInPractice（24）：SQLite 与 rusqlite
date: 2026-07-23 11:00:00
categories: [RustInPractice]
tags: [Rust, 编程, 2026, SQLite, 数据库, SQL]
---

`rusqlite` 用 Rust 类型包装 SQLite 的连接、参数绑定、查询和事务。核心规则是：SQL 值永远通过参数绑定传递，不用字符串拼接。

<!-- more -->

> 对应 `database/sqlite3`。下一篇：数据结构。

```rust
conn.execute(
    "INSERT INTO students (class_id, name, score) VALUES (?1, ?2, ?3)",
    params![1, name, score],
)?;
```

`query_map` 将行映射为 struct，`?` 将数据库失败传播到调用边界。事务应使用 checked transaction，并同时演示 commit 与 rollback；当前 demo 使用内存数据库和 `unchecked_transaction()`，只适合作为 API 导览。

真实项目还应启用 foreign keys、维护 migration、测试约束、使用持久路径，并决定连接是否只能在同步线程中使用。

> 下一篇：数据结构在 Rust 中的所有权边界。
