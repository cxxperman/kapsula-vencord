/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CallStore, GuildReadStateStore, MediaEngineStore, SelectedChannelStore, useEffect, UserStore, useState, useStateFromStores } from "@webpack/common";

import { Eye, PixelIcon } from "./sprites";

// A blink now and then: true for a moment every three to six seconds
export function useBlink() {
    const [closed, setClosed] = useState(false);
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const next = () => {
            timer = setTimeout(() => {
                setClosed(true);
                timer = setTimeout(() => {
                    setClosed(false);
                    next();
                }, 140);
            }, 3000 + Math.random() * 3000);
        };
        next();
        return () => clearTimeout(timer);
    }, []);
    return closed;
}

export function useDeaf() {
    return useStateFromStores([MediaEngineStore], () => MediaEngineStore.isSelfDeaf());
}

// The maska behind the left edge of the window: half of it shows, with one eye, and it tells what is going on
export function Peek({ isRinging }: { isRinging(): boolean; }) {
    const ringing = useStateFromStores([CallStore, SelectedChannelStore, UserStore], isRinging);
    const mentions = useStateFromStores([GuildReadStateStore], () => GuildReadStateStore.getTotalMentionCount());
    const unread = useStateFromStores([GuildReadStateStore], () => GuildReadStateStore.hasAnyUnread());
    const mute = useStateFromStores([MediaEngineStore], () => MediaEngineStore.isSelfMute());
    const deaf = useDeaf();
    const blink = useBlink();

    let state = "idle";
    let eye: Eye = blink ? "closed" : "normal";
    if (ringing) state = "ringing";
    else if (mentions > 0) state = "mentions";
    else if (unread) {
        state = "unread";
        eye = "wide";
    } else if (deaf) {
        state = "deaf";
        eye = "closed";
    } else if (mute) {
        state = "mute";
        eye = "squint";
    }

    return (
        <div className="vc-maska-peek" data-state={state}>
            <div className="vc-maska-peek-body">
                <PixelIcon size={56} eye={eye} eyeColor={state === "mentions" ? "var(--status-danger, #f23f43)" : undefined} />
                {state === "mentions" && <span className="vc-maska-peek-count">{mentions > 99 ? "99+" : mentions}</span>}
            </div>
        </div>
    );
}
