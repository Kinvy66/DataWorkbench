export default {
  app: {
    title: 'DataWorkbench'
  },
  window: {
    controls: '窗口',
    minimize: '最小化',
    maximize: '最大化',
    restore: '还原',
    close: '关闭'
  },
  ribbon: {
    file: '文件',
    home: '开始',
    sidecar: 'Sidecar',
    ping: 'Ping',
    pingTip: '调用 Python sidecar 的 host.hello',
    data: '数据',
    dataIo: '表格',
    dataManage: '管理',
    dataImport: '导入',
    dataImportTip: '导入 CSV、Excel 或 Parquet',
    dataExport: '导出',
    dataExportTip: '导出当前数据集',
    dataRemove: '移除',
    dataRemoveTip: '从内存中移除当前数据集',
    layoutSwitcher: '切换功能区布局',
    minimizeRibbon: '最小化功能区',
    keyTips: '快捷提示',
    new: '新建',
    open: '打开',
    save: '保存',
    saveAs: '另存为',
    exit: '退出'
  },
  layout: {
    datasets: '数据集',
    datasetsEmpty: '还没有数据集。使用「数据 → 导入」加载表格。',
    table: '表格',
    tableEmpty: '选择一个数据集以浏览表格。',
    workspace: '工作区',
    workspaceHint: '表格、工作流和图表将在此打开。',
    properties: '属性',
    propertiesEmpty: '未选择对象。',
    name: '名称',
    size: '尺寸',
    shape: '{rows} × {cols}',
    column: '列',
    dtype: '类型',
    log: '日志'
  },
  rpc: {
    invalidParams: '参数无效。'
  },
  data: {
    remove: '移除数据集',
    removeConfirm: '从内存中移除“{name}”？不会删除源文件。',
    pandasRequired: 'Python sidecar 未安装 pandas。',
    fileMissing: '找不到所选文件。',
    unsupportedFormat: '不支持此文件格式。',
    notFound: '找不到该数据集。',
    columnNotFound: '列或单元格超出范围。',
    invalidValue: '值与该列类型不匹配。',
    ioError: '读写文件失败。',
    pickleDisabled: '已禁用 pickle 导入。'
  },
  log: {
    ready: 'Sidecar 已就绪（pid {pid}，pandas {pandas}）。',
    pingOk: 'host.hello 成功，Python {version}，pandas {pandas}。',
    pingFail: 'host.hello 失败：{error}',
    pollution: 'Sidecar 标准输出被污染：{raw}',
    importOk: '已导入 {name}（{rows} × {cols}）。',
    exportOk: '数据集已导出。',
    removeOk: '数据集已移除。'
  }
}
