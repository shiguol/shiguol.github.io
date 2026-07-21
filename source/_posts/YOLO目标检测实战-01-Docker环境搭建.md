---
cover: /images/cover/yolo/docker-env.webp
title: YOLO 目标检测实战（01）：Docker GPU 环境搭建
date: 2026-07-22 09:00:00
categories:
  - YOLODetect
tags:
  - YOLO
  - 目标检测
  - Docker
  - CUDA
  - Ultralytics
  - 2026
---

目标：在隔离的 Docker 镜像里跑通 YOLO 所需的 CUDA / PyTorch / Ultralytics / TensorRT，并准备好权重与样例数据。这一步做扎实了，后面训练、导出、部署才不会被环境问题反复拖住。

<!-- more -->

> 这是「YOLO 目标检测实战」的第 01 篇。系列共 8 篇，完整目录见 [00 · 系列导读](/2026/07/21/YOLO目标检测实战-00-系列导读/)。文中路径统一用容器内 `/workspace` 或项目相对路径。

## 一、为什么用 Docker

- 宿主机只保留驱动与 NVIDIA Container Toolkit，训练依赖全部锁在镜像里。
- 新架构（如 Blackwell）需要较新的 CUDA wheel（本实验用 **CUDA 12.8 + cu128**），镜像便于复现。
- 同一镜像既做训练，也起 FastAPI，避免「本机能跑、服务环境缺包」这种最耗时的问题。

## 二、仓库结构（相关部分）

```text
├── docker/           # Dockerfile + compose + entrypoint
├── scripts/          # 分步脚本
├── api/              # FastAPI
├── data/
│   ├── images/       # 样例图
│   └── datasets/     # COCO128
├── weights/          # 预训练与导出权重
└── runs/             # 训练 / 验证 / 检测输出
```

## 三、镜像要点

`docker/Dockerfile` 基于 `nvidia/cuda:12.8.0-cudnn-devel-ubuntu22.04`，主要安装：

- PyTorch（源 `https://download.pytorch.org/whl/cu128`）
- `ultralytics`（注意：包版本号如 `8.x` 不是「YOLOv8 模型」）
- `onnx` / `onnxruntime-gpu` / `tensorrt-cu12`
- FastAPI + uvicorn（供后续 API 使用）

`docker-compose.yml` 里为 DataLoader 设置了较大的 `shm_size`（训练服务 `8gb`），并声明了 GPU 设备。

## 四、一次性准备

在**项目根目录**执行：

```bash
# 1) 下载权重、样例图、COCO128（无需 GPU）
bash scripts/00_download_assets.sh

# 2) 构建镜像（耗时主要在拉基础镜像与大 wheel）
docker compose -f docker/docker-compose.yml build
```

`00_download_assets.sh` 会：

- 拉取预训练 `s` 档权重与样例图 `bus.jpg`；
- 解压 COCO128 到 `data/datasets/coco128`；
- 生成本地数据配置 `data/datasets/coco128.local.yaml`（`path` 指向容器内 `/workspace/data/datasets/coco128`，避免训练时再联网下数据）。

## 五、验收

构建完成后，先确认三件套都在，并且能看到 GPU：

```bash
docker compose -f docker/docker-compose.yml run --rm yolo \
  python -c "import torch, ultralytics, tensorrt as trt; print(torch.cuda.is_available(), ultralytics.__version__, trt.__version__)"
```

期望类似：`True 8.x.x 10.x.x.x`（具体小版本以镜像为准）。

若 `cuda.is_available()` 为 `False`：先在宿主机确认 `nvidia-smi` 正常，再检查 Container Toolkit 与 compose 的 GPU `deploy` 段是否声明了设备。

## 六、进入容器

```bash
docker compose -f docker/docker-compose.yml run --rm yolo bash
```

之后的脚本默认假设你已在容器内，且工作目录为 `/workspace`（与宿主机项目目录挂载对应）。

## 七、常见坑

| 现象 | 处理 |
|------|------|
| 构建很慢 | 正常；`torch` / `tensorrt` wheel 很大 |
| 训练报 shm / Resource temporarily unavailable | 已设 `shm_size`；仍不够可再降 `workers` |
| OOM | 降低 `batch`（训练脚本默认 16） |

## 下一步

冒烟才是第一块试金石。→ [02 · 预训练模型冒烟推理](/2026/07/23/YOLO目标检测实战-02-预训练模型冒烟推理/)
