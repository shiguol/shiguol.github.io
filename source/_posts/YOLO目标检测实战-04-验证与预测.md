---
cover: /images/cover/yolo/val-predict.webp
title: YOLO 目标检测实战（04）：验证与预测
date: 2026-07-25 09:00:00
categories:
  - YOLODetect
tags:
  - YOLO
  - 目标检测
  - 验证
  - 评估
  - Ultralytics
  - 2026
---

目标：用训练得到的 `best.pt` 做一次正式 `val`，再在样例图上 `predict`，确认微调权重确实可用、加载路径无误。

<!-- more -->

> 这是「YOLO 目标检测实战」的第 04 篇。完整目录见 [00 · 系列导读](/2026/07/21/YOLO目标检测实战-00-系列导读/)。

## 一、前置条件

- 已有 `runs/train/coco128/weights/best.pt`（见 [03 · 短训](/2026/07/24/YOLO目标检测实战-03-COCO128短训/)）；
- 本地数据 yaml 仍在：`data/datasets/coco128.local.yaml`。

## 二、执行

容器内：

```bash
bash scripts/03_val_test.sh
```

脚本分两步。

### 1. Val

```bash
yolo detect val \
  model=/workspace/runs/train/coco128/weights/best.pt \
  data=/workspace/data/datasets/coco128.local.yaml \
  device=0 \
  project=/workspace/runs/val \
  name=coco128 \
  exist_ok=True
```

输出目录示例：

```text
runs/val/coco128/
├── BoxPR_curve.png / BoxF1_curve.png ...
├── confusion_matrix.png
└── val_batch*_labels.jpg / val_batch*_pred.jpg
```

关注终端打印的 Precision / Recall / mAP50 / mAP50-95，并与训练曲线对照。

### 2. Predict

```bash
yolo detect predict \
  model=.../best.pt \
  source=/workspace/data/images \
  device=0 \
  project=/workspace/runs/detect \
  name=test_best \
  exist_ok=True
```

可视化在 `runs/detect/test_best/`。可以和冒烟结果 `smoke` 对比：短训前后框与分数的变化通常不大（数据量极小），但路径与权重加载应无误。

## 三、手动再跑一张（可选）

```bash
yolo detect predict \
  model=/workspace/runs/train/coco128/weights/best.pt \
  source=/workspace/data/images/bus.jpg \
  device=0 \
  project=/workspace/runs/detect \
  name=my_test \
  exist_ok=True
```

## 四、通过标准（本实验）

- `val` 正常结束并写出曲线图；
- `predict` 生成带框图片；
- 无 CUDA / 权重路径错误。

## 下一步

权重可用后，开始考虑跨框架部署。→ [05 · 导出 ONNX 与结果对齐](/2026/07/26/YOLO目标检测实战-05-导出ONNX与结果对齐/)
