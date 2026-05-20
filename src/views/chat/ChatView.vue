<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  AppstoreOutlined,
  CommentOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons-vue'
import EventTimeline from '@/components/workflow/EventTimeline.vue'
import ExecutorEventPanel from '@/components/workflow/ExecutorEventPanel.vue'
import JsonBlock from '@/components/workflow/JsonBlock.vue'
import { runsApi } from '@/api/runs'
import { useConversationsStore } from '@/stores/conversations'
import { useRunsStore } from '@/stores/runs'

const conversations = useConversationsStore()
const runs = useRunsStore()
const activeRunId = ref('')
const selectedExecutor = ref('')
const input = ref('请帮我分析 agent_flow 后端 API 能力')
const listRef = ref(null)
const conversationRailCollapsed = ref(true)
const conversationDrawerOpen = ref(false)
const eventDrawerOpen = ref(false)
const selectedEvent = ref(null)
const resolving = ref({})

const runForm = reactive({
  planner_agent_id: 'default_planner',
  executor_agent_ids: ['default_executor'],
  context_id: 'default_step',
  max_replan_rounds: 3,
})

const currentEvents = computed(() => {
  return activeRunId.value ? runs.eventsByRun[activeRunId.value] || [] : []
})

const sortedEvents = computed(() => {
  return [...currentEvents.value].sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
})

const displayEvents = computed(() => compactLlmEvents(sortedEvents.value))
const executorEvents = computed(() => displayEvents.value.filter(isExecutorEvent))
const orchestratorEvents = computed(() => displayEvents.value.filter((event) => !isExecutorEvent(event)))

const runStats = computed(() => {
  const failed = currentEvents.value.filter((event) => event.name?.includes('failed')).length
  const pending = currentEvents.value.filter((event) => {
    return event.name === 'human.confirmation.requested' && event.payload?.status === 'pending'
  }).length
  return {
    events: currentEvents.value.length,
    failed,
    pending,
  }
})

const latestQueueRunId = computed(() => {
  const queueWithRun = [...conversations.queue].reverse().find((item) => item.run_id)
  return queueWithRun?.run_id || ''
})

const selectedEventMeta = computed(() => {
  const payload = selectedEvent.value?.payload || {}
  const step = payload.step || {}
  return [
    { label: 'Run ID', value: selectedEvent.value?.run_id || payload.run_id || activeRunId.value || '-' },
    { label: 'Agent', value: payload.agent_id || '-' },
    { label: 'Executor', value: payload.executor_id || step.executor_id || '-' },
    { label: 'Step', value: payload.step_id || step.step_id || '-' },
    { label: 'Tool', value: payload.tool_name || payload.name || '-' },
    { label: 'Call Role', value: payload.call_role || '-' },
  ]
})

function isExecutorEvent(event) {
  const name = event?.name || ''
  const payload = event?.payload || {}
  const step = payload.step || {}
  if (name.startsWith('planner.')) return false
  if (name.startsWith('llm.')) return payload.agent_type === 'executor'
  if (name.startsWith('agent.')) return payload.agent_type === 'executor'
  if (name.startsWith('workflow.') || name.startsWith('plan.') || name.startsWith('human.confirmation.')) {
    return false
  }
  if (name.startsWith('tool.') || name === 'agent.failed') return true
  return Boolean(payload.executor_id || step.executor_id || payload.tool_name)
}

function eventColor(name = '') {
  if (name.includes('failed')) return 'red'
  if (name.includes('finished')) return 'green'
  if (name.startsWith('human.confirmation')) return 'orange'
  if (name.startsWith('llm.')) return 'cyan'
  if (name.startsWith('agent.')) return 'geekblue'
  if (name.startsWith('planner.')) return 'purple'
  if (name.startsWith('plan.')) return 'purple'
  if (name.startsWith('workflow.')) return 'blue'
  return 'default'
}

