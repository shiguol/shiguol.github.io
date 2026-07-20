---
cover: /images/cover/rust/testing-strategy.webp
title: RustInPractice（16）：测试设计，写出可信代码
date: 2026-07-22 10:00:00
categories:
  - RustInPractice
tags:
  - Rust
  - 编程
  - 2026
  - 测试
  - 单元测试
  - Rustdoc
---

`cargo test` 很容易运行，但真正的难点是选择输入和断言行为。测试不是把 demo 输出再打印一遍，而是为边界、失败路径和不变量建立自动化证据。

<!-- more -->

> RustInPractice 第 16 篇。对应 demo：`testing_demo`，并为后续算法和服务文章建立测试标准。

## 一、单元测试验证一个行为

```rust
#[test]
fn divide_by_zero_is_an_error() {
    assert!(Calculator::divide(1.0, 0.0).is_err());
}
```

测试名说清行为而非实现。`#[cfg(test)]` 模块只在测试时编译，适合测试私有实现细节；公开 API 的行为还应有 integration test 覆盖。

## 二、优先覆盖边界

每个集合和算法都至少应考虑：空输入、单元素、重复值、最大最小值、无效格式和错误分支。例如排序必须覆盖空 slice；动态规划应拒绝负容量和长度不一致输入；字符串算法必须声明它返回字节偏移还是字符位置。

```rust
#[test]
fn sort_handles_empty_input() {
    let mut values: [i32; 0] = [];
    bubble_sort(&mut values);
    assert!(values.is_empty());
}
```

## 三、集成测试与 doctest

| 类型 | 位置 | 目的 |
|---|---|---|
| 单元测试 | 源码内 `#[cfg(test)]` | 私有逻辑与局部边界 |
| 集成测试 | `tests/` | 仅通过公开 API 验证 |
| doctest | Rustdoc 代码块 | 确保文档示例可编译 |
| 属性测试 | 专用框架 | 随机输入下验证不变量 |

CLI 和 HTTP 服务特别适合黑盒集成测试：输入参数或请求，断言退出码、状态码和响应内容，而不是耦合内部函数调用。

## 四、浮点数不要盲目精确比较

`0.1 + 0.2` 不能作为精确等于 `0.3` 的通用前提。需要时使用容差：

```rust
let actual = 0.1_f64 + 0.2;
assert!((actual - 0.3).abs() < 1e-12);
```

整数、枚举、字符串等精确值仍应使用 `assert_eq!`，这样失败输出更清晰。

## 五、小结

- 测试验证行为与边界，不复制实现细节。
- 单元、集成、doctest 分别覆盖不同层次。
- 新算法必须先写空输入和异常输入测试。
- 输出、fixture 和错误消息同样不得包含私有数据。

> 下一篇：原生线程、Mutex、Condvar、Barrier 与原子操作。
