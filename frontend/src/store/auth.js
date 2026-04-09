import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,

      login: async (email, password) => {
        const form = new URLSearchParams({ username: email, password })
        const { data } = await api.post('/auth/login', form, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        set({ token: data.access_token, refreshToken: data.refresh_token })
        const me = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${data.access_token}` },
        })
        set({ user: me.data })
        return me.data
      },

      register: async (payload) => {
        const { data } = await api.post('/auth/register', payload)
        set({ token: data.access_token, refreshToken: data.refresh_token })
        const me = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${data.access_token}` },
        })
        set({ user: me.data })
        return me.data
      },

      refreshMe: async () => {
        const { data } = await api.get('/auth/me')
        set({ user: data })
        return data
      },

      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    { name: 'bv-auth', partialize: (s) => ({ token: s.token, refreshToken: s.refreshToken, user: s.user }) }
  )
)
