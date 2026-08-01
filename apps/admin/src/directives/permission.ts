import type { App, Directive } from 'vue';

import { pinia } from '@/stores';
import { useAuthStore } from '@/stores/auth';

const permissionDirective: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    const auth = useAuthStore(pinia);
    if (!auth.hasPermission(binding.value)) {
      element.hidden = true;
    }
  },
};

export function registerPermissionDirective(app: App): void {
  app.directive('permission', permissionDirective);
}
