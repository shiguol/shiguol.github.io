---
cover: /images/cover/vlm/lora-demo-run.webp
title: 多模态微调实战（04）：小规模 LoRA 试跑，先证明流程可用
date: 2026-07-24 09:00:00
categories:
  - VLMFinetune
tags:
  - 多模态
  - VLM
  - 微调
  - LoRA
  - 显存优化
  - ms-swift
  - 2026
---

在上全量之前，先用 **两千级样本** 把 LoRA 跑通。这一步的目标不是刷榜，而是回答三个问题：命令能不能跑完？显存是否稳定？验证指标有没有「方向正确」的提升？

<!-- more -->

> 这是「多模态微调实战」的第 04 篇。先小后大的「小」，就在这一篇。

## 一、训练命令骨架

核心是 `swift sft`。下面是一组在约 16GB 单卡上验证过的参数思路：

```bash
PYTORCH_ALLOC_CONF=expandable_segments:True \
IMAGE_MAX_TOKEN_NUM=512 \
MAX_PIXELS=802816 \
CUDA_VISIBLE_DEVICES=0 \
swift sft \
  --model /workspace/model/Qwen3-VL-4B-Instruct \
  --dataset /workspace/dataset/ocr_plate/train.jsonl \
  --val_dataset /workspace/dataset/ocr_plate/val.jsonl \
  --tuner_type lora \
  --torch_dtype bfloat16 \
  --num_train_epochs 3 \
  --per_device_train_batch_size 1 \
  --per_device_eval_batch_size 1 \
  --attn_impl sdpa \
  --learning_rate 1e-4 \
  --lora_rank 8 \
  --lora_alpha 32 \
  --target_modules all-linear \
  --freeze_vit true \
  --freeze_aligner true \
  --gradient_checkpointing true \
  --vit_gradient_checkpointing false \
  --gradient_accumulation_steps 8 \
  --eval_steps 100 \
  --save_steps 100 \
  --save_total_limit 3 \
  --logging_steps 10 \
  --max_length 2048 \
  --output_dir /workspace/output/ocr_plate_lora \
  --warmup_ratio 0.05 \
  --dataset_num_proc 4 \
  --dataloader_num_workers 2
```

实践中通常包一层脚本，例如 `bash script/train_lora.sh`。

## 二、超参怎么理解

| 参数 | 取值思路 | 为什么 |
|------|----------|--------|
| `tuner_type=lora` | LoRA | 16GB 友好 |
| `freeze_vit / freeze_aligner` | true | OCR 更偏「读图后对齐文本」，先冻视觉侧降显存、稳训练 |
| `lora_rank / alpha` | 8 / 32 | 常见起点；不够再加大 rank |
| `batch=1` + `grad_accum=8` | 等效 8 | 显存不够就堆累积步数 |
| `gradient_checkpointing` | true | 用时间换显存 |
| `IMAGE_MAX_TOKEN_NUM` | 512 | 限制视觉 token，防 OOM |
| `MAX_PIXELS` | ~80 万 | 约 896×896 量级；OOM 可减半 |
| `attn_impl` | `sdpa` | 无 flash-attn 时的稳妥选择 |
| `epochs` | 3 | 小数据集足够观察收敛 |

## 三、显存与耗时量级

一次演示集实践的观察（供对照）：

| 项目 | 量级 |
|------|------|
| 峰值显存 | 约 9GB / 16GB |
| 数据规模 | 2k 训练 × 3 epoch |
| 耗时 | 大约几十分钟 |

若一上来就 OOM，按这个顺序降级：

1. `MAX_PIXELS` 降到约一半；
2. `IMAGE_MAX_TOKEN_NUM` 再降；
3. `lora_rank` 降到 4；
4. 确认没有其他进程占 GPU。

## 四、训练过程你会看到什么

正常日志大致包括：

1. 加载基座与 processor；
2. 注入 LoRA（可训练参数通常只有总参数的很小比例）；
3. 周期性打印 `loss` / `token_acc` / `learning_rate`；
4. 按 `save_steps` 写出 `checkpoint-xxx`。

输出目录示例：

```text
output/ocr_plate_lora/
└── v*-YYYYMMDD-HHMMSS/
    ├── checkpoint-100/
    ├── checkpoint-200/
    ├── ...
    ├── logging.jsonl
    └── args.json
```

LoRA checkpoint 内通常有：

- `adapter_model.safetensors`
- `adapter_config.json`
- `trainer_state.json`
- （完整续训还需要）`optimizer.pt` / `scheduler.pt` 等

## 五、小规模成功的判定

不要只看 loss 下降。至少做三件事：

1. 训练能完整跑完，无 CUDA error；
2. 验证集上用同一脚本评测（见下一篇）；
3. 抽几张图人工看输出是否「格式正确」。

若演示集 Exact Match 从个位数飙到接近满分，通常说明：提示词与标签格式对齐了，模型学会了「按你的规范吐车牌」。但这**不能**直接等价于全量场景的泛化，它只证明：**流水线是通的**。

## 六、小结

小规模试跑完成标志：

- 有可用的 LoRA checkpoint；
- 显存策略已确认；
- 准备进入「前后对比评测」。

> 多模态微调实战第 04 篇完。下一篇：把「微调前 vs 微调后」用同一套指标摆到一张表上。
