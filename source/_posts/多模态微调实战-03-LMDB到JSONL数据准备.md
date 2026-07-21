---
cover: /images/cover/vlm/dataset-lmdb-jsonl.webp
title: 多模态微调实战（03）：从 LMDB 到 JSONL 的数据准备
date: 2026-07-23 09:00:00
categories:
  - VLMFinetune
tags:
  - 多模态
  - VLM
  - 微调
  - 数据准备
  - JSONL
  - OCR
  - 2026
---

多模态微调里，**数据格式比模型名字更容易卡住人**。ms-swift 期望的是「对话 JSONL + 图片路径」，而公开 OCR 数据集常常是 LMDB / TFRecord 等离线格式，中间需要一层转换。这一篇讲怎么把数据整理成训练框架能直接吃的样子。

<!-- more -->

> 这是「多模态微调实战」的第 03 篇。环境就绪后，数据是下一个门槛。

## 一、数据从哪来

本系列任务使用 ModelScope 上的车牌 OCR 数据（公开集，示例名：`ocr_plate`）：

- 完整规模大约：**训练 37 万 + 验证 4 万**；
- 原始形态多为 **LMDB**（图像二进制 + 标签字符串）；
- 建议流程：**先转一个小子集验证，再转全量**。

## 二、LMDB 里大概长什么样

常见键设计（示意）：

```text
num-samples          -> 样本总数
image-000000001      -> 图片二进制
label-000000001      -> 车牌字符串（UTF-8）
```

转换时要约定：

- 图片导出到哪里；
- JSONL 里写相对还是绝对路径（容器内建议统一成 `/workspace/...`）；
- 用户提示词是否固定（例如：「请识别图片中的车牌号码」）。

## 三、ms-swift 需要的 JSONL

每行一个 JSON，核心字段：

```json
{
  "messages": [
    {"role": "user", "content": "<image>请识别图片中的车牌号码"},
    {"role": "assistant", "content": "京A12345"}
  ],
  "images": ["/workspace/dataset/ocr_plate/images/000000001.jpg"]
}
```

注意：

1. `<image>` 占位要与 `images` 列表对应；
2. assistant 内容应是你希望模型最终输出的**规范格式**（不要混入解释性废话，除非业务需要）；
3. 路径必须在训练容器内可访问。

## 四、推荐两阶段转换

### 阶段 A：演示子集（强烈建议先做）

例如：训练 2000、验证 200。

```bash
python3 script/convert_lmdb_to_jsonl.py \
  --project-root /workspace \
  --train-samples 2000 \
  --val-samples 200
```

产出示例：

```text
dataset/ocr_plate/train.jsonl
dataset/ocr_plate/val.jsonl
dataset/ocr_plate/images/
```

用途：

- 验证转换正确；
- 快速跑通 LoRA + 评测；
- 暴露提示词 / 标签格式问题。

### 阶段 B：全量

去掉采样上限，或设置很大的 `train-samples` / `val-samples`：

```bash
python3 script/convert_lmdb_to_jsonl.py \
  --project-root /workspace \
  --train-samples 0 \
  --val-samples 0
# 具体参数以你脚本约定为准：0 或 -1 常表示「全部」
```

产出示例：

```text
dataset/ocr_plate/train_full.jsonl
dataset/ocr_plate/val_full.jsonl
dataset/ocr_plate/images_full/
```

磁盘粗算（量级）：

| 项目 | 大约 |
|------|------|
| 全量图片 | 2～3 GB |
| LMDB 原包 | 十数 GB |
| JSONL | 几十～上百 MB |

## 五、标签与提示词设计建议

车牌 OCR 很容易出现「模型其实认对了，但评测判错」：

| 问题 | 例子 | 建议 |
|------|------|------|
| 格式不一致 | `京 A·12345` vs `京A12345` | 训练标签统一规范化 |
| 基座爱补全省份 | 标签无省简称，模型硬加 | 提示词明确「只输出车牌字符，不要解释」 |
| 大小写 / 字母 O 与 0 | `O` vs `0` | 数据清洗或评测时定义等价规则 |

演示阶段哪怕指标夸张地高，也要怀疑是不是「验证集太简单 / 与训练过于同分布」。全量验证才更有说服力。

## 六、快速自检

```bash
# 行数
wc -l dataset/ocr_plate/train.jsonl dataset/ocr_plate/val.jsonl

# 抽查一条
head -n 1 dataset/ocr_plate/train.jsonl | python3 -m json.tool

# 图片是否真实存在
python3 - <<'PY'
import json
from pathlib import Path
line=Path('dataset/ocr_plate/train.jsonl').read_text().splitlines()[0]
obj=json.loads(line)
p=Path(obj['images'][0].replace('/workspace','.'))
print(obj['messages'][-1]['content'], p.exists(), p)
PY
```

## 七、小结

数据准备完成的标志：

1. JSONL 能被 Python 正常解析；
2. 图片路径在容器内可读；
3. 标签格式与业务评测口径一致；
4. 已有「子集」与「全量」两套文件，互不影响。

> 多模态微调实战第 03 篇完。下一篇：用两千级样本先把 LoRA 跑通，证明流水线可用。
