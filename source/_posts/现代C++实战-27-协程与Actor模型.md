---
cover: /images/cover/cpp/coroutine-actor.png
title: 现代 C++ 实战（27）：协程与 Actor 模型
date: 2026-07-10 14:00:00
categories:
  - CppInPractice
tags:
  - C++
  - 现代C++
  - 编程
  - 2026
  - 并发
  - 协程
---

[第 26 篇](/2026/07/09/现代C++实战-26-LRU缓存与JSON解析器/) 的两个练手项目收尾了数据结构；**系列最后一篇**进入现代 C++ 的两条并发进阶路线：**C++20 协程**让异步代码像同步一样写，**Actor 模型**让并发像发消息一样简单。

demo：`ref/cpp_demo/projects/learning_guide/`（`coroutine/` + `actor/`）。

<!-- more -->

> 这是「现代 C++ 实战」系列的第 27 篇（收官）。建议先读 [第 12 篇：多线程基础](/2026/06/25/现代C++实战-12-多线程基础/) 和 [第 14 篇：线程池](/2026/06/27/现代C++实战-14-线程池与背压控制/)。

## 一、协程基础：三个关键字

C++20 协程用编译器魔法把异步逻辑写成顺序代码：

| 关键字 | 作用 | 示例 |
|--------|------|------|
| `co_yield` | 产生一个值并挂起 | Generator |
| `co_await` | 等待异步操作完成 | Task |
| `co_return` | 协程返回 | 结束协程 |

```cpp
Generator<int> counter(int max) {
    for (int i = 1; i <= max; ++i) {
        co_yield i;   // 产生值，挂起
    }
}

for (int n : counter(5)) {
    std::cout << n << " ";  // 1 2 3 4 5
}
```

协程底层三件套：

| 概念 | 说明 |
|------|------|
| `promise_type` | 定义协程行为（挂起策略、返回值处理） |
| `coroutine_handle` | 协程句柄，恢复/销毁 |
| 返回类型 | 必须包含 promise_type（如 `Generator<T>`） |

## 二、Generator：惰性序列

Generator 是**惰性**的——只在迭代时才计算下一个值：

```cpp
Generator<int> fibonacci(int count) {
    int a = 0, b = 1;
    for (int i = 0; i < count; ++i) {
        co_yield a;
        auto next = a + b;
        a = b; b = next;
    }
}

Generator<int> natural_numbers() {
    for (int i = 0; ; ++i) co_yield i;  // 无限序列
}
```

demo 提供函数式组合，类似 Ranges 管道：

```cpp
// 取前 5 个偶数的平方
auto gen = take(
    map(filter(natural_numbers(), [](int x) { return x % 2 == 0; }),
        [](int x) { return x * x; }),
    5);
```

| 操作 | 作用 |
|------|------|
| `map(gen, fn)` | 变换每个元素 |
| `filter(gen, pred)` | 过滤 |
| `take(gen, n)` | 取前 n 个 |

## 三、Task：异步任务

Generator 用 `co_yield`；异步 I/O 用 `co_await`：

```cpp
Task<int> async_compute() {
    co_await schedule_on(thread_pool);  // 切换到线程池
    int result = heavy_work();
    co_return result;
}

// 调用方
auto task = async_compute();
int val = co_await task;  // 等待完成
```

Task + Scheduler 实现**协作式多任务**：

```
主协程 ──co_await──> 挂起
                        │
线程池执行 heavy_work   │
                        │
主协程 <──resume──────── 完成
```

C++23 的 `std::generator` 是标准库版 Generator；Task 仍需自定义或使用第三方库（cppcoro、libunifex）。

## 四、Actor 模型概念

> **不要共享状态，通过消息传递。**

```
Actor A                    Actor B
  │                          │
  │  ──── Ping{seq: 0} ────> │
  │  <─── Pong{seq: 0} ───── │
  │  ──── Ping{seq: 1} ────> │
  │  <─── Pong{seq: 1} ───── │
```

| 概念 | 说明 |
|------|------|
| **Actor** | 独立实体，拥有自己的状态 |
| **Mailbox** | 线程安全消息队列 |
| **Message** | 类型安全的消息（`std::variant`） |
| **ActorRef** | Actor 的引用，用于发送消息 |
| **ActorSystem** | 管理 Actor 生命周期 |

每个 Actor 单线程处理自己的邮箱——**无锁共享状态**，避免数据竞争。

