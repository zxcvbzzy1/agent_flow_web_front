<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import EventTimeline from '@/components/workflow/EventTimeline.vue'
import ExecutorEventPanel from '@/components/workflow/ExecutorEventPanel.vue'
import { useConversationsStore } from '@/stores/conversations'
import { useRunsStore } from '@/stores/runs'

const conversations = useConversationsStore()
const runs = useRunsStore()
const activeRunId = ref('')
const selectedExecutor = ref('')
const input = ref('请帮我分析 agent_flow 后端 API 能力')
const listRef = ref(null)
const runForm = reactive({
  planner_agent_id: 'default_planner',
  executor_agent_ids: ['default_executor'],
  context_id: 'default_step',
  max_replan_rounds: 3,
})

const currentEvents = computed(() => {
  return activeRunId.value ? runs.eventsByRun[activeRunId.value] || [] : []
})

async function ensureConversation() {
  if (conversations.current) return conversations.current
  return conversations.createConversation({ title: 'Agent 对话', metadata: {} })
}

async function sendMessage() {
  const conversation = await ensureConversation()
  const messageItem = await conversations.addMessage(conversation.conversation_id, {
    role: 'user',
    content: input.value,
    metadata: {},
  })
  await conversations.enqueue(conversation.conversation_id, { message_id: messageItem.message_id })
  input.value = ''
  await nextTick()
  listRef.value?.scrollTo?.({ top: listRef.value.scrollHeight })
}

async function startRun() {
  const conversation = await ensureConversation()
  const run = await conversations.createRun(conversation.conversation_id, runForm)
  activeRunId.value = run.run_id
  selectedExecutor.value = run.executor_agent_ids?.[0] || ''
  runs.current = run
  runs.connect(run.run_id)
  message.success('已从队列消息创建 Run')
}

async function selectConversation(id) {
  await conversations.selectConversation(id)
}

function openEmbeddedRoute() {
  if (activeRunId.value) {
    window.open(`/executor-frame/${activeRunId.value}/${selectedExecutor.value || ''}`, '_blank')
  }
}

onMounted(async () => {
  await conversations.fetchConversations()
  if (conversations.items[0]) {
    await conversations.selectConversation(conversations.items[0].conversation_id)
  }
})
</script>

<template>
  <section class="chat-shell">
    <aside class="conversation-rail">
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
    </aside>

    <main class="chat-main panel-card">
      <div class="chat-topbar">
        <div>
          <span class="eyebrow">Agent Chat</span>
          <h1>{{ conversations.current?.title || '未选择会话' }}</h1>
        </div>
        <a-space>
          <a-button @click="sendMessage" :disabled="!input.trim()">发送</a-button>
          <a-button type="primary" @click="startRun">入队消息创建 Run</a-button>
        </a-space>
      </div>

      <div ref="listRef" class="message-list">
        <a-empty v-if="!conversations.messages.length" description="还没有消息" />
        <div
          v-for="item in conversations.messages"
          :key="item.message_id"
          class="message-bubble"
          :class="item.role"
        >
          <a-tag>{{ item.role }}</a-tag>
          <p>{{ item.content }}</p>
          <small>{{ item.run_id || item.message_id }}</small>
        </div>
      </div>

      <div class="chat-composer">
        <a-textarea v-model:value="input" :rows="3" placeholder="输入给 Agent 的任务..." />
      </div>

      <div class="queue-strip">
        <a-tag v-for="item in conversations.queue" :key="item.queue_id" :color="item.status === 'failed' ? 'red' : item.status === 'done' ? 'green' : 'blue'">
          {{ item.status }} · {{ item.message_id?.slice(0, 8) }}
        </a-tag>
      </div>
    </main>

    <aside class="event-side">
      <a-card class="panel-card" title="Run 事件流" :bordered="false">
        <a-input v-model:value="activeRunId" placeholder="Run ID" @pressEnter="runs.connect(activeRunId)" />
        <a-button class="mt-8" block @click="runs.connect(activeRunId)" :disabled="!activeRunId">连接 SSE</a-button>
        <EventTimeline class="mt-16" :events="currentEvents" compact />
      </a-card>

      <a-card class="panel-card embedded-slot" title="内嵌执行者视图" :bordered="false">
        <a-select v-model:value="selectedExecutor" style="width: 100%" placeholder="executor">
          <a-select-option value="">全部</a-select-option>
          <a-select-option v-for="id in runs.current?.executor_agent_ids || runForm.executor_agent_ids" :key="id" :value="id">
            {{ id }}
          </a-select-option>
        </a-select>
        <ExecutorEventPanel class="mt-12" :events="currentEvents" :executor-id="selectedExecutor" />
        <a-button class="mt-12" block @click="openEmbeddedRoute" :disabled="!activeRunId">
          新窗口查看该面板
        </a-button>
      </a-card>
    </aside>
  </section>
</template>