function eventTone(name = '') {
  if (name.includes('failed')) return 'danger'
  if (name.includes('finished')) return 'success'
  if (name.startsWith('human.confirmation')) return 'warning'
  if (name.startsWith('llm.')) return 'stream'
  if (name.startsWith('agent.')) return 'agent'
  if (name.startsWith('planner.')) return 'plan'
  if (name.startsWith('plan.')) return 'plan'
  return 'workflow'
}

function eventSummary(event) {
  const payload = event?.payload || {}
  const step = payload.step || {}
  if (event?.name === 'llm.streaming') return `${payload.agent_name || payload.agent_id} 正在输出`
  if (event?.name === 'llm.completed') return `${payload.agent_name || payload.agent_id} 输出完成`
  if (event?.name === 'agent.think') return payload.think || 'Agent 思考'
  if (event?.name === 'agent.tool.reasoning') return payload.reasoning || `调用工具 ${payload.tool_name}`
  if (event?.name === 'agent.final') return payload.final || payload.finish_reason || 'Agent 完成'
  if (event?.name === 'planner.plan.generated') return `生成 ${payload.steps?.length || 0} 个计划步骤`
  if (event?.name === 'planner.replan.reasoning') return payload.reason || payload.action || 'Plan Agent 重规划'
  if (event?.name === 'planner.final') return payload.final || 'Plan Agent 总结'
  if (step.title) return step.title
  if (payload.tool_name) return `工具 ${payload.tool_name}`
  if (payload.status_reason) return payload.status_reason
  if (payload.reason) return payload.reason
  if (payload.error) return payload.error
  if (payload.final) return payload.final
  return '查看事件负载'
}

function payloadPreview(event) {
  const payload = event?.payload || {}
  const preview = {
    agent: payload.agent_name || payload.agent_id,
    call_role: payload.call_role,
    content: event?.name === 'llm.streaming' ? payload.content : undefined,
    think: payload.think,
    reasoning: payload.reasoning,
    final: payload.final,
    agent_id: payload.agent_id,
    executor_id: payload.executor_id || payload.step?.executor_id,
    tool_name: payload.tool_name || payload.name,
    status: payload.status || payload.step?.status,
    respond: payload.respond,
    reason: payload.reason || payload.status_reason,
    arguments: payload.arguments,
  }
  return Object.fromEntries(Object.entries(preview).filter(([, value]) => value !== undefined && value !== ''))
}

function convertPlanToString(jsonData) {
  // 1. 安全检查，防止传入空数据或格式不正确的数据
  if (!jsonData || !jsonData.steps || !Array.isArray(jsonData.steps)) {
    return "错误：无效的计划数据格式";
  }

  const steps = jsonData.steps;
  
  // 2. 遍历并映射每一个步骤
  const lines = steps.map(step => {
    // 处理依赖项：如果是空数组则显示“无”，否则用逗号拼接
    const dependsOnStr = step.depends_on && step.depends_on.length > 0 
      ? step.depends_on.join(', ') 
      : '无';
    // 组装单个步骤的中文文本
    return `步骤 ID: ${step.step_id}
标题: ${step.title}
指令说明: ${step.instruction}
执行器 ID: ${step.executor_id}
依赖步骤: ${dependsOnStr}`;
  });
  // 3. 用双换行和分割线把所有步骤拼接在一起
  return lines.join('\n----------------------------------------\n');
}

function compactLlmEvents(events) {
  const compacted = []
  const streaming = new Map()

  for (const event of events) {
    if (event.name === 'llm.delta') {
      const payload = event.payload || {}
      const key = `${payload.agent_id || 'unknown'}:${payload.call_role || 'unknown'}`
      const current = streaming.get(key) || {
        ...event,
        event_id: `streaming-${key}`,
        name: 'llm.streaming',
        payload: {
          ...payload,
          content: '',
          token_chunks: 0,
          streaming: true,
        },
      }
      current.payload.content += payload.delta || ''
      current.payload.token_chunks = payload.sequence || current.payload.token_chunks + 1
      current.created_at = event.created_at
      streaming.set(key, current)
      continue
    }

    if (event.name === 'llm.completed') {
      const payload = event.payload || {}
      const key = `${payload.agent_id || 'unknown'}:${payload.call_role || 'unknown'}`
      streaming.delete(key)
      compacted.push(event)
      continue
    }

    if (event.name === 'llm.started') {
      continue
    }

    compacted.push(event)
  }

  compacted.push(...streaming.values())
  return compacted.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
}

