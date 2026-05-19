<script setup>
import { reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import JsonBlock from '@/components/workflow/JsonBlock.vue'
import { useContextsStore } from '@/stores/contexts'

const contexts = useContextsStore()
const lookupId = ref('default_executor')
const strategyText = ref('{\n  "type": "full_history",\n  "keep_last": 10\n}')
const form = reactive({
  name: '执行者上下文',
  kind: 'executor',
  available_fields: ['system', 'write_agent', 'human'],
})

async function create() {
  const item = await contexts.createContext({
    ...form,
    strategy_config: JSON.parse(strategyText.value || '{}'),
    provider_config: [],
  })
  lookupId.value = item.context_id
  message.success('上下文已创建')
}

async function lookup() {
  await contexts.getContext(lookupId.value)
}
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Context Engine</span>
        <h1>上下文配置</h1>
      </div>
    </div>

    <div class="two-column-grid">
      <a-card class="panel-card" title="创建上下文" :bordered="false">
        <a-form layout="vertical" @finish="create">
          <a-form-item label="名称">
            <a-input v-model:value="form.name" />
          </a-form-item>
          <a-form-item label="类型">
            <a-select v-model:value="form.kind">
              <a-select-option value="executor">executor</a-select-option>
              <a-select-option value="planner">planner</a-select-option>
              <a-select-option value="step">step</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="可用工具领域">
            <a-select v-model:value="form.available_fields" mode="tags">
              <a-select-option value="system">system</a-select-option>
              <a-select-option value="write_agent">write_agent</a-select-option>
              <a-select-option value="human">human</a-select-option>
              <a-select-option value="memory">memory</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="Strategy JSON">
            <a-textarea v-model:value="strategyText" :rows="6" class="code-input" />
          </a-form-item>
          <a-button type="primary" html-type="submit" :loading="contexts.loading">创建上下文</a-button>
        </a-form>
      </a-card>

      <a-card class="panel-card" title="查询上下文" :bordered="false">
        <a-input-search v-model:value="lookupId" enter-button="查询" @search="lookup" />
        <JsonBlock class="mt-16" :value="contexts.current || { context_id: lookupId }" />
      </a-card>
    </div>
  </section>
</template>

