'use client';

import React, { ReactNode, useCallback, useState } from 'react';
import { AppSidebar } from '@gitroom/frontend/components/shadcn/app-sidebar';
import { BottomNav } from '@gitroom/frontend/components/shadcn/bottom-nav';
import { Plus_Jakarta_Sans } from 'next/font/google';
const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  {
    ssr: false,
  }
);

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
import { ShowMediaBoxModal } from '@gitroom/frontend/components/media/media.component';
import { ShowLinkedinCompany } from '@gitroom/frontend/components/launches/helpers/linkedin.component';
import { MediaSettingsLayout } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { ShowPostSelector } from '@gitroom/frontend/components/post-url-selector/post.url.selector';
import { NewSubscription } from '@gitroom/frontend/components/layout/new.subscription';
import { Support } from '@gitroom/frontend/components/layout/support';
import { ContinueProvider } from '@gitroom/frontend/components/layout/continue.provider';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { CopilotKit } from '@copilotkit/react-core';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Impersonate } from '@gitroom/frontend/components/layout/impersonate';
import { AnnouncementBanner } from '@gitroom/frontend/components/layout/announcement.banner';
import { Title } from '@gitroom/frontend/components/layout/title';
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import { ChromeExtensionComponent } from '@gitroom/frontend/components/layout/chrome.extension.component';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import { StreakComponent } from '@gitroom/frontend/components/layout/streak.component';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { AttachToFeedbackIcon } from '@gitroom/frontend/components/new-layout/sentry.feedback.component';
import { FirstBillingComponent } from '@gitroom/frontend/components/billing/first.billing.component';
import { ProductProvider } from '@gitroom/frontend/components/layout/product.context';
import { ProductSwitcher } from '@gitroom/frontend/components/layout/product.switcher';

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['600', '500', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

export const LayoutComponent = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();

  const { backendUrl, billingEnabled, isGeneral } = useVariables();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Feedback icon component attaches Sentry feedback to a top-bar icon when DSN is present
  const searchParams = useSearchParams();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user, error: userError, mutate } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
    shouldRetryOnError: true,
    errorRetryInterval: 2000,
  });

  if (!user) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
          <div className="text-sm text-gray-500">
            {userError ? 'Waiting for the API…' : 'Loading workspace…'}
          </div>
          {userError && (
            <div className="text-xs text-gray-400">
              Backend at <code className="rounded bg-gray-100 px-1">{backendUrl}</code> is not
              responding yet — will retry automatically.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <ContextWrapper user={user}>
     <ProductProvider>
      <CopilotKit
        credentials="include"
        runtimeUrl={backendUrl + '/copilot/chat'}
        showDevConsole={false}
      >
        <MantineWrapper>
          <ToolTip />
          <Toaster />
          <CheckPayment check={searchParams.get('check') || ''} mutate={mutate}>
            <ShowMediaBoxModal />
            <ShowLinkedinCompany />
            <MediaSettingsLayout />
            <ShowPostSelector />
            <PreConditionComponent />
            <NewSubscription />
            <ContinueProvider />
            <div
              className={clsx(
                'flex min-h-screen w-screen flex-col bg-white text-gray-900',
                jakartaSans.className
              )}
            >
              {user?.admin && <Impersonate />}
              {user.tier === 'FREE' && isGeneral && billingEnabled ? (
                <FirstBillingComponent />
              ) : (
                <>
                  <AnnouncementBanner />
                  <div className="flex flex-1">
                    <Support />
                    <div className="hidden lg:flex">
                      <AppSidebar
                        collapsed={sidebarCollapsed}
                        onToggle={() => setSidebarCollapsed((v) => !v)}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col bg-white">
                      <div className="flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:h-16 lg:px-6">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="hidden truncate text-base font-semibold text-gray-900 sm:block lg:text-lg">
                            <Title />
                          </div>
                          <ProductSwitcher />
                        </div>
                        <div className="hidden items-center gap-4 text-gray-500 lg:flex">
                          <StreakComponent />
                          <div className="h-5 w-px bg-gray-200" />
                          <OrganizationSelector />
                          <div className="hover:text-gray-900">
                            <ModeComponent />
                          </div>
                          <div className="h-5 w-px bg-gray-200" />
                          <LanguageComponent />
                          <ChromeExtensionComponent />
                          <div className="h-5 w-px bg-gray-200" />
                          <AttachToFeedbackIcon />
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 lg:hidden" />
                      </div>
                      <div
                        className="flex-1 overflow-y-auto bg-gray-50 pb-[88px] lg:pb-0"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
                      >
                        {children}
                      </div>
                    </div>
                  </div>
                  <BottomNav />
                </>
              )}
            </div>
          </CheckPayment>
        </MantineWrapper>
      </CopilotKit>
     </ProductProvider>
    </ContextWrapper>
  );
};
