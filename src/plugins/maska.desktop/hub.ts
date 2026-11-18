/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type ClientRequest, request } from "http";

// dev.txt hub client over plain HTTP (kit.txt hub/PROTOCOL.md, "Доставка по HTTP"), a port of httpTransport from
// kit.txt hub/client.js. Node only and free of Electron, so scripts-maska/hub-test.mjs can run it as is.

export interface HubMessage {
    type: string;
    [key: string]: any;
}

export interface HubOptions {
    port?: number;
    app: string;
    name: string;
    version: string;
    commands: string[];
    topics: string[];
    onMessage(message: HubMessage): void;
    onStatus?(online: boolean): void;
}

const PROTOCOL = 1;
const HUB_PORT = 42080;
const RETRY_MIN = 1000;
const RETRY_MAX = 15000;

export function connectHub(o: HubOptions) {
    const port = o.port ?? HUB_PORT;
    // what this app last said: the hub forgets it when it restarts, so it is repeated after every hello
    const own = new Map<string, unknown>();
    let client: string | null = null;
    let out: HubMessage[] = [];
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let held: ClientRequest | undefined;
    let stopped = false;
    let online = false;
    let gen = 0;
    let delay = RETRY_MIN;

    function call(method: "GET" | "POST", body: object | null, timeout: number) {
        return new Promise<{ status: number; json: any; } | null>(resolve => {
            const text = body ? JSON.stringify(body) : null;
            const headers: Record<string, string | number> = {};
            if (text != null) {
                headers["Content-Type"] = "application/json";
                headers["Content-Length"] = Buffer.byteLength(text);
            }
            const path = method === "GET" ? "/hub/http?client=" + encodeURIComponent(client ?? "") : "/hub/http";
            // no Origin header: the hub lets local programs in and turns web pages away
            const req = request({ host: "127.0.0.1", port, path, method, headers, timeout }, res => {
                let data = "";
                res.setEncoding("utf8");
                res.on("data", chunk => data += chunk);
                res.on("error", () => resolve(null));
                res.on("end", () => {
                    let json: any = null;
                    try {
                        json = JSON.parse(data);
                    } catch { }
                    resolve({ status: res.statusCode ?? 0, json });
                });
            });
            req.on("error", () => resolve(null));
            req.on("timeout", () => req.destroy());
            if (method === "GET") held = req;
            req.end(text ?? undefined);
        });
    }

    function setOnline(on: boolean) {
        if (online === on) return;
        online = on;
        o.onStatus?.(on);
    }

    function deliver(list: unknown) {
        if (!Array.isArray(list)) return;
        for (const m of list) {
            if (!m || typeof m.type !== "string") continue;
            if (m.type === "welcome") setOnline(true);
            else if (m.type !== "pong") o.onMessage(m);
        }
    }

    function start() {
        timer = undefined;
        client = null;
        out = [{ type: "hello", v: PROTOCOL, app: o.app, name: o.name, version: o.version, commands: o.commands }];
        if (o.topics.length) out.push({ type: "subscribe", topics: o.topics });
        for (const [topic, data] of own) out.push({ type: "state", topic, data });
        flush();
    }

    // No hub (core.txt is not running) is normal: try again quietly after 1, 2, 4… up to 15 seconds.
    // A hub that answers 410 has just restarted and is there: say hello again right away.
    function lost(restarted: boolean) {
        if (stopped || timer) return;
        gen++;
        client = null;
        out = [];
        held?.destroy();
        setOnline(false);
        let wait = 0;
        if (!restarted) {
            wait = delay;
            delay = Math.min(delay * 2, RETRY_MAX);
        }
        timer = setTimeout(start, wait);
    }

    async function flush() {
        if (busy || stopped || timer || !out.length) return;
        busy = true;
        const mine = gen;
        const first = client === null;
        const batch = out;
        out = [];
        const r = await call("POST", { client, messages: batch }, 5000);
        busy = false;
        if (stopped) return;
        // the connection was restarted while this request was on its way: its answer is stale, the new hello is waiting
        if (mine !== gen) return void flush();
        if (r?.status !== 200 || typeof r.json?.client !== "string") return lost(r?.status === 410);
        delay = RETRY_MIN;
        client = r.json.client;
        deliver(r.json.messages);
        if (first) poll(mine);
        flush();
    }

    // The hub holds the GET for up to 20 seconds and answers as soon as there is something to pass on
    async function poll(mine: number) {
        while (!stopped && mine === gen) {
            const r = await call("GET", null, 30000);
            if (stopped || mine !== gen) return;
            if (r?.status !== 200 || !r.json) return lost(r?.status === 410);
            deliver(r.json.messages);
        }
    }

    function send(message: HubMessage) {
        if (stopped || timer) return;
        out.push(message);
        flush();
    }

    // after connectHub() has returned, as in client.js
    timer = setTimeout(start, 0);

    return {
        get online() {
            return online;
        },
        send,
        // always the full picture; null means "there is no such state any more"
        state(topic: string, data: unknown) {
            if (data == null) own.delete(topic);
            else own.set(topic, data);
            send({ type: "state", topic, data: data ?? null });
        },
        stop() {
            if (stopped) return;
            // say goodbye so the hub does not wait for the silence to time out
            if (client) call("POST", { client, messages: [...out, { type: "bye" }] }, 2000);
            stopped = true;
            clearTimeout(timer);
            held?.destroy();
            setOnline(false);
        }
    };
}
