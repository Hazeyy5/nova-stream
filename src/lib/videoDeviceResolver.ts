export async function resolveVideoDeviceId(deviceName: string): Promise<string | undefined> {
  if (!deviceName) return undefined

  try {
    const probe = await navigator.mediaDevices.getUserMedia({ video: true })
    probe.getTracks().forEach((t) => t.stop())
  } catch {
    return undefined
  }

  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
  if (inputs.length === 0) return undefined

  try {
    const nativeDevices = await window.novaStream.devices.listMedia()
    const nativeMatch = nativeDevices.find((d) => d.type === 'video' && d.name === deviceName)
    if (nativeMatch?.deviceId) {
      const byId = inputs.find((d) => d.deviceId === nativeMatch.deviceId)
      if (byId) return byId.deviceId
    }
  } catch {
    /* ignore */
  }

  const exact = inputs.find((d) => d.label === deviceName)
  if (exact) return exact.deviceId

  const key = deviceName.toLowerCase()
  const partial = inputs.find((d) => d.label.toLowerCase() === key)
  if (partial) return partial.deviceId

  const contains = inputs.find((d) => {
    const label = d.label.toLowerCase()
    return label.includes(key) || key.includes(label)
  })
  return contains?.deviceId
}
