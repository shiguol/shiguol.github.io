---
cover: /images/cover/cpp/ranges.png
title: 现代 C++ 实战（10）：Ranges 与函数式风格
date: 2026-06-23 14:00:00
categories:
  - CppInPractice
tags:
  - C++
  - 现代C++
  - 编程
  - 2026
  - C++20
  - Ranges
---

传统 STL 算法要传 `begin/end`，中间步骤常要**临时容器**；C++20 **Ranges** 用「范围 + 视图管道」把数据处理写成 Unix 管道风格——`filter | transform | take`，且**惰性求值**，少分配、可读性高。

这一篇对应 demo：`ref/cpp_demo/basics/ranges_demo/`。

<!-- more -->

> 这是「现代 C++ 实战」系列的第 10 篇。建议先读 [第 09 篇：C++20 格式化与编译期计算](/2026/06/22/现代C++实战-09-C++20格式化与编译期计算/)。

## 一、传统算法的局限

```cpp
std::vector<int> nums = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

// 传统写法：多步 + 中间容器
std::vector<int> evens;
std::copy_if(nums.begin(), nums.end(), std::back_inserter(evens),
             [](int n) { return n % 2 == 0; });
std::vector<int> squares;
std::transform(evens.begin(), evens.end(), std::back_inserter(squares),
               [](int n) { return n * n; });
// 再取前 3 个……
```

问题：

- 每次算法都要写 **begin/end** 迭代器对
- 多步处理往往 **分配多个中间 vector**
- 逻辑从里到外读，不如管道直观

## 二、Range 概念

**Range** = 能拿到 `begin` 和 `end` 的东西：`vector`、`array`、`string`、`span`、以及**视图（view）**。

C++20 算法有 **ranges 版本**，直接传整个容器：

```cpp
#include <ranges>
#include <algorithm>
#include <vector>

std::vector<int> nums = {5, 2, 8, 1, 9};
std::ranges::sort(nums);                    // 不必写 begin/end
auto it = std::ranges::find(nums, 8);
int c = std::ranges::count(nums, 5);
```

| 传统 STL | Ranges |
|----------|--------|
| `std::sort(v.begin(), v.end())` | `std::ranges::sort(v)` |
| 迭代器对 | 整个 range |
| 算法在 `<algorithm>` | 范围算法在 `<algorithm>` + `<ranges>` |

## 三、Views 管道：`filter | transform | take`

**视图（view）** 是轻量适配器，**不拥有**元素，**惰性**——只有迭代时才计算。

```cpp
auto result = nums
    | std::views::filter([](int n) { return n % 2 == 0; })
    | std::views::transform([](int n) { return n * n; })
    | std::views::take(3);

for (int x : result)
    std::cout << x << ' ';   // 4 16 36
```

常用视图：

| 视图 | 作用 |
|------|------|
| `filter` | 保留谓词为 true 的元素 |
| `transform` | 映射每个元素 |
| `take(n)` | 取前 n 个 |
| `drop(n)` | 跳过前 n 个 |
| `reverse` | 反转 |
| `keys` / `values` | 遍历 map 的键/值 |

管道从左到右读：**先过滤偶数 → 平方 → 取前 3**。

## 四、惰性求值：何时真正计算？

```cpp
auto pipe = nums | std::views::filter(pred) | std::views::transform(f);
// 此时没有分配新 vector，也没有跑完 filter+transform

for (int x : pipe) { /* 每前进一步才算一步 */ }
```

| |  eager（传统 + 中间容器） | lazy（views） |
|--|---------------------------|---------------|
| 内存 | 每步可能新 vector | 通常无额外容器 |
| 计算时机 | 立即 | 迭代时 |
| 组合 | 多行代码 | `\|` 链式 |

注意：视图**不能**延长底层容器生命周期——`vector` 销毁后迭代 view 是 UB（与 [第 09 篇](/2026/06/22/现代C++实战-09-C++20格式化与编译期计算/) 的 `span` 类似）。

## 五、投影（Projection）：按成员排序

对 `struct Student { string name; int score; }`，按分数排序：

```cpp
struct Student { std::string name; int score; };

std::vector<Student> students = { /* ... */ };

// 投影：比较时只取 score 字段
std::ranges::sort(students, {}, &Student::score);

// 降序
std::ranges::sort(students, std::greater{}, &Student::score);
```

第三个参数 **projection** 告诉算法「用对象的哪个成员参与比较」——不必手写 `[](const Student& a, const Student& b){ return a.score < b.score; }`。

demo 中的管道示例：过滤及格 → 按分排序 → 取前三 → 提取姓名，全用 views + ranges 算法组合。

## 六、与传统 STL 的对比

| 维度 | 传统 STL | Ranges |
|------|----------|--------|
| 语法 | `algo(b, e, ...)` | `ranges::algo(range, ...)` |
| 组合 | 中间容器或手写迭代器 | `\|` 管道 |
| 惰性 | 否（除非手写生成器） | views 默认惰性 |
| 编译器 | C++98 起 | **C++20**（GCC 10+ / Clang 13+） |
| 性能 | 成熟优化 | 管道常零开销抽象；极端场景需 profiling |

**何时用 Ranges**：多步数据变换、只读管道、提高可读性。**何时保留经典 STL**：C++17 及以下、老编译器、或已有成熟 eager 代码路径。

## 七、demo 导览

```bash
cd ref/cpp_demo/basics/ranges_demo
./build.sh --run
```

demo 分块演示：基础 ranges 算法、单视图、管道组合、投影排序、与传统 STL 对比、字符串 `split`/`join` 视图等。

最小可运行片段（需 C++20）：

```cpp
#include <iostream>
#include <ranges>
#include <vector>

int main() {
    std::vector v = {1, 2, 3, 4, 5, 6};
    for (int x : v | std::views::filter([](int n){ return n % 2; })
                  | std::views::transform([](int n){ return n * 10; }))
        std::cout << x << ' ';
}
```

## 八、小结

| 概念 | 要点 |
|------|------|
| **Range** | 有 begin/end 的可遍历对象 |
| **Views** | 非拥有、可组合的适配器 |
| **管道 `\|`** | `filter \| transform \| take` |
| **惰性** | 迭代时才计算，少中间分配 |
| **Projection** | 按成员排序/比较 |

> 现代 C++ 实战系列第 10 篇完。下一篇 **Concepts 与模板进阶**——约束模板参数，告别 SFINAE 天书。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 09 | [C++20 格式化与编译期计算](/2026/06/22/现代C++实战-09-C++20格式化与编译期计算/) | ✅ |
| **10** | **Ranges 与函数式风格（本篇）** | ✅ |
| 11 | Concepts 与模板进阶 | 下一篇 |

完整大纲见工作区 `docs/CPP_SERIES_OUTLINE.md`。
