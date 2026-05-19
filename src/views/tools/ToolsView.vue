<script setup>
import { h, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import JsonBlock from '@/components/workflow/JsonBlock.vue'
import { useToolsStore } from '@/stores/tools'

const tools = useToolsStore()

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: 180 },
  { title: '领域', dataIndex: 'field', key: 'field', width: 120 },
  { title: '说明', dataIndex: 'description', key: 'description' },
  {
    title: '事件',
    dataIndex: 'events',
    key: 'events',
    width: 280,
    customRender: ({ record }) => h('span', record.events?.length || 0),
  },
]

onMounted(() => tools.fetchTools())
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Tool Registry</span>
        <h1>工具库</h1>
      </div>
      <RouterLink to="/tools/upload"><a-button type="primary">上传工具</a-button></RouterLink>
    </div>

    <a-card class="panel-card" :bordered="false">
      <a-table
        :columns="columns"
        :data-source="tools.items"
        :loading="tools.loading"
        row-key="name"
        :pagination="{ pageSize: 8 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'field'">
            <a-tag color="blue">{{ record.field || 'unknown' }}</a-tag>
          </template>
          <template v-if="column.key === 'events'">
            <a-space wrap>
              <a-tag v-for="event in record.events || []" :key="event">{{ event.split('.').slice(-1)[0] }}</a-tag>
            </a-space>
          </template>
        </template>
        <template #expandedRowRender="{ record }">
          <div class="expanded-grid">
            <div>
              <h4>Input Schema</h4>
              <JsonBlock :value="record.input_schema" />
            </div>
            <div>
              <h4>Metadata</h4>
              <JsonBlock :value="record.metadata" />
            </div>
          </div>
        </template>
      </a-table>
    </a-card>
  </section>
</template>

