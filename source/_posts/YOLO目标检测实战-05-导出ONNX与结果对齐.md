---
cover: /images/cover/yolo/export-onnx.webp
title: YOLO 目标检测实战（05）：导出 ONNX 与结果对齐
date: 2026-07-26 09:00:00
categories:
  - YOLODetect
tags:
  - YOLO
  - 目标检测
  - ONNX
  - 模型导出
  - Ultralytics
  - 2026
---

目标：把 `best.pt` 导出为 ONNX，并用同一张图对比 PyTorch 与 ONNX 的检测框，确认导出没有「悄悄跑偏」。导出成功 ≠ 导出正确，这一篇的重点就是那道对齐检查。

<!-- more -->

> 这是「YOLO 目标检测实战」的第 05 篇。完整目录见 [00 · 系列导读](/2026/07/21/YOLO目标检测实战-00-系列导读/)。

## 一、为什么先做 ONNX

- ONNX 是跨框架部署常见的中间格式，也便于后续再转其他 runtime；
- 相对 TensorRT engine，ONNX 更易在不同机器间拷贝试跑（仍建议同环境复现）；
- 对齐脚本能在上 TensorRT 之前，先把导出问题拦下来。

## 二、导出

容器内：

```bash
bash scripts/04_export_onnx.sh
```

核心命令：

```bash
yolo export \
  model=/workspace/runs/train/coco128/weights/best.pt \
  format=onnx \
  imgsz=640 \
  device=0
```

Ultralytics 默认把 `best.onnx` 写在 `.pt` 同目录；脚本会再拷贝一份到：

```text
weights/best.onnx
```

方便后续基准与部署统一从 `weights/` 取文件。

## 三、对齐检查

```bash
python scripts/05_onnx_infer.py
# 或指定图片
python scripts/05_onnx_infer.py --image /workspace/data/images/bus.jpg
```

脚本逻辑简述：

1. 分别用 `best.pt` 与 `best.onnx` 推理同一张图（`conf=0.25`）；
2. 按**同类 + IoU ≥ 0.5** 贪心匹配框；
3. 打印匹配对数、平均 IoU、xyxy 平均绝对差。

经验阈值（脚本内）：

| 条件 | 结论 |
|------|------|
| 匹配 IoU 均值 ≥ 0.85 且匹配数合理 | OK：对齐良好 |
| ≥ 0.7 | OK：大致接近 |
| 更低或一侧空框 | WARN：需人工看图排查 |

数值后端（NMS、浮点）会有微小差异，完全一致的框坐标并不现实；关注的是「是否同一目标、框是否大体重合」。

## 四、产物清单

| 文件 | 用途 |
|------|------|
| `runs/train/.../weights/best.onnx` | 导出原始位置 |
| `weights/best.onnx` | 统一存放，给基准 / 对照用 |

## 下一步

ONNX 对齐没问题，再上 TensorRT 榨延迟。→ [06 · TensorRT 导出与三后端基准](/2026/07/27/YOLO目标检测实战-06-TensorRT导出与三后端基准/)
