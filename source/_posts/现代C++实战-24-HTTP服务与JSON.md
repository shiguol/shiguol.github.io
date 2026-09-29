---
cover: /images/cover/cpp/http-json.webp
title: 现代 C++ 实战（24）：HTTP 服务与 JSON
date: 2026-07-07 14:00:00
categories:
  - CppInPractice
tags:
- C++
- 现代C++
- 编程
- 2026
- HTTP
- JSON
- FetchContent
- 网络编程
- cpp-httplib
- REST
---

[第 23 篇](/2026/07/06/现代C++实战-23-字符串搜索与动态规划/) 收官第三季算法篇；**第四季**进入工程实战。第一篇从最常见的后端能力入手：用 **cpp-httplib** 搭 HTTP 服务，用 **nlohmann/json** 处理 JSON——几十行代码就能跑起一个 REST 接口。

demo：`ref/cpp_demo/networking/http_json/`。

<!-- more -->

> 这是「现代 C++ 实战」系列的第 24 篇，第四季开篇。建议先读 [第 01 篇：CMake 与现代构建](/2026/06/14/现代C++实战-01-CMake与现代构建/)（FetchContent）和 [第 23 篇](/2026/07/06/现代C++实战-23-字符串搜索与动态规划/)。

## 一、HTTP 基础速览

```
客户端                              服务端
  │  GET /camera HTTP/1.1              │
  │  Host: localhost:8080    ────────→ │  路由匹配 → 处理 → 响应
  │                                    │
  │  ← HTTP/1.1 200 OK                 │
  │    Content-Type: image/jpeg        │
  │    [二进制 body]                    │
```

| 概念 | 说明 |
|------|------|
| **方法** | GET 读取、POST 创建、PUT 更新、DELETE 删除 |
| **路径** | `/users`、`/camera`——路由的匹配键 |
| **状态码** | 200 成功、404 未找到、400 请求错误、500 服务端错误 |
| **Content-Type** | `application/json`、`image/jpeg`、`text/plain` |
| **REST** | 用 URL 表资源，用 HTTP 方法表操作 |

## 二、cpp-httplib：头文件即服务器

