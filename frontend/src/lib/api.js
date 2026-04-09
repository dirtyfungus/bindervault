import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  // Get token from persisted store directly (avoid circular dep)
  try {
    const raw = localStorage.getItem('bv-auth')
    if (raw) {
      const { state } = JSON.parse(raw)
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`
      }
    }
  } catch {}
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      // Clear auth on 401
      try {
        localStorage.removeItem('bv-auth')
      } catch {}
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
