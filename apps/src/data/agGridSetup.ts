import {
  CellStyleModule,
  EventApiModule,
  InfiniteRowModelModule,
  LocaleModule,
  ModuleRegistry,
  RenderApiModule,
  TextEditorModule,
  TooltipModule,
  ValidationModule
} from 'ag-grid-community'

let registered = false

export function registerAppGridModules(): void {
  if (registered) {
    return
  }
  registered = true
  const modules = [
    InfiniteRowModelModule,
    TextEditorModule,
    CellStyleModule,
    LocaleModule,
    TooltipModule,
    EventApiModule,
    RenderApiModule
  ]
  if (import.meta.env.DEV) {
    modules.push(ValidationModule)
  }
  ModuleRegistry.registerModules(modules)
}
