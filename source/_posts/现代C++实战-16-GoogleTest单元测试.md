---
cover: /images/cover/cpp/gtest.png
title: 现代 C++ 实战（16）：GoogleTest 单元测试
date: 2026-06-29 14:00:00
categories:
  - CppInPractice
tags:
  - C++
  - 现代C++
  - 编程
  - 2026
  - C++17
  - GoogleTest
---

C++ 编译器能抓住类型错误，却抓不住「`divide(10, 0)` 该不该抛异常」「阶乘边界算对没有」——这些只能靠**跑起来验证**。[第 15 篇](/2026/06/28/现代C++实战-15-现代设计模式/) 的工厂、策略可以测；本篇用 **GoogleTest** 把测试写进工程：**TEST、Fixture、参数化、Mock、CMake 集成**。

demo：`ref/cpp_demo/basics/testing_demo/`。

<!-- more -->

> 这是「现代 C++ 实战」系列的第 16 篇。建议先读 [第 15 篇：现代设计模式](/2026/06/28/现代C++实战-15-现代设计模式/)。

## 一、为什么 C++ 更需要测试？

| 编译期能抓住 | 编译期抓不住 |
|--------------|--------------|
| 类型不匹配、未声明标识符 | 除零、越界、错误算法 |
| 部分 constexpr 逻辑 | 多线程竞态、资源泄漏 |
| Concepts 约束 | API 契约（返回值、异常） |

重构 [第 14 篇](/2026/06/27/现代C++实战-14-线程池与背压控制/) 线程池、[第 08 篇](/2026/06/21/现代C++实战-08-错误处理策略/) 错误处理时，**回归测试**是安全网。GoogleTest（gtest）+ GoogleMock（gmock）是 C++ 生态事实标准。

## 二、GoogleTest 基础：TEST 与断言

```cpp
#include <gtest/gtest.h>

TEST(CalculatorTest, Add) {
    EXPECT_EQ(Calculator::add(2, 3), 5);
    EXPECT_EQ(Calculator::add(-1, 1), 0);
}
```

| 宏 | 含义 |
|----|------|
| **`TEST(Suite, Name)`** | 独立测试用例，Suite 用于分组 |
| **`EXPECT_*`** | 失败**继续**执行本用例后续断言 |
| **`ASSERT_*`** | 失败**立即终止**本用例 |

```cpp
TEST(CalculatorTest, ExpectVsAssert) {
    EXPECT_EQ(Calculator::add(1, 1), 3);  // 失败仍继续
    EXPECT_EQ(Calculator::add(2, 2), 4);

    ASSERT_EQ(Calculator::multiply(2, 3), 6);  // 失败则后面不跑
    EXPECT_EQ(Calculator::multiply(3, 4), 12);
}
```

常用断言：

| 宏 | 用途 |
|----|------|
| `EXPECT_EQ` / `EXPECT_NE` | 相等 / 不等 |
| `EXPECT_TRUE` / `EXPECT_FALSE` | 布尔 |
| `EXPECT_LT` / `EXPECT_GT` / … | 大小比较 |
| `EXPECT_NEAR` | 浮点近似（第三参数为误差） |
| `EXPECT_DOUBLE_EQ` | 浮点「按位」相等 |
| `EXPECT_THROW(expr, ExceptionType)` | 期望抛异常 |
| `EXPECT_NO_THROW(expr)` | 期望不抛 |

入口（demo `main.cpp`）：

```cpp
int main(int argc, char** argv) {
    testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
```

也可链接 **`GTest::gtest_main`**，省去手写 `main`。

## 三、Test Fixture：共享 setup / teardown

多个用例要共用初始化时，用 **`TEST_F`** + 继承 `::testing::Test`：

```cpp
class CalculatorFixture : public ::testing::Test {
protected:
    void SetUp() override {
        test_values_ = {1, 2, 3, 4, 5};
    }
    void TearDown() override {
        test_values_.clear();
    }
    std::vector<int> test_values_;
};

TEST_F(CalculatorFixture, FactorialWithFixture) {
    EXPECT_EQ(Calculator::factorial(test_values_[4]), 120);
}

TEST_F(CalculatorFixture, IsPrimeWithFixture) {
    EXPECT_TRUE(Calculator::is_prime(test_values_[1]));  // 2
}
```

每个 `TEST_F` 都会：**新建 Fixture → SetUp → 测试体 → TearDown**。用例之间**不共享** Fixture 实例，避免状态污染。

## 四、参数化测试：TEST_P

同一逻辑、多组输入，避免复制粘贴：

```cpp
class CalculatorParamTest
    : public ::testing::TestWithParam<std::tuple<int, long long>> {};

TEST_P(CalculatorParamTest, FactorialParamTest) {
    auto [input, expected] = GetParam();
    EXPECT_EQ(Calculator::factorial(input), expected);
}

INSTANTIATE_TEST_SUITE_P(
    FactorialValues,
    CalculatorParamTest,
    ::testing::Values(
        std::make_tuple(0, 1LL),
        std::make_tuple(3, 6LL),
        std::make_tuple(5, 120LL)
    )
);
```

