/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import { IS_WINDOWS } from "@utils/constants";
import definePlugin, { PluginNative } from "@utils/types";
import { findByCodeLazy, findByPropsLazy, findStoreLazy } from "@webpack";
import { ApplicationStreamingStore, ChannelStore, GuildMemberStore, GuildStore, MediaEngineStore, PermissionsBits, PermissionStore, SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

const Native = VencordNative.pluginHelpers.Kapsula as PluginNative<typeof import("./native")>;
const SpeakingStore = findStoreLazy("SpeakingStore");
const StreamingSettingsStore = findStoreLazy("ApplicationStreamingSettingsStore");
const AudioActions = findByPropsLazy("toggleSelfMute", "toggleSelfDeaf");
const ChannelActions = findByPropsLazy("selectVoiceChannel", "selectChannel");
// Screen share: the same calls Discord's own "Share Your Screen" picker makes
const startStream = findByCodeLazy('type:"STREAM_START"');
const stopStream = findByCodeLazy('type:"STREAM_STOP"');
const getDesktopSources = findByCodeLazy("desktop sources");
const StreamPreviews = getUserSettingLazy<boolean>("voiceAndVideo", "disableStreamPreviews");

interface Source {
    id: string;
    name: string;
}

let running = false;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let pending: ReturnType<typeof setTimeout> | undefined;
let channel: string | null = null;
let since = 0;
let last = "";
let lastAt = 0;
let retryAt = 0;
let sending = false;
let again = false;
// Screens and windows the island last offered to share
let sources: Source[] = [];
// One-time additions to the next message: the list of sources, or why screen share did not start
let extra: { sources?: Source[]; notice?: string; } = {};

function isSpeaking(userId: string) {
    try {
        return !!SpeakingStore.isSpeaking(userId);
    } catch {
        return false;
    }
}

// What the Kapsula island shows: where you are, since when, who is there and who is talking
function snapshot() {
    const id = SelectedChannelStore.getVoiceChannelId() ?? null;
    if (id !== channel) {
        channel = id;
        since = id ? Date.now() : 0;
    }
    const me = UserStore.getCurrentUser()?.id;
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
        // the pet on the island reacts to your own voice only
        meSpeaking: !!me && isSpeaking(me),
        since,
        people,
        ...extra
    };
}

function tell(add: typeof extra) {
    extra = { ...extra, ...add };
    send(true);
}

// Screens and windows to share: the island shows them as a menu, like Discord's own picker
async function listSources() {
    let list: any[] = [];
    try {
        list = await getDesktopSources((MediaEngineStore as any).getMediaEngine(), IS_WINDOWS, ["screen", "window"], null) ?? [];
    } catch { }
    sources = list
        .filter(s => s?.id)
        .slice(0, 30)
        .map(s => ({ id: String(s.id), name: String(s.name ?? "") }));
    tell({ sources });
}

function startShare(sourceId: string) {
    const channelId = SelectedChannelStore.getVoiceChannelId();
    const ch = channelId ? ChannelStore.getChannel(channelId) : null;
    if (!channelId || !ch) return;
    const inGuild = !ch.isDM() && !ch.isGroupDM();
    if (ch.type === 13 || inGuild && !PermissionStore.can(PermissionsBits.STREAM, ch)) {
        tell({ notice: "no-permission" });
        return;
    }
    const name = sources.find(s => s.id === sourceId)?.name ?? "";
    let sound = true;
    let previewDisabled = false;
    try {
        sound = StreamingSettingsStore.getState().soundshareEnabled !== false;
    } catch { }
    try {
        previewDisabled = !!StreamPreviews?.getSetting();
    } catch { }
    try {
        startStream(ch.guild_id ?? null, channelId, {
            pid: null,
            sourceId,
            sourceName: name,
            audioSourceId: name,
            sound,
            previewDisabled
        });
    } catch {
        tell({ notice: "no-stream" });
    }
}

function stopShare() {
    const s = ApplicationStreamingStore.getCurrentUserActiveStream();
    if (!s) return;
    const key = s.streamType === "guild"
        ? `guild:${s.guildId}:${s.channelId}:${s.ownerId}`
        : `call:${s.channelId}:${s.ownerId}`;
    stopStream(key);
}

function run(cmd: string) {
    try {
        if (cmd === "mute") AudioActions.toggleSelfMute();
        else if (cmd === "deaf") AudioActions.toggleSelfDeaf();
        else if (cmd === "leave") ChannelActions.selectVoiceChannel(null);
        else if (cmd === "sources") listSources();
        else if (cmd.startsWith("stream:")) startShare(cmd.slice(7));
        else if (cmd === "unstream") stopShare();
    } catch { }
}

function runAll(reply: string | null) {
    if (!reply) return;
    try {
        const { commands } = JSON.parse(reply);
        if (Array.isArray(commands)) commands.forEach(run);
    } catch { }
}

async function send(force: boolean) {
    const now = Date.now();
    if (now < retryAt) return;
    if (sending) {
        again = true;
        return;
    }
    const sent = extra;
    let body: string;
    try {
        body = JSON.stringify(snapshot());
    } catch {
        return;
    }
    if (!force && body === last && now - lastAt < 3000) return;
    sending = true;
    try {
        const reply = await Native.send(body);
        if (reply == null) {
            // Kapsula is not running: try again a bit later
            retryAt = Date.now() + 5000;
            last = "";
            return;
        }
        last = body;
        lastAt = now;
        if (extra === sent) extra = {};
        runAll(reply);
    } finally {
        sending = false;
        if (again) {
            again = false;
            send(false);
        }
    }
}

// Discord changed something: tell the island right away (changes that come in a burst go out together)
function changed() {
    if (pending) return;
    pending = setTimeout(() => {
        pending = undefined;
        send(false);
    }, 30);
}

// Island buttons arrive instantly: there is always a request waiting for the next command
async function listen() {
    while (running) {
        const reply = await Native.wait();
        if (!running) break;
        if (reply == null) {
            await new Promise(r => setTimeout(r, 3000));
            continue;
        }
        runAll(reply);
    }
}

const stores = () => [SelectedChannelStore, MediaEngineStore, VoiceStateStore, ApplicationStreamingStore, SpeakingStore];

export default definePlugin({
    name: "Kapsula",
    description: "Shows your Discord call on the Kapsula island (channel, time, who is talking, mute, deafen, screen share) and lets you mute, deafen, share your screen or leave right from the island",
    authors: [{ name: "cxxperman", id: 0n }],
    enabledByDefault: true,

    start() {
        running = true;
        for (const store of stores()) {
            try {
                store.addChangeListener(changed);
            } catch { }
        }
        heartbeat = setInterval(() => send(false), 1000);
        listen();
    },

    stop() {
        running = false;
        for (const store of stores()) {
            try {
                store.removeChangeListener(changed);
            } catch { }
        }
        clearInterval(heartbeat);
        clearTimeout(pending);
        pending = undefined;
        channel = null;
        last = "";
        sources = [];
        extra = {};
    }
});
