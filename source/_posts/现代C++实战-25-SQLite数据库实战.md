---
cover: /images/cover/cpp/sqlite.webp
title: 现代 C++ 实战（25）：SQLite 数据库实战
date: 2026-07-08 14:00:00
categories:
  - CppInPractice
tags:
- C++
- 现代C++
- 编程
- 2026
- SQLite
- 数据库
- SQL
- 持久化
- 嵌入式数据库
---

[第 24 篇](/2026/07/07/现代C++实战-24-HTTP服务与JSON/) 的 HTTP 服务把数据存在内存里，重启即失；**SQLite** 把数据库装进一个文件——零配置、嵌入式、全球部署量最大的数据库引擎。本篇用 C++ RAII 封装 `DatabaseManager`，实现学校管理系统的完整 CRUD。

demo：`ref/cpp_demo/database/sqlite3/`。

<!-- more -->

> 这是「现代 C++ 实战」系列的第 25 篇。建议先读 [第 24 篇：HTTP 服务与 JSON](/2026/07/07/现代C++实战-24-HTTP服务与JSON/)。

## 一、为什么选 SQLite？

| 特点 | 说明 |
|------|------|
| **零配置** | 无需安装数据库服务，打开文件即用 |
| **单文件** | 整个库在一个 `.db` 文件中，备份 = 复制文件 |
| **嵌入式** | 以库形式链接进进程，无网络开销 |
| **ACID** | 支持事务，数据一致性有保障 |
| **跨平台** | iOS/Android/桌面/浏览器（WASM）均内置 |

```
应用进程
  │
  ├─ DatabaseManager (C++ 封装)
  │
  └─ libsqlite3.so ──→ school.db (单文件)
```

适用场景：移动 App 本地存储、桌面工具、原型后端、测试数据库。不适合高并发写入（用 PostgreSQL/MySQL）。

## 二、C API vs C++ 封装

SQLite 原生是 C API：

```c
sqlite3* db;
sqlite3_open("school.db", &db);
sqlite3_prepare_v2(db, "SELECT ...", -1, &stmt, NULL);
sqlite3_step(stmt);
sqlite3_finalize(stmt);
sqlite3_close(db);
```

问题：手动管理 `sqlite3*` 和 `sqlite3_stmt*`，异常时容易泄漏。

**C++ 封装目标**：

| 原始 API | C++ 做法 |
|----------|----------|
| `sqlite3_open/close` | 构造/析构 RAII |
| `sqlite3_prepare_v2/finalize` | 每次查询封装，确保 finalize |
| 返回码检查 | `bool` + 错误日志 |
| 列读取 | 映射到 `struct Student` |

```cpp
class DatabaseManager {
    sqlite3* db;
public:
    DatabaseManager(const std::string& path);
    ~DatabaseManager() { disconnect(); }  // RAII 自动关闭
    bool connect();
    void disconnect();
};
```

## 三、数据模型：学校管理系统

demo 的 `data/school.db` 包含两张表：

```sql
CREATE TABLE classes (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE students (
    id       INTEGER PRIMARY KEY,
    class_id INTEGER,
    name     TEXT,
    gender   TEXT,
    score    INTEGER,
    FOREIGN KEY (class_id) REFERENCES classes(id)
);
```

对应 C++ 结构体：

```cpp
struct Student {
    int id, class_id, score;
    std::string name, gender;
};

struct Class {
    int id;
    std::string name;
};
```

## 四、Prepared Statement：防 SQL 注入

**永远不要**拼接用户输入：

```cpp
// 危险！SQL 注入
std::string sql = "SELECT * FROM students WHERE name = '" + user_input + "'";
```

用 `?` 占位符 + `sqlite3_bind_*`：

```cpp
std::string sql = "SELECT id, class_id, name, gender, score "
                  "FROM students WHERE class_id = ?";
sqlite3_stmt* stmt;
sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr);
sqlite3_bind_int(stmt, 1, class_id);   // 绑定参数

while (sqlite3_step(stmt) == SQLITE_ROW) {
    Student s;
    s.id        = sqlite3_column_int(stmt, 0);
    s.class_id  = sqlite3_column_int(stmt, 1);
    s.name      = (const char*)sqlite3_column_text(stmt, 2);
    s.gender    = (const char*)sqlite3_column_text(stmt, 3);
    s.score     = sqlite3_column_int(stmt, 4);
    students.push_back(s);
}
sqlite3_finalize(stmt);  // 必须释放
```

INSERT 同理：

```cpp
std::string sql = "INSERT INTO students (class_id, name, gender, score) "
                  "VALUES (?, ?, ?, ?)";
sqlite3_bind_int(stmt, 1, student.class_id);
sqlite3_bind_text(stmt, 2, student.name.c_str(), -1, SQLITE_STATIC);
sqlite3_bind_text(stmt, 3, student.gender.c_str(), -1, SQLITE_STATIC);
sqlite3_bind_int(stmt, 4, student.score);
sqlite3_step(stmt);  // 期望 SQLITE_DONE
```

