---
cover: /images/cover/yolo/train-coco128.webp
title: YOLO 目标检测实战（03）：COCO128 短训
date: 2026-07-24 09:00:00
categories:
  - YOLODetect
tags:
  - YOLO
  - 目标检测
  - 训练
  - COCO128
  - Ultralytics
  - 2026
---

目标：在 COCO128（128 张训练图）上对 `s` 档模型做一次短训，走通完整训练流水线。这一阶段指标不是重点——数据集太小，数字本来就会抖——**可复现和产物路径清晰**才是要拿到手的东西。

<!-- more -->

> 这是「YOLO 目标检测实战」的第 03 篇。完整目录见 [00 · 系列导读](/2026/07/21/YOLO目标检测实战-00-系列导读/)。

## 一、数据配置

训练使用本地 yaml：`data/datasets/coco128.local.yaml`。要点：

- `path` 固定为容器内 `/workspace/data/datasets/coco128`；
- `train` / `val` 均指向 `images/train2017`（COCO128 官方小集常见写法）；
- 含 COCO 80 类 `names`；去掉会触发联网下载的 `download` 字段。

这样即使训练时断网，也不会再去拉 zip。

## 二、执行

容器内（GPU 空闲）：

```bash
bash scripts/02_train_coco128.sh
```

默认超参（可按显存调整）：

| 参数 | 默认值 |
|------|--------|
| `imgsz` | 640 |
| `epochs` | 5 |
| `batch` | 16 |
| `workers` | 4 |
| `device` | 0 |
| `project` / `name` | `runs/train` / `coco128` |

## 三、产物

```text
runs/train/coco128/
├── weights/
│   ├── best.pt      # 后续 val / export / API 的核心
│   └── last.pt
├── results.csv
├── results.png
├── confusion_matrix*.png
└── train_batch*.jpg / val_batch*_pred.jpg ...
```

一次示例短训（5 epochs，仅作数量级参考，不同机器会有差异）：

| epoch | mAP50 | mAP50-95 |
|-------|-------|----------|
| 1 | ~0.74 | ~0.57 |
| 5 | ~0.75 | ~0.58 |

COCO128 极小，数字波动完全正常；关键是 `best.pt` 能稳定写出来。

## 四、训练侧注意点

- **shm**：compose 已给训练容器较大共享内存；仍报错就降 `workers`。
- **OOM**：优先降 `batch`，再考虑降 `imgsz`。
- **AMP**：Ultralytics 默认可开混合精度，有利于 16GB 级显存。

## 下一步

有了 `best.pt`，正式验证它。→ [04 · 验证与预测](/2026/07/25/YOLO目标检测实战-04-验证与预测/)
