/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyWithToast, insertTextIntoChatInputBox } from "@utils/discord";
import { PluginNative } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { Popout, useEffect, useRef, useState } from "@webpack/common";

import { Brand, useApps } from "./family";
import { PixelIcon } from "./sprites";

const Native = VencordNative.pluginHelpers.Maska as PluginNative<typeof import("./native")>;
// The button of the account panel (mic, headphones, settings); GameActivityToggle uses the same one
const PanelButton = findComponentByCodeLazy(".GREEN,positionKeyStemOverride:");

// aura.sounds, aura.effects and aura.party as aura.txt last sent them (kit.txt hub/PROTOCOL.md)
interface Item {
    id: string;
    name: string;
}

interface AuraState {
    sounds: { mic?: boolean; pads?: Item[]; playing?: string[]; } | null;
    effects: { mic?: boolean; active?: string | null; items?: Item[]; } | null;
    party: { enabled?: boolean; canHost?: boolean; role?: "host" | "guest" | null; code?: string; people?: number; asking?: Item[]; } | null;
}

const TOPICS: Record<string, keyof AuraState> = { "aura.sounds": "sounds", "aura.effects": "effects", "aura.party": "party" };
export const AURA_TOPICS = Object.keys(TOPICS);
const EMPTY: AuraState = { sounds: null, effects: null, party: null };

let aura = EMPTY;
const listeners = new Set<() => void>();

function changed() {
    listeners.forEach(l => l());
}

// Stores the topic if it is one of aura.txt's
export function setAuraState(topic: string, data: unknown) {
    const key = TOPICS[topic];
    if (!key) return;
    aura = { ...aura, [key]: data && typeof data === "object" ? data : null };
    changed();
}

export function resetAura() {
    aura = EMPTY;
    changed();
}

function useAura() {
    const [, update] = useState(0);
    useEffect(() => {
        const listener = () => update(n => n + 1);
        listeners.add(listener);
        return () => void listeners.delete(listener);
    }, []);
    return aura;
}

// What the running aura.txt can do: an older one has none of these commands, and then there is no button
function useSections() {
    const commands = useApps().find(a => a.app === "aura")?.commands ?? [];
    return {
        sounds: commands.includes("sounds.play"),
        effects: commands.includes("effects.set"),
        party: commands.includes("party.start")
    };
}

