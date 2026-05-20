import { defineStore } from 'pinia'
import { conversationsApi } from '@/api/conversations'

export const useConversationsStore = defineStore('conversations', {
  state: () => ({
    items: [],
    current: null,
    messages: [],
    queue: [],
    loading: false,
  }),
  actions: {
    async fetchConversations() {
      this.loading = true
      try {
        const response = await conversationsApi.list()
        this.items = response.items || []
      } finally {
        this.loading = false
      }
    },
    async createConversation(payload) {
      const response = await conversationsApi.create(payload)
      this.current = response.item
      await this.fetchConversations()
      return response.item
    },
    async selectConversation(conversationId) {
      const response = await conversationsApi.get(conversationId)
      this.current = response.item
      await Promise.all([
        this.fetchMessages(conversationId),
        this.fetchQueue(conversationId),
      ])
      return response.item
    },
    async fetchMessages(conversationId) {
      const response = await conversationsApi.messages(conversationId)
      this.messages = response.items || []
    },
    async addMessage(conversationId, payload) {
      const response = await conversationsApi.addMessage(conversationId, payload)
      await this.fetchMessages(conversationId)
      return response.item
    },
    async enqueue(conversationId, payload = {}) {
      const response = await conversationsApi.enqueue(conversationId, payload)
      await this.fetchQueue(conversationId)
      return response.item
    },
    async fetchQueue(conversationId) {
      const response = await conversationsApi.queue(conversationId)
      this.queue = response.items || []
    },
    async createRun(conversationId, payload) {
      const response = await conversationsApi.createRun(conversationId, payload)
      await this.fetchQueue(conversationId)
      return response.item
    },
    async deleteConversation(conversationId) {
      const response = await conversationsApi.remove(conversationId)
      if (this.current?.conversation_id === conversationId) {
        this.current = null
        this.messages = []
        this.queue = []
      }
      await this.fetchConversations()
      return response.item
    },
  },
})
