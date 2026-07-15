import { deleteParticipantAction } from '@/app/actions/admin'
import { t } from '@/lib/i18n'

/** ADM-13, D-050: единая кнопка удаления участника — ставится во ВСЕ разделы админки
 *  (заявки, студенты, клиенты + карточки). Все точки вызывают одну доменную функцию
 *  deleteParticipant через один экшен deleteParticipantAction.
 *
 *  Без клиентского JS: подтверждение — нативный <details> «Удалить» + ввод email участника
 *  (ADM-11, тот же приём, что «Опасная зона» карточки студента). successTo/errorTo — куда вести
 *  после успеха (обычно список — карточки удалённого уже нет) и после ошибки (обычно та же
 *  страница, чтобы показать банер, не потеряв контекст). */
export function DeleteParticipant({
  refType, id, email, successTo, errorTo,
}: {
  refType: 'user' | 'registration'
  id: string
  email: string
  successTo: string
  errorTo: string
}) {
  const td = t.admin.deleteParticipant
  return (
    <details className="danger-zone">
      <summary>{td.summary}</summary>
      <div className="danger-zone-body">
        <p className="crat-muted">{td.warning}</p>
        <form action={deleteParticipantAction}>
          <input type="hidden" name={refType === 'user' ? 'userId' : 'registrationId'} value={id} />
          <input type="hidden" name="successTo" value={successTo} />
          <input type="hidden" name="errorTo" value={errorTo} />
          <label>
            {td.confirmLabel}
            <input name="confirmEmail" placeholder={email} autoComplete="off" required />
          </label>
          <button className="crat-button danger" type="submit">{td.button}</button>
        </form>
      </div>
    </details>
  )
}
