---
cover: /images/cover/cpp/coroutine-actor.webp
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
- Actor
- 异步
- C++20
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

`src/coroutine/generator.hpp` 里的几个现成生成器：

```cpp
// n 为 0 表示无限序列
inline Generator<long long> fibonacci(size_t n = 0) {
    long long a = 0, b = 1;
    size_t count = 0;
    while (n == 0 || count < n) {
        co_yield a;
        auto next = a + b;
        a = b;
        b = next;
        ++count;
    }
}

inline Generator<long long> natural_numbers() {
    long long n = 0;
    while (true) {
        co_yield n++;   // 无限序列
    }
}
```

另有 `range(start, end, step = 1)`。demo 提供函数式组合，类似 Ranges 管道：

```cpp
// 取前 5 个偶数的平方：0 4 16 36 64
auto gen = take(
    map(
        filter(natural_numbers(), [](auto x) { return x % 2 == 0; }),
        [](auto x) { return x * x; }
    ),
    5
);
```

| 操作 | 作用 |
|------|------|
| `map(gen, fn)` | 变换每个元素 |
| `filter(gen, pred)` | 过滤 |
| `take(gen, n)` | 取前 n 个 |

## 三、Task：异步任务

Generator 用 `co_yield`；异步 I/O 用 `co_await`：

```cpp
Task<int> async_add(int a, int b) {
    co_return a + b;
}

Task<int> async_multiply(int a, int b) {
    co_return a * b;
}

Task<int> async_compute(int x) {
    int sum = co_await async_add(x, 10);          // 等待另一个 Task
    int result = co_await async_multiply(sum, 2);
    co_return result;
}

// 调用方（普通函数里）：run() 启动任务并同步取结果
auto task = async_compute(5);
int val = task.run();   // (5 + 10) * 2 = 30
```

demo 的 `Task<T>` 是**惰性**的（`initial_suspend` 返回 `suspend_always`），被 `co_await` 或 `run()` 时才开始执行；子任务结束时通过 `FinalAwaiter` 恢复等待它的父协程（continuation）。整个过程都在同一个线程里，没有真正的异步 I/O。

`Scheduler` 是一个单线程的就绪队列（`std::queue<std::coroutine_handle<>>`），`SchedulableTask::start(scheduler)` 把协程放进去，`step()` 每次取出一个 `resume`，这就是**协作式多任务**：

```cpp
SchedulableTask print_task(Scheduler& scheduler, std::string name, int count) {
    for (int i = 1; i <= count; ++i) {
        std::cout << fmt::format("    [{}] 步骤 {}/{}\n", name, i, count);
        co_await yield(scheduler);  // 把自己重新入队，再让出执行权
    }
    std::cout << fmt::format("    [{}] 完成!\n", name);
}

Scheduler scheduler;
auto task1 = print_task(scheduler, "Task-A", 3);
auto task2 = print_task(scheduler, "Task-B", 2);
auto task3 = print_task(scheduler, "Task-C", 4);
task1.start(scheduler);
task2.start(scheduler);
task3.start(scheduler);
while (!scheduler.empty()) {
    scheduler.step();
}
```

关键在 `yield(scheduler)` 返回的 `YieldAwaiter`：它在 `await_suspend` 中调用 `scheduler.schedule(handle)`，把当前协程**放回队尾**再挂起。如果换成 `co_await std::suspend_always{}`，协程只会挂起、不会重新入队，三个任务各打印「步骤 1」后就再也没人 `resume` 它们了。

另一个细节是 `name` **按值**传递：协程参数会被拷贝进协程帧，按值传才能保证协程挂起后字符串依然有效；如果写成 `const std::string&` 又传入字符串字面量，临时 `std::string` 在第一次挂起后就销毁了，后续恢复时访问的是悬空引用。

运行输出三个任务交替推进：

```
    [Task-A] 步骤 1/3
    [Task-B] 步骤 1/2
    [Task-C] 步骤 1/4
    [Task-A] 步骤 2/3
    [Task-B] 步骤 2/2
    [Task-C] 步骤 2/4
    [Task-A] 步骤 3/3
    [Task-B] 完成!
    [Task-C] 步骤 3/4
    [Task-A] 完成!
    [Task-C] 步骤 4/4
    [Task-C] 完成!
    总共执行了 12 次调度
```

C++23 的 `std::generator` 是标准库版 Generator；Task 和线程池调度仍需自定义或使用第三方库（cppcoro、libunifex）。

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
| **Message** | 用 `std::any` 做类型擦除的消息，可带发送者；`is<T>()` / `get<T>()` 按类型取出 |
| **ActorRef** | Actor 的引用，用于发送消息 |
| **ActorSystem** | 管理 Actor 生命周期 |

每个 Actor 单线程处理自己的邮箱——**无锁共享状态**，避免数据竞争。

## 五、Actor 实现要点

### Mailbox：线程安全队列

`src/actor/mailbox.hpp`（节选）。`capacity` 为 0 表示无界，否则 `send` 在队列满时阻塞，形成背压：

