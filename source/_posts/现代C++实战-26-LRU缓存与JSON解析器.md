---
cover: /images/cover/cpp/lru-json.webp
title: 现代 C++ 实战（26）：LRU 缓存与 JSON 解析器
date: 2026-07-09 14:00:00
categories:
  - CppInPractice
tags:
- C++
- 现代C++
- 编程
- 2026
- 算法
- 数据结构
- JSON
- LRU
- 缓存
- 解析器
---

[第 25 篇](/2026/07/08/现代C++实战-25-SQLite数据库实战/) 给服务加了持久化；本篇是两个经典**练手项目**：LRU 缓存练数据结构设计，JSON 解析器练递归下降与 `std::variant`——都是面试高频、又能深入理解 C++ 现代特性。

demo：`ref/cpp_demo/projects/learning_guide/`（`lru_cache/` + `json_parser/`）。

<!-- more -->

> 这是「现代 C++ 实战」系列的第 26 篇。建议先读 [第 20 篇：栈、队列与链表](/2026/07/03/现代C++实战-20-栈队列与链表/)（LRU 底层）和 [第 24 篇：HTTP 服务与 JSON](/2026/07/07/现代C++实战-24-HTTP服务与JSON/)（nlohmann/json）。

## 一、LRU 缓存：设计思路

**LRU**（Least Recently Used）——缓存满时淘汰**最久未使用**的项。要求 `get` 和 `put` 均 **O(1)**。

```
unordered_map<K, iterator>     list<pair<K,V>>
┌─────────────────┐          ┌──────────────────────┐
│ key1 → iter1 ───┼─────────>│ (k1,v1) ↔ (k2,v2) ...│
│ key2 → iter2 ───┼─────────>│  MRU ──────────> LRU │
└─────────────────┘          └──────────────────────┘
  front = 最近使用              back = 待淘汰
```

| 组件 | 作用 |
|------|------|
| `std::list` | 维护访问顺序，支持 O(1) 移动 |
| `std::unordered_map` | key → list 迭代器，O(1) 查找 |
| `list::splice` | 将节点移到头部，**迭代器不失效** |

## 二、LRU 核心实现

`src/lru_cache/lru_cache.hpp`（节选，位于命名空间 `cpp_learning`）：

```cpp
template<typename K, typename V>
class LRUCache {
public:
    using KeyValuePair = std::pair<K, V>;
    using ItemList     = std::list<KeyValuePair>;
    using ListIterator = typename ItemList::iterator;
    using CacheMap     = std::unordered_map<K, ListIterator>;

    explicit LRUCache(size_t capacity) : capacity_(capacity) {
        if (capacity == 0) {
            throw std::invalid_argument("LRU cache capacity must be greater than 0");
        }
    }

    // 禁用拷贝（避免迭代器失效问题），支持移动
    LRUCache(const LRUCache&) = delete;
    LRUCache& operator=(const LRUCache&) = delete;
    LRUCache(LRUCache&&) = default;
    LRUCache& operator=(LRUCache&&) = default;

    [[nodiscard]] std::optional<V> get(const K& key) {
        auto it = cache_.find(key);
        if (it == cache_.end()) return std::nullopt;
        move_to_front(it->second);
        return it->second->second;
    }

    void put(const K& key, V value) {
        if (auto it = cache_.find(key); it != cache_.end()) {
            it->second->second = std::move(value);
            move_to_front(it->second);
            return;
        }
        if (items_.size() >= capacity_) evict_lru();
        items_.emplace_front(key, std::move(value));
        cache_[key] = items_.begin();
    }

private:
    size_t capacity_;
    ItemList items_;
    CacheMap cache_;

    void move_to_front(ListIterator it) {
        items_.splice(items_.begin(), items_, it);
    }

    void evict_lru() {
        if (items_.empty()) return;
        cache_.erase(items_.back().first);
        items_.pop_back();
    }
};
```

此外还有 `get_ref`（返回 `std::optional<std::reference_wrapper<V>>`，可原地修改）、`contains`（不改变访问顺序）、`erase`、`clear`、`for_each`、`most_recent_key` / `least_recent_key` 等辅助接口。

现代 C++ 特性一览：

| 特性 | 用途 |
|------|------|
| `std::optional<V>` | get 未命中返回 `nullopt` |
| `std::move` | put 避免值拷贝 |
| `[[nodiscard]]` | 强制检查返回值 |
| 删除拷贝 / 默认移动 | 避免迭代器失效 |

demo 还实现了 `LRUCacheWithCallback`——构造时传入 `std::function<void(const K&, V&)>`，淘汰时触发回调，适合资源清理场景。

## 三、LRU 应用场景

| 场景 | 说明 |
|------|------|
| **DNS 缓存** | 域名 → IP，减少查询延迟 |
| **页面缓存** | Web 服务器热点数据 |
| **数据库缓冲池** | 磁盘页缓存 |
| **CPU Cache** | 硬件级 LRU 近似 |

demo 的 `demo_dns_cache()` 用 `LRUCache<std::string, std::string>`（容量 1000）模拟 DNS 缓存：第一次查询走慢路径，第二次缓存命中。

## 四、JSON 解析器：递归下降

[第 24 篇](/2026/07/07/现代C++实战-24-HTTP服务与JSON/) 用 nlohmann/json 开箱即用；本篇**手写解析器**理解原理。

JSON 文法（简化）：

```
value  := null | bool | number | string | array | object
array  := '[' (value (',' value)*)? ']'
object := '{' (pair (',' pair)*)? '}'
pair   := string ':' value
```

