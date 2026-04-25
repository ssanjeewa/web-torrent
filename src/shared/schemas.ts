import { z } from 'zod'

export const MagnetSchema = z
  .string()
  .regex(
    /^magnet:\?xt=urn:btih:[A-Fa-f0-9]{40,64}([&].*)?$/,
    'Invalid magnet URI'
  )

export const InfoHashSchema = z
  .string()
  .regex(/^[A-Fa-f0-9]{40}$/, 'Invalid info hash')

export const AddTorrentRequestSchema = z.object({
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('magnet'), uri: MagnetSchema }),
    z.object({
      kind: z.literal('file'),
      buffer: z.instanceof(ArrayBuffer),
      fileName: z.string().min(1).max(255)
    })
  ]),
  savePath: z.string().min(1)
})

export const RemoveTorrentRequestSchema = z.object({
  infoHash: InfoHashSchema,
  deleteFiles: z.boolean()
})

export const SetFilePrioritySchema = z.object({
  infoHash: InfoHashSchema,
  fileIndex: z.number().int().min(0),
  priority: z.enum(['high', 'normal', 'skip'])
})
