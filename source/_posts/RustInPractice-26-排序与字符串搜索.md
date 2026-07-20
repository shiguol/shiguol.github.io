---
cover: /images/cover/rust/sorting-search.webp
title: RustInPractice（26）：排序与字符串搜索
date: 2026-07-23 13:00:00
categories: [RustInPractice]
tags: [Rust, 编程, 2026, 排序, KMP, 算法]
---

排序 demo 用 `&mut [i32]` 直接操作切片，搜索 demo 用字节序列实现朴素匹配与 KMP。它们适合理解复杂度，生产代码仍应优先标准库。

<!-- more -->

> 对应 `sorting`、`string_search`。下一篇：动态规划与系列收官。

冒泡和插入排序是 O(n²)，快速排序平均 O(n log n)，但最后元素 pivot 对已排序输入会退化并导致深递归。默认应使用 `sort_unstable()`，除非需要稳定排序。

KMP 的 LPS 表让失配后不必回退 haystack，因此复杂度为 O(m+n)。当前实现按 UTF-8 **字节**搜索，返回字节偏移；非 ASCII 文本不能把该值当字符索引或随意切片。

测试必须覆盖空 slice、单元素、重复值、空 pattern 和 Unicode 边界。

> 下一篇：动态规划与 RustInPractice 主线回顾。
