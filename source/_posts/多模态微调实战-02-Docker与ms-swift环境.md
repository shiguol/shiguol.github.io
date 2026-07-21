---
cover: /images/cover/vlm/docker-msswift-env.webp
title: 多模态微调实战（02）：用 Docker 固化 ms-swift 训练环境
date: 2026-07-22 09:00:00
categories:
  - VLMFinetune
tags:
  - 多模态
  - VLM
  - 微调
  - ms-swift
  - Docker
  - CUDA
  - 2026
---

微调最怕两件事：**依赖打架** 和 **驱动 / CUDA 不匹配**。这一篇把训练环境固定在镜像里，宿主机只负责三件事：显卡驱动、Docker、项目目录。目标是让训练环境一次搭好、随处复现。

<!-- more -->

> 这是「多模态微调实战」的第 02 篇。上一篇讲了路线图，本篇解决「环境从哪来、怎么复现」。

## 一、硬件与软件前提

| 项目 | 建议 |
|------|------|
| GPU | 单卡，显存约 16GB 或以上 |
| 驱动 | 能跑你选用的 CUDA 容器即可（较新的消费卡通常需要较新的 PyTorch） |
| 系统 | Linux（本文以 Ubuntu 为例） |
| Docker | 已安装，并配置好 NVIDIA Container Toolkit |
| 磁盘 | 预留 50GB+（模型 + 全量数据 + checkpoint） |

自检：

```bash
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.8.0-base-ubuntu22.04 nvidia-smi
```

第二行能打印 GPU 信息，说明容器 GPU 通路正常。

## 二、项目目录约定

把下面当作「项目根」：

```text
~/projects/vlm-ocr-sft/
├── model/Qwen3-VL-4B-Instruct/   # 预先下载好的 HF 格式权重
├── dataset/
├── script/
├── docker/
├── output/
└── blog/
```

基座模型建议单独下载，**不要提交到 Git**。目录内应能看到类似 `config.json`、`model-*-of-*.safetensors`、`tokenizer.json`、多模态 processor 配置。

## 三、镜像构建思路

实践中常用做法：

1. 找一个已经装好较新 PyTorch + CUDA 的训练镜像作为基础；
2. 再 `pip install ms-swift`（以及必要的兼容依赖）；
3. 打成自己的标签，例如 `ms-swift-finetune:latest`。

示例 `docker/Dockerfile`（示意）：

```dockerfile
FROM your-base-pytorch-image:latest

RUN pip install -U pip && \
    pip install "ms-swift" && \
    pip install "datasets>=4.4,<4.8.5"

WORKDIR /workspace
```

构建：

```bash
cd ~/projects/vlm-ocr-sft
docker build -t ms-swift-finetune:latest -f docker/Dockerfile .
```

> 提示：某些 `datasets` 大版本会与当前 ms-swift 冲突。实践里曾用过 `datasets>=4.4,<4.8.5` 这一范围，建议你也固定版本，避免「昨天还能训、今天 import 失败」。

## 四、推荐的运行方式：一次性容器执行

不必长期挂着交互容器。更稳的是封装一个 `docker_run.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="ms-swift-finetune:latest"

docker run --rm --gpus all \
  -v "${PROJECT_ROOT}:/workspace" \
  -w /workspace \
  "${IMAGE}" \
  bash -c "$*"
```

之后所有训练 / 导出命令都通过它进容器，例如：

```bash
bash script/docker_run.sh swift --version
bash script/docker_run.sh python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

优点：

- 环境一致；
- 任务结束容器自动删除（`--rm`）；
- 产物落在挂载的 `output/`，宿主机可见。

## 五、环境验证清单

在容器内确认：

```bash
swift --version
python -c "import swift; print('ms-swift OK')"
python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
```

常见失败：

| 现象 | 排查 |
|------|------|
| `CUDA not available` | 宿主机驱动、`--gpus all`、Container Toolkit |
| `ImportError: datasets...` | 固定 `datasets` 版本 |
| 找不到 `swift` | 镜像里未装好 ms-swift，或用了错误镜像 |

## 六、关于 FlashAttention

文档里常写 `--attn_impl flash_attn`。若镜像未编译对应版本的 flash-attn，**直接改用 `sdpa`** 也能训，只是速度可能略慢。本系列默认以 `sdpa` 为准，优先保证「能跑」。

## 七、小结

到这里你应该有：

1. 可用 GPU 的 Docker；
2. 含 ms-swift 的训练镜像；
3. 项目目录挂载到 `/workspace`；
4. 一条统一的 `docker_run.sh` 入口。

> 多模态微调实战第 02 篇完。下一篇：把公开 OCR 数据从 LMDB 转成 ms-swift 能吃的多模态 JSONL。
