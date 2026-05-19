<script setup>
import { onMounted, reactive } from 'vue'
import { message } from 'ant-design-vue'
import { useAgentsStore } from '@/stores/agents'

const agents = useAgentsStore()
const form = reactive({
  name: '新的执行者',
  agent_type: 'executor',
  context_id: 'default_executor',
  role_prompt: '',
})

const columns = [
  { title: 'Agent ID', dataIndex: 'agent_id', key: 'agent_id' },
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'agent_type', key: 'agent_type', width: 120 },
  { title: 'Context', dataIndex: 'context_id', key: 'context_id' },
]

async function create() {
  await agents.createAgent({ ...form, metadata: {} })
  message.success('Agent 已创建')
}

onMounted(() => agents.fetchAgents())
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Agent Factory</span>
        <h1>Agent 管理</h1>
      </div>
      <a-button @click="agents.fetchAgents">刷新</a-button>
    </div>

    <div class="two-column-grid wide-left">
      <a-card class="panel-card" title="Agent 列表" :bordered="false">
        <a-table :columns="columns" :data-source="agents.items" row-key="agent_id" :loading="agents.loading">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'agent_type'">
              <a-tag :color="record.agent_type === 'planner' ? 'purple' : 'blue'">{{ record.agent_type }}</a-tag>
            </template>
          </template>
        </a-table>
      </a-card>

      <a-card class="panel-card" title="创建 Agent" :bordered="false">
        <a-form layout="vertical" @finish="create">
          <a-form-item label="名称"><a-input v-model:value="form.name" /></a-form-item>
          <a-form-item label="类型">
            <a-select v-model:value="form.agent_type">
              <a-select-option value="executor">executor</a-select-option>
              <a-select-option value="planner">planner</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="Context ID"><a-input v-model:value="form.context_id" /></a-form-item>
          <a-form-item label="Role Prompt">
            <a-textarea v-model:value="form.role_prompt" :rows="8" />
          </a-form-item>
          <a-button type="primary" html-type="submit">创建</a-button>
        </a-form>
      </a-card>
    </div>
  </section>
</template>

