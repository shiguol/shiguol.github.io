---
cover: /images/cover/yolo/smoke-detect.webp
title: YOLO 目标检测实战（02）：预训练模型冒烟推理
date: 2026-07-23 09:00:00
categories:
  - YOLODetect
tags:
  - YOLO
  - 目标检测
  - Ultralytics
  - 推理
  - 2026
---

目标：在正式训练之前，先用官方预训练权重对样例图跑一次检测，确认 GPU 推理链路是通的。这一步花不了几分钟，却能把「环境没配对」和「训练超参没调好」这两类问题彻底分开。

<!-- more -->

> 这是「YOLO 目标检测实战」的第 02 篇。完整目录见 [00 · 系列导读](/2026/07/21/YOLO目标检测实战-00-系列导读/)。

## 一、前置条件

- 已完成 [01 · 环境搭建](/2026/07/22/YOLO目标检测实战-01-Docker环境搭建/)；
- 存在预训练 `s` 档权重（如 `weights/yolo_s.pt`）与 `data/images/`（由 `scripts/00_download_assets.sh` 准备）。

## 二、执行

容器内：

```bash
bash scripts/01_smoke_detect.sh
```

等价于：

```bash
yolo detect predict \
  model=/workspace/weights/yolo_s.pt \
  source=/workspace/data/images \
  device=0 \
  project=/workspace/runs/detect \
  name=smoke \
  exist_ok=True
```

## 三、产物

可视化结果写到：

```text
runs/detect/smoke/
```

打开其中的标注图，应能看到 person / bus 等 COCO 类别框（样例图为 Ultralytics 常用的 `bus.jpg`）。

## 四、这一步在验证什么

| 检查项 | 说明 |
|--------|------|
| 权重可读 | 预训练权重路径与权限正确 |
| GPU 推理 | `device=0` 能跑通，而非静默落回 CPU |
| 写盘路径 | 挂载的 `runs/` 在宿主机也能看到输出 |

冒烟通过后，再进入微调；如果这里就失败，完全不必去排查训练超参——问题一定在环境或路径上。

## 下一步

链路通了，开始短训。→ [03 · COCO128 短训](/2026/07/24/YOLO目标检测实战-03-COCO128短训/)
