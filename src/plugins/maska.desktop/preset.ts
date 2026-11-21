/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { plugins } from "@api/PluginManager";
import { PlainSettings, Settings } from "@api/Settings";
import { IS_WINDOWS } from "@utils/constants";
import { Plugin } from "@utils/types";

// The dev.txt setup of Vencord, done once per PRESET_VERSION (index.tsx keeps the version reached).
// Raising it means the full setup again for everyone: every plugin outside the set is switched off again, the
// options of the set are overwritten, themes and the window are reset. Do it on purpose only.
export const PRESET_VERSION = 2;

// The plugin set; the number is the PRESET_VERSION the plugin came in with, kept for the record
const PLUGINS: Record<string, number> = {
    AnonymiseFileNames: 1,
    BetterFolders: 1,
    BetterGifPicker: 1,
    BetterSessions: 1,
    BetterSettings: 1,
    BetterUploadButton: 1,
    BiggerStreamPreview: 1,
    CallTimer: 1,
    ClearURLs: 1,
    CopyUserURLs: 1,
    DisableCallIdle: 1,
    Experiments: 1,
    FakeNitro: 1,
    FakeProfileThemes: 1,
    FavoriteEmojiFirst: 1,
    FixSpotifyEmbeds: 1,
    FixYoutubeEmbeds: 1,
    ForceOwnerCrown: 1,
    FriendsSince: 1,
    GifPaste: 1,
    ImageZoom: 1,
    KeepCurrentChannel: 1,
    MentionAvatars: 1,
    MessageClickActions: 1,
    MessageLatency: 1,
    MessageLogger: 1,
    MutualGroupDMs: 1,
    NewGuildSettings: 1,
    NoBlockedMessages: 1,
    NoDefaultHangStatus: 1,
    NoF1: 1,
    NoOnboardingDelay: 1,
    NoScreensharePreview: 1,
    NoSystemBadge: 1,
    NoUnblockToJump: 1,
    NormalizeMessageLinks: 1,
    NSFWGateBypass: 1,
    OnePingPerDM: 1,
    OpenInApp: 1,
    PictureInPicture: 1,
    PlatformIndicators: 1,
    QuickMention: 1,
    RelationshipNotifier: 1,
    RevealAllSpoilers: 1,
    ReverseImageSearch: 1,
    ReviewDB: 1,
    RoleColorEverywhere: 1,
    SecretRingToneEnabler: 1,
    ServerInfo: 1,
    ShowConnections: 1,
    ShowHiddenChannels: 1,
    ShowHiddenThings: 1,
    SortFriendRequests: 1,
    Translate: 1,
    TypingTweaks: 1,
    UnlockedAvatarZoom: 1,
    UserVoiceShow: 1,
    USRBG: 1,
    ValidReply: 1,
    ValidUser: 1,
    ViewIcons: 1,
    VoiceDownload: 1,
    VoiceMessages: 1,
    VolumeBooster: 1,
    XSOverlay: 1,
    YoutubeAdblock: 1,
    AlwaysExpandRoles: 1,
    AccountPanelServerProfile: 1,
    FullSearchContext: 1,
    AddAttachments: 1,
    ExpressionManager: 1,
    FixDiscordCss: 1,
    Kapsula: 1
};

// Set together with turning the plugin on, and only where nothing is saved yet
const OPTIONS: Record<string, Record<string, unknown>> = {
    AnonymiseFileNames: { anonymiseByDefault: true, method: 0, randomisedLength: 7, consistent: "image" },
    BetterFolders: { sidebar: false, sidebarAnim: true, closeAllFolders: false, closeAllHomeButton: false, closeOthers: false, forceOpen: false, keepIcons: false, showFolderIcon: 1, closeServerFolder: false },
    BetterSessions: { backgroundCheck: false, checkInterval: 20 },
    BetterSettings: { disableFade: true, eagerLoad: true, organizeMenu: true },
    CallTimer: { format: "stopwatch" },
    Experiments: { toolbarDevMenu: false },
    FakeNitro: { enableEmojiBypass: true, enableStickerBypass: true, enableStreamQualityBypass: true, transformEmojis: true, transformStickers: true, transformCompoundSentence: false, stickerSize: 160 },
    FakeProfileThemes: { nitroFirst: true },
    FixSpotifyEmbeds: { volume: 10 },
    MentionAvatars: { showAtSymbol: true },
    MessageClickActions: { requireModifier: false, enableDoubleClickToReply: true },
    MessageLatency: { latency: 2, detectDiscordKotlin: true, showMillis: false, ignoreSelf: false },
    MessageLogger: { collapseDeleted: false, deleteStyle: "text", ignoreBots: false, ignoreSelf: false, logEdits: true, logDeletes: true, logDeletedAttachments: true },
    NewGuildSettings: { guild: true, everyone: true, role: true, events: true, highlights: true, messages: 3, showAllChannels: true },
    NoBlockedMessages: { ignoreMessages: false, applyToIgnoredUsers: true },
    OnePingPerDM: { channelToAffect: "both_dms", allowMentions: false, allowEveryone: false },
    OpenInApp: { spotify: true, steam: true, epic: true, tidal: true, itunes: true },
    PlatformIndicators: { list: true, badges: true, messages: true, colorMobileIndicator: true },
    RelationshipNotifier: { offlineRemovals: true, groups: true, servers: true, friends: true, friendRequestCancels: true, notices: false },
    ReviewDB: { notifyReviews: true, showWarning: true, hideTimestamps: false, hideBlockedUsers: true },
    RoleColorEverywhere: { chatMentions: true, memberList: true, voiceUsers: true, reactorsList: true, colorChatMessages: false, pollResults: true },
    SecretRingToneEnabler: { onlySnow: false },
    ShowConnections: { iconSpacing: 1, iconSize: 32 },
    ShowHiddenChannels: { showMode: 0, hideUnreads: true, defaultAllowedUsersAndRolesDropdownState: true },
    ShowHiddenThings: { showTimeouts: true, showInvitesPaused: true, showModView: true, disableDiscoveryFilters: true, disableDisallowedDiscoveryFilters: true },
    SortFriendRequests: { showDates: false },
    Translate: { autoTranslate: false, showChatBarButton: true },
    TypingTweaks: { alternativeFormatting: true, showRoleColors: true, showAvatars: true },
    UnlockedAvatarZoom: { zoomMultiplier: 4 },
    UserVoiceShow: { showInUserProfileModal: true, showInMemberList: true, showInMessages: true },
    USRBG: { nitroFirst: true, voiceBackground: true },
    ViewIcons: { format: "webp", imgSize: "1024" },
    VolumeBooster: { multiplier: 2 },
    AccountPanelServerProfile: { prioritizeServerProfile: false }
};

