import { useEffect, useRef, useCallback } from 'react'
import type { Source } from '../types'
import { acquireSourceStream, releaseSourceStream, type StreamEntry } from '../lib/drawScene'
import { isAcquirableMediaSource, mediaSourceKey } from '../lib/sourceMedia'

function configFingerprint(source: Source): string {
  return `${source.captureId ?? ''}|${source.browserUrl ?? ''}|${source.imageUrl ?? ''}`
}

export function useSceneMedia(sources: Source[]) {
  const streamsRef = useRef<Map<string, StreamEntry>>(new Map())
  const configRef = useRef<Map<string, string>>(new Map())
  const typeRef = useRef<Map<string, Source['type']>>(new Map())

  const releaseEntry = useCallback((id: string) => {
    const entry = streamsRef.current.get(id)
    if (entry) {
      entry.stream?.getTracks().forEach((t) => t.stop())
      const type = typeRef.current.get(id)
      if (type) releaseSourceStream(id, type)
    }
    streamsRef.current.delete(id)
    configRef.current.delete(id)
    typeRef.current.delete(id)
  }, [])

  const acquireStream = useCallback(async (source: Source) => {
    return acquireSourceStream(source)
  }, [])

  const mediaKey = sources
    .map((s) => mediaSourceKey(s))
    .filter(Boolean)
    .join('|')

  useEffect(() => {
    const mediaSources = sources.filter(isAcquirableMediaSource)
    const activeIds = new Set(mediaSources.map((s) => s.id))

    for (const id of [...streamsRef.current.keys()]) {
      if (!activeIds.has(id)) releaseEntry(id)
    }

    for (const source of mediaSources) {
      const fingerprint = configFingerprint(source)
      if (configRef.current.get(source.id) === fingerprint) continue

      releaseEntry(source.id)
      acquireStream(source).then((entry) => {
        if (!isAcquirableMediaSource(source)) {
          entry.stream?.getTracks().forEach((t) => t.stop())
          releaseSourceStream(source.id, source.type)
          return
        }
        if (configFingerprint(source) !== fingerprint) {
          entry.stream?.getTracks().forEach((t) => t.stop())
          releaseSourceStream(source.id, source.type)
          return
        }
        streamsRef.current.set(source.id, entry)
        configRef.current.set(source.id, fingerprint)
        typeRef.current.set(source.id, source.type)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mediaKey résume les sources média
  }, [mediaKey, acquireStream, releaseEntry])

  useEffect(() => {
    return () => {
      for (const id of [...streamsRef.current.keys()]) releaseEntry(id)
    }
  }, [releaseEntry])

  return { streamsRef }
}
