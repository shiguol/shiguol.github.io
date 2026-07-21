---
cover: /images/cover/llamafactory/environment-docker.webp
title: 语言模型微调实战（03）：Docker 里跑 LLaMA-Factory
date: 2026-08-04 09:00:00
categories:
  - LLaMAFactorySFT
tags:
  - 大模型
  - 微调
  - Docker
  - LLaMA-Factory
  - 环境搭建
  - 2026
---

微调的依赖链很长（CUDA、PyTorch、transformers、LLaMA-Factory），容器化能让「昨天能训、今天也能训」。这一篇讲怎么用 Docker 把环境固化下来，并在进容器后先做自检。

<!-- more -->

## 你需要什么

| 类别 | 建议 |
|------|------|
| 系统 | Ubuntu（或其他 Linux） |
| GPU | NVIDIA GPU，建议 16GB+ 显存（LoRA 微调 3B 量级通常够用） |
| 软件 | Docker + NVIDIA Container Toolkit |
| 磁盘 | 预留足够空间给基础镜像、基座模型与训练输出 |

具体型号、云厂商、镜像源不必写进文章；按你机器上的实际环境配置即可。

## 为什么用 Docker

- 宿主机干净，依赖锁在镜像里；
- 换机器时更容易复现；
- 代码与数据通过挂载目录注入，不必 bake 进镜像每一层。

## 典型目录挂载

宿主机项目目录挂到容器内，职责大致如下：

| 宿主机 | 容器内 | 用途 |
|--------|--------|------|
| `models/` | `/app/models/` | 基座模型（常只读） |
| `train_data/` | `/app/train_data/` | 训练/验证数据 |
| `output/` | `/app/output/` | 适配器与合并模型 |
| `configs/` | `/app/configs/` | YAML 配置 |
| `scripts/` | `/app/scripts/` | 评估与推理脚本 |
| 框架源码目录 | `/app/LLaMA-Factory/` | 可挂载以便热更新代码 |

## 构建与启动（示意）

```bash
# 构建镜像
./docker_run.sh build

# 后台启动并进入
./docker_run.sh start
./docker_run.sh exec
```

首次构建会拉取较大的基础镜像，耗时取决于网络；后续有缓存会快很多。若你更新了框架源码且镜像内安装了 editable 包，可能需要重建镜像。

## 进入容器后先做自检

```bash
nvidia-smi
python3 -c "import torch; print(torch.cuda.is_available(), torch.cuda.is_bf16_supported())"
llamafactory-cli version
```

期望看到：CUDA 可用；若训练配置开了 `bf16: true`，确认当前 GPU 支持 bf16。

## 常见问题

### GPU 突然不可用 / bf16 报错

容器跑太久偶发 GPU 状态异常时，在宿主机重启容器通常可恢复：

```bash
./docker_run.sh stop
./docker_run.sh start
./docker_run.sh exec
```

### 输出目录权限

容器内进程常以 root 写 `output/`，宿主机删除时可能需要在容器内清理，或调整权限策略。

## 小结

环境篇的目标只有一个：**让 `llamafactory-cli train` 能稳定跑起来**。

> 语言模型微调实战第 03 篇完。下一篇讲数据：格式怎么定、怎么构造、怎么划分才公平。
