---
cover: /images/cover/ai/first-agent.webp
title: 动手构建你的第一个 Agent：从零到"能自己干活"
date: 2026-06-24 13:15:37
categories:
  - AI
tags:
- AI
- 编程
- 2026
- Agent
- 实战
- 工具调用
- Python
---

前面 6 篇文章，我们学了发动机原理（Loop）、车架设计（Harness）、接口标准（MCP）、零件品牌对比（框架）、建筑规范（设计模式）。你已经了解了 Agent 的方方面面——但你从来没有亲手造过一个。今天，我们开箱，把零件一个个组装起来，让一个 Agent 真正跑起来。不用任何框架，纯 Python 手写，你会亲眼看到前面讲的每一个概念在代码中是怎么工作的。

<!-- more -->

> 这是「小白讲 AI」系列的第 19 篇。第 12 篇我们学了怎么调用 AI API（单次对话）。这一篇我们要在那个基础上，把"单次对话"升级成"自主循环"——让 AI 不只是回答你一次，而是自己持续工作直到任务完成。

## 一、我们要造什么？

今天的目标是构建一个 **"研究助手 Agent"**——你给它一个研究问题，它会：

1. 自主搜索互联网上的相关信息
2. 阅读搜索结果中的关键内容
3. 整理信息并生成一份结构化的研究报告
4. 全程自主决策，你不需要一步步指导它

比如你问："2026 年最流行的 AI Agent 框架有哪些？"它会自己去搜索、阅读、比较、整理，最后给你一份有条有理的报告。

**我们不使用任何框架**——所有代码都是手写的。这样你能清楚地看到 Agent 的每一个组件在做什么。（下一篇我们再用框架重构，对比两种方式的差异。）

## 二、技术准备

你需要：

- **Python 3.10+**
- **Anthropic SDK**：`pip install anthropic`
- **一个 Claude API Key**（参考第 12 篇的获取方法）

```bash
# 安装依赖
pip install anthropic httpx

# 设置 API Key
export ANTHROPIC_API_KEY="你的API Key"
```

## 三、Step 1：搭建最简单的 Loop

还记得第 15 篇讲的 Agent Loop 吗？Plan → Execute → Observe → Reflect → Decide。我们先实现一个最简版本。

```python
import anthropic
import json

client = anthropic.Anthropic()

def run_agent(user_task: str, max_steps: int = 10):
    """运行一个最简单的 Agent Loop"""
    
    # System Prompt：告诉模型它是一个研究助手
    system_prompt = """你是一个研究助手 Agent。用户会给你一个研究问题，
你需要通过搜索和阅读来收集信息，最终生成一份研究报告。

你可以使用以下工具：
- search：搜索互联网
- fetch_url：获取网页内容

当你认为信息足够时，直接输出最终的研究报告。
在报告的开头写上 [报告完成]。"""
    
    # 对话历史（State Management）
    messages = [{"role": "user", "content": user_task}]
    
    # Agent Loop 开始
    for step in range(max_steps):
        print(f"\n--- 第 {step + 1} 步 ---")
        
        # 调用模型（Execute）
        response = client.messages.create(
            model="claude-sonnet-4-6-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
            tools=get_tools(),  # 工具注册表
        )
        
        # 解析响应（Observe）
        # 检查模型是否想调用工具
        if response.stop_reason == "tool_use":
            # 模型想调用工具
            tool_results = handle_tool_calls(response)
            
            # 把模型的回复和工具结果都加入历史
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
            
        elif response.stop_reason == "end_turn":
            # 模型认为任务完成，输出最终结果
            final_text = extract_text(response)
            print(f"\n{'='*50}")
            print("Agent 完成任务！")
            print(f"{'='*50}")
            print(final_text)
            return final_text
    
    # 熔断：超过最大步数（Bounded Execution）
    print(f"\n⚠️ Agent 在 {max_steps} 步内未完成任务")
    return "任务未在限制步数内完成"
```

看到了吗？这段代码里藏着前面几篇的核心概念：

- **Loop**（第 15 篇）：`for step in range(max_steps)` 就是 Agent 的心跳循环
- **Bounded Execution**（第 14 篇）：`max_steps = 10` 就是熔断机制
- **State Management**（第 14 篇）：`messages` 列表存储了完整的对话状态
- **Context Assembly**（第 13 篇）：每次调用模型时，把 system_prompt + messages 组装成上下文

## 四、Step 2：注册工具（Tool Registry）

第 14 篇讲过，Tool Registry 是 Harness 的第一个组件。现在我们来定义 Agent 能用的工具。