function AuraPopout() {
    const can = useSections();
    const { sounds, effects, party } = useAura();
    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);

    async function run(name: string, args: object = {}, timeout?: number) {
        setError(null);
        const result = await Native.request("aura", name, args, timeout);
        if (!result.ok) setError(result.error === "timeout" ? "aura.txt не ответила" : String(result.error || "Не получилось"));
        return result;
    }

    async function startParty() {
        setStarting(true);
        // aura.txt waits for the network up to 30 seconds before it answers
        await run("party.start", {}, 35000);
        setStarting(false);
    }

    const open = <button className="dt-btn" onClick={() => run("show")}>Открыть aura.txt</button>;
    const noMic = (can.sounds && sounds?.mic === false) || (can.effects && effects?.mic === false);
    const playing = sounds?.playing ?? [];

    return (
        <div className="vc-maska-aura vc-maska-aura-popout">
            <div className="vc-maska-aura-head">
                <Brand app="aura" />
                <button className="dt-btn" onClick={() => run("show")}>Открыть</button>
            </div>

            {noMic && <div className="vc-maska-aura-warn">aura.txt не встроена в микрофон — звук слышите только вы</div>}

            {can.sounds && (
                <section>
                    <div className="vc-maska-aura-title">
                        <h3>Звуки</h3>
                        {playing.length > 0 && <button className="dt-btn" onClick={() => run("sounds.stop")}>Стоп</button>}
                    </div>
                    {sounds?.pads?.length ? (
                        <div className="vc-maska-aura-grid vc-maska-aura-grid-wide">
                            {sounds.pads.map(p => (
                                <button key={p.id} className="dt-btn vc-maska-aura-pad" aria-pressed={playing.includes(p.id)} title={p.name} onClick={() => run("sounds.play", { id: p.id })}>
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    ) : <div className="vc-maska-hint">Пэдов пока нет. Добавьте их в aura.txt</div>}
                </section>
            )}

            {can.effects && (
                <section>
                    <div className="vc-maska-aura-title">
                        <h3>Эффекты</h3>
                        {effects?.active != null && <button className="dt-btn dt-btn--primary" onClick={() => run("effects.off")}>Выключить</button>}
                    </div>
                    {effects?.items?.length ? (
                        <div className="vc-maska-aura-grid">
                            {effects.items.map(e => (
                                <button
                                    key={e.id}
                                    className="dt-btn vc-maska-aura-pad"
                                    aria-pressed={effects.active === e.id}
                                    title={e.name}
                                    onClick={() => effects.active === e.id ? run("effects.off") : run("effects.set", { id: e.id })}
                                >
                                    {e.name}
                                </button>
                            ))}
                        </div>
                    ) : <div className="vc-maska-hint">Готовых голосов нет</div>}
                </section>
            )}

            {can.party && (
                <section>
                    <div className="vc-maska-aura-title">
                        <h3>Пати</h3>
                        {party?.role && <button className="dt-btn" onClick={() => run("party.stop")}>{party.role === "host" ? "Остановить" : "Выйти"}</button>}
                    </div>
                    {party?.role === "host" ? (
                        <div className="vc-maska-list">
                            <div className="vc-maska-aura-code">{party.code}</div>
                            <div className="vc-maska-aura-row">
                                <button className="dt-btn" onClick={() => { setError(null); copyWithToast(party.code ?? "", "Код скопирован"); }}>Скопировать</button>
                                <button className="dt-btn" onClick={() => { setError(null); insertTextIntoChatInputBox(party.code ?? ""); }}>В чат</button>
                                <span className="vc-maska-hint">гостей: {party.people ?? 0}</span>
                            </div>
                            {party.asking?.map(p => (
                                <div className="dt-row" key={p.id}>
                                    <div className="vc-maska-row-text">{p.name}</div>
                                    <button className="dt-btn dt-btn--primary" onClick={() => run("party.answer", { id: p.id, ok: true })}>Впустить</button>
                                    <button className="dt-btn" onClick={() => run("party.answer", { id: p.id, ok: false })}>Отклонить</button>
                                </div>
                            ))}
                            <div className="vc-maska-aura-row">
                                <span className="vc-maska-hint">Что слышат гости, выбирается в aura.txt</span>
                                {open}
                            </div>
                        </div>
                    ) : party?.role === "guest" ? (
                        <div className="vc-maska-aura-row">
                            <span>Вы в пати</span>
                            {open}
                        </div>
                    ) : party?.canHost === false ? (
                        <div className="vc-maska-aura-row">
                            <span className="vc-maska-hint">Пати не создать: aura.txt не встроена в микрофон</span>
                            {open}
                        </div>
                    ) : (
                        <div className="vc-maska-aura-row">
                            <button className="dt-btn dt-btn--primary" disabled={starting} onClick={startParty}>{starting ? "Создаётся…" : "Начать пати"}</button>
                            {party?.enabled === false && <span className="vc-maska-hint">Раздел «Пати» в aura.txt включится сам</span>}
                        </div>
                    )}
                </section>
            )}

            {error && <div className="vc-maska-aura-error">{error}</div>}
        </div>
    );
}

// The aura.txt button in the account panel, before the mic; a dot while an effect, a sound or a party is on
export function AuraButton({ nameplate }: { nameplate?: unknown; }) {
    const can = useSections();
    const { sounds, effects, party } = useAura();
    const ref = useRef<HTMLButtonElement>(null);
    const [shown, setShown] = useState(false);

    if (!can.sounds && !can.effects && !can.party) return null;
    const busy = effects?.active != null || !!sounds?.playing?.length || !!party?.role;

    return (
        <Popout
            position="top"
            align="left"
            animation={Popout.Animation.NONE}
            shouldShow={shown}
            onRequestClose={() => setShown(false)}
            targetElementRef={ref}
            renderPopout={() => <AuraPopout />}
        >
            {() => (
                <PanelButton
                    ref={ref}
                    tooltipText="aura.txt"
                    icon={() => (
                        <span className="vc-maska-aura-icon">
                            <PixelIcon app="aura" size={20} />
                            {busy && <i className="vc-maska-aura-dot" />}
                        </span>
                    )}
                    role="button"
                    plated={nameplate != null}
                    onClick={() => setShown(v => !v)}
                />
            )}
        </Popout>
    );
}
