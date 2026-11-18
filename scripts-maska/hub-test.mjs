/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Checks Maska's hub transport (src/plugins/maska.desktop/hub.ts) against the reference hub from kit.txt.
// Not part of the build. Needs Node 22.18+ (it runs the TypeScript file as is) and a copy of kit.txt:
//   node scripts-maska/hub-test.mjs [path to kit/hub]

import { spawn } from "child_process";
import { createServer, request } from "http";
import { createRequire } from "module";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const { connectHub } = await import(new URL("../src/plugins/maska.desktop/hub.ts", import.meta.url).href);

const here = dirname(fileURLToPath(import.meta.url));
const kitHub = resolve(process.argv[2] ?? resolve(here, "../../../kit/hub"));
const kitClient = createRequire(import.meta.url)(resolve(kitHub, "client.js"));

const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;

function check(what, ok) {
    console.log((ok ? "  ok    " : "  FAIL  ") + what);
    if (!ok) failed++;
}

async function until(what, test, ms = 8000) {
    const end = Date.now() + ms;
    while (Date.now() < end && !test()) await sleep(25);
    check(what, !!test());
}

function freePort() {
    return new Promise(done => {
        const s = createServer();
        s.listen(0, "127.0.0.1", () => {
            const { port } = s.address();
            s.close(() => done(port));
        });
    });
}

// The reference hub as its own process; only this process is ever killed
function startHub(port) {
    return new Promise((done, fail) => {
        const child = spawn(process.execPath, [resolve(kitHub, "hub.js"), String(port)], { stdio: ["ignore", "pipe", "inherit"] });
        child.once("error", fail);
        child.once("exit", code => fail(new Error("hub exited with " + code)));
        child.stdout.on("data", text => {
            if (String(text).includes("listening")) done(child);
        });
    });
}

function stopHub(child) {
    return new Promise(done => {
        child.removeAllListeners("exit");
        child.once("exit", done);
        child.kill();
    });
}

function post(port, body) {
    return new Promise(done => {
        const text = JSON.stringify(body);
        const req = request({ host: "127.0.0.1", port, path: "/hub/http", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(text) } }, res => {
            res.resume();
            res.on("end", () => done(res.statusCode));
        });
        req.on("error", () => done(0));
        req.end(text);
    });
}

const port = await freePort();
console.log("Reference hub: " + kitHub + ", port " + port);

// 1. Nothing listens yet: the client must stay quiet and keep trying
const heard = [];
const status = [];
const voice = { inCall: true, channel: "Общий", since: 1, people: [{ id: "1", name: "Ann", speaking: true }], mute: false, deaf: false };
const maska = connectHub({
    port,
    app: "maska",
    name: "Maska",
    version: "0.0.0-test",
    commands: ["voice.mute"],
    topics: ["hub.theme"],
    onMessage(m) {
        heard.push(m);
        if (m.type === "command") maska.send({ type: "result", id: m.id, to: m.from, ok: true, data: { muted: m.args.on } });
    },
    onStatus: on => status.push(on)
});
maska.state("maska.voice", voice);
await sleep(1500);
check("no hub: stays offline, nothing thrown", !maska.online && status.length === 0);

// 2. The hub appears: hello, subscription and the state said earlier all arrive
let hub = await startHub(port);
await until("hub appeared: online after the quiet retry", () => maska.online, 6000);
await until("hub.theme arrives after subscribing", () => heard.some(m => m.type === "state" && m.topic === "hub.theme" && m.data?.mode));

// 3. Another app sees Maska, its state, and can command it
const seen = new Map();
let apps = [];
// over HTTP as well: in Node the WebSocket transport of client.js does not come back after the hub process is killed
const tester = kitClient.connect({
    port,
    transport: "http",
    app: "tester",
    name: "Tester",
    version: "1",
    topics: ["maska.*", "hub.apps"],
    onState(topic, data) {
        if (topic === "hub.apps") apps = data ?? [];
        else seen.set(topic, data);
    }
});
await until("state said before the hub existed is published", () => seen.get("maska.voice")?.channel === "Общий");
check("hub.apps lists maska with its version and commands", apps.some(a => a.app === "maska" && a.name === "Maska" && a.version === "0.0.0-test" && a.commands.includes("voice.mute")));

maska.state("maska.voice", { ...voice, mute: true });
await until("a changed state reaches the subscriber", () => seen.get("maska.voice")?.mute === true);

let r = await tester.command("maska", "voice.mute", { on: true });
check("command is received and its result returns", r.ok === true && r.data?.muted === true);

r = await tester.command("hub", "theme.set", { accent: "#F08A4B", reducedMotion: true });
await until("a hub.theme change arrives through the held GET", () => heard.some(m => m.topic === "hub.theme" && m.data?.accent === "#F08A4B" && m.data?.reducedMotion === true));

// 4. The hub forgets the connection (410): hello again at once, state repeated
seen.clear();
const before = status.length;
await post(port, { client: null, messages: [{ type: "hello", v: 1, app: "maska", name: "Impostor", version: "0" }] });
await until("410: went offline and came back", () => status.length >= before + 2 && maska.online, 4000);
await until("410: state is repeated after the new hello", () => seen.get("maska.voice")?.mute === true);
check("410: hub.apps shows the real Maska again", apps.some(a => a.app === "maska" && a.name === "Maska"));

// 5. The hub process dies and comes back: reconnect, state repeated, commands work again
await stopHub(hub);
await until("hub killed: offline", () => !maska.online, 6000);
maska.state("maska.voice", { ...voice, channel: "После перезапуска" });
await sleep(2500);
hub = await startHub(port);
await until("hub restarted: online again", () => maska.online, 20000);
await until("hub restarted: the newest state is published", () => seen.get("maska.voice")?.channel === "После перезапуска", 20000);
r = await tester.command("maska", "voice.mute", { on: false });
check("hub restarted: commands work again", r.ok === true && r.data?.muted === false);

// 6. Goodbye: the hub forgets Maska right away
maska.state("maska.voice", null);
await until("state removed with null", () => seen.get("maska.voice") === null);
maska.stop();
await until("bye: maska leaves hub.apps", () => !apps.some(a => a.app === "maska"), 4000);

tester.close();
await stopHub(hub);
console.log(failed ? failed + " check(s) FAILED" : "All checks passed");
process.exit(failed ? 1 : 0);
