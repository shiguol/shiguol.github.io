---
cover: /images/cover/cpp/smart-ptr-basic.webp
title: 现代 C++ 实战（04）：智能指针（上）——所有权与 RAII
date: 2026-06-17 14:00:00
categories:
  - CppInPractice
tags:
- C++
- 现代C++
- 编程
- 2026
- C++11
- 智能指针
- RAII
- 内存管理
- 所有权
---

上一篇我们搞懂了移动语义——资源可以在对象之间「搬家」。但还有一个更根本的问题：**这块内存到底谁负责释放？** C++ 没有垃圾回收，手动 `new` / `delete` 一旦配对出错，就是泄漏或 double-free。

现代 C++ 的答案是 **RAII + 智能指针**：把所有权写进类型系统，让编译器和析构函数帮你收尾。这一篇聚焦 **`unique_ptr` 与 `shared_ptr` 的上半场**——独占 vs 共享、什么时候该用谁、以及 `make_unique` / `make_shared` 为什么更推荐。

<!-- more -->

> 这是「现代 C++ 实战」系列的第 4 篇。对应 demo：`ref/cpp_demo/smart_pointers/` 第 01–04 节。建议先读 [第 03 篇：移动语义与右值引用](/2026/06/16/现代C++实战-03-移动语义与右值引用/)。

## 一、RAII：资源获取即初始化

**RAII（Resource Acquisition Is Initialization）** 是 C++ 资源管理的核心惯用法：

| 阶段 | 做什么 |
|------|--------|
| **构造** | 获取资源（内存、文件句柄、锁……） |
| **使用** | 通过对象访问资源 |
| **析构** | 自动释放资源——无论正常返回还是抛异常 |

```cpp
{
    std::fstream file("data.txt");  // 构造时打开
    // ... 读写 ...
}  // 离开作用域，析构自动 close——即使中间 throw 也会执行
```

智能指针是 RAII 在**堆内存**上的标准实现：指针本身是一个栈对象，析构时自动 `delete` 所管理的堆块。

## 二、`unique_ptr`：独占所有权

`std::unique_ptr<T>` 表示：**这块内存只有一个主人**，不可拷贝，只能移动。

```cpp
#include <memory>

auto p = std::make_unique<int>(42);
// std::unique_ptr<int> q = p;       // 错误：不可拷贝
std::unique_ptr<int> q = std::move(p); // OK：所有权转移
// 此后 p 为 nullptr，q 拥有对象
```

| 特性 | 说明 |
|------|------|
| **大小** | 通常与原始指针相同（无额外控制块） |
| **拷贝** | 禁止 |
| **移动** | 允许，配合 [第 03 篇](/2026/06/16/现代C++实战-03-移动语义与右值引用/) 的移动语义 |
| **默认删除** | `delete`；可自定义删除器 |
| **适用** | 工厂返回、Pimpl、容器元素、明确单一所有者 |

### 自定义删除器

智能指针不只管理 `new` 出来的内存——任何「获取-释放」成对的资源都能包：

```cpp
auto close_file = [](FILE* f) { if (f) std::fclose(f); };
std::unique_ptr<FILE, decltype(close_file)> fp(
    std::fopen("log.txt", "w"), close_file);
// 析构时自动 fclose，不用手写
```

删除器可以是函数指针、Lambda 或无状态 functor；**带自定义删除器的 `unique_ptr` 大小可能变大**（取决于删除器类型是否为空）。

## 三、所有权转移：函数参数怎么传？

这是日常编码最常纠结的问题：

| 传参方式 | 语义 | 典型场景 |
|----------|------|----------|
| **`const T&`** | 借用，不转移 | 只读访问 |
| **`T&&` + 移动** | 夺取所有权 | 工厂把新对象交给调用方 |
| **按值 `T`** | 拷贝或移动进函数 | _sink 函数、需要本地副本 |
| **返回 `unique_ptr`** | 转移出函数 | 工厂函数 |

```cpp
std::unique_ptr<Widget> create_widget();  // 返回所有权

void consume(std::unique_ptr<Widget> w) {  // 按值：调用方必须 move 或传临时量
    // w 析构时销毁 Widget
}

auto w = create_widget();
consume(std::move(w));  // 明确转移
```

经验法则：**默认用 `unique_ptr` 表达「我拥有它」；需要共享时才升级到 `shared_ptr`。**

## 四、`shared_ptr`：共享所有权

`std::shared_ptr<T>` 通过**引用计数**允许多个指针指向同一对象，最后一个 `shared_ptr` 销毁时才释放内存。

```cpp
auto a = std::make_shared<Foo>(1);
{
    auto b = a;  // 引用计数 = 2
}               // b 析构，计数回到 1
// a 仍有效
```

| 特性 | 说明 |
|------|------|
| **控制块** | 额外分配，存强引用计数、弱引用计数、删除器 |
| **线程安全** | 引用计数的增减是原子的；**对象本身不自动加锁** |
| **开销** | 比 `unique_ptr` 多一次堆分配 + 原子操作 |
| **适用** | 多处共享同一对象、生命周期难以单点管理 |

### 什么时候不该用 `shared_ptr`？

- 所有权清晰、单一 → 用 `unique_ptr`
- 只是观察、不拥有 → 原始指针或 `weak_ptr`（下篇详讲）
- 性能热点、大量小对象 → 共享所有权成本累积

## 五、`make_unique` 与 `make_shared`

C++11 起推荐用工厂函数，而不是 `unique_ptr<T>(new T(...))`：

```cpp
// 推荐
auto p = std::make_unique<Widget>(arg1, arg2);
auto s = std::make_shared<Widget>(arg1, arg2);

// 不推荐（除非需要自定义删除器或特殊场景）
std::unique_ptr<Widget> p(new Widget(arg1, arg2));
```

