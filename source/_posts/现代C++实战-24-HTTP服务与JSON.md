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

## 四、REST CRUD 模式

把 JSON 和路由组合，就是标准 REST API。内存中用 `std::vector` 或 `std::unordered_map` 存数据：

```cpp
std::vector<User> users = {{1, "Alice", "alice@example.com"}};

// GET /users — 列表
svr.Get("/users", [](const httplib::Request&, httplib::Response& res) {
  res.set_content(json(users).dump(), "application/json");
});

// GET /users/:id — 单个
svr.Get(R"(/users/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
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
svr.Post("/users", [](const httplib::Request& req, httplib::Response& res) {
  auto j = json::parse(req.body);
  User u = j.get<User>();
  users.push_back(u);
  res.status = 201;
  res.set_content(json(u).dump(), "application/json");
});

// PUT /users/:id — 更新
svr.Put(R"(/users/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
  int id = std::stoi(req.matches[1]);
  auto j = json::parse(req.body);
  for (auto& u : users)
    if (u.id == id) { u = j.get<User>(); u.id = id; break; }
  res.set_content(json(users).dump(), "application/json");
});

// DELETE /users/:id — 删除
svr.Delete(R"(/users/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
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
  URL https://github.com/yhirose/cpp-httplib/archive/refs/tags/v0.15.3.tar.gz
)
FetchContent_Declare(nlohmann_json
  URL https://github.com/nlohmann/json/archive/refs/tags/v3.11.3.tar.gz
)
set(JSON_BuildTests OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(httplib nlohmann_json)

add_executable(httplib_json_demo main.cpp)
target_link_libraries(httplib_json_demo PRIVATE
    httplib::httplib
    nlohmann_json::nlohmann_json
)
```

HTTPS 支持需链接 OpenSSL：

```cmake
find_package(OpenSSL REQUIRED)
target_link_libraries(httplib_json_demo PRIVATE OpenSSL::SSL OpenSSL::Crypto)
target_compile_definitions(httplib_json_demo PRIVATE CPPHTTPLIB_OPENSSL_SUPPORT)
```

macOS：`brew install openssl`，CMake 可能需要 `-DOPENSSL_ROOT_DIR=/opt/homebrew/opt/openssl`。

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

# 若实现了 CRUD，可测试：
curl http://localhost:8080/users
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"id":2,"name":"Bob","email":"bob@example.com"}'
curl -X DELETE http://localhost:8080/users/2
```

## 八、与其他技术栈对比

| 方案 | 特点 |
|------|------|
| **cpp-httplib** | 头文件、零依赖（HTTP）、适合原型 |
| **Boost.Beast** | 异步、与 Boost.Asio 集成，适合高性能 |
| **Crow / Pistache** | 类似 Flask 的路由风格 |
| **gRPC** | 二进制协议，微服务间通信 |

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

下一篇给服务加上**持久化**：SQLite 嵌入式数据库 + DatabaseManager——见 [第 25 篇：SQLite 数据库实战](/2026/07/08/现代C++实战-25-SQLite数据库实战/)（计划）。
