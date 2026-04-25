export const IPC = {
  // Renderer -> Main (invoke/handle)
  Add: 'torrent:add',
  Remove: 'torrent:remove',
  Pause: 'torrent:pause',
  Resume: 'torrent:resume',
  List: 'torrent:list',
  ChoosePath: 'dialog:choose-save-path',
  OpenPath: 'shell:open-save-path',
  SetFilePriority: 'torrent:set-file-priority',
  ToggleFilePause: 'torrent:toggle-file-pause',

  // Main -> Renderer (send/on)
  Progress: 'torrent:progress',
  Done: 'torrent:done',
  Error: 'torrent:error'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
