import { useEffect, useRef, useCallback } from 'react'
import type { Source } from '../types'
import { acquireSourceStream, releaseSourceStream, type StreamEntry } from '../lib/drawScene'
import { isAcquirableMediaSource, mediaCaptureFingerprint, mediaSourceKey } from '../lib/sourceMedia'

interface UseSceneMediaOptions {
  /** Pendant un live/enregistrement, évite de couper les flux inutilisés trop tôt. */
  keepStreamsWarm?: boolean
}

export function useSceneMedia(sources: Source[], options: UseSceneMediaOptions = {}) {
  const { keepStreamsWarm = false } = options
  const streamsRef = useRef<Map<string, StreamEntry>>(new Map())
  const fingerprintRef = useRef<Map<string, StreamEntry>>(new Map())
  const sourceFingerprintRef = useRef<Map<string, string>>(new Map())
  const typeRef = useRef<Map<string, Source['type']>>(new Map())
  const keepWarmRef = useRef(keepStreamsWarm)
  keepWarmRef.current = keepStreamsWarm

  const releaseEntry = useCallback((id: string) => {
    const entry = streamsRef.current.get(id)
    if (entry) {
      entry.stream?.getTracks().forEach((t) => t.stop())
      const type = typeRef.current.get(id)
      if (type) releaseSourceStream(id, type)
    }
    streamsRef.current.delete(id)
    sourceFingerprintRef.current.delete(id)
    typeRef.current.delete(id)
  }, [])

  const releaseFingerprint = useCallback((fingerprint: string) => {
    const entry = fingerprintRef.current.get(fingerprint)
    if (entry) {
      entry.stream?.getTracks().forEach((t) => t.stop())
      fingerprintRef.current.delete(fingerprint)
    }
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
    const activeFingerprints = new Set<string>()

    for (const source of mediaSources) {
      const fingerprint = mediaCaptureFingerprint(source)
      if (!fingerprint) continue
      activeFingerprints.add(fingerprint)

      const cached = fingerprintRef.current.get(fingerprint)
      if (cached) {
        streamsRef.current.set(source.id, cached)
        sourceFingerprintRef.current.set(source.id, fingerprint)
        typeRef.current.set(source.id, source.type)
        continue
      }

      const currentFp = sourceFingerprintRef.current.get(source.id)
      if (currentFp === fingerprint && streamsRef.current.has(source.id)) continue

      if (streamsRef.current.has(source.id)) {
        releaseEntry(source.id)
      }

      acquireStream(source).then((entry) => {
        if (!isAcquirableMediaSource(source)) {
          entry.stream?.getTracks().forEach((t) => t.stop())
          releaseSourceStream(source.id, source.type)
          return
        }
        const fpNow = mediaCaptureFingerprint(source)
        if (!fpNow || fpNow !== fingerprint) {
          entry.stream?.getTracks().forEach((t) => t.stop())
          releaseSourceStream(source.id, source.type)
          return
        }
        if (!activeIds.has(source.id)) {
          entry.stream?.getTracks().forEach((t) => t.stop())
          releaseSourceStream(source.id, source.type)
          return
        }

        fingerprintRef.current.set(fingerprint, entry)
        streamsRef.current.set(source.id, entry)
        sourceFingerprintRef.current.set(source.id, fingerprint)
        typeRef.current.set(source.id, source.type)
      })
    }

    for (const id of [...streamsRef.current.keys()]) {
      if (!activeIds.has(id)) releaseEntry(id)
    }

    if (!keepWarmRef.current) {
      for (const fp of [...fingerprintRef.current.keys()]) {
        if (!activeFingerprints.has(fp)) releaseFingerprint(fp)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mediaKey résume les sources média
  }, [mediaKey, acquireStream, releaseEntry, releaseFingerprint])

  useEffect(() => {
    if (keepStreamsWarm) return
    for (const fp of [...fingerprintRef.current.keys()]) {
      const stillUsed = sources.some((s) => mediaCaptureFingerprint(s) === fp)
      if (!stillUsed) releaseFingerprint(fp)
    }
  }, [keepStreamsWarm, mediaKey, sources, releaseFingerprint])

  useEffect(() => {
    return () => {
      for (const id of [...streamsRef.current.keys()]) releaseEntry(id)
      for (const fp of [...fingerprintRef.current.keys()]) releaseFingerprint(fp)
    }
  }, [releaseEntry, releaseFingerprint])

  return { streamsRef }
}
