---
cover: /images/cover/yolo/series-overview.webp
title: YOLO 目标检测实战（00）：系列导读
date: 2026-07-21 09:00:00
categories:
  - YOLODetect
tags:
  - YOLO
  - 目标检测
  - Ultralytics
  - Docker
  - TensorRT
  - FastAPI
  - 2026
---

「跑通一个目标检测模型」听起来简单，但真正把它从环境、训练、评估一路带到能对外提供服务，中间有一堆坑：显卡驱动、CUDA 版本、共享内存、导出对齐、引擎版本绑定、服务预热……这个系列把这条链路完整走一遍，每一步都可复现、可回看。

<!-- more -->

> 这是「YOLO 目标检测实战」的第 00 篇（导读）。系列共 8 篇，以 **Ultralytics YOLO** 为例，串起 **Docker GPU 环境 → 冒烟推理 → COCO128 短训 → 验证/预测 → ONNX 导出对齐 → TensorRT 基准 → FastAPI 部署** 的完整闭环。文中路径统一用容器内 `/workspace` 或项目相对路径，硬件与版本号均以示例给出，不绑定具体机器或账号。

## 一、这个系列想解决什么

网上「YOLO 五分钟上手」的教程很多，但它们通常停在「我在自己机器上 predict 出了一张带框的图」。真正做工程时，你会连续遇到这些问题：

- **环境不可复现**：本机能跑，换台机器 / 换个同事就缺包、版本对不上。
- **训练一跑就崩**：共享内存不足、OOM、DataLoader 卡死。
- **导出后「悄悄跑偏」**：ONNX / TensorRT 导出成功了，但框和原模型对不上，没人发现。
- **部署踩预热坑**：第一个请求卡好几秒，或者 GPU 静默落回 CPU。

本系列的取向是：**先把每一步做对、做到能复现，再谈优化**。指标不是重点（用的是极小的 COCO128），链路正确、产物路径清晰才是。

## 二、系列目录

| 序号 | 文章 | 内容 |
|------|------|------|
| 01 | Docker GPU 环境搭建 | CUDA 镜像、compose、资产下载与环境验收 |
| 02 | 预训练模型冒烟推理 | 用预训练权重对样例图做 detect，确认推理链路 |
| 03 | COCO128 短训 | 5 epochs 微调，走通训练流水线与产物 |
| 04 | 验证与预测 | `val` + `predict`，看指标与可视化 |
| 05 | 导出 ONNX 与结果对齐 | ONNX 导出，PyTorch vs ONNX 框对齐检查 |
| 06 | TensorRT 导出与三后端基准 | FP16 engine、三后端延迟对比 |
| 07 | FastAPI 推理服务部署 | `/health`、`/predict`，Docker 起 API |

## 三、推荐阅读顺序

按编号 01 → 07 走一遍即可，每篇末尾都有「下一步」链接。如果你只关心部署，可以先读 01 打好环境，再直接跳到 06–07（前提是你已经有一份可用的 `best.pt` 或 `best.engine`）。

## 四、示例环境（脱敏）

| 项目 | 示例值 |
|------|--------|
| 宿主机 | Ubuntu + Docker + NVIDIA Container Toolkit |
| GPU | NVIDIA RTX 50 系（如 5080），驱动需支持 CUDA ≥ 12.8 |
| 镜像 | `yolo-lab:cu128`（CUDA 12.8 + PyTorch cu128 + Ultralytics + TensorRT 10.x） |
| 模型 | `Ultralytics` 官方预训练 `s` 档权重 |

> 说明：这里的版本号只是示例。新架构显卡（如 Blackwell）通常需要较新的 CUDA wheel，请以你自己镜像里实际装到的版本为准。包版本号（如 `ultralytics 8.x`）与「YOLOv8 模型」不是一回事，别混淆。

## 五、贯穿全系列的目录约定

后面每篇都假设仓库大致长这样，产物都落在挂载出来的目录里，宿主机可见：

```text
├── docker/           # Dockerfile + compose + entrypoint
├── scripts/          # 分步脚本（00 下载资产、01 冒烟、02 训练……）
├── api/              # FastAPI
├── data/
│   ├── images/       # 样例图
│   └── datasets/     # COCO128
├── weights/          # 预训练与导出权重
└── runs/             # 训练 / 验证 / 检测输出
```

## 六、脱敏约定

写这个系列（以及你自己复现时对外分享）建议守住几条线：

- 不出现宿主机绝对路径、用户名、内网地址或组织信息。
- 命令统一以**项目根目录**为当前工作目录；容器内工作目录为 `/workspace`。
- 端口、`batch`、`epochs` 等都是实验默认值，按本机资源调整即可。

准备好了就从环境开始。

> YOLO 目标检测实战第 00 篇完。下一篇：用 Docker 把 CUDA / PyTorch / Ultralytics / TensorRT 一次性固化成可复现的镜像。
