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
    data: 'Data',
    dataImportGroup: 'Import',
    dataExportGroup: 'Export',
    dataDataset: 'Dataset',
    dataImport: 'Import',
    dataImportTip: 'Import CSV, Excel, or Parquet',
    dataExport: 'Export',
    dataExportTip: 'Export the selected dataset',
    dataRename: 'Rename',
    dataRenameTip: 'Rename the selected dataset',
    dataRemove: 'Remove',
    dataRemoveTip: 'Remove the selected dataset from memory',
    layoutSwitcher: 'Switch ribbon layout',
    minimizeRibbon: 'Minimize ribbon',
    keyTips: 'Key Tips',
    new: 'New',
    open: 'Open',
    save: 'Save',
    saveAs: 'Save As',
    exit: 'Exit'
  },
  layout: {
    datasets: 'Datasets',
    datasetsEmpty: 'No datasets yet. Use Data → Import to load a table.',
    table: 'Table',
    tableEmpty: 'Select a dataset to browse its table.',
    workspace: 'Workspace',
    workspaceHint: 'Tables, workflow, and charts will open here.',
    properties: 'Properties',
    propertiesEmpty: 'Nothing selected.',
    name: 'Name',
    size: 'Size',
    shape: '{rows} × {cols}',
    column: 'Column',
    dtype: 'Type',
    log: 'Log'
  },
  rpc: {
    invalidParams: 'Invalid parameters.'
  },
  data: {
    remove: 'Remove dataset',
    removeConfirm: 'Remove “{name}” from memory? This does not delete the file.',
    renamePrompt: 'New dataset name',
    pandasRequired: 'pandas is not installed in the Python sidecar.',
    fileMissing: 'The selected file was not found.',
    unsupportedFormat: 'This file format is not supported.',
    notFound: 'Dataset not found.',
    columnNotFound: 'Column or cell is out of range.',
    invalidValue: 'The value does not match the column type.',
    ioError: 'Failed to read or write the file.',
    pickleDisabled: 'Pickle import is disabled.'
  },
  log: {
    ready: 'Sidecar ready (pid {pid}, pandas {pandas}).',
    pingOk: 'host.hello ok, Python {version}, pandas {pandas}.',
    pingFail: 'host.hello failed: {error}',
    pollution: 'Protocol pollution on sidecar stdout: {raw}',
    importOk: 'Imported {name} ({rows} × {cols}).',
    exportOk: 'Dataset exported.',
    renameOk: 'Dataset renamed to {name}.',
    removeOk: 'Dataset removed.'
  }
}
