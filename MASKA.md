# Vencord + плагин Maska

**Maska** — ваш вид и ваши звонки для Discord, часть dev.txt. Это второй плагин этой сборки (`src/plugins/maska.desktop`), рядом с [Kapsula](KAPSULA.md). Сам [Vencord](https://github.com/Vendicated/Vencord) в сборке по-прежнему не меняется, и собирается она так же: GitHub забирает свежий Vencord, собирает его с обоими плагинами и выкладывает в релиз `DevBuild`.

**Что делает плагин.**

- **Вид.** Оформляет Discord в общем стиле dev.txt: тёмное стекло, общий цвет, шрифт Segoe UI Variable, скруглённые углы. Цвета, радиусы и шрифты взяты из общих токенов kit.txt. Оформление меняет только тёмную тему Discord; в светлой остаются цвет, шрифт и углы.
- **Звонки.** Сообщает хабу dev.txt, что происходит в голосе Discord: вы в звонке или в голосовом канале и с какого момента, как называется канал, кто в нём и кто говорит, выключен ли микрофон, полный мут, идёт ли демонстрация экрана, включена ли камера, кто вам сейчас звонит. В ответ другие приложения dev.txt могут попросить выключить микрофон, включить полный мут, выйти из звонка, принять или отклонить входящий звонок.
- **Общий вид.** Если в core.txt выбран общий цвет, Discord красится в него. Если включено «Меньше движения», меню Maska появляются без анимации.

**Настройки.** Три переключателя: «Оформление dev.txt», «Скруглённые углы», «Показывать звонки другим приложениям dev.txt». Они есть и в настройках плагина в Discord, и на общей странице настроек в core.txt — это одни и те же настройки. Если выключить третий, плагин перестаёт сообщать о звонках и не выполняет команды.

**Что и куда передаётся.** Только хабу на этом же компьютере (`127.0.0.1:42080`, он живёт в core.txt), обычным локальным запросом. Передаются состояние звонка (вместе с именами и адресами аватаров тех, кто в канале) и три переключателя. Сообщения, переписка, пароли и токен Discord не передаются. С компьютера ничего не уходит: в интернет плагин не обращается. «Отклонить» — тот же запрос к Discord, что и его собственная кнопка. Если core.txt не запущен, плагин тихо пробует подключиться снова, а оформление работает и без него.

**Maska и Kapsula.** Оба плагина остаются и друг другу не мешают. Kapsula по-прежнему сообщает о звонке прямо острову (`127.0.0.1:42073`) — на этом держатся выпущенные версии Kapsula. Maska говорит то же самое хабу, чтобы звонок видели все приложения dev.txt, и добавляет оформление.

**Как включить.** Плагин входит в сборку, но выключен, пока вы сами его не включите: Discord → Настройки → Vencord → Plugins → Maska. Так Discord не меняет вид у тех, кто ставил сборку только ради Kapsula.

Vencord — неофициальная модификация Discord; ставить её или нет, решаете вы. Maska основана на Vencord; лицензия та же — GPL-3.0.

---

**English.** Maska is the second plugin of this Vencord build, next to Kapsula. It gives Discord the dev.txt look (dark glass, the shared accent colour, Segoe UI Variable, rounded corners, all taken from the kit.txt design tokens) and tells the dev.txt hub on the same computer (`127.0.0.1:42080`, inside core.txt) about your Discord voice state: call, channel, time, who is there and talking, mute, deafen, screen share, camera, who is calling you. Other dev.txt apps can ask it to mute, deafen, leave, accept or decline. Nothing leaves the computer. The Kapsula plugin stays as it is and keeps talking to the island directly. Maska is off until you enable it in Vencord's plugin list. Based on Vencord, GPL-3.0, same as Vencord.
