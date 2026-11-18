/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle, managedStyleRootNode } from "@api/Styles";
import { createAndAppendStyle } from "@utils/css";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { ApplicationStreamingStore, CallStore, ChannelStore, GuildMemberStore, GuildStore, MediaEngineStore, RelationshipStore, RestAPI, SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

import themeStyle from "./maska.css?managed";
import roundedStyle from "./rounded.css?managed";

// Sent to the hub in hello; the launcher shows it in hub.apps
const VERSION = "0.1.0";

const Native = VencordNative.pluginHelpers.Maska as PluginNative<typeof import("./native")>;
// The same Discord internals as the Kapsula plugin next door (kapsula.desktop), nothing new
const SpeakingStore = findStoreLazy("SpeakingStore");
const AudioActions = findByPropsLazy("toggleSelfMute", "toggleSelfDeaf");
const ChannelActions = findByPropsLazy("selectVoiceChannel", "selectChannel");

type SettingKey = "theme" | "rounded" | "shareCalls";

const settings = definePluginSettings({
    theme: {
        type: OptionType.BOOLEAN,
        description: "dev.txt look: dark glass surfaces, the shared accent colour, Segoe UI Variable",
        default: true,
        onChange: settingsChanged
    },
    rounded: {
        type: OptionType.BOOLEAN,
        description: "Rounded corners (part of the dev.txt look)",
        default: true,
        onChange: settingsChanged
    },
    shareCalls: {
        type: OptionType.BOOLEAN,
        description: "Show your calls to other dev.txt apps on this computer and let them mute, deafen, answer or hang up",
        default: true,
        onChange: settingsChanged
    }
});

let running = false;
let session = 0;
let pending: ReturnType<typeof setTimeout> | undefined;
let channel: string | null = null;
let since = 0;
let lastVoice = "";
// hub.theme as the hub last sent it; kept while the hub is away
let hubTheme: { accent?: string | null; reducedMotion?: boolean; } = {};
let runtimeStyle: HTMLStyleElement | null = null;

function isSpeaking(userId: string) {
    try {
        return !!SpeakingStore.isSpeaking(userId);
    } catch {
        return false;
    }
}

function nameOf(userId: string) {
    const u = UserStore.getUser(userId);
    return RelationshipStore.getNickname(userId) ?? u?.globalName ?? u?.username ?? "";
}

// Calls that are ringing for you right now, other than the one you are in
function ringingCalls() {
    const me = UserStore.getCurrentUser()?.id;
    if (!me) return [];
    const current = SelectedChannelStore.getVoiceChannelId();
    return (CallStore.getCalls() ?? []).filter(c => c?.ringing?.includes(me) && c.channelId !== current);
}

function incoming() {
    const me = UserStore.getCurrentUser()?.id;
    const call = ringingCalls()[0];
    const ch = call ? ChannelStore.getChannel(call.channelId) : null;
    if (!ch) return null;
    // the caller is already in the call; in a DM it is the other person anyway
    const callerId = Object.values(VoiceStateStore.getVoiceStatesForChannel(ch.id) ?? {}).map(s => s.userId).find(u => u !== me)
        ?? ch.recipients?.find(u => u !== me);
    const group = ch.isGroupDM();
    return {
        channel: ch.id,
        name: group ? ch.name || (ch.recipients ?? []).slice(0, 3).map(nameOf).join(", ") : callerId ? nameOf(callerId) : "",
        caller: callerId ? nameOf(callerId) : "",
        avatar: callerId ? UserStore.getUser(callerId)?.getAvatarURL(null, 128, false) ?? "" : "",
        group
    };
}

// maska.voice: where you are, since when, who is there and who is talking. The same picture the Kapsula plugin gives its island
function snapshot() {
    const id = SelectedChannelStore.getVoiceChannelId() ?? null;
    if (id !== channel) {
        channel = id;
        since = id ? Date.now() : 0;
    }
    const me = UserStore.getCurrentUser()?.id;
    let ring: ReturnType<typeof incoming> = null;
    try {
        ring = incoming();
    } catch { }
    const ch = id ? ChannelStore.getChannel(id) : null;
    const guildId = ch?.guild_id ?? null;
    const states = id ? Object.values(VoiceStateStore.getVoiceStatesForChannel(id) ?? {}) : [];
    const people = states.slice(0, 12).map(s => {
        const u = UserStore.getUser(s.userId);
        return {
            id: s.userId,
            name: (guildId ? GuildMemberStore.getNick(guildId, s.userId) : null) ?? u?.globalName ?? u?.username ?? "",
            avatar: u?.getAvatarURL(guildId, 64, false) ?? "",
            speaking: isSpeaking(s.userId),
            mute: !!(s.selfMute || s.mute),
            deaf: !!(s.selfDeaf || s.deaf),
            video: !!s.selfVideo,
            stream: !!s.selfStream,
            me: s.userId === me
        };
    });
    return {
        inCall: id != null,
        channel: ch?.name ?? "",
        guild: guildId ? GuildStore.getGuild(guildId)?.name ?? "" : "",
        users: states.length,
        mute: MediaEngineStore.isSelfMute(),
        deaf: MediaEngineStore.isSelfDeaf(),
        stream: ApplicationStreamingStore.getCurrentUserActiveStream() != null,
        video: people.some(p => p.me && p.video),
        speaking: people.some(p => p.speaking),
        meSpeaking: !!me && isSpeaking(me),
        since,
        people,
        incoming: ring
    };
}

// The full picture every time, and only when something in it has changed
function publishVoice() {
    if (!running) return;
    let data: ReturnType<typeof snapshot> | null = null;
    if (settings.store.shareCalls) {
        try {
            data = snapshot();
        } catch {
            return;
        }
    }
    const body = JSON.stringify(data);
    if (body === lastVoice) return;
    lastVoice = body;
    Native.state("maska.voice", data);
}

// Discord changed something: changes that come in a burst go out together
function changed() {
    if (pending) return;
    pending = setTimeout(() => {
        pending = undefined;
        publishVoice();
    }, 30);
}

// maska.settings: core.txt draws these on its settings page and sends changes back with settings.set
function publishSettings() {
    const item = (key: SettingKey, label: string, hint: string) => ({ key, type: "switch", label, hint, value: settings.store[key] });
    Native.state("maska.settings", {
        groups: [
            {
                title: "Вид Discord",
                items: [
                    item("theme", "Оформление dev.txt", "Тёмное стекло, общий цвет и шрифт Segoe UI Variable"),
                    item("rounded", "Скруглённые углы", "Работает вместе с оформлением dev.txt")
                ]
            },
            {
                title: "Звонки",
                items: [
                    item("shareCalls", "Показывать звонки другим приложениям dev.txt", "Кто в звонке и кто говорит; кнопки микрофона, звука и ответа на звонок")
                ]
            }
        ]
    });
}

function toHsl(hex: string) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return null;
    const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d + 6) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
    }
    return `${(h * 60).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

function setStyle(name: string, on: boolean) {
    if (on) enableStyle(name);
    else disableStyle(name);
}

// The look: maska.css and rounded.css by the settings, plus what hub.theme asks for on top
function applyLook() {
    const on = running && settings.store.theme;
    setStyle(themeStyle, on);
    setStyle(roundedStyle, on && settings.store.rounded);
    if (!on) {
        runtimeStyle?.remove();
        runtimeStyle = null;
        return;
    }
    runtimeStyle ??= createAndAppendStyle("vc-maska-runtime", managedStyleRootNode);
    runtimeStyle.textContent = "";
    const vars: string[] = [];
    const accent = typeof hubTheme.accent === "string" && toHsl(hubTheme.accent) ? hubTheme.accent : null;
    if (accent) vars.push(`--maska-accent: ${accent};`);
    // Discord keeps the brand colour a second time as "hue saturation lightness"; without a hub accent it is the token's
    const hsl = toHsl(accent ?? getComputedStyle(document.documentElement).getPropertyValue("--maska-accent").trim());
    if (hsl) vars.push(`--brand-500-hsl: ${hsl};`);
    if (hubTheme.reducedMotion) vars.push("--maska-dur: 0ms;");
    runtimeStyle.textContent = `:root:root:root { ${vars.join(" ")} }`;
}

function settingsChanged() {
    if (!running) return;
    applyLook();
    publishVoice();
    publishSettings();
}

function needCalls() {
    if (!settings.store.shareCalls) throw new Error("calls-not-shared");
}

// The call a command is about: the one named in args.channel if it is really ringing, otherwise the one that is
function ringing(args: { channel?: unknown; }) {
    const calls = ringingCalls();
    const call = args.channel == null ? calls[0] : calls.find(c => c.channelId === args.channel);
    if (!call) throw new Error("no-call");
    return call.channelId;
}

const commands: Record<string, (args: any) => unknown> = {
    "voice.mute"({ on }) {
        needCalls();
        const now = MediaEngineStore.isSelfMute();
        const want = typeof on === "boolean" ? on : !now;
        if (want !== now) AudioActions.toggleSelfMute();
        return { muted: want };
    },
    "voice.deafen"({ on }) {
        needCalls();
        const now = MediaEngineStore.isSelfDeaf();
        const want = typeof on === "boolean" ? on : !now;
        if (want !== now) AudioActions.toggleSelfDeaf();
        return { deafened: want };
    },
    "voice.leave"() {
        needCalls();
        ChannelActions.selectVoiceChannel(null);
    },
    "call.accept"(args) {
        needCalls();
        ChannelActions.selectVoiceChannel(ringing(args));
    },
    // Stops the ringing just for you, as declining in Discord does; others in a group call keep ringing
    async "call.decline"(args) {
        needCalls();
        const channelId = ringing(args);
        await RestAPI.post({ url: `/channels/${channelId}/call/stop-ringing`, body: { recipients: [UserStore.getCurrentUser().id] } });
    },
    "settings.set"({ key, value }) {
        if (!Object.hasOwn(settings.def, key)) throw new Error("unknown-key");
        if (typeof value !== "boolean") throw new Error("bad-value");
        settings.store[key as SettingKey] = value;
        settingsChanged();
        return { key, value };
    }
};

async function handle(m: { type: string; [key: string]: any; }) {
    if (m.type === "state" && m.topic === "hub.theme") {
        hubTheme = m.data ?? {};
        applyLook();
    } else if (m.type === "command") {
        const run = commands[m.name];
        if (!run) return Native.result(m.id, m.from, false, null, "unknown-command");
        try {
            Native.result(m.id, m.from, true, await run(m.args ?? {}) ?? null);
        } catch (e: any) {
            Native.result(m.id, m.from, false, null, String(e?.message ?? e));
        }
    }
}

// There is always a request waiting in the main process for the next thing the hub passes on
async function listen(mine: number) {
    while (running && mine === session) {
        let messages: Awaited<ReturnType<typeof Native.wait>> = [];
        try {
            messages = await Native.wait();
        } catch {
            await new Promise(r => setTimeout(r, 3000));
        }
        if (!running || mine !== session) break;
        for (const m of messages) {
            try {
                await handle(m);
            } catch { }
        }
    }
}

const stores = () => [SelectedChannelStore, MediaEngineStore, VoiceStateStore, ApplicationStreamingStore, SpeakingStore, CallStore];

export default definePlugin({
    name: "Maska",
    description: "Your look and your calls for Discord: the dev.txt theme (dark glass, shared accent colour, rounded corners) and your call shown to other dev.txt apps on this computer, which can mute, deafen, answer or hang up for you",
    authors: [{ name: "cxxperman", id: 0n }],
    settings,

    start() {
        running = true;
        applyLook();
        Native.start(VERSION, Object.keys(commands), ["hub.theme"]);
        publishSettings();
        publishVoice();
        for (const store of stores()) {
            try {
                store.addChangeListener(changed);
            } catch { }
        }
        listen(++session);
    },

    stop() {
        running = false;
        for (const store of stores()) {
            try {
                store.removeChangeListener(changed);
            } catch { }
        }
        clearTimeout(pending);
        pending = undefined;
        channel = null;
        lastVoice = "";
        hubTheme = {};
        applyLook();
        Native.stop();
    }
});