```python
def get_tools():
    """工具注册表：定义 Agent 可以使用的工具"""
    return [
        {
            "name": "search",
            "description": "在互联网上搜索信息。输入搜索关键词，返回相关结果摘要。",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词"
                    }
                },
                "required": ["query"]
            }
        },
        {
            "name": "fetch_url",
            "description": "获取指定网页的文本内容。用于深入阅读搜索结果中的链接。",
            "input_schema": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "要获取内容的网页 URL"
                    }
                },
                "required": ["url"]
            }
        }
    ]
```

每个工具的定义包含三个要素：
- **name**：工具名称
- **description**：工具描述（模型根据这个描述来决定什么时候该用这个工具）
- **input_schema**：参数格式（JSON Schema）

这就是 MCP 的 Tool 原语（第 16 篇）的简化版本——MCP 用的是同样的 JSON Schema 格式来描述工具。

## 五、Step 3：实现工具执行

定义了工具"菜单"之后，还需要实现工具的实际执行逻辑。

```python
import httpx

def execute_tool(tool_name: str, tool_input: dict) -> str:
    """执行工具并返回结果"""
    
    if tool_name == "search":
        return do_search(tool_input["query"])
    elif tool_name == "fetch_url":
        return do_fetch_url(tool_input["url"])
    else:
        return f"未知工具：{tool_name}"


def do_search(query: str) -> str:
    """简易搜索实现（使用 DuckDuckGo）"""
    try:
        # 使用 DuckDuckGo 的即时回答 API（免费，无需 API Key）
        resp = httpx.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": 1},
            timeout=10
        )
        data = resp.json()
        
        results = []
        # 提取相关话题
        for topic in data.get("RelatedTopics", [])[:5]:
            if "Text" in topic:
                results.append(topic["Text"])
            elif "Topics" in topic:  # 嵌套话题
                for sub in topic["Topics"][:2]:
                    if "Text" in sub:
                        results.append(sub["Text"])
        
        if data.get("Abstract"):
            results.insert(0, f"摘要：{data['Abstract']}")
        
        if not results:
            return f"搜索 '{query}' 未找到直接结果。请尝试更具体的关键词。"
        
        return f"搜索 '{query}' 的结果：\n" + "\n".join(
            f"- {r}" for r in results[:8]
        )
    except Exception as e:
        return f"搜索失败：{str(e)}"


def do_fetch_url(url: str) -> str:
    """获取网页内容（截取前 3000 字符）"""
    try:
        resp = httpx.get(url, timeout=15, follow_redirects=True)
        text = resp.text
        # 简单的 HTML 标签清理
        import re
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        
        # 截断（Context Engineering：控制工具返回值的大小）
        if len(text) > 3000:
            text = text[:3000] + "\n...[内容已截断]"
        
        return f"网页内容：\n{text}"
    except Exception as e:
        return f"获取网页失败：{str(e)}"
```

注意 `do_fetch_url` 中的截断逻辑——这就是第 13 篇 Context Engineering 在实战中的体现。工具返回的内容可能很长，如果全部放进上下文，会挤占有限的"注意力预算"。截断到 3000 字符是一个实用的策略。

## 六、Step 4：处理工具调用

当模型决定调用工具时，我们需要解析它的请求、执行工具、然后把结果返回给模型。

```python
def handle_tool_calls(response) -> list:
    """处理模型发出的工具调用请求"""
    tool_results = []
    
    for block in response.content:
        if block.type == "tool_use":
            tool_name = block.name
            tool_input = block.input
            tool_id = block.id
            
            print(f"  🔧 调用工具：{tool_name}")
            print(f"     参数：{json.dumps(tool_input, ensure_ascii=False)}")
            
            # 执行工具
            result = execute_tool(tool_name, tool_input)
            
            # 简要显示结果
            preview = result[:100] + "..." if len(result) > 100 else result
            print(f"     结果：{preview}")
            
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": result
            })
    
    return tool_results


def extract_text(response) -> str:
    """从模型响应中提取文本内容"""
    texts = []
    for block in response.content:
        if hasattr(block, "text"):
            texts.append(block.text)
    return "\n".join(texts)
```

## 七、Step 5：加上 Guardrails（护栏）

第 14 篇讲了四层护栏。在我们的简易 Agent 中，我们实现最关键的两层：

```python
# 工具调用护栏：限制工具调用频率
tool_call_counts = {}
MAX_CALLS_PER_TOOL = 5

def guarded_execute_tool(tool_name: str, tool_input: dict) -> str:
    """带护栏的工具执行"""
    
    # 护栏：检查调用次数
    tool_call_counts[tool_name] = tool_call_counts.get(tool_name, 0) + 1
    if tool_call_counts[tool_name] > MAX_CALLS_PER_TOOL:
        return (f"⚠️ 工具 {tool_name} 已调用 {MAX_CALLS_PER_TOOL} 次，"
                "达到上限。请使用已有信息完成任务。")
    
    # 护栏：URL 白名单（简易版）
    if tool_name == "fetch_url":
        url = tool_input.get("url", "")
        blocked = ["localhost", "127.0.0.1", "internal", ".local"]
        if any(b in url for b in blocked):
            return "⚠️ 安全限制：不允许访问内部网络地址。"
    
    return execute_tool(tool_name, tool_input)
```

