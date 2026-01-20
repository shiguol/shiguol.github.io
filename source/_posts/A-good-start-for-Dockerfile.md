title: A good start for Dockerfile
date: 2025-05-19 00:12:17
categories:
- Docker

tags:
- 2025


---

构建 Docker 镜像，这样开发调试都是与真实线上环境一致。

<!-- more -->

```

# 查看所有镜像
docker images

# 从 Dockerfile 中构建一个镜像，并保存为 ubuntu:22.04，注意，「.」表示配置文件在当前目录
docker build -t ubuntu:22.04 .

# 启动镜像，一般会写成一个 shell 脚本
docker run -it --rm -v /sacode:/worksapce
```

```

# 基础镜像
FROM ubuntu:22.04

# 设置环境变量
ENV DEBIAN_FRONTEND=noninteractive

# 更新软件源并安装基础工具
RUN apt-get update && apt-get install --no-install-recommends -y \
    build-essential \
    cmake \
    gdb \
    clang \
    lldb \
    llvm \
    python3 \
    python3-pip \
    git \
    wget \
    curl \
    vim \
    locales \
	&& locale-gen zh_CN.UTF-8 \
	&& echo "export LANG=zh_CN.UTF-8" >> ~/.bashrc \
	&& echo "export LC_ALL=zh_CN.UTF-8" >> ~/.bashrc \
    && rm -rf /var/lib/apt/lists/*

# 安装常用Python包
RUN pip3 install --upgrade pip && \
    pip3 install numpy scipy matplotlib pandas jupyter notebook

# 设置工作目录
WORKDIR /workspace

# 默认启动命令
CMD ["/bin/bash"]
```

docker run -it --rm -v /myfolder:/workspace -p 8080:8080
