---
cover: /images/cover/cpp/concepts.webp
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

add(1, 2);             // OK
add("hello", "world"); // 编译失败：T 推导为 const char*，两个指针不能相加，
                       // 但报错位置在模板函数体内部，而不是调用处
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

demo 的 `type_name_sfinae` 用三个 `enable_if` 重载分别匹配整数、浮点和 `std::string`，传入 `std::vector<int>` 则因没有匹配的重载而编译失败：

```cpp
template <typename T>
typename std::enable_if<std::is_integral<T>::value, std::string>::type
type_name_sfinae(T) {
    return "整数类型 (SFINAE)";
}

template <typename T>
typename std::enable_if<std::is_floating_point<T>::value, std::string>::type
type_name_sfinae(T) {
    return "浮点类型 (SFINAE)";
}
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

// 方式 2：简洁语法（C++20，concept + auto 作为参数约束）
auto multiply_v2(Numeric auto a, Numeric auto b) { return a * b; }
void dump(Printable auto const& x) { std::cout << x; }

// 方式 3：template 参数列表里直接写 concept
template<Numeric T>
T multiply_v3(T a, T b) { return a * b; }
```

demo 中对应的是 `type_name_concept_v1`（requires 子句，函数体内再用 `if constexpr (std::integral<T>)` 区分整数和浮点）与 `type_name_concept_v2(Numeric auto)`（简洁语法）。

传入不满足 concept 的类型时，编译器直接报：**「T 不满足 Numeric」**——而不是 SFINAE 的「没有匹配的重载」。

### 3.3 Concept 重载

demo 的写法（`Container` 是 demo 里定义的另一个 concept）：

```cpp
template <typename T>
concept Container = requires(T t) {
    { t.begin() };
    { t.end() };
    { t.size() } -> std::convertible_to<std::size_t>;
};

void print_value(Numeric auto value) {
    std::cout << "  数值: " << value << "\n";
}

void print_value(const std::string& value) {
    std::cout << "  字符串: \"" << value << "\"\n";
}

void print_value(Container auto const& container) {
    std::cout << "  容器 [" << container.size() << " 元素]: ";
    for (const auto& item : container) {
        std::cout << item << " ";
    }
    std::cout << "\n";
}
```

编译器按**最特化**规则选择重载，类似普通函数重载，但约束在编译期检查。注意 `std::string` 同时满足 `Container`，但非模板的 `const std::string&` 版本在同等匹配时优先，所以 `print_value(std::string("hello"))` 走字符串分支。

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

`ref/cpp_demo/basics/type_traits_demo/` 包含两个可执行文件。

**`type_traits_demo`：概念讲解**，按演进顺序分 7 段演示：

1. 基础 `type_traits`（`is_integral` / `is_same` / `is_pointer` 等）
2. 类型变换（`remove_const` / `remove_reference` / `decay` / `conditional`）
3. SFINAE 重载（`type_name_sfinae`）
4. `if constexpr` 分支
5. Concepts 定义与重载（`Printable` / `Numeric` / `Container` / `Comparable`）
6. 自定义萃取：`void_t` 版 `has_size` / `is_addable` 与 Concept 版 `HasSize` / `Addable` 对照
7. 三种写法的对比总结

**`json_serializer_demo`：实战应用**，把上面的技术落到一个迷你 JSON 序列化器上，把任意 C++ 值转成 JSON 字符串：

| 输入类型 | 输出 JSON |
|----------|-----------|
| `int` / `double` | `42` / `3.14` |
| `bool` | `true` / `false`（而非 1/0） |
| `std::string` / `const char*` | `"..."`（自动加引号并转义） |
| `vector` / `list` / `array` 等 | `[1, 2, 3]`（可递归嵌套） |
| `std::map` / `std::unordered_map` | `{"key": value}` |
| `std::optional<T>` | 有值序列化内部值，无值输出 `null` |
| 自定义 struct（含成员 `to_json()`） | 交给用户的 `to_json()` |

它把本篇的知识点串在了一起：

- **`void_t` + SFINAE 自定义萃取**：`is_iterable` / `is_map_like` / `has_member_to_json` 检测类型「是否具备某种能力」
- **Concepts**：`StringLike` / `SequenceContainer` / `MapContainer` 用更清晰的方式表达同样的检测
- **`if constexpr`**：一个 `to_json()` 函数内按「bool → 数值 → 字符串 → 自定义 `to_json()` → optional → 映射 → 序列 → 兜底」8 个分支依次判断，编译期裁剪（bool 必须排在数值前，字符串、映射必须排在序列前）
- **偏特化**：`detail::is_optional` 识别 `std::optional<X>`
- **`remove_cvref_t` / `decay_t`**：归一化类型，去掉引用和 const
- **`static_assert`**：兜底分支给不支持的类型一个友好的编译期报错

核心入口节选：

```cpp
template <typename T>
std::string to_json(const T& value) {
    using U = std::remove_cvref_t<T>;

    if constexpr (std::is_same_v<U, bool>) {
        return value ? "true" : "false";
    } else if constexpr (NumericNonBool<U>) {
        std::ostringstream oss;
        oss << value;
        return oss.str();
    } else if constexpr (StringLike<U>) {
        return "\"" + escape_string(std::string(value)) + "\"";
    } else if constexpr (HasMemberToJson<U>) {
        return value.to_json();
    }
    // ... optional / MapContainer / SequenceContainer 分支 ...
    else {
        static_assert(sizeof(T) == 0,
            "to_json: 不支持的类型。请为该类型提供成员函数 to_json()，"
            "或让它变成可迭代 / 数值 / 字符串类型。");
        return {};
    }
}
```

`main` 依次序列化标量、字符串（含转义）、`vector` / `list` / `array` / 嵌套 `vector`、`map`、`optional`，以及带成员 `to_json()` 的 `Point`、`Person` 和 `vector<Person>`，最后用一组 `static_assert` 验证 `is_iterable_v` / `is_map_like_v` / `has_member_to_json_v` 的判断结果。

```bash
cd ref/cpp_demo/basics/type_traits_demo
./build.sh --run                        # 依次运行两个示例
./build.sh --run json_serializer_demo   # 只看序列化器
```

> 这是教学实现，真实项目请直接用 nlohmann/json（[第 01 篇](/2026/06/14/现代C++实战-01-CMake与现代构建/) 的 fetch_content demo 已集成）。

两个 target 共用同一份 CMake，`set(CMAKE_CXX_STANDARD 20)`，以启用 `<concepts>` 和 `std::remove_cvref_t`。

## 八、小结

| 概念 | 要点 |
|------|------|
| **SFINAE** | 替换失败丢弃重载，晦涩 |
| **enable_if** | 条件启用模板，老办法 |
| **Concepts** | `concept` + `requires`，约束可读 |
| **type_traits** | 编译期类型查询与变换 |
| **选型** | 新模板 API 用 Concepts |

> 现代 C++ 实战系列第 11 篇完。下一篇[进入 **第二季：多线程基础**——thread、mutex、condition_variable](/2026/06/25/现代C++实战-12-多线程基础/)。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 10 | [Ranges 与函数式风格](/2026/06/23/现代C++实战-10-Ranges与函数式风格/) | ✅ |
| **11** | **Concepts 与模板进阶（本篇）** | ✅ |
| 12 | [多线程基础](/2026/06/25/现代C++实战-12-多线程基础/) | ✅ |