// The plugin-manager features that need an API plugin, the same list initPluginManager goes by
function apiPluginsOf(p: Plugin) {
    const api: string[] = [];
    if (p.commands?.length) api.push("CommandsAPI");
    if (p.onBeforeMessageEdit || p.onBeforeMessageSend || p.onMessageClick) api.push("MessageEventsAPI");
    if (p.chatBarButton) api.push("ChatInputButtonAPI");
    if (p.renderMemberListDecorator) api.push("MemberListDecoratorsAPI");
    if (p.renderMessageAccessory) api.push("MessageAccessoriesAPI");
    if (p.renderMessageDecoration) api.push("MessageDecorationsAPI");
    if (p.messagePopoverButton) api.push("MessagePopoverAPI");
    if (p.userProfileBadge) api.push("BadgeAPI");
    return api;
}

// What stays on: the set, Maska and Kapsula, what Vencord itself needs (required, on by default) and,
// all the way down, whatever these depend on
function keptPlugins() {
    const keep = new Set<string>();
    const add = (name: string) => {
        const p = plugins[name];
        if (!p || keep.has(name)) return;
        keep.add(name);
        p.dependencies?.forEach(add);
        apiPluginsOf(p).forEach(add);
    };
    Object.keys(PLUGINS).forEach(add);
    ["Maska", "Kapsula"].forEach(add);
    for (const p of Object.values(plugins)) if (p.required || p.enabledByDefault) add(p.name);
    return keep;
}

// The person's Vencord settings from before the setup, kept once: the first one is the one worth keeping
const SNAPSHOT_KEY = "Maska_settingsBefore";

export interface Snapshot {
    at: number;
    settings: Record<string, any>;
    restoredAt?: number;
}

export function getSnapshot() {
    return DataStore.get<Snapshot>(SNAPSHOT_KEY);
}

async function saveSnapshot() {
    if (await DataStore.get(SNAPSHOT_KEY)) return;
    await DataStore.set(SNAPSHOT_KEY, { at: Date.now(), settings: JSON.parse(JSON.stringify(PlainSettings)) });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Brings Vencord to the dev.txt state: the set and nothing else, its options, no themes, the Acrylic window.
// Nothing is changed until the snapshot is written; if writing it fails this throws and the setup waits for
// the next start. Returns whether anything changed. Maska's own settings are set by index.tsx
export async function installPreset() {
    await saveSnapshot();
    let changed = false;
    const set = (target: Record<string, any>, key: string, value: unknown) => {
        if (same(target[key], value)) return;
        target[key] = value;
        changed = true;
    };

    const keep = keptPlugins();
    for (const name of Object.keys(plugins)) set(Settings.plugins[name], "enabled", keep.has(name));
    for (const [name, options] of Object.entries(OPTIONS)) {
        const def = plugins[name]?.settings?.def;
        if (!def) continue;
        for (const [key, value] of Object.entries(options)) if (def[key]) set(Settings.plugins[name], key, value);
    }

    // the theme files and the QuickCSS file stay on disk, they are only switched off
    set(Settings, "enabledThemes", []);
    set(Settings, "themeLinks", []);
    set(Settings, "useQuickCss", false);

    if (IS_WINDOWS) set(Settings, "windowsMaterial", "acrylic");
    set(Settings, "transparent", false);
    set(Settings, "frameless", false);
    set(Settings, "nativeTitleBar", false);
    return changed;
}

// Puts back what the setup changed, from the snapshot: every plugin (on or off, its options) except Maska,
// the themes and the window. Maska's own switches are done by index.tsx. False if there is nothing to put back
export async function restoreSnapshot() {
    const snapshot = await getSnapshot();
    if (!snapshot || snapshot.restoredAt) return false;
    const before = snapshot.settings ?? {};
    const beforePlugins: Record<string, any> = before.plugins ?? {};

    for (const name of new Set([...Object.keys(beforePlugins), ...Object.keys(PlainSettings.plugins)])) {
        if (name === "Maska") continue;
        // a plugin that had no entry before goes back to its defaults
        if (beforePlugins[name]) Settings.plugins[name] = JSON.parse(JSON.stringify(beforePlugins[name]));
        else delete Settings.plugins[name];
    }

    Settings.enabledThemes = before.enabledThemes ?? [];
    Settings.themeLinks = before.themeLinks ?? [];
    Settings.useQuickCss = before.useQuickCss ?? true;
    Settings.windowsMaterial = before.windowsMaterial ?? "none";
    Settings.transparent = before.transparent ?? false;
    Settings.frameless = before.frameless ?? false;
    Settings.nativeTitleBar = before.nativeTitleBar ?? false;

    await DataStore.set(SNAPSHOT_KEY, { ...snapshot, restoredAt: Date.now() });
    return true;
}
