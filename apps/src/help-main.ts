import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import HelpViewer from './views/app/HelpViewer.vue'
import { i18n } from './i18n'
import './styles.css'

const app = createApp(HelpViewer)
app.use(i18n)
app.use(ElementPlus)
app.mount('#app')
