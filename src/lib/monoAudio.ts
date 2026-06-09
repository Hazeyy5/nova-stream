/** Routage audio stéréo → centre (mono sur les deux oreilles / une piste). */

export function connectCenteredMono(
  source: AudioNode,
  gain: GainNode,
  destination: AudioNode,
  channelCount: number
): void {
  const ctx = gain.context

  if (channelCount <= 1) {
    source.connect(gain)
    gain.connect(destination)
    return
  }

  const splitter = ctx.createChannelSplitter(2)
  const monoSum = ctx.createChannelMerger(1)
  const stereoOut = ctx.createChannelMerger(2)

  source.connect(splitter)
  splitter.connect(monoSum, 0, 0)
  splitter.connect(monoSum, 1, 0)

  monoSum.connect(gain)
  gain.connect(stereoOut, 0, 0)
  gain.connect(stereoOut, 0, 1)
  stereoOut.connect(destination)
}