[cpp-httplib](https://github.com/yhirose/cpp-httplib) 是**单头文件** HTTP 库，适合原型和轻量服务：

```cpp
#include <httplib.h>

httplib::Server svr;

svr.Get("/hello", [](const httplib::Request& req, httplib::Response& res) {
    res.set_content("Hello, World!", "text/plain");
});

svr.listen("0.0.0.0", 8080);
```

demo 的 `main.cpp` 在此基础上加了**日志中间件**和**图片接口**：

```cpp
svr.set_logger([](const httplib::Request& req, const httplib::Response& res) {
    std::cout << "[请求] " << req.method << " " << req.path
              << " | 来源: " << req.remote_addr
              << " | 状态码: " << res.status << std::endl;
});

svr.Get("/camera", [](const httplib::Request& req, httplib::Response& res) {
    std::ifstream file("yellow_ducks.jpeg", std::ios::binary);
    if (!file) {
        res.status = 404;
        res.set_content("Image not found", "text/plain");
        return;
    }
    std::string image_data((std::istreambuf_iterator<char>(file)),
                           std::istreambuf_iterator<char>());
    res.set_content(image_data, "image/jpeg");
});
```

要点：

- `res.status` 设置状态码（默认 200）
- `res.set_content(body, mime_type)` 设置响应体
- 二进制文件用 `std::ios::binary` 读取，避免换行符被转换

## 三、nlohmann/json：现代 C++ 的 JSON

[nlohmann/json](https://github.com/nlohmann/json) 是事实标准的 JSON 库，接口接近 STL：

```cpp
#include <nlohmann/json.hpp>
using json = nlohmann::json;

// 序列化：对象 → JSON 字符串
json j = {{"name", "WALL-E"}, {"age", 2000}};
std::string s = j.dump(2);  // 缩进 2 空格

// 反序列化：JSON 字符串 → 对象
json parsed = json::parse(R"({"name":"EVE","age":500})");
std::string name = parsed["name"];  // "EVE"
```

自定义类型（`NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE` 宏）：

```cpp
struct User {
    int id;
    std::string name;
    std::string email;
};
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(User, id, name, email)

User u{1, "Alice", "alice@example.com"};
json j = u;           // 自动序列化
User u2 = j.get<User>(); // 自动反序列化
```

demo 的 `my_object.hpp` 走的是另一条路：为 `MyObject { id, userId, title, body }` 特化 `nlohmann::adl_serializer<MyObject>`，手写 `to_json` / `from_json`，从而能对 `null` 或缺失字段给默认值（`id` / `userId` 为 `null` 时取 0，`title` / `body` 缺失或非字符串时取 `"NULL"`）——宏绑定做不到这种容错：

```cpp
namespace nlohmann {
template <>
struct adl_serializer<MyObject> {
    static void to_json(json& j, const MyObject& p) {
        j = json{{"id", p.id}, {"userId", p.userId}, {"title", p.title}, {"body", p.body}};
    }
    static void from_json(const json& j, MyObject& p) {
        if (j.at("id").is_null()) p.id = 0; else j.at("id").get_to(p.id);
        // userId / title / body 同理……
    }
};
}
```

## 四、REST CRUD 模式

把 JSON 和路由组合，就是标准 REST API。下面是通用示意（demo 中没有这些路由），内存中用 `std::vector` 存数据，与 `svr` 定义在同一函数里、lambda 按引用捕获：

```cpp
std::vector<User> users = {{1, "Alice", "alice@example.com"}};

// GET /users — 列表
svr.Get("/users", [&](const httplib::Request&, httplib::Response& res) {
  res.set_content(json(users).dump(), "application/json");
});

// GET /users/:id — 单个
svr.Get(R"(/users/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
  int id = std::stoi(req.matches[1]);
  for (auto& u : users)
    if (u.id == id) {
      res.set_content(json(u).dump(), "application/json");
      return;
    }
  res.status = 404;
  res.set_content(R"({"error":"not found"})", "application/json");
});

// POST /users — 创建
svr.Post("/users", [&](const httplib::Request& req, httplib::Response& res) {
  auto j = json::parse(req.body);
  User u = j.get<User>();
  users.push_back(u);
  res.status = 201;
  res.set_content(json(u).dump(), "application/json");
});

// PUT /users/:id — 更新
svr.Put(R"(/users/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
  int id = std::stoi(req.matches[1]);
  auto j = json::parse(req.body);
  for (auto& u : users)
    if (u.id == id) { u = j.get<User>(); u.id = id; break; }
  res.set_content(json(users).dump(), "application/json");
});

// DELETE /users/:id — 删除
svr.Delete(R"(/users/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
  int id = std::stoi(req.matches[1]);
  users.erase(std::remove_if(users.begin(), users.end(),
    [id](const User& u) { return u.id == id; }), users.end());
  res.status = 204;
});
```

| 方法 | 路径 | 作用 | 成功状态码 |
|------|------|------|-----------|
| GET | `/users` | 列表 | 200 |
| GET | `/users/:id` | 详情 | 200 / 404 |
| POST | `/users` | 创建 | 201 |
| PUT | `/users/:id` | 更新 | 200 |
| DELETE | `/users/:id` | 删除 | 204 |

demo 当前实现了 `/camera` 图片接口；CRUD 是同一套 httplib + json 的自然延伸，下一篇 SQLite 会接上持久化。

## 五、FetchContent 拉依赖

`CMakeLists.txt` 用 [第 01 篇](/2026/06/14/现代C++实战-01-CMake与现代构建/) 学过的 FetchContent 自动下载：

```cmake
include(FetchContent)

FetchContent_Declare(httplib
  URL https://github.com/yhirose/cpp-httplib/archive/refs/tags/v0.58.0.tar.gz
)
FetchContent_Declare(nlohmann_json
  URL https://github.com/nlohmann/json/archive/refs/tags/v3.12.0.tar.gz
)
set(JSON_BuildTests OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(httplib nlohmann_json)

add_executable(httplib_json_demo main.cpp)
target_link_libraries(httplib_json_demo PRIVATE
    httplib::httplib
    nlohmann_json::nlohmann_json
)
```

HTTPS 支持需要 OpenSSL **3.0+**（新版 cpp-httplib 已不支持 1.1.x）。新版不必再手写 `find_package` + `target_link_libraries(OpenSSL::SSL)`，只要在 `FetchContent_MakeAvailable` 之前打开 httplib 自带的开关，`httplib::httplib` 目标就会自动传递 OpenSSL 链接和 `CPPHTTPLIB_OPENSSL_SUPPORT` 宏：

```cmake
set(HTTPLIB_REQUIRE_OPENSSL ON CACHE BOOL "" FORCE)   # 找不到 OpenSSL 直接报错
# 用不到的压缩库显式关闭，保证 macOS 与 Ubuntu 行为一致
set(HTTPLIB_USE_ZLIB_IF_AVAILABLE OFF CACHE BOOL "" FORCE)
set(HTTPLIB_USE_BROTLI_IF_AVAILABLE OFF CACHE BOOL "" FORCE)
set(HTTPLIB_USE_ZSTD_IF_AVAILABLE OFF CACHE BOOL "" FORCE)
```

Ubuntu：`apt-get install libssl-dev`（Docker 镜像已预装）；macOS：`brew install openssl@3`，demo 的 CMake 会通过 `brew --prefix openssl@3` 自动设置 `OPENSSL_ROOT_DIR`。

资源文件复制到构建目录：

```cmake
configure_file(${CMAKE_SOURCE_DIR}/yellow_ducks.jpeg
               ${CMAKE_BINARY_DIR}/yellow_ducks.jpeg COPYONLY)
```

## 六、错误处理与日志

| 场景 | 处理 |
|------|------|
| 文件不存在 | `res.status = 404` + 错误消息 |
| JSON 解析失败 | `try/catch (json::parse_error&)` → 400 |
| 未捕获异常 | 全局 handler 或返回 500 |

```cpp
svr.set_exception_handler([](const httplib::Request&, httplib::Response& res,
                             std::exception_ptr ep) {
  res.status = 500;
  res.set_content(R"({"error":"internal server error"})", "application/json");
});
```

`set_logger` 记录每个请求的方法、路径、来源 IP、状态码——开发阶段够用；生产环境可换 spdlog（[第 01 篇](/2026/06/14/现代C++实战-01-CMake与现代构建/) fetch_content demo 已集成）。

## 七、运行 demo 与 curl 测试

```bash
cd ref/cpp_demo/networking/http_json
./build.sh          # 首次需网络下载依赖
./build.sh --run    # 或 ./build/httplib_json_demo
```

服务监听 `0.0.0.0:8080`，另开终端测试：

```bash
# 获取图片
curl -v http://localhost:8080/camera -o duck.jpg
file duck.jpg    # JPEG image data

# demo 只注册了 /camera，其他路径返回 404
curl -i http://localhost:8080/users   # HTTP/1.1 404 Not Found
```

服务端终端会看到 `set_logger` 打印的日志，例如 `[请求] GET /camera | 来源: 127.0.0.1 | 状态码: 200`。第四节的 CRUD 路由需要自己加到 `main.cpp` 里再用 curl 测试。

## 八、与其他技术栈对比

| 方案 | 特点 |
|------|------|
| **cpp-httplib** | 头文件、零依赖（HTTP）、适合原型 |
| **Boost.Beast** | 异步、与 Boost.Asio 集成，适合高性能 |
| **Crow / Pistache** | 类似 Flask 的路由风格 |
| **gRPC** | 二进制协议，微服务间通信 |

cpp-httplib 新版本还内置了 RFC 6455 **WebSocket** 服务端 / 客户端。`networking/websocket/` demo 已从停更的 websocketpp（依赖 Boost.Asio）迁移过来，提供 `/echo` 回显和 `/chat` 聊天室广播两条路由，零系统依赖：

```bash
cd ref/cpp_demo/networking/websocket
./build.sh --run websocket_selftest      # 同进程回环自检（别直接 --run，服务端会阻塞）
./build/websocket_server                 # 终端 1：默认 0.0.0.0:8080
./build/websocket_client ws://localhost:8080/chat   # 终端 2+：交互式聊天，Ctrl+D 退出
```

代价是阻塞 I/O + 每连接一个线程，适合中小规模；需要海量长连接时再考虑 Boost.Beast 这类异步方案。

学习路径：httplib 入门 → 需要持久化接 SQLite（[第 25 篇](/2026/07/08/现代C++实战-25-SQLite数据库实战/)）→ 需要并发接 [第 14 篇](/2026/06/27/现代C++实战-14-线程池与背压控制/) 线程池。

## 九、小结

| 要点 | 内容 |
|------|------|
| HTTP | 方法 + 路径 + 状态码 + Content-Type |
| cpp-httplib | `Get`/`Post` 路由、`set_content`、中间件 |
| nlohmann/json | `dump`/`parse`、宏绑定自定义类型 |
| CMake | FetchContent 拉 httplib + json |
| REST | CRUD 五件套，JSON 作 body |
| 测试 | curl 验证接口 |

下一篇给服务加上**持久化**：SQLite 嵌入式数据库 + DatabaseManager——见 [第 25 篇：SQLite 数据库实战](/2026/07/08/现代C++实战-25-SQLite数据库实战/)。
