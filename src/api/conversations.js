import http from '@/api/http'

export const conversationsApi = {
  create(payload) {
    return http.post('/api/conversations', payload)
  },
  list() {
    return http.get('/api/conversations')
  },
  get(conversationId) {
    return http.get(`/api/conversations/${conversationId}`)
  },
  messages(conversationId) {
    return http.get(`/api/conversations/${conversationId}/messages`)
  },
  addMessage(conversationId, payload) {
    return http.post(`/api/conversations/${conversationId}/messages`, payload)
  },
  enqueue(conversationId, payload = {}) {
    return http.post(`/api/conversations/${conversationId}/queue`, payload)
  },
  queue(conversationId) {
    return http.get(`/api/conversations/${conversationId}/queue`)
  },
  createRun(conversationId, payload) {
    return http.post(`/api/conversations/${conversationId}/runs`, payload)
  },
  remove(conversationId) {
    return http.delete(`/api/conversations/${conversationId}`)
  },
}
