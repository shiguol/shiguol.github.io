---
cover: /images/cover/cpp/sorting.webp
title: 现代 C++ 实战（18）：排序算法与 std::sort
date: 2026-07-01 14:00:00
categories:
  - CppInPractice
tags:
- C++
- 现代C++
- 编程
- 2026
- 算法
- 排序
- STL
- 复杂度
---

第二季讲完语言与工程，第三季进入**算法与数据结构**。排序是第一课：手写七种经典算法理解原理，再和 **`std::sort`** 做性能对比——感受工业级实现为何快一个数量级。

demo：`ref/cpp_demo/algorithms/sorting/`（含 7 种手写排序 + benchmark）。

<!-- more -->

> 这是「现代 C++ 实战」系列的第 18 篇，**第三季开篇**。建议先读 [第 17 篇：C++23 新特性](/2026/06/30/现代C++实战-17-C++23新特性/)。

## 一、排序算法全景

| 算法 | 平均时间 | 最坏 | 空间 | 稳定 | 比较？ |
|------|----------|------|------|------|--------|
| 冒泡 | O(n²) | O(n²) | O(1) | ✅ | 是 |
| 选择 | O(n²) | O(n²) | O(1) | ❌ | 是 |
| 插入 | O(n²) | O(n²) | O(1) | ✅ | 是 |
| 归并 | O(n log n) | O(n log n) | O(n) | ✅ | 是 |
| 快速 | O(n log n) | O(n²) | O(log n) | ❌ | 是 |
| 堆 | O(n log n) | O(n log n) | O(1) | ❌ | 是 |
| 计数 | O(n + k) | O(n + k) | O(n + k) | ✅ | **否** |
| **`std::sort`** | O(n log n) | — | O(log n) | ❌ | 是（IntroSort） |

**稳定**：相等元素排序后相对顺序不变。需要稳定时用 `std::stable_sort` 或归并/计数。

## 二、O(n²) 三角：冒泡、选择、插入

### 冒泡排序

相邻比较，大元素「冒泡」到末尾；一轮无交换可提前退出（已有序时 O(n)）。

```cpp
for (auto i = first; i != last; ++i) {
    bool swapped = false;
    for (auto j = first; j != last - std::distance(first, i) - 1; ++j) {
        if (*j > *(j + 1)) { std::swap(*j, *(j + 1)); swapped = true; }
    }
    if (!swapped) break;
}
```

### 选择排序

每轮在未排序区找最小值，换到当前位置。交换次数少，但**无论输入都是 O(n²)**，且不稳定。

### 插入排序

像理扑克牌：把 `key` 插入已排序区左侧。**基本有序时接近 O(n)**，小数组、稳定场景常用；也是 `std::sort` 对小段的优化手段之一。

| | 教学价值 | 实战 |
|--|----------|------|
| 三者 | 理解「比较-交换/移动」 | 仅 n < 50 或作子过程 |

## 三、归并排序：分治 + 合并

```
[38, 27, 43, 3] → [38,27] [43,3] → [27,38] [3,43] → [3,27,38,43]
```

1. 一分为二，递归排序
2. **合并**两个有序子数组（双指针取较小者）

时间恒 **O(n log n)**，空间 **O(n)**，**稳定**。适合链表排序、外部排序（大文件分块归并）。

## 四、快速排序：partition + 递归

选 **pivot**（demo 取末尾），分区：≤ pivot 放左，> pivot 放右，再递归左右。

```cpp
Iterator partition(Iterator first, Iterator last) {
    auto pivot = *(last - 1);
    auto i = first;
    for (auto j = first; j != last - 1; ++j) {
        if (*j <= pivot) { std::swap(*i, *j); ++i; }
    }
    std::swap(*i, *(last - 1));
    return i;
}
```

平均 O(n log n)，最坏 O(n²)（pivot 总取最值）。工程上：**随机 pivot**、**三数取中**、小数组改插入排序。`std::sort` 底层常用 **IntroSort**（快排 + 堆排序兜底，避免最坏 O(n²)）。

## 五、堆排序：原地 O(n log n)

1. 建**最大堆**
2. 堆顶（最大）与末尾交换，堆大小减 1，再 `heapify`

时间稳定 O(n log n)，空间 **O(1)**，不稳定。适合既要 O(n log n) 又要限制额外内存的场景。

## 六、计数排序：非比较排序

数据为**小范围整数**时，统计频次再按序输出：

| 步骤 | 操作 |
|------|------|
| 1 | 找 min/max，范围 k |
| 2 | `count[val]` 计数 |
| 3 | 前缀和得到位置 |
| 4 | 从后向前填输出（保稳定） |

时间 **O(n + k)**，k 很大时空间爆炸。是**基数排序**、**桶排序**的基础。

## 七、与 `std::sort` 的性能对比

demo 对 **10000 个随机整数** 测各算法耗时（毫秒级），典型结论：

| 梯队 | 算法 |
|------|------|
| 慢 | 冒泡、选择、插入（数百 ms 级） |
| 中 | 手写快排、归并、堆（个位数 ms） |
| 快 | **计数**（范围合适时）、**`std::sort`** |

```cpp
std::sort(v.begin(), v.end());                    // 默认 <
std::sort(v.begin(), v.end(), std::greater<>());  // 降序

// 需要稳定
std::stable_sort(v.begin(), v.end());

// C++20 起：未完成序列上排序
std::ranges::sort(v);
```

**`std::sort` 要求**：随机访问迭代器；比较满足**严格弱序**。自定义类型需提供 `operator<` 或比较器：

```cpp
struct Point { int x, y; };
bool operator<(const Point& a, const Point& b) { return a.x < b.x; }
```

实现细节（libc++）：IntroSort + 小数组插入排序 + 可能并行（实现定义）。

## 八、怎么选？

| 场景 | 推荐 |
|------|------|
| 日常容器排序 | **`std::sort` / `ranges::sort`** |
| 要稳定 | **`std::stable_sort`** |
| 小范围整数 | 计数 / 基数 |
| 链表 | 归并（`std::list::sort`） |
| 面试/教学 | 手写快排、归并 |
| Top-K | `std::partial_sort` / 堆 |

## 九、demo 运行

```bash
cd ref/cpp_demo/algorithms/sorting
./build.sh --run
```

先对小数组打印七种排序结果，再输出 10000 元数据的性能表（含 `std::sort`）。

## 十、小结

| 要点 | 内容 |
|------|------|
| **O(n²)** | 冒泡、选择、插入——小数据/教学 |
| **O(n log n)** | 归并、快排、堆——通用 |
| **O(n + k)** | 计数——整数、范围小 |
| **工程** | 直接用 `std::sort`，稳定用 `stable_sort` |

> 现代 C++ 实战系列第 18 篇完。下一篇 **哈希表实现**——链地址法 vs 开放寻址。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 17 | [C++23 新特性](/2026/06/30/现代C++实战-17-C++23新特性/) | ✅ |
| **18** | **排序算法与 std::sort（本篇）** | ✅ |
| 19 | 哈希表实现 | 下一篇 |

完整大纲见工作区 `docs/CPP_SERIES_OUTLINE.md`。
