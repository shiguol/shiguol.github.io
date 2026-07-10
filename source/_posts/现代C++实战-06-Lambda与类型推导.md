---
cover: /images/cover/cpp/lambda.png
title: 现代 C++ 实战（06）：Lambda 与类型推导
date: 2026-06-19 14:00:00
categories:
  - CppInPractice
tags:
- C++
- 现代C++
- 编程
- 2026
- C++11
- Lambda
- 类型推导
- auto
- 函数式
---

智能指针解决「谁拥有资源」，Lambda 解决「怎么写小段逻辑」——回调、算法谓词、闭包、延迟执行，现代 C++ 里无处不在。从 C++11 的 `[](){}` 到 C++20 的模板 Lambda，每一版标准都在把它变强。

这一篇系统梳理 **Lambda 语法、捕获方式、与 `auto`/`decltype` 的类型推导**，并对比函数指针与 `std::function` 的取舍。

<!-- more -->

> 这是「现代 C++ 实战」系列的第 6 篇。对应 demo：`ref/cpp_demo/basics/lambda_demo/`。建议先读 [第 05 篇：智能指针（下）](/2026/06/18/现代C++实战-05-智能指针下-模式与循环引用/)。

## 一、基本语法：`[](){}` 四部分

Lambda 的完整形式：

```cpp
[捕获列表](参数列表) 可选说明符 -> 返回类型 { 函数体 }
```

| 部分 | 含义 | 可省略？ |
|------|------|----------|
| `[...]` | **捕获列表**：把外部变量「带进」闭包 | 空 `[]` 表示不捕获 |
| `(...)` | 参数列表，同普通函数 | 无参时可写 `()` 或省略 |
| `-> T` | 显式返回类型 | 可省略，编译器推导 |
| `{...}` | 函数体 | 不可省略 |

最小例子：

```cpp
auto square = [](int x) { return x * x; };
std::cout << square(5) << '\n';  // 25
```

Lambda 是**匿名函数对象**：编译器生成一个带 `operator()` 的 unnamed class，因此可以赋值给 `auto`，也可以传给 STL 算法。

## 二、捕获方式：值、引用与初始化捕获

### 2.1 默认捕获

```cpp
int a = 1, b = 2;
auto f1 = [=]() { return a + b; };   // 按值捕获所有用到的外部变量
auto f2 = [&]() { return a + b; };   // 按引用捕获
auto f3 = [a, &b]() { return a + b; }; // 混合：a 值捕获，b 引用捕获
```

| 写法 | 含义 | 注意 |
|------|------|------|
| `[=]` | 用到的变量**按值**复制进闭包 | 闭包内修改不影响外部（除非 mutable） |
| `[&]` | 用到的变量**按引用**绑定 | 闭包生命周期不能长于被引用对象 |
| `[x, &y]` | 显式指定每个变量 | 最清晰，推荐 |

### 2.2 `mutable`：修改值捕获的副本

按值捕获的变量在 Lambda 体内默认是 `const`；加 `mutable` 可修改**闭包内的副本**：

```cpp
int n = 0;
auto counter = [n]() mutable { return ++n; };
std::cout << counter() << counter() << '\n';  // 1 2（外部 n 仍为 0）
```

### 2.3 C++14 初始化捕获（移动捕获）

可以把表达式结果**移动**进闭包，适合 `unique_ptr` 等不可拷贝类型：

```cpp
auto ptr = std::make_unique<int>(42);
auto f = [p = std::move(ptr)]() { return *p; };
// ptr 此时为 nullptr；所有权已移入 Lambda
```

demo 中的写法：

```cpp
auto important = std::make_unique<int>(1);
auto add = [v1 = 1, v2 = std::move(important)](int x, int y) -> int {
    return x + y + v1 + (*v2);
};
```

**初始化捕获**语法：`[标识符 = 表达式]`，表达式可以是移动、常量或任意可拷贝/移动的值。

## 三、泛型 Lambda（C++14）

参数写 `auto`，Lambda 自动成为函数模板：

```cpp
auto twice = [](auto x) { return x + x; };
twice(3);       // int
twice(2.5);     // double
twice(std::string("hi"));  // string 拼接
```

等价于编译器生成 `operator()(T x)` 的模板成员。适合写通用算法谓词，无需手写 `template<typename T>`。

## 四、constexpr Lambda（C++17）

Lambda 默认可以在 `constexpr` 上下文使用（若函数体满足 constexpr 规则）：

```cpp
constexpr auto sq = [](int n) { return n * n; };
static_assert(sq(10) == 100);
```

C++17 起，**无捕获**或**仅捕获字面量**的 Lambda 可用于编译期计算，与 `constexpr` 函数类似。