## 五、CRUD 操作一览

| 操作 | 方法 | SQL |
|------|------|-----|
| 查全部 | `getAllStudents()` | `SELECT ... FROM students` |
| 按班查 | `getStudentsByClass(id)` | `WHERE class_id = ?` |
| 按 ID 查 | `getStudentById(id)` | `WHERE id = ?` |
| 增 | `addStudent(s)` | `INSERT INTO ...` |
| 改 | `updateStudent(s)` | `UPDATE ... WHERE id = ?` |
| 删 | `deleteStudent(id)` | `DELETE WHERE id = ?` |
| 排行 | `getTopStudents(n)` | `ORDER BY score DESC LIMIT ?` |

统计查询：

```cpp
// 平均分
executeSQL("SELECT AVG(score) FROM students", [&](sqlite3_stmt* stmt) {
    if (sqlite3_step(stmt) == SQLITE_ROW)
        avg = sqlite3_column_double(stmt, 0);
});

// 计数
executeSQL("SELECT COUNT(*) FROM students WHERE class_id = ?", ...);
```

`executeSQL` 辅助函数统一处理 prepare → callback/step → finalize 流程。

## 六、事务：保证原子性

批量操作需要事务——要么全成功，要么全回滚：

```cpp
if (dbManager.beginTransaction()) {
    bool ok1 = dbManager.addStudent({0, 1, "李四", "F", 88});
    bool ok2 = dbManager.addStudent({0, 1, "王五", "M", 92});

    if (ok1 && ok2)
        dbManager.commitTransaction();
    else
        dbManager.rollbackTransaction();
}
```

底层即三条 SQL：

```sql
BEGIN TRANSACTION;
-- ... 多条操作 ...
COMMIT;    -- 或 ROLLBACK;
```

连接时 demo 还执行了 `PRAGMA foreign_keys = ON`，启用外键约束。

## 七、错误处理

SQLite 每个 API 返回 `int` 状态码：

| 返回码 | 含义 |
|--------|------|
| `SQLITE_OK` (0) | 成功 |
| `SQLITE_DONE` (101) | `step` 完成，无更多行 |
| `SQLITE_ROW` (100) | `step` 返回一行数据 |
| 其他负值 | 错误，用 `sqlite3_errmsg(db)` 获取描述 |

```cpp
int rc = sqlite3_open(db_path.c_str(), &db);
if (rc != SQLITE_OK) {
    std::cerr << "无法打开数据库: " << sqlite3_errmsg(db) << std::endl;
    return false;
}
```

工程建议：封装为 `Result<T>` 或抛出自定义异常（结合 [第 08 篇](/2026/06/21/现代C++实战-08-错误处理策略/) 错误处理策略）。

## 八、CMake 配置

```cmake
find_package(SQLite3 QUIET)
# 回退：pkg-config → 手动 find_path/find_library

add_executable(sqlite3_demo src/main.cpp src/DatabaseManager.cpp)
target_link_libraries(sqlite3_demo SQLite3::SQLite3)

# 复制预置数据库到构建目录
configure_file(${CMAKE_SOURCE_DIR}/data/school.db
               ${CMAKE_BINARY_DIR}/data/school.db COPYONLY)
```

依赖安装：

| 平台 | 命令 |
|------|------|
| macOS | `brew install sqlite3` |
| Ubuntu | `apt-get install libsqlite3-dev` |

## 九、运行 demo

```bash
cd ref/cpp_demo/database/sqlite3
./build.sh
./build.sh --run    # 或 ./build/sqlite3_demo
```

demo 依次演示 10 步：

1. 查询所有学生 / 班级
2. 添加新班级「计算机科学1班」
3. 添加新学生「张三」
4. 按班级查询、成绩 Top 5
5. 统计平均分 / 人数
6. 更新学生成绩
7. 事务批量添加
8. 输出最终学生列表

## 十、与 HTTP 服务组合

[第 24 篇](/2026/07/07/现代C++实战-24-HTTP服务与JSON/) 的 REST API + 本篇的 `DatabaseManager` = 完整后端：

```
GET  /students  → dbManager.getAllStudents()  → json.dump()
POST /students  → json.parse(req.body)        → dbManager.addStudent()
```

内存 `vector` 换 SQLite，数据持久化，进程重启不丢失。

## 十一、小结

| 要点 | 内容 |
|------|------|
| SQLite | 零配置、单文件、嵌入式、ACID |
| RAII | 构造连接、析构关闭，防泄漏 |
| Prepared Statement | `?` 占位 + bind，防注入 |
| CRUD | SELECT/INSERT/UPDATE/DELETE |
| 事务 | BEGIN / COMMIT / ROLLBACK |
| 错误 | 检查返回码 + `sqlite3_errmsg` |

下一篇是两个经典练手项目：LRU 缓存 + JSON 解析器——见 [第 26 篇：LRU 缓存与 JSON 解析器](/2026/07/09/现代C++实战-26-LRU缓存与JSON解析器/)（计划）。
