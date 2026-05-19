import http from '@/api/http'

export const runsApi = {
  create(payload) {
    return http.post('/api/runs', payload)
  },
  get(runId) {
    return http.get(`/api/runs/${runId}`)
  },
}

