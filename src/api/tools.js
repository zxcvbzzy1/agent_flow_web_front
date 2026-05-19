import http from '@/api/http'

export const toolsApi = {
  list() {
    return http.get('/api/tools')
  },
  upload(payload) {
    return http.post('/api/tools/upload', payload)
  },
}

