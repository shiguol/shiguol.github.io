---
title: 实战进阶：用 MCP 打造多工具 Agent
date: 2026-06-24 13:18:01
categories:
  - AI
tags:
  - AI
  - 编程
  - 2026
---

上一篇我们手写了一个"单机游戏"式的 Agent——工具是自己定义的、能力是固定的，就像一个只能在自家小区逛的孩子。今天我们要让它"联网"——通过 MCP 协议接入外部工具生态，瞬间获得读写文件、查询数据库、操作 GitHub 等成千上万种能力。就像游戏角色走出新手村，接入了整个世界地图，可以接任务、买装备、组队打副本。

<!-- more -->

> 这是「小白讲 AI」系列的第 20 篇，也是 Agent 系列的最终章。从第 5 篇的一条 Prompt，到今天用 MCP 打造多工具 Agent——我们走了一段不短的路。这一篇既是实战教程，也是对整个系列的总结和回顾。

## 一、上一篇的 Agent 缺什么？

回顾一下第 19 篇手写的研究助手 Agent——它能跑，但有几个明显的限制：

1. **工具是硬编码的**：只有 `search` 和 `fetch_url` 两个工具，想加新工具就得改代码
2. **不能操作本地文件**：Agent 查到了信息却没法保存下来
3. **单打独斗**：只有一个 Agent 在干活，没有分工协作
4. **代码量随复杂度增长**：工具越多、逻辑越复杂，手写代码越难维护

今天我们要解决这些问题：
- 用 **MCP** 让 Agent 动态发现和使用工具
- 接入 **文件系统 MCP Server** 让 Agent 能读写文件
- 实现简单的 **多 Agent 协作**
- 引入 **LangGraph 框架** 对比手写代码的差异

## 二、MCP Client 集成

第 16 篇我们从概念上理解了 MCP 的三个角色（Host / Client / Server）。现在来在代码中实现 Client 端。

### 安装 MCP SDK

```bash
pip install mcp anthropic
```

### 连接 MCP Server

我们先连接一个本地的文件系统 MCP Server，让 Agent 能读写文件。

```python
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from contextlib import AsyncExitStack

class MCPManager:
    """管理 MCP Server 连接和工具发现"""
    
    def __init__(self):
        self.sessions = {}      # server_name -> session
        self.tools = {}         # tool_name -> (session, tool_schema)
        self.exit_stack = AsyncExitStack()
    
    async def connect_server(self, name: str, command: str, args: list):
        """连接一个 MCP Server"""
        params = StdioServerParameters(command=command, args=args)
        
        # 启动 Server 进程并建立连接
        stdio_transport = await self.exit_stack.enter_async_context(
            stdio_client(params)
        )
        read_stream, write_stream = stdio_transport
        session = await self.exit_stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )
        await session.initialize()
        
        self.sessions[name] = session
        
        # 🔑 工具动态发现——这就是 MCP 的核心价值
        tools = await session.list_tools()
        for tool in tools.tools:
            self.tools[tool.name] = (session, tool)
            print(f"  📦 发现工具：{tool.name} — {tool.description[:60]}")
        
        print(f"✅ 已连接 Server '{name}'，发现 {len(tools.tools)} 个工具\n")
    
    async def call_tool(self, tool_name: str, arguments: dict):
        """调用一个 MCP 工具"""
        if tool_name not in self.tools:
            return f"⚠️ 未知工具：{tool_name}"
        
        session, _ = self.tools[tool_name]
        result = await session.call_tool(tool_name, arguments)
        
        # 提取文本内容
        texts = [c.text for c in result.content if hasattr(c, "text")]
        return "\n".join(texts) if texts else "（工具无返回内容）"
    
    def get_tools_for_llm(self) -> list:
        """把 MCP 工具转换成 Claude API 的工具格式"""
        llm_tools = []
        for name, (_, tool) in self.tools.items():
            llm_tools.append({
                "name": name,
                "description": tool.description or "",
                "input_schema": tool.inputSchema
            })
        return llm_tools
    
    async def cleanup(self):
        await self.exit_stack.aclose()
```

注意 `connect_server` 方法中的 `list_tools()` 调用——这就是 MCP 的**工具动态发现**。Agent 不需要预先知道 Server 有哪些工具，连接之后一问就知道了。第 19 篇里我们手写了 `get_tools()` 函数来硬编码工具列表；现在 MCP 帮我们自动完成了这一步。