这段代码实现了两个护栏：
- **工具调用频率限制**（Bounded Execution）：同一个工具最多调用 5 次
- **URL 安全过滤**（Guardrail Layering 的工具调用护栏）：阻止访问内部网络

## 八、完整代码整合

把上面所有部分拼在一起，就是一个完整的 Agent：

```python
#!/usr/bin/env python3
"""
研究助手 Agent - 小白讲 AI 第 19 篇配套代码
纯手写实现，不使用任何 Agent 框架
"""

import anthropic
import httpx
import json
import re

client = anthropic.Anthropic()

# ==================== Tool Registry ====================

def get_tools():
    return [
        {
            "name": "search",
            "description": "在互联网上搜索信息。返回相关结果摘要。",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"}
                },
                "required": ["query"]
            }
        },
        {
            "name": "fetch_url",
            "description": "获取网页的文本内容。用于深入阅读搜索结果。",
            "input_schema": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "网页 URL"}
                },
                "required": ["url"]
            }
        }
    ]

# ==================== Tool Execution ====================

tool_call_counts = {}
MAX_CALLS_PER_TOOL = 5

def execute_tool(name: str, input: dict) -> str:
    # Guardrail: 调用频率限制
    tool_call_counts[name] = tool_call_counts.get(name, 0) + 1
    if tool_call_counts[name] > MAX_CALLS_PER_TOOL:
        return f"⚠️ {name} 已达调用上限 ({MAX_CALLS_PER_TOOL} 次)。"

    if name == "search":
        return do_search(input["query"])
    elif name == "fetch_url":
        return do_fetch_url(input["url"])
    return f"未知工具：{name}"

def do_search(query: str) -> str:
    try:
        resp = httpx.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": 1},
            timeout=10
        )
        data = resp.json()
        results = []
        if data.get("Abstract"):
            results.append(f"摘要：{data['Abstract']}")
        for topic in data.get("RelatedTopics", [])[:5]:
            if "Text" in topic:
                results.append(topic["Text"])
        if not results:
            return f"搜索 '{query}' 无直接结果，请换个关键词。"
        return "\n".join(f"- {r}" for r in results[:8])
    except Exception as e:
        return f"搜索失败：{e}"

def do_fetch_url(url: str) -> str:
    # Guardrail: URL 安全过滤
    if any(b in url for b in ["localhost", "127.0.0.1", ".local"]):
        return "⚠️ 安全限制：不允许访问内部地址。"
    try:
        resp = httpx.get(url, timeout=15, follow_redirects=True)
        text = resp.text
        text = re.sub(r'<script.*?</script>', '', text, flags=re.DOTALL)
        text = re.sub(r'<style.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        # Context Engineering: 截断过长内容
        return text[:3000] + ("\n...[已截断]" if len(text) > 3000 else "")
    except Exception as e:
        return f"获取失败：{e}"

# ==================== Agent Loop ====================

def run_agent(task: str, max_steps: int = 10):
    system = """你是一个研究助手 Agent。用户给你一个研究问题，
你需要通过搜索和阅读来收集信息，然后生成一份结构化的研究报告。

工作流程：
1. 先思考需要搜索什么关键词
2. 搜索并阅读结果
3. 如果信息不够，继续搜索
4. 信息足够后，生成报告

报告格式要求：
- 有清晰的标题和小节
- 引用信息来源
- 客观呈现事实，不编造内容"""

    messages = [{"role": "user", "content": task}]
    tool_call_counts.clear()

    for step in range(max_steps):
        print(f"\n🔄 第 {step + 1}/{max_steps} 步")

        response = client.messages.create(
            model="claude-sonnet-4-6-20250514",
            max_tokens=4096,
            system=system,
            messages=messages,
            tools=get_tools(),
        )

        if response.stop_reason == "tool_use":
            # 处理工具调用
            results = []
            for block in response.content:
                if block.type == "tool_use":
                    print(f"  🔧 {block.name}({json.dumps(block.input, ensure_ascii=False)[:80]})")
                    result = execute_tool(block.name, block.input)
                    results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result
                    })
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": results})

        elif response.stop_reason == "end_turn":
            # 任务完成
            final = "\n".join(
                b.text for b in response.content if hasattr(b, "text")
            )
            print(f"\n{'='*50}")
            print("✅ Agent 完成任务！")
            print(f"{'='*50}\n")
            print(final)
            return final

    print(f"\n⚠️ 达到最大步数 ({max_steps})，任务未完成。")
    return None


# ==================== 运行 ====================

if __name__ == "__main__":
    run_agent("2026 年最流行的 AI Agent 框架有哪些？请对比它们的优缺点。")
```

