import type {Tab} from '@/components/tabs';
import {useMessages} from '@/i18n/LocaleProvider';
import {linkProps, type Route} from '@/lib/route';

const ICON_SIZE = 23;

type TabBarProps = {
  tabs: readonly Tab[];
  route: Route;
  onNavigate: (route: Route) => void;
};

export function TabBar({tabs, route, onNavigate}: TabBarProps) {
  const t = useMessages();

  return (
    <nav
      aria-label={t.tabs.mainMenu}
      className='shrink-0 border-t border-theme-line bg-theme-bg pb-[env(safe-area-inset-bottom)]'
    >
      <div className='flex p-1.5'>
        {tabs.map(({route: target, label, Icon}) => {
          const active = route === target;

          return (
            <a
              key={target}
              {...linkProps(target, onNavigate)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-1.5 rounded-lg transition-colors active:opacity-60 ${
                active
                  ? 'text-theme-ink'
                  : 'text-theme-faint hover:text-theme-muted'
              }`}
            >
              <Icon size={ICON_SIZE} />
              <span className='mt-px text-[11px] font-semibold leading-none'>
                {label(t)}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