| 函数 | 标准 | 好处 |
|------|------|------|
| `make_unique` | C++14 | 异常安全；单行写法 |
| `make_shared` | C++11 | **一次分配**：对象 + 控制块同块内存，缓存更友好 |

**异常安全例子**（简化）：

```cpp
void foo(std::shared_ptr<Widget> a, std::shared_ptr<Widget> b);

foo(std::shared_ptr<Widget>(new Widget()), std::shared_ptr<Widget>(new Widget()));
// 若第二个 new 成功、第一个 shared_ptr 构造前抛异常 → 可能泄漏

foo(std::make_shared<Widget>(), std::make_shared<Widget>());  // 更安全
```

## 六、性能对比直觉

| 操作 | `unique_ptr` | `shared_ptr` |
|------|-------------|--------------|
|  sizeof | ≈ 一个指针 | ≈ 两个指针 |
|  构造 | 无控制块 | 控制块 + 原子计数 |
|  拷贝 | 禁止 | 原子 ++ |
|  移动 | 指针交换 | 原子 ++/-- |

在不是「真需要共享」的场景滥用 `shared_ptr`，会平白多分配、多原子操作。**先 unique，不够再 shared** 是常见策略。

## 七、与原始指针的关系

| 场景 | 建议 |
|------|------|
| 拥有堆对象 | `unique_ptr` / `shared_ptr` |
| 不拥有、仅观察 | `T*` 或 `T&`（生命周期由别处保证） |
| 可选观察、可能失效 | `weak_ptr`（下篇） |
| C API 互操作 | `unique_ptr` + 自定义删除器 |

**不要**两个 `shared_ptr` 从同一个裸 `new` 构造——会产生双重控制块、双重释放：

```cpp
// 危险！
Widget* raw = new Widget();
std::shared_ptr<Widget> a(raw);
std::shared_ptr<Widget> b(raw);  // 两个独立控制块，double-free
```

## 八、demo 导览：smart_pointers 01–04

`ref/cpp_demo/smart_pointers/` 按主题拆成 9 个独立可执行文件（C++17），本篇对应前四个：

| 节 | 源文件 / target | 主题 |
|----|-----------------|------|
| 01 | `01_basic_unique_ptr` | 栈对象 vs 堆对象、局部对象生命周期、`make_unique`、自定义删除器（函数指针 / Lambda / 函数对象）、`get` / `reset` / `release` 等常用操作 |
| 02 | `02_ownership_transfer` | `std::move` 转移所有权、函数返回 `unique_ptr`、移动后原指针状态、禁止拷贝、容器中的 `unique_ptr`、`swap` |
| 03 | `03_function_params` | 传值（sink）、传引用、传原始指针 / 引用观察、工厂返回值、`shared_ptr` 参数传递、Core Guidelines 参数规则 |
| 04 | `04_class_member` | `unique_ptr` 成员（组合）、依赖注入、延迟初始化、`shared_ptr` 成员（聚合，`Taxi` 与 `Driver`） |

`01_basic_unique_ptr.cpp` 里用函数对象管理 C 风格文件指针，正是第二节「自定义删除器」的实战版：

```cpp
struct FileDeleter {
    void operator()(std::FILE* fp) const {
        if (fp) {
            std::cout << "  [FileDeleter] 关闭文件\n";
            std::fclose(fp);
        }
    }
};

std::unique_ptr<std::FILE, FileDeleter> filePtr(
    std::fopen("/tmp/test_unique_ptr.txt", "w")
);
```

`03_function_params.cpp` 的 sink 参数则对应第三节的按值传递：

```cpp
void takeOwnership(std::unique_ptr<Widget> widget) {
    std::cout << "  takeOwnership 获得了 '" << widget->getName() << "' 的所有权\n";
    widget->process();
    // widget 在函数结束时被销毁
}

auto widget = std::make_unique<Widget>("按值传递");
takeOwnership(std::move(widget));  // 必须使用 std::move
```

### 运行方式

```bash
cd ref/cpp_demo/smart_pointers
./build.sh --run
```

`--run` 不带参数会依次运行 `build/` 下全部 9 个程序（包括下一篇用到的 05–08 和性能对比 `demo_share_unique`）。只看某一节时指定 target 名：

```bash
./build.sh --run 01_basic_unique_ptr
./build.sh --run 02_ownership_transfer
./build.sh --run 03_function_params
./build.sh --run 04_class_member
```

观察日志里**构造 / 析构的打印顺序**，理解 RAII 何时释放资源。

## 九、小结

| 概念 | 一句话 |
|------|--------|
| **RAII** | 构造获取、析构释放——异常安全的基础 |
| **`unique_ptr`** | 独占所有权，零开销首选 |
| **`shared_ptr`** | 引用计数共享，有控制块开销 |
| **`make_*`** | 异常安全 + 更少分配 |
| **选型** | 默认 unique，确需共享再 shared |

> 现代 C++ 实战系列第 4 篇完。下一篇 [**智能指针（下）** 讲 `weak_ptr`、循环引用，以及工厂 / Pimpl / Observer 等模式如何用智能指针落地](/2026/06/18/现代C++实战-05-智能指针下-模式与循环引用/)。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 03 | [移动语义与右值引用](/2026/06/16/现代C++实战-03-移动语义与右值引用/) | ✅ |
| **04** | **智能指针（上）：所有权与 RAII（本篇）** | ✅ |
| 05 | [智能指针（下）：模式与循环引用](/2026/06/18/现代C++实战-05-智能指针下-模式与循环引用/) | ✅ |
