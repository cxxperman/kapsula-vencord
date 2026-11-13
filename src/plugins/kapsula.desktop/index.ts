/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin, { PluginNative } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { ApplicationStreamingStore, ChannelStore, GuildStore, MediaEngineStore, SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

const Native = VencordNative.pluginHelpers.Kapsula as PluginNative<typeof import("./native")>;
const SpeakingStore = findStoreLazy("SpeakingStore");
const AudioActions = findByPropsLazy("toggleSelfMute", "toggleSelfDeaf");
const ChannelActions = findByPropsLazy("selectVoiceChannel", "selectChannel");

let timer: ReturnType<typeof setInterval> | undefined;
let channel: string | null = null;
let since = 0;
let last = "";
let lastAt = 0;
let retryAt = 0;
let busy = false;

// What the Kapsula island shows: where you are, since when, and what is on or off
function snapshot() {
    const id = SelectedChannelStore.getVoiceChannelId() ?? null;
    if (id !== channel) {
        channel = id;
        since = id ? Date.now() : 0;
    }
    const me = UserStore.getCurrentUser()?.id;
    let name = "";
    let guild = "";
    let users = 0;
    let video = false;
    let speaking = false;
    if (id) {
        const ch = ChannelStore.getChannel(id);
        name = ch?.name ?? "";
        if (ch?.guild_id) guild = GuildStore.getGuild(ch.guild_id)?.name ?? "";
        const states = Object.values(VoiceStateStore.getVoiceStatesForChannel(id) ?? {});
        users = states.length;
        for (const s of states) {
            if (s.userId === me) video = !!s.selfVideo;
            try {
                if (SpeakingStore.isSpeaking(s.userId)) speaking = true;
            } catch { }
        }
    }
    return {
        inCall: id != null,
        channel: name,
        guild,
        users,
        mute: MediaEngineStore.isSelfMute(),
        deaf: MediaEngineStore.isSelfDeaf(),
        stream: ApplicationStreamingStore.getCurrentUserActiveStream() != null,
        video,
        speaking,
        since
    };
}

function run(cmd: string) {
    try {
        if (cmd === "mute") AudioActions.toggleSelfMute();
        else if (cmd === "deaf") AudioActions.toggleSelfDeaf();
        else if (cmd === "leave") ChannelActions.selectVoiceChannel(null);
    } catch { }
}

async function tick() {
    const now = Date.now();
    if (busy || now < retryAt) return;
    let body: string;
    try {
        body = JSON.stringify(snapshot());
    } catch {
        return;
    }
    // changes go out right away, otherwise a short "still here" every few seconds
    if (body === last && now - lastAt < 3000) return;
    busy = true;
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
        const { commands } = JSON.parse(reply);
        if (Array.isArray(commands)) commands.forEach(run);
    } catch { } finally {
        busy = false;
    }
}

export default definePlugin({
    name: "Kapsula",
    description: "Shows your Discord call on the Kapsula island (channel, call time, mute, deafen, screen share) and lets you mute, deafen or leave right from the island",
    authors: [{ name: "cxxperman", id: 0n }],
    enabledByDefault: true,

    start() {
        timer = setInterval(tick, 500);
    },

    stop() {
        clearInterval(timer);
        channel = null;
        last = "";
    }
});
