import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

import App from './App.vue';
import { registerPermissionDirective } from './directives/permission';
import { pinia } from './stores';
import { router } from './router';
import './styles/index.css';

const app = createApp(App);

app.use(pinia);
app.use(router);
app.use(ElementPlus);
registerPermissionDirective(app);

app.mount('#app');