## 五、模板 Lambda（C++20）

C++20 允许在 Lambda 上直接写模板参数列表：

```cpp
auto print = []<typename T>(const T& v) {
    std::cout << v << '\n';
};
print(42);
print("hello");
```

与 C++14 泛型 Lambda 相比，可以显式访问 `T`，做 `if constexpr`、Concepts 约束等更复杂的编译期逻辑。

## 六、`auto` 与 `decltype`：类型推导规则

Lambda 几乎总是配合 `auto` 存储——**每个 Lambda 表达式都有唯一的编译器生成类型**，无法直接写出名。

### 6.1 `auto` 推导

```cpp
auto f = [](int x) -> double { return x * 1.5; };
// f 的类型类似 closure_type_xxx，不可手写
```

若需要类型擦除（存进容器、跨编译单元传递），才用 `std::function`（见第七节）。

### 6.2 `decltype` 与尾置返回类型

泛型代码中常用 `decltype` 推导表达式类型：

```cpp
template<typename T, typename U>
auto add(T a, U b) -> decltype(a + b) {
    return a + b;
}
```

C++14 起可简写为 `auto add(T a, U b) { return a + b; }`，编译器自动推导返回类型。

### 6.3 推导要点（速查）

| 场景 | 规则 |
|------|------|
| `auto x = expr` | 丢弃顶层 `const`、忽略引用 |
| `auto& x = expr` | 保留引用，不拷贝 |
| `decltype(expr)` | 精确推导，含 const/引用 |
| Lambda 存 `auto` | 保留具体闭包类型，**可内联优化** |

## 七、Lambda vs 函数指针 vs `std::function`

| 方式 | 灵活性 | 性能 | 典型用途 |
|------|--------|------|----------|
| **Lambda + `auto`** | 高（捕获、泛型） | 最佳（可内联） | 局部回调、STL 算法 |
| **函数指针** | 低（无捕获、无状态） | 好 | C 接口、简单回调 |
| **`std::function<R(Args...)>`** | 高（类型擦除） | 有堆分配/间接调用开销 | 容器存多种可调用对象 |

```cpp
// 函数指针：不能捕获
void (*fp)(int) = [](int x){ /* 错误：有捕获的 Lambda 不能转函数指针 */ };

// std::function：可存 Lambda，但有开销
std::function<int(int,int)> op = [](int a, int b){ return a + b; };
std::vector<std::function<void()>> tasks;  // 任务队列
```

**选型建议**：

1. 能 `auto` 就 `auto`——模板代码里用 `auto&&` 转发 Lambda
2. 需要存在 `vector` 且类型各异 → `std::function`
3. 与 C API 交互 → 无捕获 Lambda 或静态函数

## 八、与 STL 算法的配合

Lambda 最常见的战场：

```cpp
std::vector<int> v = {3, 1, 4, 1, 5};
std::sort(v.begin(), v.end(), [](int a, int b) { return a > b; });  // 降序

std::count_if(v.begin(), v.end(), [](int x) { return x % 2 == 0; });  // 偶数个数
```

C++20 Ranges 进一步把 Lambda 管道化（系列第 10 篇详讲）。

## 九、demo 导览：lambda_demo

`ref/cpp_demo/basics/lambda_demo/` 演示 **C++14 初始化捕获 + 移动 `unique_ptr`**：

```bash
cd ref/cpp_demo/basics/lambda_demo
./build.sh --run
```

输出 `9`（3 + 4 + 1 + 1）。建议对照源码理解：`v2` 从外部 `unique_ptr` 移动进闭包后，外部指针为空。

## 十、小结

| 概念 | 要点 |
|------|------|
| **语法** | `[捕获](参数) -> 返回 { 体 }` |
| **捕获** | `=` 值、`&` 引用、`[x=expr]` 初始化/移动捕获 |
| **泛型** | C++14 `auto` 参数；C++20 模板 Lambda |
| **constexpr** | C++17 无捕获 Lambda 可编译期求值 |
| **存储** | 优先 `auto`；跨模块/容器用 `std::function` |
| **性能** | 具体闭包类型 > 函数指针 > `std::function` |

> 现代 C++ 实战系列第 6 篇完。下一篇进入 **C++17 工具箱**——`any`、filesystem 与并行算法。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 05 | [智能指针（下）](/2026/06/18/现代C++实战-05-智能指针下-模式与循环引用/) | ✅ |
| **06** | **Lambda 与类型推导（本篇）** | ✅ |
| 07 | C++17 工具箱 | 下一篇 |

完整大纲见工作区 `docs/CPP_SERIES_OUTLINE.md`。
