import { defineStore } from 'pinia'
import { contextsApi } from '@/api/contexts'

export const useContextsStore = defineStore('contexts', {
  state: () => ({
    current: null,
    history: [],
    loading: false,
  }),
  actions: {
    async createContext(payload) {
      this.loading = true
      try {
        const response = await contextsApi.create(payload)
        this.current = response.item
        this.history.unshift(response.item)
        return response.item
      } finally {
        this.loading = false
      }
    },
    async getContext(contextId) {
      this.loading = true
      try {
        const response = await contextsApi.get(contextId)
        this.current = response.item
        return response.item
      } finally {
        this.loading = false
      }
    },
  },
})

