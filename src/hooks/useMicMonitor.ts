import { useEffect } from 'react'
import { micMeterEngine } from '../lib/micMeterEngine'

export function useMicMonitor(
  deviceName: string | undefined,
  micEnabled: boolean,
  _gainDb: number,
  monitorEnabled: boolean,
  _micMono = false
): void {
  useEffect(() => {
    micMeterEngine.setMonitorEnabled(monitorEnabled, micEnabled && !!deviceName)
    return () => {
      micMeterEngine.setMonitorEnabled(false, false)
    }
  }, [deviceName, micEnabled, monitorEnabled])
}
