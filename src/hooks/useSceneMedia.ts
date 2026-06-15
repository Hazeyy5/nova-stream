import { useEffect, useRef, useCallback } from 'react'
import type { Source } from '../types'
import { acquireSourceStream, releaseSourceStream, type StreamEntry } from '../lib/drawScene'
import { isAcquirableMediaSource, mediaCaptureFingerprint, mediaSourceKey } from '../lib/sourceMedia'

interface UseSceneMediaOptions {
  /** Pendant un live/enregistrement, garde les flux en cache entre les scènes. */
  keepStreamsWarm?: boolean
}

function isStreamEntryAlive(entry: StreamEntry): boolean {
  if (entry.image) return true
  if (!entry.stream) return false
  const tracks = entry.stream.getVideoTracks()
  if (tracks.length === 0) return entry.video != null
  return tracks.some((t) => t.readyState === 'live')
}

export function useSceneMedia(sources: Source[], options: UseSceneMediaOptions = {}) {
  const { keepStreamsWarm = false } = options
  const streamsRef = useRef<Map<string, StreamEntry>>(new Map())
  const fingerprintRef = useRef<Map<string, StreamEntry>>(new Map())
  const sourceFingerprintRef = useRef<Map<string, string>>(new Map())
  const typeRef = useRef<Map<string, Source['type']>>(new Map())
  const keepWarmRef = useRef(keepStreamsWarm)
  const effectGenRef = useRef(0)
  keepWarmRef.current = keepStreamsWarm

  const unmapSourceId = useCallback((id: string) => {
    streamsRef.current.delete(id)
    sourceFingerprintRef.current.delete(id)
    typeRef.current.delete(id)
  }, [])

  const releaseFingerprint = useCallback((fingerprint: string) => {
    const entry = fingerprintRef.current.get(fingerprint)
    if (entry) {
      entry.stream?.getTracks().forEach((t) => t.stop())
      const type = typeRef.current.get(entry.sourceId)
      if (type) releaseSourceStream(entry.sourceId, type)
      fingerprintRef.current.delete(fingerprint)
    }
    for (const id of [...sourceFingerprintRef.current.keys()]) {
      if (sourceFingerprintRef.current.get(id) === fingerprint) unmapSourceId(id)
    }
  }, [unmapSourceId])

  /** Retire le mapping d'une source sans couper le flux si une autre source l'utilise encore. */
  const detachSourceId = useCallback((id: string) => {
    const fingerprint = sourceFingerprintRef.current.get(id)
    unmapSourceId(id)
    if (!fingerprint) return

    const stillReferenced = [...sourceFingerprintRef.current.values()].includes(fingerprint)
    if (stillReferenced) return
    if (keepWarmRef.current) return

    releaseFingerprint(fingerprint)
  }, [releaseFingerprint, unmapSourceId])

  const acquireStream = useCallback(async (source: Source) => {
    return acquireSourceStream(source)
  }, [])

  const mediaKey = sources
    .map((s) => mediaSourceKey(s))
    .filter(Boolean)
    .join('|')

  useEffect(() => {
    const effectGen = ++effectGenRef.current
    const mediaSources = sources.filter(isAcquirableMediaSource)
    const activeIds = new Set(mediaSources.map((s) => s.id))
    const activeFingerprints = new Set<string>()

    for (const source of mediaSources) {
      const fingerprint = mediaCaptureFingerprint(source)
      if (!fingerprint) continue
      activeFingerprints.add(fingerprint)

      let cached = fingerprintRef.current.get(fingerprint)
      if (cached && !isStreamEntryAlive(cached)) {
        releaseFingerprint(fingerprint)
        cached = undefined
      }

      if (cached) {
        streamsRef.current.set(source.id, cached)
        sourceFingerprintRef.current.set(source.id, fingerprint)
        typeRef.current.set(source.id, source.type)
        continue
      }

      const currentFp = sourceFingerprintRef.current.get(source.id)
      if (currentFp === fingerprint && streamsRef.current.has(source.id)) continue

      if (streamsRef.current.has(source.id)) {
        detachSourceId(source.id)
      }

      const sourceId = source.id
      const sourceType = source.type
      acquireStream(source).then((entry) => {
        if (effectGen !== effectGenRef.current) {
          entry.stream?.getTracks().forEach((t) => t.stop())
          releaseSourceStream(sourceId, sourceType)
          return
        }
        if (!isAcquirableMediaSource(source)) {
          entry.stream?.getTracks().forEach((t) => t.stop())
          releaseSourceStream(sourceId, sourceType)
          return
        }
        const fpNow = mediaCaptureFingerprint(source)
        if (!fpNow || fpNow !== fingerprint) {
          entry.stream?.getTracks().forEach((t) => t.stop())
          releaseSourceStream(sourceId, sourceType)
          return
        }
        if (!activeIds.has(sourceId)) {
          entry.stream?.getTracks().forEach((t) => t.stop())
          releaseSourceStream(sourceId, sourceType)
          return
        }

        entry.sourceId = sourceId
        fingerprintRef.current.set(fingerprint, entry)
        streamsRef.current.set(sourceId, entry)
        sourceFingerprintRef.current.set(sourceId, fingerprint)
        typeRef.current.set(sourceId, sourceType)
      })
    }

    for (const id of [...streamsRef.current.keys()]) {
      if (!activeIds.has(id)) detachSourceId(id)
    }

    if (!keepWarmRef.current) {
      for (const fp of [...fingerprintRef.current.keys()]) {
        if (!activeFingerprints.has(fp)) releaseFingerprint(fp)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mediaKey résume les sources média
  }, [mediaKey, acquireStream, detachSourceId, releaseFingerprint])

  useEffect(() => {
    if (keepStreamsWarm) return
    for (const fp of [...fingerprintRef.current.keys()]) {
      const stillUsed = sources.some((s) => mediaCaptureFingerprint(s) === fp)
      if (!stillUsed) releaseFingerprint(fp)
    }
  }, [keepStreamsWarm, mediaKey, sources, releaseFingerprint])

  useEffect(() => {
    return () => {
      for (const fp of [...fingerprintRef.current.keys()]) releaseFingerprint(fp)
    }
  }, [releaseFingerprint])

  return { streamsRef }
}