## 三、升级 Agent：从硬编码到 MCP

现在把第 19 篇的 Agent 改造为使用 MCP 工具。

```python
import anthropic
import json

client = anthropic.Anthropic()

async def run_mcp_agent(task: str, mcp: MCPManager, max_steps: int = 15):
    """使用 MCP 工具的 Agent"""
    
    system = """你是一个研究助手 Agent。你可以使用提供的工具来：
- 搜索互联网获取信息
- 读写本地文件来保存研究成果

工作流程：
1. 分析用户的研究需求
2. 使用搜索工具收集信息
3. 整理信息，生成结构化报告
4. 将报告保存为本地文件
5. 向用户汇报完成情况"""

    # 从 MCP 动态获取工具列表（不再是硬编码！）
    tools = mcp.get_tools_for_llm()
    print(f"📋 Agent 可用工具：{[t['name'] for t in tools]}\n")
    
    messages = [{"role": "user", "content": task}]
    
    for step in range(max_steps):
        print(f"🔄 第 {step + 1}/{max_steps} 步")
        
        response = client.messages.create(
            model="claude-sonnet-4-6-20250514",
            max_tokens=4096,
            system=system,
            messages=messages,
            tools=tools,
        )
        
        if response.stop_reason == "tool_use":
            results = []
            for block in response.content:
                if block.type == "tool_use":
                    print(f"  🔧 {block.name}({json.dumps(block.input, ensure_ascii=False)[:80]})")
                    
                    # 通过 MCP 调用工具（不再是本地函数！）
                    result = await mcp.call_tool(block.name, block.input)
                    
                    preview = result[:100] + "..." if len(result) > 100 else result
                    print(f"     → {preview}")
                    
                    results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result
                    })
            
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": results})
            
        elif response.stop_reason == "end_turn":
            final = "\n".join(
                b.text for b in response.content if hasattr(b, "text")
            )
            print(f"\n{'='*50}")
            print("✅ Agent 完成任务！")
            print(f"{'='*50}\n")
            print(final)
            return final
    
    print(f"\n⚠️ 达到最大步数 ({max_steps})")
    return None
```

对比第 19 篇的代码，核心变化只有两处：

1. **工具列表**：从 `get_tools()`（硬编码）变成 `mcp.get_tools_for_llm()`（动态发现）
2. **工具执行**：从 `execute_tool(name, input)`（本地函数）变成 `mcp.call_tool(name, input)`（MCP 调用）

**Agent 的核心逻辑一行都没变**——还是那个 Loop、还是那个 Observe、还是那个 Decide。变的只是工具的来源。这就是 MCP 的价值：**Agent 代码和工具实现解耦了**。

## 四、运行：让 Agent 连接文件系统

```python
async def main():
    mcp = MCPManager()
    
    try:
        # 连接文件系统 MCP Server
        await mcp.connect_server(
            name="filesystem",
            command="npx",
            args=["-y", "@modelcontextprotocol/server-filesystem",
                  "/tmp/agent-workspace"]
        )
        
        # 运行 Agent
        await run_mcp_agent(
            task="请搜索 2026 年 AI Agent 框架的最新对比信息，"
                 "整理成一份简要报告，并保存为 agent-report.md 文件。",
            mcp=mcp
        )
    finally:
        await mcp.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
```

运行后你会看到：

```
✅ 已连接 Server 'filesystem'，发现 11 个工具
  📦 发现工具：read_file — Read the complete contents of a file
  📦 发现工具：write_file — Create a new file or overwrite an existing one
  📦 发现工具：list_directory — Get a detailed listing of files
  ...

📋 Agent 可用工具：['read_file', 'write_file', 'list_directory', ...]

🔄 第 1/15 步
  🔧 search({"query": "AI Agent frameworks comparison 2026"})
...
🔄 第 5/15 步
  🔧 write_file({"path": "/tmp/agent-workspace/agent-report.md", ...})
     → 文件已保存

✅ Agent 完成任务！
```

Agent 不仅搜索了信息、整理了报告，还自主决定调用 `write_file` 工具把报告保存到了本地文件。这就是 MCP 带来的能力扩展——你没有告诉 Agent "用 write_file 工具"，它自己从工具列表的描述中推断出应该这样做。