```cpp
template<typename T>
class Mailbox {
public:
    explicit Mailbox(std::size_t capacity = 0)
        : capacity_(capacity), closed_(false) {}

    bool send(T msg) {
        std::unique_lock<std::mutex> lock(mutex_);
        if (capacity_ > 0) {
            not_full_cv_.wait(lock, [this] {
                return closed_.load() || queue_.size() < capacity_;
            });
        }
        if (closed_.load()) return false;
        queue_.push(std::move(msg));
        lock.unlock();
        not_empty_cv_.notify_one();
        return true;
    }

    std::optional<T> receive() {
        std::unique_lock<std::mutex> lock(mutex_);
        not_empty_cv_.wait(lock, [this] {
            return closed_.load() || !queue_.empty();
        });
        if (queue_.empty()) return std::nullopt;   // 已关闭且取空
        T msg = std::move(queue_.front());
        queue_.pop();
        if (capacity_ > 0) {
            lock.unlock();
            not_full_cv_.notify_one();
        }
        return msg;
    }

    void close();   // 置 closed_ 并唤醒所有等待者

private:
    std::size_t capacity_;
    std::queue<T> queue_;
    mutable std::mutex mutex_;
    std::condition_variable not_empty_cv_;
    std::condition_variable not_full_cv_;
    std::atomic<bool> closed_;
};
```

另有 `try_send`、`receive_for`（超时）、`try_receive`，以及按优先级出队的 `PriorityMailbox`。

### Actor 基类

`src/actor/actor.hpp`（节选）：每个 Actor 有自己的 `Mailbox<Message>` 和一个工作线程，`start()` 启动线程跑 `run()`：

```cpp
class Actor : public std::enable_shared_from_this<Actor> {
protected:
    virtual void on_receive(const Message& msg) = 0;
    virtual void on_start() {}
    virtual void on_stop() {}

private:
    void run() {
        while (state_.load() == ActorState::Running) {
            auto msg_opt = mailbox_.receive();   // 阻塞
            if (!msg_opt) break;                 // 邮箱已关闭
            Message& msg = *msg_opt;
            if (msg.is<PoisonPill>()) break;     // 毒丸：停止

            current_sender_ = msg.sender();
            try {
                on_receive(msg);
            } catch (const std::exception& e) {
                on_error(e, msg);
            }
            current_sender_.reset();
        }
    }

    ActorSystem& system_;
    std::string name_;
    Mailbox<Message> mailbox_;
    std::thread worker_;
    std::atomic<ActorState> state_;
    std::shared_ptr<ActorRef> current_sender_;
};
```

### Ping-Pong 演示

两个 Actor 互相发消息，演示消息传递而非共享变量：

```cpp
class PingActor : public Actor {
    // ...
protected:
    void on_receive(const Message& msg) override {
        if (msg.is<Pong>()) {
            auto pong = msg.get<Pong>().value();
            ++count_;
            if (count_ < max_count_) {
                std::this_thread::sleep_for(10ms);  // 减慢速度
                if (pong_.valid()) {
                    pong_.send(Ping{count_}, self_shared());
                }
            } else {
                done_ = true;
            }
        }
    }
};
```

`pong_` 是 `ActorRef`，`self_shared()` 把自己作为发送者附在消息上，`PongActor` 收到 `Ping` 后据此回 `Pong`。

demo 还包含：`CounterActor`、Worker Pool（`MasterActor` 分发任务给多个 `WorkerActor`）、状态机（`TrafficLightActor` 红绿灯）。

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
./build.sh
./build/cpp_learning_guide --demo coroutine
./build/cpp_learning_guide --demo actor
# 或：./build.sh --run-args "--demo actor"
```

协程演示：Generator 基础、斐波那契、map/filter/take 组合、Task 基础、Task 链式调用、调度器、协程与普通函数对比、实用 Generator 管道（逐行读取 / 过滤空行 / 加行号），最后跑一组自测。

Actor 演示：Mailbox 多线程、Ping-Pong、Counter、Worker Pool、状态机，最后跑一组自测。

需要 **C++20** 编译器（协程支持）；CMake 对 GCC 额外加了 `-fcoroutines`。

## 八、系列总结：28 篇回顾

「现代 C++ 实战」系列至此完结。28 篇（00–27）覆盖五条主线：

| 季 | 篇号 | 主题 | 核心收获 |
|----|------|------|----------|
| 第零季 | 00–02 | 环境与基础 | CMake、版本地图、工具链 |
| 第一季 | 03–11 | 语言特性 | 移动语义、智能指针、Lambda、C++17/20、Ranges、Concepts |
| 第二季 | 12–17 | 并发与工程 | 线程、同步、线程池、设计模式、测试、C++23 |
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

41 个子项目都在 `ref/cpp_demo/`，每个目录下统一用 `./build.sh` 构建、`./build.sh --run [TARGET]` 运行。

## 九、小结

| 要点 | 内容 |
|------|------|
| 协程 | `co_yield` / `co_await` / `co_return` |
| Generator | 惰性序列，支持 map/filter/take |
| Task | 异步任务 + 调度器 |
| Actor | 消息传递、Mailbox、无共享状态 |
| 选型 | I/O→协程，隔离→Actor，CPU→线程池 |

**现代 C++ 实战系列 28 篇（含第 00 篇）全部完结。** 感谢阅读，Happy Coding!