function eventTime(event) {
  return event?.created_at ? new Date(event.created_at * 1000).toLocaleTimeString() : ''
}

function shortId(value = '') {
  return value ? value.slice(0, 8) : '-'
}

function currentInitial() {
  const title = conversations.current?.title || '会'
  return title.slice(0, 1).toUpperCase()
}

async function ensureConversation() {
  if (conversations.current) return conversations.current
  return conversations.createConversation({ title: 'Agent 对话', metadata: {} })
}

async function sendMessage() {
  if (!input.value.trim()) return
  const conversation = await ensureConversation()
  const messageItem = await conversations.addMessage(conversation.conversation_id, {
    role: 'user',
    content: input.value,
    metadata: {},
  })
  await conversations.enqueue(conversation.conversation_id, { message_id: messageItem.message_id })
  input.value = ''
  await nextTick()
  listRef.value?.scrollTo?.({ top: listRef.value.scrollHeight, behavior: 'smooth' })
}

async function startRun() {
  const conversation = await ensureConversation()
  const run = await conversations.createRun(conversation.conversation_id, runForm)
  activateRun(run.run_id, run)
  message.success('已从队列消息创建 Run')
}

async function activateRun(runId, runRecord = null) {
  if (!runId) return
  activeRunId.value = runId
  if (runRecord) {
    runs.current = runRecord
  } else {
    runs.fetchRun(runId).catch(() => {})
  }
  selectedExecutor.value = runRecord?.executor_agent_ids?.[0] || runs.current?.executor_agent_ids?.[0] || selectedExecutor.value
  runs.connect(runId)
}

async function selectConversation(id) {
  await conversations.selectConversation(id)
  const runId = latestQueueRunId.value || conversations.messages.find((item) => item.run_id)?.run_id || ''
  if (runId) activateRun(runId)
  conversationDrawerOpen.value = false
}

function openEmbeddedRoute() {
  if (activeRunId.value) {
    window.open(`/executor-frame/${activeRunId.value}/${selectedExecutor.value || ''}`, '_blank')
  }
}

function openEvent(event) {
  selectedEvent.value = event
  eventDrawerOpen.value = true
}

function isConfirmationRequest(event) {
  return event?.name === 'human.confirmation.requested' && event.payload?.status === 'pending'
}

async function resolveSelectedConfirmation(approved) {
  const payload = selectedEvent.value?.payload || {}
  if (!payload.run_id || !payload.confirmation_id) return
  resolving.value[payload.confirmation_id] = true
  try {
    await runsApi.resolveConfirmation(payload.run_id, payload.confirmation_id, {
      approved,
      reason: approved ? '前端批准执行' : '前端拒绝执行',
    })
    message.success(approved ? '已批准工具执行' : '已拒绝工具执行')
    eventDrawerOpen.value = false
  } finally {
    resolving.value[payload.confirmation_id] = false
  }
}

function queueColor(status) {
  if (status === 'failed') return 'red'
  if (status === 'done') return 'green'
  if (status === 'processing') return 'blue'
  return 'gold'
}

onMounted(async () => {
  await conversations.fetchConversations()
  if (conversations.items[0]) {
    await conversations.selectConversation(conversations.items[0].conversation_id)
    const runId = latestQueueRunId.value || conversations.messages.find((item) => item.run_id)?.run_id || ''
    if (runId) activateRun(runId)
  }
})
</script>

