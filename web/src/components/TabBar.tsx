import type {Tab} from '@/components/tabs';
import {useMessages} from '@/i18n/LocaleProvider';
import {linkProps, type Route} from '@/lib/route';

const ICON_SIZE = 23;

type TabBarProps = {
  tabs: readonly Tab[];
  route: Route;
  onNavigate: (route: Route) => void;
};

// Floats over the page in a glass bar, every tab in ink and the active one
// marked by a lens that slides between them. The app's TabBar draws the
// same.
export function TabBar({tabs, route, onNavigate}: TabBarProps) {
  const t = useMessages();
  const active = tabs.findIndex((tab) => tab.route === route);

  return (
    <nav
      aria-label={t.tabs.mainMenu}
      className='tab-bar-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 p-5 pt-0'
    >
      <div className='glass pointer-events-auto relative mx-auto flex max-w-md rounded-card p-1.5'>
        {active >= 0 ? (
          <span
            aria-hidden
            className='absolute inset-y-1.5 left-1.5 rounded-card-inner bg-theme-sunk transition-transform duration-[320ms] ease-[cubic-bezier(0.3,1.12,0.5,1)] motion-reduce:transition-none'
            style={{
              width: `calc((100% - 12px) / ${tabs.length})`,
              transform: `translateX(${active * 100}%)`,
            }}
          />
        ) : null}
        {tabs.map(({route: target, label, Icon}, index) => (
          <a
            key={target}
            {...linkProps(target, onNavigate)}
            aria-current={index === active ? 'page' : undefined}
            className='relative flex flex-1 flex-col items-center gap-1 rounded-card-inner py-1.5 text-theme-ink active:opacity-60'
          >
            <Icon size={ICON_SIZE} />
            <span className='mt-px text-[11px] leading-[13px] font-semibold'>
              {label(t)}
            </span>
          </a>
        ))}
      </div>
    </nav>
  );
}