## 五、多 Agent 协作

让我们再进一步——实现一个简单的 Supervisor 模式多 Agent 系统。

```python
async def run_multi_agent(task: str, mcp: MCPManager):
    """Supervisor 模式：一个 Researcher + 一个 Writer"""
    
    print("🏢 启动多 Agent 系统\n")
    
    # ===== Agent 1: Researcher =====
    print("👨‍🔬 Researcher Agent 开始工作...")
    research_result = await run_mcp_agent(
        task=f"请搜索并收集以下主题的信息（只收集信息，不需要写报告）：\n{task}",
        mcp=mcp,
        max_steps=8
    )
    
    # ===== Agent 2: Writer =====
    print("\n✍️ Writer Agent 开始工作...")
    final_report = await run_mcp_agent(
        task=f"""请基于以下研究素材，撰写一份结构化的分析报告，
并保存为 final-report.md 文件。

研究素材：
{research_result}

报告要求：
- 有标题和小节
- 有数据支撑
- 语言精练
- 保存到文件""",
        mcp=mcp,
        max_steps=5
    )
    
    print("\n🏢 多 Agent 系统任务完成！")
    return final_report
```

这就是第 18 篇讲的 **Supervisor 模式**的最简实现：

- **Researcher Agent**：负责搜索和收集原始信息
- **Writer Agent**：基于 Researcher 的成果撰写最终报告
- **Supervisor**（`run_multi_agent` 函数本身）：负责分配任务和串联结果

每个 Agent 有自己的 System Prompt（角色）、自己的步数限制（独立熔断）、自己的工具权限。它们通过文本结果来传递信息——Researcher 的输出成为 Writer 的输入。

## 六、从手写到框架：用 LangGraph 重构

现在让我们看看同样的逻辑用 LangGraph 框架写出来是什么样的。

```python
# 安装：pip install langgraph langchain-anthropic

from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool

# 定义工具（LangGraph 的方式）
@tool
def search(query: str) -> str:
    """在互联网上搜索信息"""
    # 复用之前的搜索实现
    return do_search(query)

@tool
def save_file(filename: str, content: str) -> str:
    """保存内容到文件"""
    with open(f"/tmp/agent-workspace/{filename}", "w") as f:
        f.write(content)
    return f"已保存到 {filename}"

# 构建 Agent 图
model = ChatAnthropic(model="claude-sonnet-4-6-20250514")
tools_list = [search, save_file]
model_with_tools = model.bind_tools(tools_list)

def agent_node(state: MessagesState):
    return {"messages": [model_with_tools.invoke(state["messages"])]}

# 用图来定义流程
graph = StateGraph(MessagesState)
graph.add_node("agent", agent_node)
graph.add_node("tools", ToolNode(tools_list))

graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", tools_condition)
graph.add_edge("tools", "agent")

# 编译并运行
app = graph.compile()
result = app.invoke({
    "messages": [("user", "搜索 2026 年 AI Agent 框架对比，整理成报告并保存")]
})
```

对比手写版本和框架版本：

| 方面 | 手写 (第 19 篇) | LangGraph |
|---|---|---|
| 循环逻辑 | 手动写 `for` 循环 | 图结构自动循环 |
| 工具调用解析 | 手动解析 `response.content` | `tools_condition` 自动处理 |
| 状态管理 | 手动维护 `messages` 列表 | `MessagesState` 自动管理 |
| 检查点 | 没有 | 内置（可从断点恢复） |
| 可观测性 | 手动 `print` | LangSmith 集成 |
| 代码量 | ~100 行 | ~30 行 |

框架帮你省掉的是**胶水代码**——循环控制、工具调用解析、状态传递这些重复性工作。但框架也要求你学习它的概念（Graph、State、Node、Edge），这就是第 17 篇说的"学习曲线"。

**先手写一遍，再用框架**——这个顺序很重要。如果你直接上来就用 LangGraph，你可能会用它但不理解它。手写过之后再用框架，你会发现"啊，原来 `tools_condition` 就是帮我写了那个 `if response.stop_reason == 'tool_use'` 的判断"。

## 七、生产化建议

如果你要把这个 Agent 部署到生产环境，以下是几个关键建议：

### 错误处理强化