## 九、运行效果

运行这个脚本，你会看到类似这样的输出：

```
🔄 第 1/10 步
  🔧 search({"query": "2026 AI Agent frameworks popular"})

🔄 第 2/10 步
  🔧 search({"query": "LangGraph vs CrewAI vs OpenAI Agents SDK 2026"})

🔄 第 3/10 步
  🔧 fetch_url({"url": "https://..."})

🔄 第 4/10 步
  🔧 search({"query": "Microsoft Agent Framework AutoGen 2026"})

🔄 第 5/10 步
==================================================
✅ Agent 完成任务！
==================================================

# 2026 年主流 AI Agent 框架对比报告
...
```

Agent 自主决定了搜索什么、阅读什么、什么时候信息足够了可以开始写报告。你没有一步步指导它——它自己完成了整个过程。

## 十、回顾：代码中的概念对应

最后，让我们把代码和前面 6 篇的概念对应起来：

| 概念 | 对应代码 | 篇目 |
|---|---|---|
| Context Assembly | `system` + `messages` 组装 | 第 13 篇 |
| 上下文截断 | `text[:3000]` | 第 13 篇 |
| Tool Registry | `get_tools()` | 第 14 篇 |
| Guardrails | `MAX_CALLS_PER_TOOL`、URL 过滤 | 第 14 篇 |
| State Management | `messages` 列表、`tool_call_counts` | 第 14 篇 |
| Bounded Execution | `max_steps = 10` | 第 14 篇 |
| Agent Loop | `for step in range(max_steps)` | 第 15 篇 |
| Execute → Observe → Decide | 调用模型 → 解析响应 → 判断是调工具还是结束 | 第 15 篇 |
| Tool Schema (类似 MCP) | `input_schema` 用 JSON Schema 定义 | 第 16 篇 |
| 不用框架，手写 Harness | 整个脚本 | 第 17 篇 |
| Autonomous 模式 | 整体架构 | 第 18 篇 |

**每一个我们讲过的概念，都在这 100 行代码里找到了对应。** 这就是为什么我们要先讲 6 篇理论再动手——理解了概念之后，代码就不再是"照着抄"，而是"每一行都知道为什么这么写"。

## 十一、这个 Agent 还缺什么？

我们手写的这个 Agent 能跑，但离"生产级"还差很多。它缺少：

1. **外循环反思**：Agent 跑到一半不会"回头看看做得对不对"
2. **对话历史压缩**：如果步数很多，messages 列表会越来越长
3. **错误重试**：工具调用失败就直接返回错误信息，没有自动重试
4. **持久化**：Agent 的状态全在内存里，程序一退出就丢了
5. **可观测性**：没有 Traces 和 Spans，难以分析性能瓶颈
6. **MCP 集成**：工具是硬编码的，不能动态发现

这些正是**框架**帮你解决的问题。下一篇，我们会用 MCP 让这个 Agent 的工具能力指数级扩展，并引入框架来对比差异。

## 总结

今天我们从零手写了一个能自主工作的 Agent，它虽然只有 100 多行代码，但包含了 Agent 的所有核心组件：

- **Agent Loop**：持续循环直到任务完成或触发熔断
- **Tool Registry + Execution**：定义工具、解析调用、执行并返回结果
- **Context Assembly**：组装 System Prompt + 对话历史 + 工具结果
- **Guardrails**：工具调用频率限制 + URL 安全过滤
- **Bounded Execution**：最大步数限制（熔断器）
- **State Management**：对话历史和工具调用计数

**先理解，再使用框架。** 当你亲手写过一遍 Agent 的每个组件之后，再去用 LangGraph 或 CrewAI，你就不是"被动使用"，而是"主动选择"——你知道框架在帮你做什么，也知道什么时候该绕过框架自己写。

---

## 延伸阅读

1. **[Anthropic Claude API 文档 - Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)** —— Claude 工具调用的完整 API 参考。
2. **[Building effective agents - Anthropic](https://www.anthropic.com/engineering/building-effective-agents)** —— 从简单 Agent 到生产级系统的进阶指南。
3. **[本文完整代码](https://github.com/shiguol/agent-tutorial)** —— 如果你想直接运行代码，可以在这里找到。

---

> 小白讲 AI 系列第 19 篇完。下一篇是系列的最终章——我们要让这个 Agent "联网"：通过 MCP 接入外部工具生态，加入多 Agent 协作，并引入 LangGraph 框架重构，看看从"手写"到"框架"的差异有多大。
