# Vencord + плагин Kapsula

Это официальный [Vencord](https://github.com/Vendicated/Vencord) с одним добавленным плагином — **Kapsula** (`src/plugins/kapsula.desktop`). Больше в этой сборке ничего не меняется: каждые несколько часов GitHub сам забирает свежий Vencord, собирает его вместе с плагином и выкладывает в релиз `DevBuild`. Встроенное обновление Vencord в Discord берёт обновления отсюда же, поэтому плагин не пропадает.

**Что делает плагин.** Раз в полсекунды сообщает острову [Kapsula](https://github.com/cxxperman/kapsula) на этом же компьютере (`127.0.0.1:42073`), что происходит в голосе Discord: вы в звонке или в голосовом канале и с какого момента, выключен ли микрофон, полный мут, идёт ли демонстрация экрана, включена ли камера, говорит ли кто-нибудь. В ответ остров может попросить выключить микрофон, включить полный мут или выйти из звонка — это кнопки на острове. Никуда, кроме вашего компьютера, плагин ничего не отправляет.

**Как поставить.** В Kapsula: Настройки → Steam и Discord → «Звонки Discord на острове» → «Подключить», потом перезапустить Discord. Если Vencord уже стоит, меняются только его файлы (прежние сохраняются, «Отключить» возвращает их), ваши плагины и настройки остаются.

Vencord — неофициальная модификация Discord; ставить её или нет, решаете вы. Лицензия — GPL-3.0, как у Vencord.

---

**English.** Official Vencord plus one plugin, Kapsula, which tells the Kapsula island on the same computer (`127.0.0.1:42073`) about your Discord voice state (call, channel, time, mute, deafen, screen share) and accepts mute/deafen/leave commands from it. Rebuilt automatically from every Vencord update and published as the `DevBuild` release, so Vencord's built-in updater keeps the plugin. GPL-3.0, like Vencord.