每个规则对应一个解析函数——**递归下降**（`src/json_parser/json_parser.hpp`）：

```cpp
[[nodiscard]] JsonValue parse_value() {
    skip_whitespace();
    if (is_end()) {
        throw JsonParseError("Unexpected end of input", pos_);
    }

    char c = peek();
    switch (c) {
        case 'n': return parse_null();
        case 't': return parse_true();
        case 'f': return parse_false();
        case '"': return parse_string();
        case '[': return parse_array();
        case '{': return parse_object();
        case '-':
        case '0': case '1': case '2': case '3': case '4':
        case '5': case '6': case '7': case '8': case '9':
            return parse_number();
        default:
            throw JsonParseError(
                std::string("Unexpected character: '") + c + "'", pos_);
    }
}
```

`parse_array` 和 `parse_object` 递归调用 `parse_value()`，自然处理任意嵌套。

## 五、std::variant 表示 JSON 值

`src/json_parser/json_value.hpp` 中 `JsonNull` 即 `std::monostate`，`JsonArray` / `JsonObject` 分别是 `std::vector<JsonValue>` / `std::map<std::string, JsonValue>`，`struct JsonValue : JsonVariant` 继承 variant 并加上 `is_xxx()` / `as_xxx()` 等便捷方法：

```cpp
using JsonVariant = std::variant<
    JsonNull,        // null
    bool,            // boolean
    double,          // number
    std::string,     // string
    JsonArray,       // array
    JsonObject       // object
>;
```

| JSON 类型 | C++ 类型 | variant index |
|-----------|----------|---------------|
| null | `std::monostate` | 0 |
| boolean | `bool` | 1 |
| number | `double` | 2 |
| string | `std::string` | 3 |
| array | `vector<JsonValue>` | 4 |
| object | `map<string, JsonValue>` | 5 |

访问方式：

```cpp
// std::visit + if constexpr
std::visit([](auto&& arg) {
    using T = std::decay_t<decltype(arg)>;
    if constexpr (std::is_same_v<T, bool>) { /* ... */ }
    else if constexpr (std::is_same_v<T, double>) { /* ... */ }
}, static_cast<const JsonVariant&>(value));

// 类型检查
if (val.is_string()) { auto s = val.as_string(); }
```

## 六、移动语义在解析中的应用

构建嵌套 JSON 时用 `std::move` 避免深拷贝：

```cpp
JsonArray arr;
arr.push_back(parse_value());       // 递归解析
// ...
return JsonValue(std::move(arr));   // 移动而非拷贝

// 对象键值对
obj[std::move(key)] = std::move(value);
```

字符串解析末尾：

```cpp
return JsonValue(std::move(result));  // 长字符串移动更高效
```

## 七、错误处理

```cpp
class JsonParseError : public std::runtime_error {
public:
    JsonParseError(const std::string& message, size_t position)
        : std::runtime_error(format_message(message, position))
        , position_(position) {}
    [[nodiscard]] size_t position() const { return position_; }
private:
    size_t position_;
    // format_message: "JSON parse error at position N: ..."
};

// 严格模式：出错抛 JsonParseError
auto doc = JsonParser::parse(R"({"name": "Alice"})");   // 或 parse_json(...)

// 容错模式：失败返回 null
auto maybe = try_parse_json("invalid");  // noexcept
```

常见错误：尾随逗号、单引号、未闭合括号、`undefined`。

## 八、与 nlohmann/json 对比

| | 手写解析器 | nlohmann/json |
|--|-----------|---------------|
| 目的 | 学习、可控 | 生产使用 |
| 依赖 | 无（仅 STL） | 头文件库 |
| 性能 | demo 级 | 高度优化 |
| API | 自定义 | 成熟生态 |

工程上直接用 nlohmann/json；理解递归下降和 variant 后，读任何 JSON 库源码都更容易。

## 九、运行 demo

```bash
cd ref/cpp_demo/projects/learning_guide
./build.sh                               # C++20，FetchContent 拉 fmt/spdlog/json/CLI11
./build/cpp_learning_guide --list        # 列出全部 demo（不带参数运行也是列表）
./build/cpp_learning_guide --demo lru    # 运行 LRU 演示
./build/cpp_learning_guide --demo json   # 运行 JSON 解析器演示
./build.sh --run-args "--demo lru"       # 也可以编译后直接带参数运行
```

程序没有交互菜单，用 CLI11 解析 `-d,--demo <name>`，可选值 `lru`、`json`、`coroutine`、`http`、`allocator`、`actor`、`database`、`regex`。

LRU 演示：基本操作、`std::optional` 用法、淘汰策略、带回调的缓存、复杂类型、性能测试（容量 1 万、百万次 put/get）、DNS 缓存，最后跑一组自测。

JSON 演示：基本类型、数组、对象、`std::visit`、错误处理、序列化 `dump()`、与 nlohmann 对比，最后跑一组自测。

## 十、小结

| 项目 | 要点 |
|------|------|
| LRU | `unordered_map` + `list` + `splice`，O(1) get/put |
| JSON 解析 | 递归下降，一文法一函数 |
| JsonValue | `std::variant` 六种类型 |
| 移动语义 | 嵌套结构构建时避免拷贝 |
| 工程选型 | 学习手写，生产用 nlohmann/json |

下一篇进入系列收官：**C++20 协程与 Actor 模型**——见 [第 27 篇：协程与 Actor 模型](/2026/07/10/现代C++实战-27-协程与Actor模型/)。