```python
# 每个工具调用都需要 try/except
async def safe_call_tool(mcp, name, args, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await mcp.call_tool(name, args)
        except Exception as e:
            if attempt < max_retries - 1:
                wait = 2 ** attempt  # 指数退避
                print(f"  ⚠️ 重试 ({attempt+1}/{max_retries})，等待 {wait}s...")
                await asyncio.sleep(wait)
            else:
                return f"工具调用失败（已重试 {max_retries} 次）：{e}"
```

### Rate Limit 应对

```python
import time

class RateLimiter:
    def __init__(self, calls_per_minute=30):
        self.interval = 60.0 / calls_per_minute
        self.last_call = 0
    
    async def wait(self):
        now = time.time()
        elapsed = now - self.last_call
        if elapsed < self.interval:
            await asyncio.sleep(self.interval - elapsed)
        self.last_call = time.time()
```

### 日志与可观测性

```python
import logging

logger = logging.getLogger("agent")

# 记录每一步的关键信息
logger.info(f"Step {step}: tool_call={tool_name}, "
            f"args={tool_input}, "
            f"duration={duration:.2f}s, "
            f"tokens_used={response.usage.total_tokens}")
```

### MCP Server 安全

- 只连接可信来源的 Server
- 给文件系统 Server 限定目录范围
- 生产环境使用 HTTP+SSE transport 并加上认证

## 八、系列总结：从一条 Prompt 到多工具 Agent

让我们站在第 20 篇的终点，回望整个系列的路径：

```
第 05 篇  Prompt Engineering
          "帮我写一首关于春天的诗"
          → 你学会了怎么跟 AI 说一句话
          
          ↓

第 13 篇  Context Engineering
          "在正确的信息环境中工作"
          → 你学会了管理 AI 看到的全部信息
          
          ↓

第 14 篇  Harness 工程
          "工具 + 护栏 + 状态 + 编排"
          → 你学会了搭建 Agent 的系统骨架
          
          ↓

第 15 篇  Loop 工程
          "Plan → Execute → Observe → Reflect → Decide"
          → 你学会了设计靠谱的运行循环
          
          ↓

第 16 篇  MCP 协议
          "Agent 世界的 USB 接口"
          → 你学会了 Agent 连接工具的通用语言
          
          ↓

第 17 篇  框架选型
          "LangGraph / OpenAI SDK / CrewAI / ..."
          → 你学会了选择合适的框架
          
          ↓

第 18 篇  架构设计模式
          "Router / Supervisor / Guardrail Layering / ..."
          → 你学会了生产级的设计模式
          
          ↓

第 19 篇  手写 Agent
          "100 行代码，从零构建"
          → 你亲手造了一个能自主工作的 Agent
          
          ↓

第 20 篇  MCP + 多 Agent + 框架
          "接入生态，协作，重构"
          → 你的 Agent 连接了整个世界
```

从**一条 Prompt** 到**多工具 Agent**，从**"我跟 AI 说话"** 到**"AI 自己干活"**——这就是 2026 年 AI 工程的进化之路。

Agent 技术仍在快速发展。MCP 的生态每天都在壮大、新的框架和模式不断涌现、模型的推理能力还在持续提升。但无论技术怎么变，核心原理不会变：

- **上下文决定质量**（Context Engineering）
- **系统骨架决定可靠性**（Harness）
- **循环设计决定行为**（Loop）
- **标准协议决定扩展性**（MCP）
- **设计模式决定工程水平**（Architecture Patterns）

掌握了这些原理，你就不怕技术更新换代——因为新框架、新工具、新模型都只是这些原理的新实现。

---

## 延伸阅读

1. **[MCP 官方文档 - Quick Start](https://modelcontextprotocol.io/quickstart)** —— 5 分钟搭建你的第一个 MCP Server。
2. **[LangGraph Tutorial](https://langchain-ai.github.io/langgraph/tutorials/)** —— LangGraph 官方教程，从零到生产。
3. **[Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)** —— 系列反复引用的经典参考，值得精读。

---

> 🎉 小白讲 AI 系列 Agent 篇全部完成（第 13-20 篇）。希望这 8 篇文章帮你从"理解 Agent 概念"走到了"能动手构建 Agent"。AI Agent 的世界才刚刚开始——去造属于你自己的 Agent 吧！
