'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { t } from '@/lib/i18n'

const STORAGE_KEY = 'crat_cookie_ack'
// Кастомное событие — 'storage' срабатывает только в ДРУГИХ вкладках, не в той, что вызвала
// setItem; без него клик «Понятно» не скрыл бы баннер в текущей вкладке без reload.
const ACK_EVENT = 'crat-cookie-ack-changed'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(ACK_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(ACK_EVENT, callback)
  }
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — считаем «уже подтверждено», чтобы
    // не показывать баннер, который нельзя надёжно закрыть (страница не должна падать).
    return true
  }
}

// На сервере localStorage нет — рендерим как «уже подтверждено» (баннер скрыт). useSyncExternalStore
// сам сверяет это с getSnapshot() после гидратации и обновляет разметку без ручного эффекта —
// поэтому баннер не мигает до гидратации и не требует setState внутри useEffect.
function getServerSnapshot() {
  return true
}

/**
 * Ф7в T5, LEGAL-04/06, D-037: информационный куки-баннер — не consent-стена (платформа
 * ставит только строго необходимый сессионный cookie и cookieless-аналитику Plausible,
 * UX-07). Единственное действие — «Понятно», выбор запоминается в localStorage.
 */
export function CookieBanner() {
  const acknowledged = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  // T4 дизайн-аудита: в кабинете (/app) и админке (/admin) баннер не нужен — это уже
  // авторизованная зона, LEGAL-04/06 требует показывать его на публичных страницах.
  const pathname = usePathname()
  const hiddenRoute = pathname.startsWith('/app') || pathname.startsWith('/admin')
  const ref = useRef<HTMLDivElement>(null)
  // T3 (D-042): fallback для входа снизу в браузерах без @starting-style (site.css
  // .cookie-banner) — один кадр после монтирования переключает атрибут, CSS-transition
  // отрабатывает переход между «за экраном» и обычным положением сам.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (acknowledged) return
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [acknowledged])

  // Баннер фиксирован снизу — без резерва места он перекрывает последние пиксели страницы
  // (в частности, ссылки футера, включая /cookies — ревью нашло это на коротких страницах
  // при скролле до конца). Резервируем под него place через padding-bottom на body, пока
  // он виден; ResizeObserver держит отступ точным при переносе текста на узких экранах.
  useEffect(() => {
    if (acknowledged) {
      document.body.style.removeProperty('padding-bottom')
      return
    }
    const el = ref.current
    if (!el) return
    const apply = () => {
      document.body.style.paddingBottom = `${el.offsetHeight}px`
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.body.style.removeProperty('padding-bottom')
    }
  }, [acknowledged])

  function ack() {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // см. комментарий в getSnapshot — сбой записи не должен мешать закрыть баннер визуально
    }
    window.dispatchEvent(new Event(ACK_EVENT))
  }

  if (hiddenRoute) return null

  return (
    <>
      {/* T9 дизайн-аудита: без JS getServerSnapshot() всегда «acknowledged» (см. комментарий
          выше — так JS-версия не мигает уже согласившимся посетителям при гидратации), а
          значит div ниже в SSR-разметке без JS вообще отсутствует и «Понятно» всё равно не
          сработал бы (onClick требует JS) — LEGAL-04/06 требует, чтобы уведомление было видно
          и без JS. <noscript> рендерится браузером только когда JS выключен — статичная копия
          без кнопки (не давать нажать то, что не работает), полностью независима от хука выше. */}
      <noscript>
        <div className="cookie-banner cookie-banner--noscript" role="complementary" aria-label={t.legal.banner.ariaLabel}>
          <div className="cookie-banner-inner crat-shell">
            <p className="cookie-banner-text crat-muted">
              {t.legal.banner.text}{' '}
              <Link href="/cookies">{t.legal.banner.linkLabel}</Link>
            </p>
          </div>
        </div>
      </noscript>
      {!acknowledged && (
        <div
          ref={ref}
          className="cookie-banner"
          data-mounted={mounted ? '' : undefined}
          role="complementary"
          aria-label={t.legal.banner.ariaLabel}
        >
          <div className="cookie-banner-inner crat-shell">
            <p className="cookie-banner-text crat-muted">
              {t.legal.banner.text}{' '}
              <Link href="/cookies">{t.legal.banner.linkLabel}</Link>
            </p>
            <button type="button" className="crat-button primary" onClick={ack}>
              {t.legal.banner.ack}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
