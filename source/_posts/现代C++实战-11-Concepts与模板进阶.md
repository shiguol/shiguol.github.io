---
cover: /images/cover/cpp/concepts.png
title: 现代 C++ 实战（11）：Concepts 与模板进阶
date: 2026-06-24 14:00:00
categories:
  - CppInPractice
tags:
- C++
- 现代C++
- 编程
- 2026
- C++20
- Concepts
- 模板
- 泛型
- 约束
---

模板很强大，但约束不足时编译错误像天书——SFINAE、`enable_if` 能解决问题，却难写难读。C++20 **Concepts** 把「类型必须满足什么」写进签名，错误从 100 行模板展开变成 3 行人话。

这一篇从 SFINAE 回顾到 Concepts 语法，并配合 `type_traits` 与 demo：`ref/cpp_demo/basics/type_traits_demo/`。

<!-- more -->

> 这是「现代 C++ 实战」系列的第 11 篇。建议先读 [第 10 篇：Ranges](/2026/06/23/现代C++实战-10-Ranges与函数式风格/)。

## 一、模板的问题：约束写在哪？

```cpp
template<typename T>
T add(T a, T b) { return a + b; }

add(1, 2);           // OK
add("hello", "world"); // 可能编译过，但语义不对（指针相加）
```

我们希望：**在模板实例化前**就拒绝不合法的类型，并给出清晰错误——而不是在深层实例化里爆炸。

历史上三条路线：

| 时代 | 手段 |
|------|------|
| C++11 | SFINAE + `std::enable_if` + `type_traits` |
| C++17 | `if constexpr` |
| C++20 | **Concepts** |

## 二、SFINAE 与 `enable_if` 回顾

**SFINAE**（Substitution Failure Is Not An Error）：模板替换失败时，该重载被丢弃，而非报错。

```cpp
#include <type_traits>

// 仅当 T 为整数时启用
template<typename T>
std::enable_if_t<std::is_integral_v<T>, T>
safe_add(T a, T b) { return a + b; }
```

缺点：

- 语法嵌套深，**意图藏在返回类型里**
- 错误信息指向 `enable_if` 内部，不直观
- 多个约束组合时 quickly 变成「模板元编程 spaghetti」

## 三、Concepts 语法

### 3.1 定义 concept

```cpp
#include <concepts>

template<typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

template<typename T>
concept Printable = requires(std::ostream& os, const T& t) {
    { os << t } -> std::same_as<std::ostream&>;
};
```

`requires` 子句列出类型**必须支持的操作**。

### 3.2 约束模板

```cpp
// 方式 1：requires 子句
template<typename T>
    requires Numeric<T>
T multiply(T a, T b) { return a * b; }

// 方式 2：简洁语法（C++20）
T multiply_v2(Numeric auto a, Numeric auto b) { return a * b; }

// 方式 3：template 参数直接写 concept
void dump(Printable auto const& x) { std::cout << x; }
```

传入不满足 concept 的类型时，编译器直接报：**「T 不满足 Numeric」**——而不是 SFINAE 的「没有匹配的重载」。

### 3.3 Concept 重载

```cpp
void print_value(Numeric auto value) {
    std::cout << "数值: " << value << '\n';
}
void print_value(const std::string& value) {
    std::cout << "字符串: " << value << '\n';
}
```

编译器按**最特化**规则选择重载，类似普通函数重载，但约束在编译期检查。

## 四、标准库常用 Concepts

| Concept | 含义 |
|---------|------|
| `std::same_as<T, U>` | T 与 U 相同 |
| `std::integral<T>` | 整数类型 |
| `std::floating_point<T>` | 浮点类型 |
| `std::copyable<T>` | 可拷贝 |
| `std::movable<T>` | 可移动 |
| `std::convertible_to<F, T>` | F 可隐式转为 T |
| `std::invocable<F, Args...>` | 可调用 |
| `std::ranges::range` | 是 range（与 [第 10 篇](/2026/06/23/现代C++实战-10-Ranges与函数式风格/) 衔接） |

组合示例：

```cpp
template<typename T>
concept AddableNumeric = Numeric<T> && requires(T a, T b) {
    { a + b } -> std::same_as<T>;
};
```

## 五、Concepts vs SFINAE vs `if constexpr`

| | SFINAE / enable_if | if constexpr | Concepts |
|--|-------------------|--------------|----------|
| **可读性** | 差 | 中 | **好** |
| **错误信息** | 差 | 中 | **好** |
| **约束位置** | 返回值/参数隐藏 | 函数体内 | **签名可见** |
| **重载选择** | 复杂 | 单模板内分支 | 自然重载 |
| **标准** | C++11 | C++17 | **C++20** |

**实践建议**：

- 新代码优先 **Concepts** 表达模板约束
- 函数**内部**按类型分支用 **`if constexpr`**
- 维护老库或需 C++17 时保留 SFINAE

## 六、`type_traits`：编译期类型信息

Concepts 建立在 `<type_traits>` 之上：

```cpp
static_assert(std::is_integral_v<int>);
static_assert(std::is_same_v<std::remove_const_t<const int>, int>);

using T = std::conditional_t<sizeof(int) == 4, int32_t, int64_t>;
```

| 类别 | 示例 |
|------|------|
| 类型判断 | `is_integral`, `is_pointer`, `is_class` |
| 类型变换 | `remove_const`, `decay`, `add_pointer` |
| C++17 简写 | `is_integral_v<T>`, `remove_const_t<T>` |

自定义 trait 也可用特化：

```cpp
template<typename T> struct is_container : std::false_type {};
template<typename T> struct is_container<std::vector<T>> : std::true_type {};
```

Concepts 往往可以**替代**手写 trait + SFINAE 的组合。

## 七、demo 导览

`ref/cpp_demo/basics/type_traits_demo/` 按演进顺序演示：

1. 基础 `type_traits`
2. 类型变换 `remove_const_t` / `decay_t`
3. SFINAE 重载
4. `if constexpr` 分支
5. Concepts 定义与重载

```bash
cd ref/cpp_demo/basics/type_traits_demo
./build.sh --run
```

需 **C++20**（`-std=c++20`）以启用 `<concepts>`。

## 八、小结

| 概念 | 要点 |
|------|------|
| **SFINAE** | 替换失败丢弃重载，晦涩 |
| **enable_if** | 条件启用模板，老办法 |
| **Concepts** | `concept` + `requires`，约束可读 |
| **type_traits** | 编译期类型查询与变换 |
| **选型** | 新模板 API 用 Concepts |

> 现代 C++ 实战系列第 11 篇完。下一篇进入 **第二季：多线程基础**——thread、mutex、condition_variable。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 10 | [Ranges 与函数式风格](/2026/06/23/现代C++实战-10-Ranges与函数式风格/) | ✅ |
| **11** | **Concepts 与模板进阶（本篇）** | ✅ |
| 12 | 多线程基础 | 下一篇 |

完整大纲见工作区 `docs/CPP_SERIES_OUTLINE.md`。
