title: CMake CPP
date: 2025-05-19 00:06:03
categories: 
- Programming

tags: 
- CMake
- C++

---

目录结构

```
CMakeLists.txt
/src
/include
/lib
/build
```

其中 CMakeLists.txt 内容如下：

```
# CMake 最低版本号要求
cmake_minimum_required (VERSION 2.8)

# C++ 11 支持:q
set(CMAKE_CXX_FLAGS "-std=c++11")

# 项目信息
project (my_demos)

# 设置源码位置
set(SRC ${PROJECT_SOURCE_DIR}/src/carrots.cpp)


# 生成可执行文件的位置
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${PROJECT_SOURCE_DIR}/bin)

# 指定生成目标
add_executable(${PROJECT_NAME} ${SRC})
```

cd 到 build 目录下，生成 Makefile：

```
cd build && cmake .. && make
```

运行:

```
./main
```

清理：

```
make clean
```

