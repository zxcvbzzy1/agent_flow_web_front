<script setup>
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import EventTimeline from '@/components/workflow/EventTimeline.vue'
import ExecutorEventPanel from '@/components/workflow/ExecutorEventPanel.vue'
import JsonBlock from '@/components/workflow/JsonBlock.vue'
import { useRunsStore } from '@/stores/runs'

const runs = useRunsStore()
const lookupId = ref('')
const selectedExecutor = ref('')
const form = reactive({
  prompt: '请分析当前任务并给出执行结果',
  planner_agent_id: 'default_planner',
  executor_agent_ids: 'default_executor',
  context_id: 'default_step',
  max_replan_rounds: 3,
  auto_start: true,
})

const events = computed(() => {
  const runId = runs.current?.run_id
  return runId ? runs.eventsByRun[runId] || [] : []
})

async function createRun() {
  const item = await runs.createRun({
    ...form,
    executor_agent_ids: form.executor_agent_ids.split(',').map((item) => item.trim()).filter(Boolean),
  })
  lookupId.value = item.run_id
  selectedExecutor.value = item.executor_agent_ids?.[0] || ''
  message.success('Run 已创建')
}

async function lookup() {
  const item = await runs.fetchRun(lookupId.value)
  selectedExecutor.value = item.executor_agent_ids?.[0] || ''
  runs.connect(item.run_id)
}

function openStandalone() {
  if (runs.current?.run_id) {
    window.open(`/runs/${runs.current.run_id}/events`, '_blank')
  }
}
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Run Orchestration</span>
        <h1>编排运行</h1>
      </div>
      <a-space>
        <a-button @click="openStandalone" :disabled="!runs.current">独立事件页</a-button>
      </a-space>
    </div>

    <div class="run-grid">
      <a-card class="panel-card" title="创建 Run" :bordered="false">
        <a-form layout="vertical" @finish="createRun">
          <a-form-item label="Prompt">
            <a-textarea v-model:value="form.prompt" :rows="5" />
          </a-form-item>
          <div class="form-pair">
            <a-form-item label="Planner Agent">
              <a-input v-model:value="form.planner_agent_id" />
            </a-form-item>
            <a-form-item label="Step Context">
              <a-input v-model:value="form.context_id" />
            </a-form-item>
          </div>
          <a-form-item label="Executor Agents">
            <a-input v-model:value="form.executor_agent_ids" />
          </a-form-item>
          <div class="form-pair">
            <a-form-item label="Max Replan">
              <a-input-number v-model:value="form.max_replan_rounds" :min="0" />
            </a-form-item>
            <a-form-item label="自动启动">
              <a-switch v-model:checked="form.auto_start" />
            </a-form-item>
          </div>
          <a-button type="primary" html-type="submit" :loading="runs.loading">创建</a-button>
        </a-form>
      </a-card>

      <a-card class="panel-card" title="Run 状态" :bordered="false">
        <a-input-search v-model:value="lookupId" enter-button="查询并连接 SSE" @search="lookup" />
        <a-descriptions v-if="runs.current" class="mt-16" :column="1" size="small">
          <a-descriptions-item label="Run ID">{{ runs.current.run_id }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="runs.current.status === 'failed' ? 'red' : runs.current.status === 'finished' ? 'green' : 'blue'">
              {{ runs.current.status }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="Final">{{ runs.current.final || '-' }}</a-descriptions-item>
        </a-descriptions>
        <JsonBlock class="mt-16" :value="runs.current || { status: 'waiting' }" />
      </a-card>
    </div>

    <div class="event-workbench">
      <a-card class="panel-card" title="总体事件流" :bordered="false">
        <EventTimeline :events="events" />
      </a-card>
      <div class="executor-column">
        <a-card class="panel-card" title="执行者选择" :bordered="false">
          <a-select v-model:value="selectedExecutor" style="width: 100%">
            <a-select-option value="">全部</a-select-option>
            <a-select-option v-for="id in runs.current?.executor_agent_ids || []" :key="id" :value="id">
              {{ id }}
            </a-select-option>
          </a-select>
        </a-card>
        <ExecutorEventPanel :events="events" :executor-id="selectedExecutor" />
      </div>
    </div>
  </section>
</template>

