import type { Pinia } from 'pinia';
import type { Router } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

export function installRouterGuards(router: Router, pinia: Pinia): void {
  router.beforeEach(async (to) => {
    const auth = useAuthStore(pinia);

    if (to.meta.public) {
      return true;
    }

    if (to.meta.requiresAuth && !auth.isAuthenticated) {
      return {
        name: 'login',
        query: { redirect: to.fullPath },
      };
    }

    if (auth.isAuthenticated) {
      try {
        await auth.restore();
      } catch {
        auth.clearSession();
        return {
          name: 'login',
          query: { redirect: to.fullPath },
        };
      }
    }

    if (
      typeof to.meta.permission === 'string' &&
      !auth.hasPermission(to.meta.permission)
    ) {
      return { name: 'dashboard' };
    }

    return true;
  });

  router.afterEach((to) => {
    const title = String(to.meta.title ?? '');
    document.title = title ? `${title}｜鲜链云` : '鲜链云管理后台';
  });
}
