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
    new: '新建',
    open: '打开',
    save: '保存',
    saveAs: '另存为',
    exit: '退出'
  },
  layout: {
    datasets: '数据集',
    datasetsEmpty: '还没有数据集。导入将在 P1 提供。',
    workspace: '工作区',
    workspaceHint: '表格、工作流和图表将在此打开。',
    properties: '属性',
    propertiesEmpty: '未选择对象。',
    log: '日志'
  },
  log: {
    ready: 'Sidecar 已就绪（pid {pid}，pandas {pandas}）。',
    pingOk: 'host.hello 成功，Python {version}，pandas {pandas}。',
    pingFail: 'host.hello 失败：{error}',
    pollution: 'Sidecar 标准输出被污染：{raw}'
  }
}
