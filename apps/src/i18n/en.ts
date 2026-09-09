export default {
  app: {
    title: 'DataWorkbench'
  },
  window: {
    controls: 'Window',
    minimize: 'Minimize',
    maximize: 'Maximize',
    restore: 'Restore',
    close: 'Close'
  },
  ribbon: {
    file: 'File',
    home: 'Home',
    sidecar: 'Sidecar',
    ping: 'Ping',
    pingTip: 'Call host.hello on the Python sidecar',
    new: 'New',
    open: 'Open',
    save: 'Save',
    saveAs: 'Save As',
    exit: 'Exit'
  },
  layout: {
    datasets: 'Datasets',
    datasetsEmpty: 'No datasets yet. Import arrives in P1.',
    workspace: 'Workspace',
    workspaceHint: 'Tables, workflow, and charts will open here.',
    properties: 'Properties',
    propertiesEmpty: 'Nothing selected.',
    log: 'Log'
  },
  log: {
    ready: 'Sidecar ready (pid {pid}, pandas {pandas}).',
    pingOk: 'host.hello ok, Python {version}, pandas {pandas}.',
    pingFail: 'host.hello failed: {error}',
    pollution: 'Protocol pollution on sidecar stdout: {raw}'
  }
}
