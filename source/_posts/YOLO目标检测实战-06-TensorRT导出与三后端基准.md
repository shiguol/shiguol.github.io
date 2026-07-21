---
cover: /images/cover/yolo/tensorrt-bench.webp
title: YOLO 目标检测实战（06）：TensorRT 导出与三后端基准
date: 2026-07-27 09:00:00
categories:
  - YOLODetect
tags:
  - YOLO
  - 目标检测
  - TensorRT
  - 性能基准
  - Ultralytics
  - 2026
---

目标：导出 FP16 TensorRT engine，并在同一张图上对比 **PyTorch / ONNX / TensorRT** 三个后端的平均延迟，看看引擎到底快在哪。

<!-- more -->

> 这是「YOLO 目标检测实战」的第 06 篇。完整目录见 [00 · 系列导读](/2026/07/21/YOLO目标检测实战-00-系列导读/)。

## 一、导出 TensorRT

容器内需已安装 `tensorrt`（镜像已 pin `tensorrt-cu12`；脚本在缺失时会尝试安装固定版本）。

```bash
bash scripts/06_export_tensorrt.sh
```

关键参数：

```bash
yolo export \
  model=/workspace/runs/train/coco128/weights/best.pt \
  format=engine \
  imgsz=640 \
  device=0 \
  quantize=16 \
  workspace=4
```

说明：

- `quantize=16` → FP16 engine（新卡上常用默认，不必再传已弃用的 `half` 写法）；
- `workspace=4`：构建时的工作空间（GB 量级），可按显存调整；
- 生成的 `best.engine` 会拷到 `weights/best.engine`。

> **注意**：`.engine` 与 GPU 架构 / TensorRT 版本强绑定，换卡或换 TRT 大版本通常需要重新 export。别把 engine 当成能到处拷的通用文件。

## 二、用 engine 做一次预测（可选）

```bash
yolo detect predict \
  model=/workspace/weights/best.engine \
  source=/workspace/data/images/bus.jpg \
  device=0 \
  project=/workspace/runs/detect \
  name=trt_test \
  exist_ok=True
```

## 三、三后端延迟基准

```bash
python scripts/07_bench_backends.py
# 可调 warmup / 迭代次数
python scripts/07_bench_backends.py --warmup 20 --iters 100
```

默认权重路径：

| 后端 | 路径 |
|------|------|
| PyTorch | `runs/train/coco128/weights/best.pt` |
| ONNX | `weights/best.onnx` |
| TensorRT | `weights/best.engine` |

输出形如（数值因 GPU / 驱动 / 是否独占而异，此处不写死绝对毫秒）：

```text
[PyTorch]  ... avg=xx.xx ms/img  fps≈..  dets=N
[ONNX]     ...
[TensorRT] ...
```

解读建议：

1. 先看 TensorRT 是否明显快于 PyTorch（FP16 + engine 常见收益）；
2. ONNX（经 Ultralytics + onnxruntime-gpu）介于两者之间或接近其一，都属正常；
3. 比较时尽量保证 GPU 空闲，并保留足够 `warmup`，避免把首次建引擎 / 首次推理的开销算进均值。

## 四、这一步结束后你应有

```text
weights/
├── yolo_s.pt
├── best.onnx
└── best.engine    # API 默认优先加载
```

## 下一步

有了最快的 engine，把它封成服务。→ [07 · FastAPI 推理服务部署](/2026/07/28/YOLO目标检测实战-07-FastAPI推理服务部署/)
