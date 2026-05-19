import http from '@/api/http'

export const contextsApi = {
  create(payload) {
    return http.post('/api/contexts', payload)
  },
  get(contextId) {
    return http.get(`/api/contexts/${contextId}`)
  },
}

