<script setup>
import { computed } from 'vue'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons-vue'
import JsonBlock from './JsonBlock.vue'

const props = defineProps({
  events: {
    type: Array,
    default: () => [],
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const sortedEvents = computed(() => {
  return [...props.events].sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
})

function colorFor(name = '') {
  if (name.includes('failed')) return 'red'
  if (name.includes('finished')) return 'green'
  if (name.includes('generated') || name.includes('replanned')) return 'blue'
  if (name.includes('step')) return 'purple'
  return 'gray'
}

function iconFor(name = '') {
  if (name.includes('failed')) return CloseCircleOutlined
  if (name.includes('finished')) return CheckCircleOutlined
  if (name.includes('step')) return NodeIndexOutlined
  return ClockCircleOutlined
}

function eventTitle(event) {
  const step = event?.payload?.step
  if (step?.title) return `${event.name} · ${step.title}`
  return event.name
}
</script>

<template>
  <a-empty v-if="!sortedEvents.length" description="暂无事件" />
  <a-timeline v-else class="event-timeline">
    <a-timeline-item
      v-for="event in sortedEvents"
      :key="event.event_id || `${event.name}-${event.created_at}`"
      :color="colorFor(event.name)"
    >
      <template #dot>
        <component :is="iconFor(event.name)" />
      </template>
      <div class="event-row">
        <div class="event-row-head">
          <a-tag :color="colorFor(event.name)">{{ event.name }}</a-tag>
          <span class="event-time">{{ event.created_at ? new Date(event.created_at * 1000).toLocaleTimeString() : '' }}</span>
        </div>
        <strong>{{ eventTitle(event) }}</strong>
        <JsonBlock v-if="!compact" :value="event.payload" />
      </div>
    </a-timeline-item>
  </a-timeline>
</template>