| 组件 | 作用 |
|------|------|
| **`TestWithParam<T>`** | 参数类型 `T` |
| **`TEST_P`** | 参数化用例 |
| **`INSTANTIATE_TEST_SUITE_P`** | 绑定参数表；每组参数生成一个独立测试 |

还可 `::testing::Combine` 做笛卡尔积；**`TYPED_TEST`** 对多种类型实例化同一模板测试（demo 中对 `int`、`double` 等测 `add`）。

## 五、Mock 与依赖注入

单元测试要**隔离被测单元**：数据库、网络、文件系统应替换为假实现。

| 手段 | 做法 |
|------|------|
| **依赖注入** | 构造函数传入接口或 `std::function` |
| **接口 + 假对象** | 测试里传 `FakeDatabase` |
| **GMock** | `MOCK_METHOD` 生成 mock，设 `EXPECT_CALL` |

```cpp
class Database {
public:
    virtual ~Database() = default;
    virtual int query(const std::string& sql) = 0;
};

class MockDatabase : public Database {
public:
    MOCK_METHOD(int, query, (const std::string& sql), (override));
};

TEST(ServiceTest, UsesDatabase) {
    MockDatabase db;
    EXPECT_CALL(db, query("SELECT 1")).WillOnce(::testing::Return(42));
    Service svc(&db);
    EXPECT_EQ(svc.run(), 42);
}
```

原则：**测逻辑不测基础设施**；能注入就不 `new` 真实依赖。与 [第 15 篇](/2026/06/28/现代C++实战-15-现代设计模式/) Strategy / Factory 天然配合。

## 六、Matchers：`EXPECT_THAT`

GMock 提供 **Matchers**，断言更可读（demo 含 `<gmock/gmock.h>`）：

```cpp
std::vector<int> primes = {2, 3, 5, 7, 11, 13};
EXPECT_THAT(primes, ::testing::SizeIs(6));
EXPECT_THAT(primes, ::testing::Contains(7));
EXPECT_THAT(Calculator::factorial(5), ::testing::AllOf(
    ::testing::Gt(100), ::testing::Eq(120)));
```

适合容器、字符串、浮点区间；复杂条件用 `AllOf` / `AnyOf` / `Not` 组合。

## 七、CMake 集成：FetchContent + CTest

demo `CMakeLists.txt` 用 **FetchContent** 拉 gtest v1.14.0，无需系统预装：

```cmake
include(FetchContent)
FetchContent_Declare(
  googletest
  URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.tar.gz
)
set(BUILD_GMOCK ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

enable_testing()

add_executable(testing_demo src/main.cpp src/calculator_test.cpp)
target_link_libraries(testing_demo PRIVATE
    GTest::gtest GTest::gtest_main GTest::gmock)

add_test(NAME CalculatorTests COMMAND testing_demo)
```

| 步骤 | 说明 |
|------|------|
| `FetchContent_MakeAvailable` | 下载并 add_subdirectory gtest |
| `enable_testing()` | 启用 CTest |
| `add_test` | `ctest` / CI 可批量跑 |
| `GTest::gtest_main` | 提供默认 `main` |

运行：

```bash
cd ref/cpp_demo/basics/testing_demo
./build.sh
cd build && ctest --output-on-failure
# 或直接
./testing_demo
```

过滤用例：`./testing_demo --gtest_filter=CalculatorTest.Add`

## 八、编写测试的习惯

| 建议 | 原因 |
|------|------|
| **一个 TEST 只测一件事** | 失败时定位快 |
| **命名说清意图** | `DivideByZeroThrows` 优于 `Test3` |
| **优先 EXPECT，慎用 ASSERT** | 一次看到多个失败 |
| **边界与异常** | 0、负数、空容器、除零 |
| **CI 里跑 ctest** | 每次 push 自动回归 |

## 九、小结

| 主题 | 要点 |
|------|------|
| **TEST / EXPECT / ASSERT** | 基本用例与断言语义 |
| **TEST_F** | SetUp/TearDown 共享夹具 |
| **TEST_P** | 多组参数，INSTANTIATE_TEST_SUITE_P |
| **Mock** | 依赖注入 + GMock 隔离外部 |
| **CMake** | FetchContent + enable_testing + add_test |

> 现代 C++ 实战系列第 16 篇完。下一篇 **C++23 新特性**——`expected`、`deducing this`、`std::print`。

### 系列导航

| 篇号 | 标题 | 状态 |
|------|------|------|
| 15 | [现代设计模式](/2026/06/28/现代C++实战-15-现代设计模式/) | ✅ |
| **16** | **GoogleTest 单元测试（本篇）** | ✅ |
| 17 | C++23 新特性 | 下一篇 |

完整大纲见工作区 `docs/CPP_SERIES_OUTLINE.md`。
