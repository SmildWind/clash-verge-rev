import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { MihomoWebSocket } from 'tauri-plugin-mihomo-api'

export const trafficAggregationConnectionHook = MihomoWebSocket
export const trafficAggregationReactHooks = [
  useCallback,
  useMemo,
  useSyncExternalStore,
]
