/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { plugins } from "@api/PluginManager";
import { PlainSettings, Settings } from "@api/Settings";

// The plugin set Maska turns on once. Raise PRESET_VERSION and give new entries that number:
// only they are turned on then, nothing someone has switched off comes back.
export const PRESET_VERSION = 1;

// plugin name: the PRESET_VERSION it was added in
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

// Turns on the entries newer than `applied` that this build has. Their dependencies are turned on by the
// plugin manager at the next start, as for any plugin. Returns whether anything changed.
export function applyPreset(applied: number) {
    let changed = false;
    for (const [name, since] of Object.entries(PLUGINS)) {
        const plugin = plugins[name];
        if (since <= applied || !plugin) continue;

        const store = Settings.plugins[name];
        if (!store.enabled) {
            store.enabled = true;
            changed = true;
        }

        // the plain object: the store would answer with the plugin's default and hide that nothing is saved
        const saved = PlainSettings.plugins[name] ?? {};
        for (const [key, value] of Object.entries(OPTIONS[name] ?? {})) {
            if (!plugin.settings?.def[key] || saved[key] !== undefined) continue;
            store[key] = value;
            changed = true;
        }
    }
    return changed;
}