<template>
  <section class="chat-shell agent-workbench" :class="{ 'rail-collapsed': conversationRailCollapsed }">
    <aside class="conversation-rail agent-rail" :class="{ collapsed: conversationRailCollapsed }">
      <button class="rail-toggle" type="button" @click="conversationRailCollapsed = !conversationRailCollapsed">
        <MenuUnfoldOutlined v-if="conversationRailCollapsed" />
        <MenuFoldOutlined v-else />
      </button>

      <template v-if="conversationRailCollapsed">
        <a-tooltip title="展开会话">
          <button class="rail-avatar" type="button" @click="conversationRailCollapsed = false">
            {{ currentInitial() }}
          </button>
        </a-tooltip>
        <a-tooltip title="新建会话">
          <a-button shape="circle" type="primary" size="small" @click="conversations.createConversation({ title: '新会话' })">
            <CommentOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="移动端会话抽屉">
          <a-button class="mobile-rail-open" shape="circle" size="small" @click="conversationDrawerOpen = true">
            <AppstoreOutlined />
          </a-button>
        </a-tooltip>
      </template>

      <template v-else>
        <div class="rail-head">
          <h2>会话</h2>
          <a-button size="small" type="primary" @click="conversations.createConversation({ title: '新会话' })">
            新建
          </a-button>
        </div>
        <a-list :data-source="conversations.items" :loading="conversations.loading">
          <template #renderItem="{ item }">
            <a-list-item
              class="conversation-item"
              :class="{ active: item.conversation_id === conversations.current?.conversation_id }"
              @click="selectConversation(item.conversation_id)"
            >
              <a-list-item-meta :title="item.title" :description="item.conversation_id" />
            </a-list-item>
          </template>
        </a-list>
      </template>
    </aside>

    <main class="chat-main panel-card agent-chat-main" style="max-height: 150vh;">
      <div class="chat-topbar agent-chat-topbar">
        <div>
          <span class="eyebrow">Agent Chat</span>
          <h1>{{ conversations.current?.title || '未选择会话' }}</h1>
          <div class="run-capsule-row">
            <a-tag :color="activeRunId ? 'blue' : 'default'">Run {{ shortId(activeRunId) }}</a-tag>
            <a-tag>{{ runStats.events }} events</a-tag>
            <a-tag :color="runStats.failed ? 'red' : 'green'">{{ runStats.failed }} failed</a-tag>
            <a-tag :color="runStats.pending ? 'orange' : 'default'">{{ runStats.pending }} confirmations</a-tag>
          </div>
        </div>
        <a-space wrap>
          <a-button class="mobile-conversation-button" @click="conversationDrawerOpen = true">
            会话
          </a-button>
          <a-button @click="sendMessage" :disabled="!input.trim()">发送</a-button>
          <a-button type="primary" @click="startRun">入队消息创建 Run</a-button>
        </a-space>
      </div>

      <div ref="listRef" class="message-list agent-message-list">
        <a-empty
          v-if="!conversations.messages.length && !orchestratorEvents.length"
          description="还没有消息或事件"
        />

        <div
          v-for="item in conversations.messages"
          :key="item.message_id"
          class="message-bubble"
          :class="item.role"
        >
          <div class="message-meta-row">
            <a-tag>{{ item.role }}</a-tag>
            <a-button
              v-if="item.run_id"
              size="small"
              type="link"
              @click="activateRun(item.run_id)"
            >
              Run {{ shortId(item.run_id) }}
            </a-button>
          </div>
          <p>{{ item.content }}</p>
          <small>{{ item.message_id }}</small>
        </div>

        <div
          v-for="event in orchestratorEvents"
          :key="event.event_id || `${event.name}-${event.created_at}`"
          class="message-bubble event-bubble"
          :class="eventTone(event.name)"
          @click="openEvent(event)"
        >
          <div class="event-bubble-head">
            <a-tag :color="eventColor(event.name)">{{ event.name }}</a-tag>
            <span>{{ eventTime(event) }}</span>
          </div>
          <strong>{{ eventSummary(event) }}</strong>
          <JsonBlock class="event-bubble-preview" :value="payloadPreview(event)" />
        </div>
      </div>

      <div class="chat-composer agent-composer">
        <a-textarea v-model:value="input" :rows="3" placeholder="输入给 Agent 的任务..." />
      </div>

      <div class="queue-strip agent-queue-strip">
        <a-tag
          v-for="item in conversations.queue"
          :key="item.queue_id"
          class="queue-chip"
          :color="queueColor(item.status)"
          @click="activateRun(item.run_id)"
        >
          {{ item.status }} · {{ shortId(item.run_id || item.message_id) }}
        </a-tag>
      </div>
    </main>

    <aside class="event-side executor-workbench">
      <a-card class="panel-card executor-toolbar" :bordered="false">
        <div class="card-title-row">
          <span>执行者工作台</span>
          <a-tag :color="executorEvents.length ? 'blue' : 'default'">{{ executorEvents.length }} events</a-tag>
        </div>
        <a-input-search
          v-model:value="activeRunId"
          enter-button="连接"
          placeholder="Run ID"
          @search="activateRun(activeRunId)"
        />
        <a-select v-model:value="selectedExecutor" class="mt-12" style="width: 100%" placeholder="executor">
          <a-select-option value="">全部执行者</a-select-option>
          <a-select-option v-for="id in runs.current?.executor_agent_ids || runForm.executor_agent_ids" :key="id" :value="id">
            {{ id }}
          </a-select-option>
        </a-select>
      </a-card>

      <a-card class="panel-card embedded-slot executor-inspector" :bordered="false">
        <ExecutorEventPanel
          :events="executorEvents"
          :executor-id="selectedExecutor"
          title="Executor / Tool 事件"
          selectable
          @select="openEvent"
          style="max-height: 65vh;overflow-y: auto;" 
          />
        <a-button class="mt-12" block @click="openEmbeddedRoute" :disabled="!activeRunId">
          新窗口查看该面板
        </a-button>
      </a-card>

      <a-card class="panel-card orchestrator-mini" title="编排时间线" :bordered="false">
        <EventTimeline
          :events="orchestratorEvents"
          compact
          selectable
          @select="openEvent"
        />
      </a-card>
    </aside>

    <a-drawer
      v-model:open="eventDrawerOpen"
      width="560"
      class="event-inspector-drawer"
      placement="right"
      :title="selectedEvent?.name || '事件详情'"
    >
      <template v-if="selectedEvent">
        <a-space class="mb-16" wrap>
          <a-tag :color="eventColor(selectedEvent.name)">{{ selectedEvent.name }}</a-tag>
          <a-tag>{{ eventTime(selectedEvent) }}</a-tag>
        </a-space>
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item v-for="item in selectedEventMeta" :key="item.label" :label="item.label">
            {{ item.value }}
          </a-descriptions-item>
        </a-descriptions>
        <a-space v-if="isConfirmationRequest(selectedEvent)" class="confirmation-actions mt-16">
          <a-button
            type="primary"
            :loading="resolving[selectedEvent.payload.confirmation_id]"
            @click="resolveSelectedConfirmation(true)"
          >
            批准
          </a-button>
          <a-button
            danger
            :loading="resolving[selectedEvent.payload.confirmation_id]"
            @click="resolveSelectedConfirmation(false)"
          >
            拒绝
          </a-button>
        </a-space>
        <JsonBlock class="mt-16" :value="selectedEvent.payload || {}" />
      </template>
    </a-drawer>

    <a-drawer
      v-model:open="conversationDrawerOpen"
      title="会话"
      placement="left"
      width="320"
    >
      <a-button block type="primary" class="mb-16" @click="conversations.createConversation({ title: '新会话' })">
        新建会话
      </a-button>
      <a-list :data-source="conversations.items" :loading="conversations.loading">
        <template #renderItem="{ item }">
          <a-list-item
            class="conversation-item"
            :class="{ active: item.conversation_id === conversations.current?.conversation_id }"
            @click="selectConversation(item.conversation_id)"
          >
            <a-list-item-meta :title="item.title" :description="item.conversation_id" />
          </a-list-item>
        </template>
      </a-list>
    </a-drawer>
  </section>
</template>