## 五、Actor 实现要点

### Mailbox：线程安全队列

```cpp
template<typename T>
class Mailbox {
    std::queue<T> queue_;
    std::mutex mutex_;
    std::condition_variable cv_;
public:
    void send(T msg) {
        { std::lock_guard lock(mutex_); queue_.push(std::move(msg)); }
        cv_.notify_one();
    }
    std::optional<T> receive() {
        std::unique_lock lock(mutex_);
        cv_.wait(lock, [this] { return !queue_.empty() || closed_; });
        if (queue_.empty()) return std::nullopt;
        auto msg = std::move(queue_.front());
        queue_.pop();
        return msg;
    }
};
```

### Actor 基类

```cpp
class Actor : public std::enable_shared_from_this<Actor> {
    Mailbox<Message> mailbox_;
    std::thread thread_;
protected:
    virtual void on_receive(const Message& msg) = 0;
    void run() {
        while (auto msg = mailbox_.receive()) {
            on_receive(*msg);
        }
    }
};
```

### Ping-Pong 演示

两个 Actor 互相发消息，演示消息传递而非共享变量：

```cpp
class PingActor : public Actor {
    void on_receive(const Message& msg) override {
        if (msg.is<Pong>()) {
            ++count_;
            if (count_ < max_) pong_.send(Ping{count_}, self_shared());
        }
    }
};
```

demo 还包含：Counter Actor、Worker Pool、状态机 Actor。

## 六、协程 vs Actor vs 线程池

| 模型 | 优势 | 劣势 | 适用 |
|------|------|------|------|
| **线程池** | 成熟、简单 | 回调地狱、共享状态 | CPU 密集、通用并发 |
| **协程** | 异步代码线性化 | 生态仍在发展 | I/O 密集、网络服务 |
| **Actor** | 无共享状态、易推理 | 消息开销、调试难 | 分布式、状态机、游戏 |

```
选型决策树：
  I/O 密集 + 需要线性代码？ → 协程
  多实体 + 状态隔离？       → Actor
  CPU 密集 + 任务队列？     → 线程池（第 14 篇）
  简单同步？               → std::thread + mutex
```

三者可组合：Actor 内部用协程处理消息，线程池作为协程调度器。

## 七、运行 demo

```bash
cd ref/cpp_demo/projects/learning_guide
./build.sh --run
# 选择 coroutine 或 actor 模块
```

协程演示：Generator 基础、斐波那契、map/filter/take 组合、Task 异步、调度器。

Actor 演示：Mailbox 多线程、Ping-Pong、Counter、Worker Pool、状态机。

需要 **C++20** 编译器（协程支持）。

## 八、系列总结：28 篇回顾

「现代 C++ 实战」系列至此完结。28 篇（00–27）覆盖五条主线：

| 季 | 篇号 | 主题 | 核心收获 |
|----|------|------|----------|
| 第零季 | 00–02 | 环境与基础 | CMake、版本地图、工具链 |
| 第一季 | 03–11 | 语言特性 | 移动语义、智能指针、Lambda、C++17/20/23 |
| 第二季 | 12–17 | 并发与工程 | 线程、同步、线程池、设计模式、测试 |
| 第三季 | 18–23 | 算法与数据结构 | 排序、哈希、树、图、字符串、DP |
| 第四季 | 24–27 | 进阶项目 | HTTP、SQLite、LRU/JSON、协程/Actor |

```
学习路线建议：
  00 环境 → 01 CMake → 02 版本地图
       ↓
  03–11 语言特性（按顺序）
       ↓
  12–17 并发与工程
       ↓
  18–23 算法（可跳跃阅读）
       ↓
  24–27 项目实战（综合运用）
```

39 个 demo 在 `ref/cpp_demo/`，统一 `./build.sh --run` 运行。大纲详见 `docs/CPP_SERIES_OUTLINE.md`。

## 九、小结

| 要点 | 内容 |
|------|------|
| 协程 | `co_yield` / `co_await` / `co_return` |
| Generator | 惰性序列，支持 map/filter/take |
| Task | 异步任务 + 调度器 |
| Actor | 消息传递、Mailbox、无共享状态 |
| 选型 | I/O→协程，隔离→Actor，CPU→线程池 |

**现代 C++ 实战系列 27 篇（含第 00 篇）全部完结。** 感谢阅读，Happy Coding!
