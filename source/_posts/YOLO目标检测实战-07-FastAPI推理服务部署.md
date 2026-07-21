---
cover: /images/cover/yolo/fastapi-deploy.webp
title: YOLO 目标检测实战（07）：FastAPI 推理服务部署
date: 2026-07-28 09:00:00
categories:
  - YOLODetect
tags:
  - YOLO
  - 目标检测
  - FastAPI
  - 部署
  - 推理服务
  - 2026
---

目标：把检测能力封成 HTTP 服务——上传图片，返回 JSON 框或标注图，优先加载 TensorRT engine。至此，从环境到对外服务的一条链路就闭合了。

<!-- more -->

> 这是「YOLO 目标检测实战」的第 07 篇（收尾）。完整目录见 [00 · 系列导读](/2026/07/21/YOLO目标检测实战-00-系列导读/)。

## 一、服务职责

`api/main.py` 是一层薄封装：

- 启动时解析模型路径并 **warmup**（空图跑一次 `predict`，避免首请求卡住）；
- `GET /health`：返回状态、模型路径、后端后缀（`engine` / `pt` / `onnx`）；
- `POST /predict`：multipart 上传图片；可选 `conf`、`imgsz`、`return_image`。

### 模型加载优先级

1. 环境变量 `YOLO_MODEL`
2. `weights/best.engine`
3. `runs/train/coco128/weights/best.pt`
4. `weights/yolo_s.pt`

compose 里 `api` 服务默认设置：

```yaml
YOLO_MODEL=/workspace/weights/best.engine
```

宿主机端口映射为 **18080 → 容器 8000**（避免与本机常见 8000 占用冲突）。

## 二、启动方式

### 方式 A：compose（推荐）

在项目根目录：

```bash
docker compose -f docker/docker-compose.yml up -d api
```

### 方式 B：已在容器内

```bash
bash scripts/08_run_api.sh
```

监听 `0.0.0.0:8000`（compose 场景下由端口映射对外暴露）。

## 三、调用示例

健康检查：

```bash
curl -s http://127.0.0.1:18080/health
```

JSON 检测：

```bash
curl -s -F "file=@data/images/bus.jpg" \
  "http://127.0.0.1:18080/predict?conf=0.25"
```

返回字段大致包括：`model`、`latency_ms`、`count`、`boxes`（`xyxy` / `conf` / `cls` / `name`）。

返回标注 JPEG：

```bash
curl -s -F "file=@data/images/bus.jpg" \
  "http://127.0.0.1:18080/predict?return_image=true" \
  -o /tmp/bus_pred.jpg
```

交互文档：浏览器打开 `http://127.0.0.1:18080/docs`。

## 四、运维注意

| 点 | 说明 |
|----|------|
| GPU | API 容器同样声明了 NVIDIA 设备；无 GPU 时 engine / CUDA 路径会失败 |
| 模型缺失 | `/health` 或启动阶段会报找不到文件；确认 `weights/best.engine` 或改 `YOLO_MODEL` |
| 并发 | 当前实现为进程内单例模型，适合本地 demo；生产需再考虑进程数、队列与超时 |
| 安全 | 示例仅面向本机回环访问；**勿直接暴露公网**，且需自行加鉴权 |

## 五、系列收尾

至此，一条完整链路已经闭合：

```text
环境 → 冒烟 → 短训 → val/predict → ONNX 对齐 → TensorRT + 基准 → FastAPI
```

后续可以自行扩展：自有数据集与 Label Studio 标注、更长训练、批量评测接口，以及按业务把训练镜像与推理镜像拆开。

> YOLO 目标检测实战系列（8 篇）完。回到 [00 · 系列导读](/2026/07/21/YOLO目标检测实战-00-系列导读/) 可总览全流程。
