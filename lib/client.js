window.__ModuleLoader__.load({
	id: "workspace-groups-remote",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		// src/client/store-core.ts
		/** Collapse writes `false` (key retained); expand writes `true`. */
		function setCategoryExpandedImpl(state, key, expanded) {
			state.categoryExpansion[key] = expanded;
		}
		/** Collapse writes `false` (key retained); expand writes `true`. */
		function setWorkspaceExpandedImpl(state, key, expanded) {
			state.workspaceExpansion[key] = expanded;
		}
		/** Drop expansion keys that no longer exist (renames/deletes/config edits). */
		function retainKeysImpl(state, categoryKeys, workspaceKeys) {
			state.categoryExpansion = Object.fromEntries(Object.entries(state.categoryExpansion).filter(([key]) => categoryKeys.includes(key)));
			state.workspaceExpansion = Object.fromEntries(Object.entries(state.workspaceExpansion).filter(([key]) => workspaceKeys.includes(key)));
		}
		// src/client/stores.ts
		/**
		* The workspace-groups viewing store: category / workspace folder expansion,
		* persisted across reloads under an independent key (the official
		* ui-workspace store keeps its own `dsh.workspace.view.v5` — we never touch
		* it). Module level exports the factory only (a module-level handle would pin
		* the store identity across plugin reloads); register() receives the factory
		* and the browser derives its PropsStore share from the return type.
		*
		* The action implementations live in `store-core.ts` (pure, runtime-free) so
		* unit tests exercise the real semantics without a browser module loader;
		* this file only binds them through defineStore.
		*/
		/**
		* Create the workspace-groups viewing store handle.
		* @returns the store handle (spec + type + identity + factory in one).
		*/
		function createGroupsViewStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					categoryExpansion: {},
					workspaceExpansion: {}
				}),
				persist: "dsh.workspace.groups.view.v1",
				actions: {
					setCategoryExpanded: setCategoryExpandedImpl,
					setWorkspaceExpanded: setWorkspaceExpandedImpl,
					retainKeys: retainKeysImpl
				}
			});
		}
		// src/client/tabs.ts
		/**
		* Add a session to the strip, or leave an existing entry exactly where it is.
		*
		* Arrival order is the strip's only order, so re-opening a session that already
		* has a tab is a NO-OP: the tab keeps its position and its arrival key. Moving
		* it to the front here would fight the whole point of stable positions — a user
		* clicking through sessions would watch the strip reshuffle on every click.
		*
		* @param tabs - current strip (oldest first).
		* @param sessionId - arriving session.
		* @param nextOrder - monotonic arrival counter to spend when appending.
		* @returns the strip, unchanged (same array) when the session already has a tab.
		*/
		function appendTab(tabs, sessionId, nextOrder) {
			if (tabs.find((tab) => tab.sessionId === sessionId) !== void 0) return tabs;
			return [...tabs, {
				sessionId,
				order: nextOrder
			}];
		}
		/**
		* Remove one session's tab. An absent session leaves the strip untouched.
		* @param tabs - current strip.
		* @param sessionId - session whose tab closes.
		* @returns a new strip.
		*/
		function removeTab(tabs, sessionId) {
			return tabs.filter((tab) => tab.sessionId !== sessionId);
		}
		/**
		* Whether a tab is pinned (absent counts as unpinned).
		* @param tab - the tab.
		* @returns true when the tab belongs in the pinned block.
		*/
		function isPinned(tab) {
			return tab.pinned === true;
		}
		/**
		* Count the leading pinned block.
		*
		* The transforms keep every pinned tab before every unpinned one, so the pinned
		* block is always a prefix and its length is the single index that separates
		* the two blocks — which is exactly where a chip lands when it changes sides.
		*
		* @param tabs - strip in display order.
		* @returns how many leading tabs are pinned.
		*/
		function pinnedCount(tabs) {
			let count = 0;
			while (count < tabs.length && isPinned(tabs[count])) count += 1;
			return count;
		}
		/**
		* Stable-partition a strip so every pinned tab precedes every unpinned one.
		*
		* Needed by the restore path: stored tabs are merged onto whatever the startup
		* flow already opened, and an append would otherwise park a pinned tab at the
		* end of the strip. Already-normalized strips come back as a copy.
		*
		* @param tabs - any strip.
		* @returns a strip satisfying the pinned-first invariant.
		*/
		function normalizeTabs(tabs) {
			const pinned = tabs.filter(isPinned);
			if (pinned.length === 0 || pinned.length === tabs.length) return [...tabs];
			return [...pinned, ...tabs.filter((tab) => !isPinned(tab))];
		}
		/**
		* Move one tab to a new place in the strip (drag and drop).
		*
		* `targetIndex` is an index in the RESULTING strip. The move is clamped to the
		* tab's own block — a dragged chip can be reordered within the pinned block or
		* within the unpinned one, but never carried across that boundary. Crossing it
		* is `togglePinTab`'s job, because it changes the tab's meaning rather than
		* just its position: pinning is what makes a tab survive `close others`.
		*
		* @param tabs - strip in display order.
		* @param sessionId - the tab being moved.
		* @param targetIndex - desired index in the resulting strip.
		* @returns a new strip, or the same array when nothing moved.
		*/
		function moveTab(tabs, sessionId, targetIndex) {
			const from = tabs.findIndex((tab) => tab.sessionId === sessionId);
			if (from < 0) return tabs;
			const moving = tabs[from];
			const rest = tabs.filter((tab) => tab.sessionId !== sessionId);
			const boundary = pinnedCount(rest);
			const min = isPinned(moving) ? 0 : boundary;
			const max = isPinned(moving) ? boundary : rest.length;
			const clamped = Math.min(Math.max(Math.trunc(targetIndex), min), max);
			if (clamped === from) return tabs;
			return [
				...rest.slice(0, clamped),
				moving,
				...rest.slice(clamped)
			];
		}
		/**
		* Pin or unpin one tab, re-inserting it at the boundary between the blocks.
		*
		* Pinning puts the chip at the END of the pinned block (next to the other
		* kept tabs) and unpinning at the START of the unpinned one, so a toggle never
		* throws a chip to the far end of the strip.
		*
		* @param tabs - strip in display order.
		* @param sessionId - the tab to toggle.
		* @returns a new strip, or the same array when the tab is absent.
		*/
		function togglePinTab(tabs, sessionId) {
			const from = tabs.findIndex((tab) => tab.sessionId === sessionId);
			if (from < 0) return tabs;
			const moving = tabs[from];
			const rest = tabs.filter((tab) => tab.sessionId !== sessionId);
			const boundary = pinnedCount(rest);
			const repinned = isPinned(moving) ? {
				sessionId: moving.sessionId,
				order: moving.order,
				...moving.title !== void 0 ? { title: moving.title } : {}
			} : {
				sessionId: moving.sessionId,
				order: moving.order,
				pinned: true,
				...moving.title !== void 0 ? { title: moving.title } : {}
			};
			return [
				...rest.slice(0, boundary),
				repinned,
				...rest.slice(boundary)
			];
		}
		/**
		* Set or clear one tab's own label.
		*
		* A blank value CLEARS the override (the chip falls back to the session title)
		* rather than storing an empty label, so "rename to nothing" and "rename back to
		* the session title" are the same gesture.
		*
		* @param tabs - strip.
		* @param sessionId - the tab to relabel.
		* @param title - the new label; blank clears it.
		* @returns a new strip, or the same array when the tab is absent.
		*/
		function renameTab(tabs, sessionId, title) {
			const from = tabs.findIndex((tab) => tab.sessionId === sessionId);
			if (from < 0) return tabs;
			const trimmed = title?.trim() ?? "";
			if ((tabs[from]?.title ?? "") === trimmed) return tabs;
			return tabs.map((tab) => {
				if (tab.sessionId !== sessionId) return tab;
				if (trimmed === "") {
					const { title: _cleared, ...rest } = tab;
					return rest;
				}
				return {
					...tab,
					title: trimmed
				};
			});
		}
		/**
		* Close every tab except one — pinned tabs stay.
		*
		* Pinning is exactly how a user says "keep this no matter what"; letting
		* `close others` eat the pinned block would make the flag pointless.
		*
		* @param tabs - strip.
		* @param keepSessionId - the tab to keep (plus every pinned one).
		* @returns a new strip.
		*/
		function closeOtherTabs(tabs, keepSessionId) {
			if (!tabs.some((tab) => tab.sessionId === keepSessionId)) return tabs;
			return tabs.filter((tab) => isPinned(tab) || tab.sessionId === keepSessionId);
		}
		/**
		* Close every tab after one in display order.
		*
		* "After" is display order (pinned block first), which is the order the user
		* sees; a pinned tab is never after an unpinned one, so this cannot silently
		* drop the kept block.
		*
		* @param tabs - strip in display order.
		* @param sessionId - the last tab that stays.
		* @returns a new strip, or the same array when the tab is absent.
		*/
		function closeTabsAfter(tabs, sessionId) {
			const from = tabs.findIndex((tab) => tab.sessionId === sessionId);
			if (from < 0) return tabs;
			return tabs.slice(0, from + 1);
		}
		/**
		* Order the strip for display: strictly by arrival, regardless of which tab is
		* active.
		*
		* Position is a property of the TAB, not of the selection. Switching to a tab
		* must not move it — an earlier version pulled the active tab to the front,
		* which made every click reshuffle the strip and slid the chip out from under
		* the pointer that had just clicked it.
		*
		* `activeId` is therefore accepted only to document that "active" deliberately
		* does NOT participate in ordering; it is unused. The returned array is a copy
		* so callers cannot mutate the store's state through it.
		*
		* @param tabs - strip in arrival order.
		* @param activeId - the open session, if it has a tab (intentionally unused).
		* @returns a new array in arrival order.
		*/
		function orderedTabs(tabs, activeId) {
			return [...tabs];
		}
		/**
		* Whether the open session must surface a tab.
		*
		* A tab means "this conversation is in play right now", not "I once opened
		* this". Browsing history is what the sidebar is for; opening an old
		* conversation to read it should not litter the strip, which is the whole point
		* of the strip being a working set rather than a second session list.
		*
		* A session therefore earns a tab only once a conversation has actually STARTED
		* in it and is still engaged, which is any of:
		* - **running** — the agent is producing output (including subagents);
		* - **waiting on you** — an approval / plan review / question is pending;
		* - **unseen completion** — it finished while you were elsewhere, so the tab is
		*   the thing that tells you to come back.
		*
		* A still-blank draft gets NO tab: the tab appears the moment the first message
		* is sent (which is when the controller flips `blank` on `turn/start`). Once the
		* turn ends and you have read the result, the session is settled history and
		* does not earn a tab — so clicking through finished conversations leaves the
		* strip alone. Tabs already opened stay open: this gate only decides whether a
		* NEW tab appears, never whether an existing one closes.
		*
		* `blank` (from `sessionListMetadata`) is exactly "no turn has started": the
		* controller flips it to false on `turn/start`. It is the right signal for
		* "has this conversation begun", and the wrong one ALONE — a conversation
		* finished a week ago is also non-blank, which is why the earlier `!blank` rule
		* surfaced every old conversation the user clicked.
		*
		* @param mode - feature switch ('auto' applies the engagement rule).
		* @param summary - the session's catalog row (absent while the catalog has not
		*   caught up with a just-created session).
		* @param status - the session's unified UI status (absent → no live signal).
		* @returns true when a tab belongs in the strip.
		*/
		function shouldOpenTab(mode, summary, status) {
			if (mode === "manual") return false;
			if (summary === void 0) return false;
			if (summary.blank) return false;
			if (summary.running) return true;
			if (status?.running === true) return true;
			if (status?.pendingInteraction !== void 0) return true;
			if (status?.completionUnread === true) return true;
			return false;
		}
		/**
		* Derive one tab's indicators from the catalog row and the unified UI status.
		* @param summary - the tab session's catalog row (absent → inert indicators).
		* @param status - the tab session's unified UI status (absent → idle).
		* @returns the indicator quadruple.
		*/
		function tabIndicator(summary, status) {
			const pending = status?.pendingInteraction !== void 0;
			const running = status?.running === true || summary?.running === true;
			const unread = status?.completionUnread === true;
			const blank = summary?.blank !== false;
			return {
				attention: pending,
				running,
				unread,
				settled: !pending && !running && !unread && summary !== void 0 && !blank
			};
		}
		/**
		* Index sessions by the project that owns them.
		*
		* Membership comes from the workspace registry (`sessionIds`), which is the same
		* authority the sidebar tree uses — a tab and its sidebar row therefore agree on
		* the project without a second derivation.
		*
		* Built once per render pass rather than scanned per tab: a strip of N tabs over
		* M projects is O(N×M) with a naive `find` per tab.
		*
		* @param workspaces - workspace views from the controller snapshot.
		* @returns a session id → project map; sessions in no workspace are absent.
		*/
		function projectIndex(workspaces) {
			const index = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) {
				const label = projectLabel(workspace);
				const project = {
					workspaceId: workspace.workspaceId,
					label,
					path: workspace.path
				};
				for (const sessionId of workspace.sessionIds) if (!index.has(sessionId)) index.set(sessionId, project);
			}
			return index;
		}
		/**
		* Display label for a project: its title, else the directory basename.
		* @param workspace - workspace view.
		* @returns a non-empty label, falling back to the raw path.
		*/
		function projectLabel(workspace) {
			const title = workspace.title.trim();
			if (title !== "") return title;
			const parts = workspace.path.split(/[\\/]/).filter((part) => part !== "");
			return parts[parts.length - 1] ?? workspace.path;
		}
		/**
		* Store transform: add the open session, or leave its existing tab in place.
		*
		* Live here rather than in `tab-store.ts` so unit tests can exercise the real
		* semantics without importing `@deepseek-ai/dsh-client-store` (which pulls
		* `zustand` into the test process). The store module binds these into its
		* actions table.
		*
		* The no-op guard matters: this runs on EVERY catalog change for the open
		* session, so an unguarded write would wake the strip and spend arrival keys on
		* every projection tick.
		*
		* @param state - store draft, mutated in place.
		* @param sessionId - the session that just became open.
		*/
		function touchTabImpl(state, sessionId) {
			const next = appendTab(state.tabs, sessionId, state.order + 1);
			if (next === state.tabs) return;
			state.order += 1;
			state.tabs = next;
		}
		/**
		* Store transform: close one tab. Closing a session that has no tab is not a
		* state change, so it writes nothing.
		* @param state - store draft, mutated in place.
		* @param sessionId - the tab to close.
		*/
		function closeTabImpl(state, sessionId) {
			const next = removeTab(state.tabs, sessionId);
			if (next.length === state.tabs.length) return;
			state.tabs = next;
		}
		/**
		* Store transform: adopt tabs loaded from the host, MERGING with whatever is
		* already in the strip.
		*
		* Async by nature (the host read is a `fetch`), so it can land after the browser
		* has already opened a tab for the current session. Merging — rather than
		* "ignore the read if the strip is non-empty" — is what makes a restart safe:
		* the tab opened during startup survives AND the stored tabs still come back.
		* (Bailing on a non-empty strip would silently drop every stored tab whenever
		* the startup tab won the race, which is the common case for a session that is
		* running or unread.)
		*
		* The arrival counter is lifted above every restored key so a tab opened later
		* cannot reuse one; a reused key makes React move a chip's DOM node instead of
		* reconciling it.
		*
		* @param state - store draft, mutated in place.
		* @param tabs - tabs read from the host, oldest first.
		*/
		function restoreTabsImpl(state, tabs) {
			if (tabs.length === 0) return;
			const present = new Set(state.tabs.map((tab) => tab.sessionId));
			const additions = [];
			let order = state.order;
			for (const tab of tabs) {
				if (present.has(tab.sessionId)) continue;
				present.add(tab.sessionId);
				order += 1;
				additions.push({
					sessionId: tab.sessionId,
					order,
					...tab.pinned === true ? { pinned: true } : {},
					...tab.title !== void 0 ? { title: tab.title } : {}
				});
			}
			if (additions.length > 0) {
				const merged = [...state.tabs, ...additions];
				state.tabs = merged.some(isPinned) ? normalizeTabs(merged) : merged;
			}
			state.order = order;
		}
		/**
		* Store transform: pin or unpin one tab.
		* @param state - store draft, mutated in place.
		* @param sessionId - the tab to toggle.
		*/
		function pinTabImpl(state, sessionId) {
			const next = togglePinTab(state.tabs, sessionId);
			if (next === state.tabs) return;
			state.tabs = next;
		}
		/**
		* Store transform: move one tab to a new index (drag and drop).
		* @param state - store draft, mutated in place.
		* @param sessionId - the tab being moved.
		* @param targetIndex - desired index in the resulting strip.
		*/
		function moveTabImpl(state, sessionId, targetIndex) {
			const next = moveTab(state.tabs, sessionId, targetIndex);
			if (next === state.tabs) return;
			state.tabs = next;
		}
		/**
		* Store transform: set or clear one tab's own label.
		* @param state - store draft, mutated in place.
		* @param sessionId - the tab to relabel.
		* @param title - the new label; blank clears it.
		*/
		function renameTabImpl(state, sessionId, title) {
			const next = renameTab(state.tabs, sessionId, title);
			if (next === state.tabs) return;
			state.tabs = next;
		}
		/**
		* Store transform: close every unlisted tab, keeping the pinned ones.
		* @param state - store draft, mutated in place.
		* @param keepSessionId - the tab to keep.
		*/
		function closeOthersImpl(state, keepSessionId) {
			const next = closeOtherTabs(state.tabs, keepSessionId);
			if (next.length === state.tabs.length) return;
			state.tabs = next;
		}
		/**
		* Store transform: close every tab after one in display order.
		* @param state - store draft, mutated in place.
		* @param sessionId - the last tab that stays.
		*/
		function closeAfterImpl(state, sessionId) {
			const next = closeTabsAfter(state.tabs, sessionId);
			if (next.length === state.tabs.length) return;
			state.tabs = next;
		}
		// src/client/tab-store.ts
		/**
		* The session-tab store: the `defineStore` binding and nothing else.
		*
		* The action TRANSFORMS live in `tabs.ts` (pure, runtime-free), so unit tests
		* exercise the real semantics without pulling in the store engine — this module
		* is the only place that needs `@deepseek-ai/dsh-client-store`, and importing it
		* from a test would drag `zustand` into the test process.
		*
		* One handle, one scope: the tab store is seated by the `sidebar.workspaces`
		* entry alone. The tab strip is a CHILD of that entry (rendered through a DOM
		* portal into the conversation column), not a second slot registration, so the
		* handle is never mounted under a second, differently-scoped slot — which the
		* registry rejects outright ("one handle, one scope").
		*
		* Placement is navigation, not data: the strip derives its active chip from the
		* open session, and arrival order is the strip's only order, so nothing here
		* mirrors selection.
		*/
		/**
		* Create the session-tab store handle.
		*
		* The strip starts EMPTY and is hydrated by the caller through the `restore`
		* action: persistence lives on the host behind a `fetch`, which cannot run
		* during `init()`. Browser storage is deliberately not used — the origin
		* includes the port, and every launch picks a new one, so `localStorage` and
		* `sessionStorage` both start empty on the next start.
		*
		* @returns the store handle (spec + type + identity + factory in one).
		*/
		function createSessionTabsStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					tabs: [],
					order: 0
				}),
				actions: {
					touch: touchTabImpl,
					close: closeTabImpl,
					restore: restoreTabsImpl,
					pin: pinTabImpl,
					move: moveTabImpl,
					rename: renameTabImpl,
					closeOthers: closeOthersImpl,
					closeAfter: closeAfterImpl
				}
			});
		}
		// src/client/tab-persist.ts
		/**
		* Client side of the session-tab persistence, talking to
		* `GET|PUT /workspace-groups/tabs` on the host.
		*
		* Why not browser storage: **the origin includes the PORT**, and every `dsh web`
		* / `dsh test` / desktop launch picks a different one. `localStorage` and
		* `sessionStorage` are both scoped to the origin, so they start empty on the
		* next launch — a tab list kept there survives a reload only when the port
		* happens to match. The host's JSON sidecar has no such problem, which is why
		* the strip is stored there and read back verbatim.
		*
		* There is deliberately no per-browser-session marker. A marker has to live in
		* browser storage, which the port invalidates, so every restart looked like a
		* fresh session and silently discarded the user's tabs — the exact failure this
		* module exists to prevent.
		*
		* Every call is best-effort: a failed read means "no tabs" and a failed write is
		* swallowed, because the strip is a convenience and must never break the app.
		*/
		/** Host route holding the strip. */
		const TABS_ROUTE = "/workspace-groups/tabs";
		/**
		* Read one tab row off the wire, dropping the row when it is unusable.
		* @param entry - one element of the stored `tabs` array.
		* @returns the tab, or null for a malformed row.
		*/
		function parseWireTab(entry) {
			if (typeof entry !== "object" || entry === null) return null;
			const row = entry;
			if (typeof row.sessionId !== "string" || row.sessionId === "") return null;
			if (typeof row.order !== "number" || !Number.isFinite(row.order)) return null;
			const pinned = row.pinned === true;
			const title = typeof row.title === "string" && row.title.trim() !== "" ? row.title.trim() : void 0;
			return {
				sessionId: row.sessionId,
				order: row.order,
				...pinned ? { pinned: true } : {},
				...title !== void 0 ? { title } : {}
			};
		}
		/**
		* Fetch the stored strip.
		* @param fetchImpl - fetch implementation (injectable for tests).
		* @returns the tabs, oldest first; empty on any failure.
		*/
		async function loadTabs(fetchImpl = fetch) {
			try {
				const response = await fetchImpl(TABS_ROUTE, {
					method: "GET",
					cache: "no-store"
				});
				if (!response.ok) return [];
				const body = await response.json();
				if (typeof body !== "object" || body === null) return [];
				const list = body.tabs;
				if (!Array.isArray(list)) return [];
				const tabs = [];
				for (const entry of list) {
					const tab = parseWireTab(entry);
					if (tab !== null) tabs.push(tab);
				}
				return tabs;
			} catch {
				return [];
			}
		}
		/**
		* Store the strip. Failures are swallowed.
		* @param state - the client's current strip and its arrival counter.
		* @param fetchImpl - fetch implementation (injectable for tests).
		*/
		async function saveTabs(state, fetchImpl = fetch) {
			try {
				await fetchImpl(TABS_ROUTE, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						order: state.order,
						tabs: state.tabs
					}),
					cache: "no-store",
					keepalive: true
				});
			} catch {}
		}
		// src/client/store-hook.ts
		/**
		* A framework-shaped selector hook over a store instance.
		*
		* The renderer builds this hook for slot seats (`bindSnapshotSelector` in
		* ui-renderer, wrapping React's `useSyncExternalStoreWithSelector`), but the tab
		* strip is NOT a slot occupant: it renders through a DOM seat as a child of this
		* plugin's own `sidebar.workspaces` occupant, so it receives its store face as a
		* plain prop and needs the equivalent binding here.
		*
		* The implementation mirrors React's `useSyncExternalStoreWithSelector` without
		* depending on the `use-sync-external-store` package (it is not resolvable from
		* this plugin). The two behaviours that matter:
		*
		* - identity-stable subscribe/getSnapshot closures, so the strip never
		*   resubscribes across renders;
		* - a memoized selection: the selector re-runs only when the state reference
		*   changes, and an equal result (by `eq`, defaulting to `Object.is`) returns
		*   the PREVIOUS reference, so a selector allocating a fresh array or object
		*   does not spin the render loop.
		*
		* The hook must be called unconditionally (Rules of Hooks).
		*/
		/**
		* Build a selector hook bound to one store instance.
		* @param instance - the live store instance (snapshot source).
		* @returns a `SnapshotSelectorHook`-compatible hook over that instance.
		*/
		function createStoreHook(instance) {
			const subscribe = (onChange) => instance.subscribe(onChange);
			const getState = () => instance.getSnapshot();
			return function useSelector(selector, eq) {
				const memory = (0, react.useRef)(null);
				const getSelection = (0, react.useCallback)(() => {
					const state = getState();
					const previous = memory.current;
					if (previous !== null && previous.hasValue && Object.is(previous.state, state)) return previous.value;
					const value = selector(state);
					if (previous !== null && previous.hasValue) {
						if (eq !== void 0 ? eq(previous.value, value) : Object.is(previous.value, value)) {
							memory.current = {
								state,
								value: previous.value,
								hasValue: true
							};
							return previous.value;
						}
					}
					memory.current = {
						state,
						value,
						hasValue: true
					};
					return value;
				}, [selector, eq]);
				return (0, react.useSyncExternalStore)(subscribe, getSelection, getSelection);
			};
		}
		// src/core/types.ts
		/** Whitelist shared by the host write-validation and the client picker. */
		const GROUP_COLORS = [
			"red",
			"orange",
			"amber",
			"green",
			"teal",
			"blue",
			"indigo",
			"purple",
			"pink",
			"gray"
		];
		/** Curated icon ids (rendered from @deepseek-ai/dsh-client-ui-primitives). */
		const GROUP_ICON_IDS = [
			"folder",
			"workspace",
			"code",
			"plugin",
			"skill",
			"data",
			"database",
			"api",
			"plan",
			"goal",
			"light",
			"globe",
			"archive",
			"branch",
			"users",
			"clock",
			"shield",
			"checklist",
			"sparkle",
			"tree",
			"chat",
			"search",
			"settings",
			"document",
			"edit",
			"think",
			"agent",
			"browse",
			"context",
			"link",
			"share",
			"user",
			"send",
			"attachment",
			"download",
			"play",
			"design",
			"moon",
			"monitor",
			"gauge",
			"queue",
			"notes",
			"inspect",
			"help",
			"info",
			"alarm",
			"compare",
			"done",
			"pin",
			"microphone",
			"test-tube",
			"flask",
			"pipette",
			"dropper",
			"stirrer",
			"hotplate",
			"centrifuge",
			"balance",
			"atom",
			"molecule",
			"lattice",
			"layered",
			"framework",
			"thin-film",
			"fiber",
			"hydrogel",
			"microscope",
			"xrd",
			"spectrum",
			"tensile",
			"electrode",
			"iv-curve",
			"illumination",
			"temperature",
			"humidity",
			"actuator",
			"flex-sensor",
			"battery"
		];
		/**
		* Legacy label of the fallback bucket. The top-level (ungrouped) concept
		* replaced the rendered "未分类" bucket: workspaces in no group render as
		* top-level rows beside the group folders. The constant survives for data
		* compatibility (reserved name, assignment null marker).
		*/
		const UNCATEGORIZED_LABEL = "未分类";
		/**
		* Reserved key under `workspaceOrder` holding the manual order of TOP-LEVEL
		* (ungrouped) project rows. Distinct from any real group display name (a group
		* may not be named this), so it can never collide; the top-level list's order
		* is preserved exactly like a group's, and top-level rows can be reordered by
		* dragging.
		*/
		const TOP_LEVEL_ORDER_KEY = "__topLevel__";
		/** Normalize a path for prefix matching: trailing slashes stripped. */
		function normalizePath(path) {
			return path.replace(/[/\\]+$/, "");
		}
		// src/core/matcher.ts
		/**
		* Pure classification + ordering logic: decides which category a workspace
		* belongs to and how categories/workspaces are ordered. Shared by the host
		* half (validation) and the client half (tree derivation), so the semantics
		* can never drift between the config surface and the rendered tree.
		*
		* Category identity: a category's STABLE origin is its YAML rule category
		* name (or a manual-group name). Its DISPLAY key is what the tree renders and
		* what assignments reference — for rule categories that is the rename
		* override when present. Hidden rule categories are inert: workspaces that
		* would match them become top-level (ungrouped).
		*/
		/** One rule match against a workspace's path and title. */
		function ruleMatches(rule, path, title) {
			const normalized = normalizePath(path);
			if (rule.pathPrefix !== void 0 && normalized.startsWith(normalizePath(rule.pathPrefix))) return true;
			if (rule.pathExact !== void 0 && normalized === normalizePath(rule.pathExact)) return true;
			if (rule.nameContains !== void 0 && title.toLowerCase().includes(rule.nameContains.toLowerCase())) return true;
			if (rule.basenameContains !== void 0) {
				if ((path.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ?? "").toLowerCase().includes(rule.basenameContains.toLowerCase())) return true;
			}
			return false;
		}
		/** Classify a workspace by rules only; hidden categories are inert. */
		function classify(categories, path, title) {
			for (const category of categories) if (category.rules.some((rule) => ruleMatches(rule, path, title))) return category;
		}
		/** Display name of a rule category: the rename override when present. */
		function ruleDisplayName(manual, originalName) {
			return manual?.renamed?.[originalName] ?? originalName;
		}
		/** Whether a rule category has been hidden by a UI delete. */
		function isHiddenRule(manual, originalName) {
			return manual?.hidden?.includes(originalName) ?? false;
		}
		/** Presentation for a category display key, or undefined when unset. */
		function categoryAppearance(manual, key) {
			return manual?.appearance?.[key];
		}
		/** Whether a category display key is pinned. */
		function isCategoryPinned(manual, key) {
			return categoryAppearance(manual, key)?.pinned === true;
		}
		/**
		* Drop empty presentation fields: `undefined` values, `pinned: false`, `icon: ''`.
		* Returns undefined when nothing is left, so callers can delete the whole entry.
		*/
		function pruneAppearance(value) {
			const result = {};
			if (value.color !== void 0) result.color = value.color;
			if (value.icon !== void 0 && value.icon.trim() !== "") result.icon = value.icon;
			if (value.pinned === true) result.pinned = true;
			return Object.keys(result).length === 0 ? void 0 : result;
		}
		/** Original YAML rule name whose display name equals `key` (undefined when none). */
		function originalRuleNameForDisplay(categories, manual, key) {
			return categories.find((c) => ruleDisplayName(manual, c.name) === key)?.name;
		}
		/** Apply `manual.categoryOrder` to the default sequence (stable). */
		function orderByCategoryOrder(entries, order) {
			if (order === void 0 || order.length === 0) return entries;
			const position = new Map(order.map((key, index) => [key, index]));
			return [...entries].sort((a, b) => {
				const pa = position.get(a.key);
				const pb = position.get(b.key);
				if (pa !== void 0 && pb !== void 0) return pa - pb;
				if (pa !== void 0) return -1;
				if (pb !== void 0) return 1;
				return 0;
			});
		}
		/** Stable partition: pinned groups first, unpinned ones keep their order. */
		function pinnedFirst(entries, manual) {
			if (manual?.appearance === void 0) return entries;
			const pinned = (entry) => Number(isCategoryPinned(manual, entry.key));
			return [...entries].sort((a, b) => pinned(b) - pinned(a));
		}
		function effectiveCategories(config, manual) {
			const entries = [];
			const seen = /* @__PURE__ */ new Set();
			for (const category of config.categories) {
				if (isHiddenRule(manual, category.name)) continue;
				const key = ruleDisplayName(manual, category.name);
				if (seen.has(key)) continue;
				seen.add(key);
				entries.push({
					key,
					source: "rule"
				});
			}
			for (const name of manual?.categories ?? []) {
				if (seen.has(name)) continue;
				seen.add(name);
				entries.push({
					key: name,
					source: "manual"
				});
			}
			return pinnedFirst(orderByCategoryOrder(entries, manual?.categoryOrder), manual);
		}
		/** Display keys of all effective categories (top-level workspaces excluded). */
		function displayCategoryKeys(config, manual) {
			return effectiveCategories(config, manual).map((e) => e.key);
		}
		/**
		* Resolve the category key a workspace renders under, or `undefined` when it
		* is top-level (ungrouped). Precedence: manual override (`null` = forced
		* top-level) → rule classification (hidden rules inert) → top-level.
		*/
		function resolveCategory(config, manual, workspaceId, path, title) {
			const override = manual?.assignments[workspaceId];
			if (override !== void 0) return override ?? void 0;
			const matched = classify(config.categories, path, title);
			if (matched === void 0) return void 0;
			if (isHiddenRule(manual, matched.name)) return void 0;
			return ruleDisplayName(manual, matched.name);
		}
		/**
		* Names that may not be used for a new/renamed group: the legacy reserved
		* label plus every current display key.
		*/
		function takenCategoryNames(config, manual) {
			const taken = new Set(displayCategoryKeys(config, manual));
			taken.add(UNCATEGORIZED_LABEL);
			return taken;
		}
		/**
		* Order a bucket of workspace ids: the stored per-category order first
		* (filtered to actual members), then any remaining members in `fallback`
		* (host) order. Deterministic; the renderer never re-sorts on its own.
		*/
		function orderedWorkspaceIds(manual, categoryKey, members) {
			const stored = manual?.workspaceOrder?.[categoryKey];
			if (stored === void 0 || stored.length === 0) return [...members];
			const memberSet = new Set(members);
			const ordered = [];
			const seen = /* @__PURE__ */ new Set();
			for (const id of stored) {
				if (!memberSet.has(id) || seen.has(id)) continue;
				seen.add(id);
				ordered.push(id);
			}
			for (const id of members) {
				if (seen.has(id)) continue;
				ordered.push(id);
			}
			return ordered;
		}
		/** Move `id` before `beforeId` (undefined = append) within an ordered list. */
		function moveBefore(list, id, beforeId) {
			const rest = list.filter((x) => x !== id);
			if (beforeId === void 0) return [...rest, id];
			const index = rest.indexOf(beforeId);
			if (index === -1) return [...rest, id];
			rest.splice(index, 0, id);
			return rest;
		}
		/** Move `id` after `afterId` (undefined = append) within an ordered list. */
		function moveAfter(list, id, afterId) {
			const rest = list.filter((x) => x !== id);
			if (afterId === void 0) return [...rest, id];
			const index = rest.indexOf(afterId);
			if (index === -1) return [...rest, id];
			rest.splice(index + 1, 0, id);
			return rest;
		}
		// src/client/subagent-lineage.ts
		/**
		* Index uninterrupted subagent descendants under each ancestor.
		* @param summaries - Session summaries keyed by id.
		* @returns descendant totals keyed by possible parent id.
		*/
		function indexSubagentDescendants(summaries) {
			const indexed = /* @__PURE__ */ new Map();
			for (const descendant of Object.values(summaries)) {
				if (descendant.origin !== "subagent") continue;
				const seen = /* @__PURE__ */ new Set();
				let current = descendant;
				while (current?.origin === "subagent" && current.parentId !== void 0 && !seen.has(current.id)) {
					seen.add(current.id);
					const aggregate = indexed.get(current.parentId);
					if (aggregate === void 0) indexed.set(current.parentId, {
						count: 1,
						runningCount: descendant.running ? 1 : 0
					});
					else {
						aggregate.count += 1;
						if (descendant.running) aggregate.runningCount += 1;
					}
					current = summaries[current.parentId];
				}
			}
			return indexed;
		}
		/** Parent directory the Host creates inside <Documents> for its state. */
		const HOST_STATE_DIRECTORY = "deepseek-harness";
		/**
		* Whether a workspace snapshot is the Host's default workspace.
		* @param workspace - workspace snapshot (title is the primary signal, path the fallback).
		*/
		function isDefaultWorkspace(workspace) {
			if (workspace.title?.trim().toLowerCase() === "default-workspace") return true;
			const path = (workspace.path ?? "").replace(/[/\\]+$/u, "");
			if (path === "") return false;
			const segments = path.split(/[/\\]+/u);
			return segments[segments.length - 1]?.toLowerCase() === "default-workspace" && segments.some((segment) => segment.toLowerCase() === HOST_STATE_DIRECTORY);
		}
		// src/core/folders.ts
		/** Canonical empty document, shared so callers need not allocate one each time. */
		const EMPTY_FOLDERS_DOCUMENT = {
			version: 1,
			revision: 0,
			workspaces: {}
		};
		/** `C:\…` or `C:/…` — a drive-rooted Windows path. */
		const WINDOWS_DRIVE = /^[A-Za-z]:[\\/]/u;
		/** `\\server\share` — a Windows UNC path. */
		const WINDOWS_UNC = /^\\\\/u;
		/** True for both Windows path spellings accepted by the write validator. */
		function isWindowsStyle(path) {
			return WINDOWS_DRIVE.test(path) || WINDOWS_UNC.test(path);
		}
		/**
		* One path with trailing separators removed, spelling preserved (no case
		* folding) — the form to STORE. A drive/UNC/root prefix keeps its separator.
		* @param path - raw path.
		*/
		function withoutTrailingSeparator(path) {
			if (isWindowsStyle(path)) {
				let value = path.replaceAll("/", "\\");
				while (value.length > 3 && value.endsWith("\\")) value = value.slice(0, -1);
				return value;
			}
			let value = path;
			while (value.length > 1 && value.endsWith("/")) value = value.slice(0, -1);
			return value;
		}
		/**
		* Comparison form of one path: trimmed, separator-normalized and, for Windows
		* spellings, lower-cased (drive letters and file names are case-insensitive
		* there). Trailing separators are dropped except for a drive/UNC/root prefix.
		* @param path - raw path as stored or picked.
		* @returns the canonical comparison form.
		*/
		function canonicalPath(path) {
			const trimmed = path.trim();
			const value = withoutTrailingSeparator(trimmed);
			return isWindowsStyle(trimmed) ? value.toLowerCase() : value;
		}
		/**
		* Path equality: case-insensitive for Windows-style paths, tolerant of
		* trailing separators, exact for POSIX paths.
		* @param a - first path.
		* @param b - second path.
		*/
		function samePath(a, b) {
			return canonicalPath(a) === canonicalPath(b);
		}
		/**
		* Look up the folder entry saved for one workspace.
		* @param doc - folders document.
		* @param workspaceId - host workspace id.
		* @returns the entry, or undefined when the workspace has none.
		*/
		function entryFor(doc, workspaceId) {
			return doc.workspaces[workspaceId];
		}
		/**
		* The workspace's effective folder list, base first. The base cannot be
		* duplicated and blank extra entries are dropped.
		* @param workspacePath - canonical directory of the workspace.
		* @param entry - saved folder entry, if any.
		*/
		function effectiveFolders(workspacePath, entry) {
			const extras = [];
			const candidates = [...entry?.folders ?? [], ...(entry?.members ?? []).map((member) => member.path)];
			for (const folder of candidates) {
				if (folder.trim() === "") continue;
				if (samePath(folder, workspacePath)) continue;
				if (extras.some((existing) => samePath(existing, folder))) continue;
				extras.push(folder);
			}
			return [workspacePath, ...extras];
		}
		/**
		* The member record behind one folder path, when that folder is workspace-backed.
		* @param entry - saved folder entry, if any.
		* @param path - folder path as stored.
		*/
		function memberOf(entry, path) {
			return (entry?.members ?? []).find((member) => samePath(member.path, path));
		}
		/**
		* Light canonical form of a REMOTE path (POSIX — the server's filesystem):
		* trimmed, trailing slashes removed. Deliberately string-only: the client
		* cannot resolve `~` or symlinks; the remote-ssh host canonicalizes fully
		* at registration time. This is the second line of defense, catching the
		* spelling variants a user can type into the add-cloud-folder dialog.
		* @param raw - remote path as typed or as stored.
		*/
		function lightRemotePath(raw) {
			const trimmed = raw.trim();
			return trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
		}
		/**
		* Whether two remote paths name the same directory under {@link lightRemotePath}.
		* @param a - first remote path.
		* @param b - second remote path.
		*/
		function sameRemotePath(a, b) {
			return lightRemotePath(a) === lightRemotePath(b);
		}
		/**
		* The member backed by one native workspace id, when one exists.
		* @param entry - saved folder entry, if any.
		* @param workspaceId - native workspace id backing the member.
		*/
		function memberByWorkspaceId(entry, workspaceId) {
			return (entry?.members ?? []).find((member) => member.workspaceId === workspaceId);
		}
		/**
		* The remote member for one connection + remote directory, when one exists.
		* @param entry - saved folder entry, if any.
		* @param profileId - remote-ssh connection id.
		* @param remotePath - remote directory to look up.
		*/
		function findRemoteMember(entry, profileId, remotePath) {
			return (entry?.members ?? []).find((member) => member.kind === "remote" && member.profileId === profileId && member.remotePath !== void 0 && sameRemotePath(member.remotePath, remotePath));
		}
		/**
		* Member workspace id → owning workspace id.
		*
		* These are the workspaces whose own row disappears from the sidebar: their
		* sessions render under the owning project's folder row instead. A workspace
		* that is itself an owner (it carries an entry) is never absorbed — absorbing
		* it would hide a project together with the folders nested below it.
		* @param doc - folders document.
		*/
		function absorbedWorkspaceIds(doc) {
			const owners = new Set(Object.keys(doc.workspaces));
			const absorbed = /* @__PURE__ */ new Map();
			for (const [ownerId, entry] of Object.entries(doc.workspaces)) for (const member of entry.members ?? []) {
				if (member.workspaceId === "" || member.workspaceId === ownerId) continue;
				if (owners.has(member.workspaceId)) continue;
				if (!absorbed.has(member.workspaceId)) absorbed.set(member.workspaceId, ownerId);
			}
			return absorbed;
		}
		/**
		* True when the entry carries neither a plain folder nor a member, i.e. it can
		* be dropped from the sidecar instead of being written empty.
		* @param entry - folder entry.
		*/
		function isEmptyEntry(entry) {
			return (entry?.folders.length ?? 0) === 0 && (entry?.members?.length ?? 0) === 0;
		}
		/**
		* The folder new sessions start in by default.
		* @param workspacePath - canonical directory of the workspace.
		* @param entry - saved folder entry, if any.
		* @returns the stored root when it names an effective extra folder, else the
		* workspace's own directory.
		*/
		function rootOf(workspacePath, entry) {
			const root = entry?.root;
			if (root === void 0) return workspacePath;
			return effectiveFolders(workspacePath, entry).find((folder) => samePath(folder, root)) ?? workspacePath;
		}
		/**
		* Owning folder of a session cwd: the most specific (longest) effective folder
		* that equals the cwd or is a proper path ancestor of it.
		* @param cwd - recorded session cwd; undefined means "the workspace itself".
		* @param workspacePath - canonical directory of the workspace.
		* @param entry - saved folder entry, if any.
		* @returns the owning folder, or the workspace path when nothing matches.
		*/
		function folderOfCwd(cwd, workspacePath, entry) {
			if (cwd === void 0) return workspacePath;
			const target = canonicalPath(cwd);
			let best;
			let bestLength = -1;
			for (const folder of effectiveFolders(workspacePath, entry)) {
				const root = canonicalPath(folder);
				if (root === "") continue;
				const separator = isWindowsStyle(root) ? "\\" : "/";
				const prefix = root.endsWith(separator) ? root : `${root}${separator}`;
				if (target !== root && !target.startsWith(prefix)) continue;
				if (root.length > bestLength) {
					best = folder;
					bestLength = root.length;
				}
			}
			return best ?? workspacePath;
		}
		/**
		* Append an extra folder. Idempotent under `samePath`, and the stored root (if
		* any) survives untouched.
		* @param entry - current entry, or undefined for a workspace with no extras.
		* @param path - folder path to append.
		*/
		function addFolder(entry, path) {
			const folders = entry?.folders ?? [];
			const members = entry?.members ?? [];
			const root = entry?.root;
			const trimmed = path.trim();
			const keepRoot = root === void 0 ? {} : { root };
			const keepMembers = members.length === 0 ? {} : { members: [...members] };
			if (trimmed === "" || folders.some((folder) => samePath(folder, trimmed)) || members.some((member) => samePath(member.path, trimmed))) return {
				folders: [...folders],
				...keepMembers,
				...keepRoot
			};
			return {
				folders: [...folders, trimmed],
				...keepMembers,
				...keepRoot
			};
		}
		/**
		* Append a workspace-backed folder. Idempotent under `samePath`: a later call
		* for the same path replaces the stored member (so a re-registered workspace id
		* wins) instead of stacking a duplicate row.
		* @param entry - current entry, or undefined for a workspace with no extras.
		* @param member - member record to store.
		*/
		function addMember(entry, member) {
			const folders = (entry?.folders ?? []).filter((folder) => !samePath(folder, member.path));
			const members = (entry?.members ?? []).filter((existing) => !samePath(existing.path, member.path));
			const root = entry?.root;
			const keepRoot = root === void 0 ? {} : { root };
			return {
				folders: [...folders],
				members: [...members, member],
				...keepRoot
			};
		}
		/**
		* Drop an extra folder, plain or workspace-backed. A root that pointed at it is
		* cleared, so the workspace falls back to its own directory instead of
		* referencing a folder it no longer has.
		* @param entry - current entry, or undefined.
		* @param path - folder path to drop.
		*/
		function removeFolder(entry, path) {
			const folders = (entry?.folders ?? []).filter((folder) => !samePath(folder, path));
			const members = (entry?.members ?? []).filter((member) => !samePath(member.path, path));
			const root = entry?.root;
			const keepRoot = root !== void 0 && !samePath(root, path);
			return {
				folders,
				...members.length === 0 ? {} : { members },
				...keepRoot ? { root } : {}
			};
		}
		/**
		* Designate the root folder. Only an extra folder can be stored: naming the
		* base directory means "no explicit root", which is represented by clearing
		* the key.
		* @param entry - current entry, or undefined.
		* @param path - folder to make the root.
		*/
		function setRoot(entry, path) {
			const folders = entry?.folders ?? [];
			const members = entry?.members ?? [];
			const keepMembers = members.length === 0 ? {} : { members: [...members] };
			const match = [...folders, ...members.map((member) => member.path)].find((folder) => samePath(folder, path));
			if (match === void 0) return {
				folders: [...folders],
				...keepMembers
			};
			return {
				folders: [...folders],
				...keepMembers,
				root: match
			};
		}
		/**
		* True when `path` is `base` itself or lives somewhere below it, with the same
		* separator and case rules as {@link samePath}.
		* @param path - candidate path.
		* @param base - containing directory.
		*/
		function isUnderBase(path, base) {
			const root = canonicalPath(base);
			const target = canonicalPath(path);
			if (root === "" || target === "") return false;
			if (target === root) return true;
			const separator = isWindowsStyle(root) ? "\\" : "/";
			const prefix = root.endsWith(separator) ? root : `${root}${separator}`;
			return target.startsWith(prefix);
		}
		/**
		* Resolve a user-typed SUBPATH against a base directory.
		*
		* This is what remote (mirror-backed) workspaces need: their canonical
		* directory is a local mirror of a remote root, so an extra folder must be a
		* directory INSIDE the mirror — that is the only spelling that also exists on
		* the remote side. Absolute input and `..` escapes are rejected outright so a
		* typo cannot smuggle in an unrelated local directory.
		* @param base - the workspace's canonical directory.
		* @param relative - typed subpath, either separator style.
		* @returns the joined path, or null when the input is empty, absolute, or
		* escapes the base.
		*/
		function joinSubpath(base, relative) {
			const root = base.trim();
			const raw = relative.trim();
			if (root === "" || raw === "") return null;
			if (WINDOWS_DRIVE.test(raw) || WINDOWS_UNC.test(raw) || raw.startsWith("/")) return null;
			const segments = raw.split(/[\\/]+/u).filter((segment) => segment !== "" && segment !== ".");
			if (segments.length === 0) return null;
			if (segments.includes("..")) return null;
			const separator = isWindowsStyle(root) ? "\\" : "/";
			return `${withoutTrailingSeparator(root)}${separator}${segments.join(separator)}`;
		}
		// src/client/tree.ts
		/**
		* The Session the Conversation is currently showing.
		*
		* 0.1.6 removed `SessionListState.current`: selection is expressed as the
		* Session retained through the `mainView` reference source (the ui-workspace
		* navigation holds exactly one). Same read the official browser performs.
		* @param list - sessions list snapshot.
		* @returns the retained Session id, or undefined while no Session is selected.
		*/
		function currentSessionId(list) {
			return Object.values(list.byId).find((session) => (session.retainedBy?.mainView ?? 0) > 0)?.id;
		}
		/** Keep navigation presentation independent from domain-owned interaction objects. */
		function visiblePendingKind(kind) {
			switch (kind) {
				case "approval":
				case "plan-review":
				case "question": return kind;
				default: return;
			}
		}
		/** Key of the uncategorized bucket (matches the config fallback label). */
		const UNCATEGORIZED_KEY = UNCATEGORIZED_LABEL;
		/**
		* Names the "not sorted yet" bucket commonly gets. A group whose key matches one
		* of these is docked to the bottom of the sidebar (above the default-workspace
		* row) instead of taking a slot in the tree, so the workspaces a user has not
		* classified yet never push the classified tree around.
		*/
		const DOCKED_CATEGORY_PATTERN = /^(?:未归类|未分类|未分组|未排序|待归类|ungrouped|uncategorized|unsorted)$/iu;
		/** Whether this category key names the "not yet classified" bucket. */
		function isDockedCategoryKey(key) {
			return DOCKED_CATEGORY_PATTERN.test(key.trim());
		}
		/** Directory display label: basename of the path (both separators accepted). */
		function workspaceLabel(cwd) {
			if (cwd === void 0 || cwd === "") return UNCATEGORIZED_LABEL;
			const base = cwd.replace(/[/\\]+$/, "").split(/[/\\]/).pop();
			return base !== void 0 && base !== "" ? base : cwd;
		}
		/** Ordinary sessions are visible; blank only when current; archived/subagent never. */
		function sessionVisible(session, current, archived) {
			return session.origin !== "subagent" && !archived.has(session.id) && (!session.blank || session.id === current);
		}
		/** Blank rows display the localized New Session label (never enters search). */
		function sessionTitle(session) {
			return session.blank ? "New Session" : session.displayTitle;
		}
		function sessionNode(s, descendants, statuses) {
			const status = typeof statuses?.get === "function" ? statuses.get(s.id) : statuses[s.id];
			const pending = visiblePendingKind(status?.pendingInteraction?.kind);
			return {
				id: s.id,
				title: sessionTitle(s),
				blank: s.blank,
				running: status?.running ?? s.running,
				runningSubagentCount: descendants.get(s.id)?.runningCount ?? 0,
				completed: status?.completionUnread === true,
				updatedAt: s.updatedAt,
				...pending === void 0 ? {} : { pendingInteraction: pending }
			};
		}
		/** Visible sessions of one workspace in its stored account order. */
		function workspaceSessions(list, workspace, archived, descendants, statuses, current) {
			const nodes = [];
			for (const id of workspace.sessionIds) {
				const summary = list.byId[id];
				if (summary === void 0) continue;
				if (!sessionVisible(summary, current, archived)) continue;
				nodes.push(sessionNode(summary, descendants, statuses));
			}
			return nodes;
		}
		/**
		* Resolve the workspace-backed folders of every project.
		*
		* A member folder is a real DSH workspace whose OWN row must disappear: its
		* sessions are rendered under its owner's folder row instead, so one project can
		* carry local and cloud (SSH-mirrored) folders at once. Members the Host no
		* longer knows are dropped from the index — the folder row survives (its path is
		* still stored) but shows no sessions.
		* @param workspaces - real workspaces in Host order.
		* @param folders - per-workspace extra folders + members + root.
		*/
		function memberWorkspaces(workspaces, folders = EMPTY_FOLDERS_DOCUMENT) {
			const byId = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) byId.set(workspace.workspaceId, workspace);
			const stored = absorbedWorkspaceIds(folders);
			const absorbed = /* @__PURE__ */ new Map();
			for (const [memberId, ownerId] of stored) {
				if (!byId.has(ownerId) || stored.has(ownerId)) continue;
				absorbed.set(memberId, ownerId);
			}
			const byOwner = /* @__PURE__ */ new Map();
			for (const [ownerId, entry] of Object.entries(folders.workspaces)) for (const member of entry.members ?? []) {
				if (absorbed.get(member.workspaceId) !== ownerId) continue;
				const view = byId.get(member.workspaceId);
				if (view === void 0) continue;
				const bucket = byOwner.get(ownerId);
				if (bucket === void 0) byOwner.set(ownerId, [view]);
				else bucket.push(view);
			}
			return {
				absorbed,
				byOwner
			};
		}
		/** Visible sessions of a project: its own rows plus every member folder's rows. */
		function sessionsWithMembers(list, workspace, members, archived, descendants, statuses, current) {
			if (members.length === 0) return workspaceSessions(list, workspace, archived, descendants, statuses, current);
			const nodes = workspaceSessions(list, workspace, archived, descendants, statuses, current);
			for (const member of members) nodes.push(...workspaceSessions(list, member, archived, descendants, statuses, current));
			return nodes;
		}
		/** Whether a session lives in this project or in one of its member folders. */
		function projectHoldsSession(workspace, members, sessionId) {
			if (sessionId === void 0) return false;
			if (workspace.sessionIds.includes(sessionId)) return true;
			return members.some((member) => member.sessionIds.includes(sessionId));
		}
		/**
		* Display label of one folder: the last path segment. A drive root (`C:\`) or
		* the POSIX root has no segment, so the whole path is the honest label.
		* @param path - absolute folder path.
		*/ function folderLabel(path) {
			const trimmed = path.replace(/[/\\]+$/u, "");
			if (trimmed === "" || /^[A-Za-z]:$/u.test(trimmed)) return path;
			const base = trimmed.split(/[/\\]/u).pop();
			return base !== void 0 && base !== "" ? base : path;
		}
		/** Stable identity of one folder row (same path may live under two workspaces). */
		function folderKey(workspaceId, path) {
			return `${workspaceId}\u0000${path}`;
		}
		/**
		* Display labels for member folders.
		*
		* A cloud member's directory is a locally generated mirror id (`wabc123`), which
		* says nothing to the user: its REMOTE path or title is the honest label. Local
		* members keep the last path segment, like every other folder.
		* @param folders - per-workspace folders + members.
		*/
		function memberFolderLabels(entry) {
			const labels = /* @__PURE__ */ new Map();
			for (const member of entry?.members ?? []) {
				const label = member.kind === "remote" ? member.title ?? folderLabel(member.remotePath ?? member.path) : folderLabel(member.path);
				if (label !== "") labels.set(member.path, label);
			}
			return labels;
		}
		/**
		* Split a workspace's visible sessions between its base directory and its extra
		* folders. Sessions keep the order they already had inside their owner, and a
		* workspace with no extra folder returns its sessions untouched — the pre-
		* folders node shape (no `folders` key at all).
		* @param workspaceId - owning workspace.
		* @param workspacePath - canonical directory (folder #0).
		* @param sessions - every visible session of the workspace, in host order.
		* @param list - sessions list snapshot (records each session's cwd).
		* @param entry - saved extra folders + root for this workspace.
		* @param collapsedFolders - collapsed folder-row keys. Undefined means "nothing
		* is collapsed", which is both the default view and what search uses so every
		* hit is visible without another click.
		*/
		function applyFolders(workspaceId, workspacePath, sessions, list, entry, collapsedFolders) {
			const labels = memberFolderLabels(entry);
			const extras = effectiveFolders(workspacePath, entry).slice(1);
			if (extras.length === 0) return { sessions };
			const root = rootOf(workspacePath, entry);
			const base = [];
			const byFolder = /* @__PURE__ */ new Map();
			for (const node of sessions) {
				const owner = folderOfCwd(list.byId[node.id]?.cwd, workspacePath, entry);
				if (samePath(owner, workspacePath)) {
					base.push(node);
					continue;
				}
				const bucket = byFolder.get(owner);
				if (bucket === void 0) byFolder.set(owner, [node]);
				else bucket.push(node);
			}
			const folderNode = (path, isBase) => {
				const owned = isBase ? base : byFolder.get(path) ?? [];
				return {
					path,
					label: labels.get(path) ?? folderLabel(path),
					isRoot: samePath(path, root),
					expanded: collapsedFolders === void 0 || !collapsedFolders.has(folderKey(workspaceId, path)),
					isBase,
					sessions: owned
				};
			};
			const folders = [folderNode(workspacePath, true), ...extras.map((path) => folderNode(path, false))];
			const rootIndex = folders.findIndex((folder) => folder.isRoot);
			if (rootIndex > 0) {
				const [rootFolder] = folders.splice(rootIndex, 1);
				if (rootFolder !== void 0) folders.unshift(rootFolder);
			}
			return {
				sessions: base,
				folders
			};
		}
		/**
		* Derive the three-level tree.
		* @param list - sessions list snapshot (`current` feeds containsCurrent).
		* @param workspaces - real workspaces in stable Host order.
		* @param archivedSessionIds - registry-global archive set.
		* @param config - sidecar grouping config (rule categories).
		* @param view - local expansion arrays.
		* @param manual - runtime overlay (manual groups + overrides). A workspace's
		* manual override wins over rule classification; removing it reverts to rules.
		* @param statuses - unified UI status by Session (drives the running / warning
		* / unread-completion row indicators); defaults to none (tests).
		* @param folders - per-workspace extra folders + root. A workspace with extras
		* gains folder rows and its extra-folder sessions move under them; a workspace
		* without extras keeps exactly the pre-folders node shape.
		* @returns category sections in render order (rule categories first, then
		* manual-only ones, uncategorized last). Manual groups render even while
		* empty; empty rule buckets stay hidden.
		*/
		function deriveGroups(list, workspaces, archivedSessionIds, config, view, manual, statuses = /* @__PURE__ */ new Map(), folders = EMPTY_FOLDERS_DOCUMENT) {
			const archived = new Set(archivedSessionIds);
			const expandedCategories = new Set(view.expandedCategories);
			const expandedWorkspaces = new Set(view.expandedWorkspaces);
			const collapsedFolders = new Set(view.collapsedFolders ?? []);
			const descendants = indexSubagentDescendants(list.byId);
			const current = currentSessionId(list);
			const members = memberWorkspaces(workspaces, folders);
			const byCategory = /* @__PURE__ */ new Map();
			for (const { key } of effectiveCategories(config, manual)) byCategory.set(key, []);
			for (const workspace of workspaces) {
				if (isDefaultWorkspace(workspace)) continue;
				if (members.absorbed.has(workspace.workspaceId)) continue;
				const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title);
				if (key === void 0) continue;
				if (!byCategory.has(key)) byCategory.set(key, []);
				byCategory.get(key).push(workspace);
			}
			const manualCategories = new Set(manual.categories);
			const currentWorkspaceId = current === void 0 ? void 0 : workspaces.find((w) => !members.absorbed.has(w.workspaceId) && projectHoldsSession(w, members.byOwner.get(w.workspaceId) ?? [], current))?.workspaceId;
			const nodes = [];
			for (const key of effectiveCategories(config, manual).map((e) => e.key)) {
				const bucket = byCategory.get(key) ?? [];
				if (bucket.length === 0 && !manualCategories.has(key)) continue;
				const expanded = expandedCategories.has(key);
				const ordered = orderedWorkspaceIds(manual, key, bucket.map((w) => w.workspaceId));
				const workspaceNodes = [];
				let containsCurrent = false;
				for (const workspaceId of ordered) {
					const workspace = bucket.find((w) => w.workspaceId === workspaceId);
					if (workspace === void 0) continue;
					const sessions = sessionsWithMembers(list, workspace, members.byOwner.get(workspace.workspaceId) ?? [], archived, descendants, statuses, current);
					const wsExpanded = expandedWorkspaces.has(workspace.workspaceId);
					const wsContainsCurrent = workspace.workspaceId === currentWorkspaceId;
					const partitioned = applyFolders(workspace.workspaceId, workspace.path, sessions, list, entryFor(folders, workspace.workspaceId), collapsedFolders);
					if (wsContainsCurrent) containsCurrent = true;
					workspaceNodes.push({
						workspaceId: workspace.workspaceId,
						path: workspace.path,
						label: workspace.title,
						createdAt: Date.parse(workspace.createdAt),
						sessionCount: sessions.length,
						expanded: wsExpanded,
						containsCurrent: wsContainsCurrent,
						sessions: wsExpanded ? partitioned.sessions : [],
						...partitioned.folders === void 0 ? {} : { folders: partitioned.folders }
					});
				}
				const appearance = categoryAppearance(manual, key);
				nodes.push({
					key,
					label: key,
					expanded,
					containsCurrent,
					workspaces: workspaceNodes,
					...appearance === void 0 ? {} : { appearance }
				});
			}
			return nodes;
		}
		/**
		* Top-level (ungrouped) workspace rows: workspaces resolving to no category
		* (no manual override and no matching rule, or a forced `null` override).
		* Rendered after the group folders as plain project rows (not inside any
		* folder), in manual top-level order (`workspaceOrder[TOP_LEVEL_ORDER_KEY]`),
		* falling back to host registration order.
		*/
		function deriveTopLevel(list, workspaces, archivedSessionIds, config, view, manual, statuses = /* @__PURE__ */ new Map(), folders = EMPTY_FOLDERS_DOCUMENT) {
			const archived = new Set(archivedSessionIds);
			const expandedWorkspaces = new Set(view.expandedWorkspaces);
			const collapsedFolders = new Set(view.collapsedFolders ?? []);
			const descendants = indexSubagentDescendants(list.byId);
			const current = currentSessionId(list);
			const members = memberWorkspaces(workspaces, folders);
			const currentWorkspaceId = current === void 0 ? void 0 : workspaces.find((w) => !members.absorbed.has(w.workspaceId) && projectHoldsSession(w, members.byOwner.get(w.workspaceId) ?? [], current))?.workspaceId;
			const topLevelIds = workspaces.filter((w) => !isDefaultWorkspace(w)).filter((w) => !members.absorbed.has(w.workspaceId)).filter((w) => resolveCategory(config, manual, w.workspaceId, w.path, w.title) === void 0).map((w) => w.workspaceId);
			const ordered = orderedWorkspaceIds(manual, TOP_LEVEL_ORDER_KEY, topLevelIds);
			const nodes = [];
			for (const workspaceId of ordered) {
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) continue;
				const sessions = sessionsWithMembers(list, workspace, members.byOwner.get(workspaceId) ?? [], archived, descendants, statuses, current);
				const wsExpanded = expandedWorkspaces.has(workspaceId);
				const partitioned = applyFolders(workspace.workspaceId, workspace.path, sessions, list, entryFor(folders, workspaceId), collapsedFolders);
				nodes.push({
					workspaceId: workspace.workspaceId,
					path: workspace.path,
					label: workspace.title,
					createdAt: Date.parse(workspace.createdAt),
					sessionCount: sessions.length,
					expanded: wsExpanded,
					containsCurrent: workspace.workspaceId === currentWorkspaceId,
					sessions: wsExpanded ? partitioned.sessions : [],
					...partitioned.folders === void 0 ? {} : { folders: partitioned.folders }
				});
			}
			return nodes;
		}
		/**
		* The Host's default workspace as a standalone node for the pinned bottom bar.
		*
		* The default workspace is not part of the grouping tree (it is excluded from
		* `deriveGroups`, `deriveTopLevel` and the search results), yet it keeps the
		* full workspace-row behaviour: expansion, session count, its sessions and its
		* extra folders. This derives exactly that node, reusing the same visibility,
		* folder partitioning and current-session marking as the tree.
		*
		* @param list - sessions list snapshot.
		* @param workspaces - real workspaces in stable Host order.
		* @param archivedSessionIds - registry-global archive set.
		* @param view - local expansion arrays.
		* @param statuses - unified UI status by Session.
		* @param folders - per-workspace extra folders + root.
		* @returns the default workspace node, or undefined when the Host has none.
		*/
		function deriveDefaultWorkspace(list, workspaces, archivedSessionIds, view, statuses = /* @__PURE__ */ new Map(), folders = EMPTY_FOLDERS_DOCUMENT) {
			const workspace = workspaces.find((w) => isDefaultWorkspace(w));
			if (workspace === void 0) return void 0;
			const archived = new Set(archivedSessionIds);
			const expandedWorkspaces = new Set(view.expandedWorkspaces);
			const collapsedFolders = new Set(view.collapsedFolders ?? []);
			const descendants = indexSubagentDescendants(list.byId);
			const current = currentSessionId(list);
			const ownerMembers = memberWorkspaces(workspaces, folders).byOwner.get(workspace.workspaceId) ?? [];
			const sessions = sessionsWithMembers(list, workspace, ownerMembers, archived, descendants, statuses, current);
			const wsExpanded = expandedWorkspaces.has(workspace.workspaceId);
			const partitioned = applyFolders(workspace.workspaceId, workspace.path, sessions, list, entryFor(folders, workspace.workspaceId), collapsedFolders);
			return {
				workspaceId: workspace.workspaceId,
				path: workspace.path,
				label: workspace.title,
				createdAt: Date.parse(workspace.createdAt),
				sessionCount: sessions.length,
				expanded: wsExpanded,
				containsCurrent: projectHoldsSession(workspace, ownerMembers, current),
				sessions: wsExpanded ? partitioned.sessions : [],
				...partitioned.folders === void 0 ? {} : { folders: partitioned.folders }
			};
		}
		/** Recency comparator: newest first, id as the deterministic tiebreak. */
		function byRecency(a, b) {
			if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
			return a.id < b.id ? -1 : 1;
		}
		/**
		* Compute the matched-session set: immediate title/Workspace substring matches
		* from the local list, merged with ranked Host content matches. The consumer
		* (SearchBody) derives the pruned three-level tree from these ids.
		*/
		function deriveSearchMatches(list, workspaces, config, query, archivedSessionIds, content, limit, folders = EMPTY_FOLDERS_DOCUMENT) {
			const q = query.trim().toLowerCase();
			if (q === "") return {
				matchedIds: /* @__PURE__ */ new Set(),
				snippetsBySession: /* @__PURE__ */ new Map(),
				hasMore: false
			};
			const archived = new Set(archivedSessionIds);
			indexSubagentDescendants(list.byId);
			const current = currentSessionId(list);
			const members = memberWorkspaces(workspaces, folders);
			const workspaceBySession = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) {
				if (members.absorbed.has(workspace.workspaceId)) continue;
				const owner = workspace;
				for (const sessionId of workspace.sessionIds) if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, owner);
				for (const member of members.byOwner.get(workspace.workspaceId) ?? []) for (const sessionId of member.sessionIds) if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, owner);
			}
			const labelOf = (summary) => workspaceBySession.get(summary.id)?.title ?? workspaceLabel(summary.cwd);
			const local = [];
			for (const id of list.ids) {
				const summary = list.byId[id];
				if (summary === void 0 || summary.blank || !sessionVisible(summary, current, archived)) continue;
				if (sessionTitle(summary).toLowerCase().includes(q) || labelOf(summary).toLowerCase().includes(q)) local.push(summary);
			}
			local.sort(byRecency);
			const ordered = [];
			const included = /* @__PURE__ */ new Set();
			const include = (summary) => {
				if (included.has(summary.id)) return;
				included.add(summary.id);
				ordered.push(summary);
			};
			for (const summary of local) include(summary);
			for (const item of content.items) {
				const summary = list.byId[item.sessionId];
				if (summary !== void 0 && !summary.blank && sessionVisible(summary, current, archived)) include(summary);
			}
			const snippets = /* @__PURE__ */ new Map();
			for (const item of content.items) if (item.snippet !== void 0) snippets.set(item.sessionId, item.snippet);
			return {
				matchedIds: ordered.slice(0, limit).reduce((set, summary) => {
					set.add(summary.id);
					return set;
				}, /* @__PURE__ */ new Set()),
				snippetsBySession: snippets,
				hasMore: content.hasMore || ordered.length > limit
			};
		}
		/**
		* Build a three-level search tree containing ONLY the branches that hold a
		* matched session: 分类文件夹 → 项目文件夹 → 命中会话行. Every matched
		* session carries `matched: true` so rows render with the search-hit tint.
		* Classification uses the same precedence as the idle tree (manual override →
		* rules), so search shows the same grouping the user sees. Matched top-level
		* workspaces are returned separately (rendered as plain rows).
		*
		* @param list - sessions list snapshot.
		* @param workspaces - real workspaces in stable Host order.
		* @param config - sidecar grouping config.
		* @param matchedIds - set of session ids that matched the query.
		* @param archivedSessionIds - registry-global archive set.
		* @param manual - runtime overlay (manual groups + overrides).
		* @param snippetsBySession - optional content-match snippets keyed by session id.
		* @param statuses - unified UI status by Session (drives the running / warning
		* / unread-completion row indicators); defaults to none (tests).
		* @param folders - per-workspace extra folders + root, so a hit inside an extra
		* folder surfaces under that folder instead of flat under the project.
		* @returns group folders in render order plus top-level matched workspaces,
		* pruned to matched branches only.
		*/
		function deriveSearchGroups(list, workspaces, config, matchedIds, archivedSessionIds, manual, snippetsBySession, statuses = /* @__PURE__ */ new Map(), folders = EMPTY_FOLDERS_DOCUMENT) {
			const archived = new Set(archivedSessionIds);
			const descendants = indexSubagentDescendants(list.byId);
			const current = currentSessionId(list);
			const members = memberWorkspaces(workspaces, folders);
			const byCategory = /* @__PURE__ */ new Map();
			for (const key of effectiveCategories(config, manual).map((e) => e.key)) byCategory.set(key, []);
			const topLevel = [];
			let defaultWorkspace;
			for (const workspace of workspaces) {
				if (members.absorbed.has(workspace.workspaceId)) continue;
				const nodes = [];
				const sources = [workspace, ...members.byOwner.get(workspace.workspaceId) ?? []];
				for (const source of sources) for (const id of source.sessionIds) {
					const summary = list.byId[id];
					if (summary === void 0 || !matchedIds.has(id)) continue;
					if (!sessionVisible(summary, current, archived)) continue;
					const node = sessionNode(summary, descendants, statuses);
					const snippet = snippetsBySession?.get(id);
					nodes.push({
						...node,
						matched: true,
						...snippet === void 0 ? {} : { snippet }
					});
				}
				if (nodes.length === 0) continue;
				const partitioned = applyFolders(workspace.workspaceId, workspace.path, nodes, list, entryFor(folders, workspace.workspaceId), void 0);
				const node = {
					workspaceId: workspace.workspaceId,
					path: workspace.path,
					label: workspace.title,
					createdAt: Date.parse(workspace.createdAt),
					sessionCount: nodes.length,
					expanded: true,
					containsCurrent: false,
					sessions: partitioned.sessions,
					...partitioned.folders === void 0 ? {} : { folders: partitioned.folders }
				};
				if (isDefaultWorkspace(workspace)) {
					defaultWorkspace = node;
					continue;
				}
				const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title);
				if (key === void 0) {
					topLevel.push(node);
					continue;
				}
				if (!byCategory.has(key)) byCategory.set(key, []);
				byCategory.get(key).push(node);
			}
			const categories = [];
			for (const key of effectiveCategories(config, manual).map((e) => e.key)) {
				const workspaceNodes = byCategory.get(key);
				if (workspaceNodes === void 0 || workspaceNodes.length === 0) continue;
				const appearance = categoryAppearance(manual, key);
				categories.push({
					key,
					label: key,
					expanded: true,
					containsCurrent: false,
					workspaces: workspaceNodes,
					...appearance === void 0 ? {} : { appearance }
				});
			}
			return {
				categories,
				topLevel,
				...defaultWorkspace === void 0 ? {} : { defaultWorkspace }
			};
		}
		// src/client/FlowerBranch.tsx
		/**
		* The flower marker: an SVG overlay that draws a single bloom on the row you are
		* currently on.
		*
		* Originally ported from the RewampUI *Flower Sidebar* reference, which drew a
		* continuous curly stem down the whole tree — a dashed "ghost" route plus a
		* solid stroke "grown" to the active row — with a dot on every row and the bloom
		* at its tip. **The stem and the dots are gone**: they read as a stray black line
		* down the sidebar, and depth is already carried by the row indentation. Only the
		* bloom remains, still spinning while the current session works and resting when
		* it is idle.
		*
		* The SVG is `pointer-events: none` and `overflow: visible`, so it is pure
		* decoration over the real rows and never intercepts a click.
		*
		* Measurement, not layout: the rows are rendered by the tree itself (they carry
		* drag handlers, menus and hover state), so this component reads each row's
		* vertical centre and anchor from the DOM and feeds plain numbers to
		* `buildBranch`. That keeps the geometry unit-tested (`branch.ts`) while the SVG
		* stays a dumb renderer of it — and leaves the branch math intact should the stem
		* ever come back.
		*
		* Re-measured on: row count changes (expand/collapse, new session), the active
		* row changing, and container resize. A `ResizeObserver` on the scroll body
		* covers the last one without a window listener.
		*
		* The bloom's spin is NOT re-measured here: it arrives as the `spinning` prop
		* and is applied as a class, so a status flip never re-runs the DOM measurement
		* above (the tree is the expensive part, not the class swap).
		*/
		/**
		* The bloom's petal outline, in the 1024-unit box the artwork was drawn in.
		*
		* This is the user's own flower glyph verbatim: an eight-petal bloom around a
		* ringed center. Kept as a path (not a component) because it is a constant.
		*/
		const FLOWER_PATH = "M375.3728 841.8432c92.96-12.5184 203.8784-71.264 299.5456-166.9248 22.6112-22.6112 43.1616-46.08 61.5232-69.952C712.7616 786.3936 621.2608 921.6 512 921.6c-51.1488 0-98.4-29.632-136.6272-79.7568z m-87.808-422.8096C311.2384 237.6064 402.7328 102.4 512 102.4c51.1488 0 98.4 29.632 136.6272 79.7568-92.96 12.5184-203.8784 71.264-299.5456 166.9248a719.1232 719.1232 0 0 0-61.5232 69.952z m-129.536 139.5648c57.3248 74.2464 163.6608 140.9344 294.336 175.9488a719.1232 719.1232 0 0 0 91.3472 18.304c-168.9664 70.208-331.808 58.5728-386.432-36.0512-25.5744-44.288-23.5456-100.032 0.7552-158.2016z m322.2592-287.4496c168.9664-70.208 331.808-58.5728 386.432 36.0512 25.5744 44.288 23.5456 100.032-0.7552 158.2016-57.3184-74.2464-163.648-140.9344-294.336-175.9488a719.1232 719.1232 0 0 0-91.3408-18.304zM294.656 228.7552c-35.6352 86.7648-40.224 212.1984-5.2032 342.8736a719.1232 719.1232 0 0 0 29.8176 88.256C173.9904 548.6592 102.6432 401.824 157.2736 307.2c25.5744-44.288 74.8608-70.4 137.3824-78.4448z m410.0736 135.36c145.28 111.2256 216.6272 258.0608 161.9968 352.6848-25.5744 44.288-74.8608 70.4-137.3824 78.4448 35.6352-86.7648 40.224-212.1984 5.2032-342.8736a719.1232 719.1232 0 0 0-29.8176-88.256zM512 678.4c-88.3648 0-160-71.6352-160-160s71.6352-160 160-160 160 71.6352 160 160-71.6352 160-160 160z m0-83.2c42.4128 0 76.8-34.3872 76.8-76.8s-34.3872-76.8-76.8-76.8-76.8 34.3872-76.8 76.8 34.3872 76.8 76.8 76.8z";
		/** Petal colour: the accent the glyph was drawn in. */
		const FLOWER_PETAL = "#fa541c";
		/**
		* The bloom at the branch's endpoint.
		*
		* Anchoring is done entirely by these transforms, in this order:
		*
		*   1. `translate(cx cy)` — put the origin on the stem's tip (the endpoint of
		*      the grown stroke).
		*   2. `scale(FLOWER_SCALE)` — shrink the 1024-unit artwork about that origin.
		*   3. `translate(-512 -512)` — bring the glyph's own centre (512, 512) onto the
		*      origin, so the flower is centred on the tip.
		*
		* The spin is applied by `wgFlowerArt` in CSS as a `rotate()` composed AFTER
		* that recentring (`translate(-512 -512) rotate(...)`), so the bloom turns about
		* its own centre and the recentring never drifts as it rotates.
		*
		* Note what is deliberately NOT used here: a percentage `translate(-50%, -50%)`
		* or `transform-box: fill-box` + percentage `transform-origin`. Measured on the
		* live page, the percentage form resolved against the SVG VIEWPORT rather than
		* the path's box, translating by (-24, -409.5) instead of (-373, -409.6) and
		* parking the bloom well right of the stem. Explicit user units remove the
		* question: 512 is the measured centre, not an inferred one.
		*
		* The flower rests while the session is idle and turns while it works: one
		* animation, paused rather than removed, so a state flip resumes the turn
		* instead of snapping the petals back to 0deg.
		*
		* @param props - endpoint coordinates and whether the session is working.
		* @returns the bloom group.
		*/
		/** In-flow session marker: its position follows the row, including disclosure animations. */
		function SessionFlower({ spinning }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: 17,
				height: 17,
				viewBox: "0 0 1024 1024",
				className: spinning ? "wgSessionFlower wgFlowerSpinning" : "wgSessionFlower",
				"aria-hidden": "true",
				focusable: "false",
				style: {
					flex: "none",
					overflow: "visible"
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					className: "wgFlowerArt",
					d: FLOWER_PATH,
					fill: FLOWER_PETAL
				})
			});
		}
		// src/client/group-icons-science.tsx
		/** Ids appended to the shared registry; order is the picker's section order. */
		const SCIENCE_ICON_IDS = [
			"test-tube",
			"flask",
			"pipette",
			"dropper",
			"stirrer",
			"hotplate",
			"centrifuge",
			"balance",
			"atom",
			"molecule",
			"lattice",
			"layered",
			"framework",
			"thin-film",
			"fiber",
			"hydrogel",
			"microscope",
			"xrd",
			"spectrum",
			"tensile",
			"electrode",
			"iv-curve",
			"illumination",
			"temperature",
			"humidity",
			"actuator",
			"flex-sensor",
			"battery"
		];
		/** The picker's section split of the research family. */
		const SCIENCE_ICON_SECTIONS = [
			{
				key: "lab",
				ids: [
					"test-tube",
					"flask",
					"pipette",
					"dropper",
					"stirrer",
					"hotplate",
					"centrifuge",
					"balance"
				]
			},
			{
				key: "materials",
				ids: [
					"atom",
					"molecule",
					"lattice",
					"layered",
					"framework",
					"thin-film",
					"fiber",
					"hydrogel"
				]
			},
			{
				key: "characterization",
				ids: [
					"microscope",
					"xrd",
					"spectrum",
					"tensile",
					"electrode",
					"iv-curve"
				]
			},
			{
				key: "devices",
				ids: [
					"illumination",
					"temperature",
					"humidity",
					"actuator",
					"flex-sensor",
					"battery"
				]
			}
		];
		/** Primitive artwork per research icon. */
		const SCIENCE_ICON_ART = {
			"test-tube": [
				{
					kind: "path",
					d: "M5.2 2.8v7.6a2.8 2.8 0 0 0 5.6 0V2.8"
				},
				{
					kind: "line",
					x1: 4.5,
					y1: 2.8,
					x2: 11.5,
					y2: 2.8
				},
				{
					kind: "line",
					x1: 5.2,
					y1: 8.4,
					x2: 10.8,
					y2: 8.4
				}
			],
			flask: [
				{
					kind: "path",
					d: "M6.2 2.4v3.4L3 11.6a1.6 1.6 0 0 0 1.4 2.4h7.2a1.6 1.6 0 0 0 1.4-2.4L9.8 5.8V2.4"
				},
				{
					kind: "line",
					x1: 5.2,
					y1: 2.4,
					x2: 10.8,
					y2: 2.4
				},
				{
					kind: "line",
					x1: 5.2,
					y1: 9.8,
					x2: 10.8,
					y2: 9.8
				}
			],
			pipette: [
				{
					kind: "line",
					x1: 8,
					y1: 1.5,
					x2: 8,
					y2: 2.4
				},
				{
					kind: "rect",
					x: 6.1,
					y: 2.5,
					width: 3.8,
					height: 6.4,
					radius: 1.1
				},
				{
					kind: "line",
					x1: 6.1,
					y1: 4.6,
					x2: 7.2,
					y2: 4.6
				},
				{
					kind: "line",
					x1: 6.1,
					y1: 6.1,
					x2: 7.2,
					y2: 6.1
				},
				{
					kind: "path",
					d: "M7.3 8.9L8 13.2L8.7 8.9"
				}
			],
			dropper: [
				{
					kind: "rect",
					x: 5.1,
					y: 2.1,
					width: 5.8,
					height: 4.2,
					radius: 2.1
				},
				{
					kind: "line",
					x1: 6.6,
					y1: 6.3,
					x2: 6.6,
					y2: 10.3
				},
				{
					kind: "line",
					x1: 9.4,
					y1: 6.3,
					x2: 9.4,
					y2: 10.3
				},
				{
					kind: "path",
					d: "M6.6 10.3L8 13.4L9.4 10.3"
				},
				{
					kind: "circle",
					cx: 11.9,
					cy: 12.2,
					radius: .95,
					filled: true
				}
			],
			stirrer: [
				{
					kind: "circle",
					cx: 8,
					cy: 6.1,
					radius: 2.5
				},
				{
					kind: "path",
					d: "M6.4 6.1c1-.9 2.2-.9 3.2 0"
				},
				{
					kind: "rect",
					x: 2,
					y: 9.6,
					width: 12,
					height: 4.2,
					radius: 1.2
				},
				{
					kind: "circle",
					cx: 11.4,
					cy: 11.7,
					radius: .85,
					filled: true
				}
			],
			hotplate: [
				{
					kind: "path",
					d: "M5.4 8.4c1.2-.9 1.2-2.1 0-3"
				},
				{
					kind: "path",
					d: "M8 8.4c1.2-.9 1.2-2.1 0-3"
				},
				{
					kind: "path",
					d: "M10.6 8.4c1.2-.9 1.2-2.1 0-3"
				},
				{
					kind: "rect",
					x: 2,
					y: 9.6,
					width: 12,
					height: 4.2,
					radius: 1.2
				},
				{
					kind: "circle",
					cx: 11.4,
					cy: 11.7,
					radius: .85,
					filled: true
				}
			],
			centrifuge: [
				{
					kind: "circle",
					cx: 8,
					cy: 5.6,
					radius: 3.4
				},
				{
					kind: "line",
					x1: 8,
					y1: 5.6,
					x2: 8,
					y2: 2.3
				},
				{
					kind: "line",
					x1: 8,
					y1: 5.6,
					x2: 5.1,
					y2: 7.3
				},
				{
					kind: "line",
					x1: 8,
					y1: 5.6,
					x2: 10.9,
					y2: 7.3
				},
				{
					kind: "circle",
					cx: 8,
					cy: 5.6,
					radius: .9,
					filled: true
				},
				{
					kind: "line",
					x1: 8,
					y1: 9,
					x2: 8,
					y2: 9.8
				},
				{
					kind: "rect",
					x: 2.6,
					y: 9.8,
					width: 10.8,
					height: 3.4,
					radius: 1
				}
			],
			balance: [
				{
					kind: "path",
					d: "M4.1 7.8h7.8"
				},
				{
					kind: "path",
					d: "M5 7.8a3 3 0 0 0 6 0"
				},
				{
					kind: "line",
					x1: 8,
					y1: 9.3,
					x2: 8,
					y2: 10.4
				},
				{
					kind: "rect",
					x: 2.2,
					y: 10.4,
					width: 11.6,
					height: 3.2,
					radius: 1
				},
				{
					kind: "rect",
					x: 9.6,
					y: 11.2,
					width: 2.6,
					height: 1.5,
					radius: .3
				}
			],
			atom: [
				{
					kind: "ellipse",
					cx: 8,
					cy: 8,
					rx: 6.2,
					ry: 2.5
				},
				{
					kind: "ellipse",
					cx: 8,
					cy: 8,
					rx: 6.2,
					ry: 2.5,
					rotate: 60
				},
				{
					kind: "ellipse",
					cx: 8,
					cy: 8,
					rx: 6.2,
					ry: 2.5,
					rotate: -60
				},
				{
					kind: "circle",
					cx: 8,
					cy: 8,
					radius: 1.05,
					filled: true
				}
			],
			molecule: [
				{
					kind: "line",
					x1: 5,
					y1: 4.2,
					x2: 11,
					y2: 4.2
				},
				{
					kind: "line",
					x1: 4.5,
					y1: 5.4,
					x2: 6.9,
					y2: 9.7
				},
				{
					kind: "line",
					x1: 11.5,
					y1: 5.4,
					x2: 9.1,
					y2: 9.7
				},
				{
					kind: "circle",
					cx: 3.6,
					cy: 4.2,
					radius: 1.35
				},
				{
					kind: "circle",
					cx: 12.4,
					cy: 4.2,
					radius: 1.35
				},
				{
					kind: "circle",
					cx: 8,
					cy: 11.6,
					radius: 1.35
				}
			],
			lattice: [
				{
					kind: "line",
					x1: 3.6,
					y1: 3.6,
					x2: 3.6,
					y2: 12.4
				},
				{
					kind: "line",
					x1: 8,
					y1: 3.6,
					x2: 8,
					y2: 12.4
				},
				{
					kind: "line",
					x1: 12.4,
					y1: 3.6,
					x2: 12.4,
					y2: 12.4
				},
				{
					kind: "line",
					x1: 3.6,
					y1: 3.6,
					x2: 12.4,
					y2: 3.6
				},
				{
					kind: "line",
					x1: 3.6,
					y1: 8,
					x2: 12.4,
					y2: 8
				},
				{
					kind: "line",
					x1: 3.6,
					y1: 12.4,
					x2: 12.4,
					y2: 12.4
				},
				{
					kind: "circle",
					cx: 3.6,
					cy: 3.6,
					radius: .85,
					filled: true
				},
				{
					kind: "circle",
					cx: 8,
					cy: 3.6,
					radius: .85,
					filled: true
				},
				{
					kind: "circle",
					cx: 12.4,
					cy: 3.6,
					radius: .85,
					filled: true
				},
				{
					kind: "circle",
					cx: 3.6,
					cy: 8,
					radius: .85,
					filled: true
				},
				{
					kind: "circle",
					cx: 8,
					cy: 8,
					radius: .85,
					filled: true
				},
				{
					kind: "circle",
					cx: 12.4,
					cy: 8,
					radius: .85,
					filled: true
				},
				{
					kind: "circle",
					cx: 3.6,
					cy: 12.4,
					radius: .85,
					filled: true
				},
				{
					kind: "circle",
					cx: 8,
					cy: 12.4,
					radius: .85,
					filled: true
				},
				{
					kind: "circle",
					cx: 12.4,
					cy: 12.4,
					radius: .85,
					filled: true
				}
			],
			layered: [
				{
					kind: "rect",
					x: 2.6,
					y: 3,
					width: 10.8,
					height: 2.3,
					radius: .6
				},
				{
					kind: "rect",
					x: 3.6,
					y: 6.85,
					width: 10.8,
					height: 2.3,
					radius: .6
				},
				{
					kind: "rect",
					x: 2.6,
					y: 10.7,
					width: 10.8,
					height: 2.3,
					radius: .6
				}
			],
			framework: [
				{
					kind: "rect",
					x: 2.6,
					y: 2.8,
					width: 10.8,
					height: 10.4,
					radius: .8
				},
				{
					kind: "line",
					x1: 8,
					y1: 2.8,
					x2: 8,
					y2: 13.2
				},
				{
					kind: "line",
					x1: 2.6,
					y1: 8,
					x2: 13.4,
					y2: 8
				},
				{
					kind: "circle",
					cx: 5.3,
					cy: 5.3,
					radius: .8,
					filled: true
				},
				{
					kind: "circle",
					cx: 10.7,
					cy: 5.3,
					radius: .8,
					filled: true
				},
				{
					kind: "circle",
					cx: 5.3,
					cy: 10.7,
					radius: .8,
					filled: true
				},
				{
					kind: "circle",
					cx: 10.7,
					cy: 10.7,
					radius: .8,
					filled: true
				}
			],
			"thin-film": [
				{
					kind: "path",
					d: "M2.6 7.6q1.35-1.6 2.7 0t2.7 0t2.7 0t2.7 0"
				},
				{
					kind: "line",
					x1: 2.6,
					y1: 9.4,
					x2: 13.4,
					y2: 9.4
				},
				{
					kind: "rect",
					x: 2.6,
					y: 10.6,
					width: 10.8,
					height: 2.6,
					radius: .6
				}
			],
			fiber: [
				{
					kind: "path",
					d: "M5 2.4c1 1.6-1 2.4 0 4s-1 2.4 0 4 0 1.6 0 3.2"
				},
				{
					kind: "path",
					d: "M8 2.4c1 1.6-1 2.4 0 4s-1 2.4 0 4 0 1.6 0 3.2"
				},
				{
					kind: "path",
					d: "M11 2.4c1 1.6-1 2.4 0 4s-1 2.4 0 4 0 1.6 0 3.2"
				},
				{
					kind: "rect",
					x: 2.9,
					y: 7.2,
					width: 10.2,
					height: 1.8,
					radius: .9
				}
			],
			hydrogel: [
				{
					kind: "rect",
					x: 2.4,
					y: 4.4,
					width: 11.2,
					height: 8.4,
					radius: 4.2
				},
				{
					kind: "path",
					d: "M5.4 7.3L8 9.4L10.6 6.9L5.4 7.3"
				},
				{
					kind: "circle",
					cx: 5.4,
					cy: 7.3,
					radius: .8,
					filled: true
				},
				{
					kind: "circle",
					cx: 8,
					cy: 9.4,
					radius: .8,
					filled: true
				},
				{
					kind: "circle",
					cx: 10.6,
					cy: 6.9,
					radius: .8,
					filled: true
				}
			],
			microscope: [
				{
					kind: "line",
					x1: 5.9,
					y1: 2.1,
					x2: 8.9,
					y2: 5.1
				},
				{
					kind: "circle",
					cx: 5.4,
					cy: 1.9,
					radius: .9
				},
				{
					kind: "circle",
					cx: 9.5,
					cy: 7.4,
					radius: 1.1
				},
				{
					kind: "path",
					d: "M11 6.6c1.5 1.5 1.5 3.8 0 5.3"
				},
				{
					kind: "line",
					x1: 4.2,
					y1: 10.4,
					x2: 11.6,
					y2: 10.4
				},
				{
					kind: "line",
					x1: 9.9,
					y1: 10.4,
					x2: 9.9,
					y2: 13.2
				},
				{
					kind: "line",
					x1: 3,
					y1: 13.2,
					x2: 12.6,
					y2: 13.2
				}
			],
			xrd: [{
				kind: "path",
				d: "M2.6 13.2V2.9h11"
			}, {
				kind: "path",
				d: "M3.4 12.4h1.9l.6-4.6.6 4.6h1.9l.7-2.6.6 2.6h1.9l.9-6.1.7 6.1h1.3"
			}],
			spectrum: [
				{
					kind: "path",
					d: "M6.6 4.4L9.8 10.6H3.4z"
				},
				{
					kind: "line",
					x1: 1.2,
					y1: 8.4,
					x2: 4.4,
					y2: 8.4
				},
				{
					kind: "line",
					x1: 9.2,
					y1: 9.2,
					x2: 13.4,
					y2: 4.8
				},
				{
					kind: "line",
					x1: 9.6,
					y1: 10,
					x2: 13.7,
					y2: 6.4
				},
				{
					kind: "line",
					x1: 9.8,
					y1: 10.6,
					x2: 13.8,
					y2: 8.6
				}
			],
			tensile: [
				{
					kind: "rect",
					x: 5.8,
					y: 7.2,
					width: 4.4,
					height: 1.6,
					radius: .4
				},
				{
					kind: "line",
					x1: 4.4,
					y1: 5.8,
					x2: 4.4,
					y2: 10.2
				},
				{
					kind: "line",
					x1: 11.6,
					y1: 5.8,
					x2: 11.6,
					y2: 10.2
				},
				{
					kind: "path",
					d: "M2.4 8h1.7"
				},
				{
					kind: "path",
					d: "M3.3 7.2l.8.8-.8.8"
				},
				{
					kind: "path",
					d: "M13.6 8h-1.7"
				},
				{
					kind: "path",
					d: "M12.7 7.2l-.8.8.8.8"
				},
				{
					kind: "line",
					x1: 8,
					y1: 4.9,
					x2: 8,
					y2: 3.2
				},
				{
					kind: "path",
					d: "M7.2 4l.8-.8.8.8"
				},
				{
					kind: "line",
					x1: 8,
					y1: 11.1,
					x2: 8,
					y2: 12.8
				},
				{
					kind: "path",
					d: "M7.2 12l.8.8.8-.8"
				}
			],
			electrode: [
				{
					kind: "path",
					d: "M3.2 8.6v4.4a1.2 1.2 0 0 0 1.2 1.2h7.2a1.2 1.2 0 0 0 1.2-1.2V8.6"
				},
				{
					kind: "line",
					x1: 3.2,
					y1: 10.6,
					x2: 12.8,
					y2: 10.6
				},
				{
					kind: "line",
					x1: 6,
					y1: 2.4,
					x2: 6,
					y2: 10.6
				},
				{
					kind: "line",
					x1: 10,
					y1: 2.4,
					x2: 10,
					y2: 10.6
				},
				{
					kind: "line",
					x1: 5.2,
					y1: 2.4,
					x2: 6.8,
					y2: 2.4
				},
				{
					kind: "line",
					x1: 9.2,
					y1: 2.4,
					x2: 10.8,
					y2: 2.4
				}
			],
			"iv-curve": [
				{
					kind: "path",
					d: "M2.8 13.2V3.2h10.4"
				},
				{
					kind: "path",
					d: "M3.6 12.4c2.6 0 2.7-4.6 5-5.6s3.4-2.6 4.3-3.4"
				},
				{
					kind: "circle",
					cx: 8.6,
					cy: 6.8,
					radius: .8,
					filled: true
				}
			],
			illumination: [
				{
					kind: "rect",
					x: 4.6,
					y: 1.8,
					width: 6.8,
					height: 2.6,
					radius: .7
				},
				{
					kind: "line",
					x1: 6.2,
					y1: 4.9,
					x2: 4.6,
					y2: 8.4
				},
				{
					kind: "line",
					x1: 8,
					y1: 4.9,
					x2: 8,
					y2: 9
				},
				{
					kind: "line",
					x1: 9.8,
					y1: 4.9,
					x2: 11.4,
					y2: 8.4
				},
				{
					kind: "line",
					x1: 2.6,
					y1: 12.6,
					x2: 13.4,
					y2: 12.6
				}
			],
			temperature: [
				{
					kind: "rect",
					x: 6.9,
					y: 2.4,
					width: 2.2,
					height: 8.2,
					radius: 1.1
				},
				{
					kind: "circle",
					cx: 8,
					cy: 12.2,
					radius: 1.9
				},
				{
					kind: "line",
					x1: 8,
					y1: 6.4,
					x2: 8,
					y2: 11.4
				},
				{
					kind: "line",
					x1: 9.1,
					y1: 4.8,
					x2: 10,
					y2: 4.8
				},
				{
					kind: "line",
					x1: 9.1,
					y1: 7,
					x2: 10,
					y2: 7
				},
				{
					kind: "line",
					x1: 9.1,
					y1: 9.2,
					x2: 10,
					y2: 9.2
				}
			],
			humidity: [{
				kind: "path",
				d: "M8 2.1c0 0-4.2 5-4.2 7.9a4.2 4.2 0 0 0 8.4 0C12.2 7.1 8 2.1 8 2.1z"
			}, {
				kind: "path",
				d: "M6 10.2c1.3-1 2.7-1 4 0"
			}],
			actuator: [
				{
					kind: "path",
					d: "M2.6 12.6c6 .4 9.2-1.8 10.2-6.4"
				},
				{
					kind: "path",
					d: "M2.6 10.6c5.2.3 7.8-1.6 8.6-5.2"
				},
				{
					kind: "line",
					x1: 2.6,
					y1: 9.6,
					x2: 2.6,
					y2: 14
				}
			],
			"flex-sensor": [
				{
					kind: "path",
					d: "M2.8 4.2v8.2h3.4V4.2h3.4v8.2h3.4V4.2"
				},
				{
					kind: "circle",
					cx: 2.8,
					cy: 3.2,
					radius: .8,
					filled: true
				},
				{
					kind: "circle",
					cx: 13,
					cy: 3.2,
					radius: .8,
					filled: true
				},
				{
					kind: "circle",
					cx: 8,
					cy: 8.2,
					radius: 1.1
				}
			],
			battery: [
				{
					kind: "rect",
					x: 1.8,
					y: 5.4,
					width: 11,
					height: 5.4,
					radius: 1
				},
				{
					kind: "rect",
					x: 12.8,
					y: 7.1,
					width: 1.6,
					height: 2,
					radius: .4
				},
				{
					kind: "path",
					d: "M8.8 6.3L6.8 8.8h2.2l-1.4 2.5"
				}
			]
		};
		function Primitive({ primitive }) {
			switch (primitive.kind) {
				case "line": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
					x1: primitive.x1,
					y1: primitive.y1,
					x2: primitive.x2,
					y2: primitive.y2
				});
				case "rect": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: primitive.x,
					y: primitive.y,
					width: primitive.width,
					height: primitive.height,
					rx: primitive.radius ?? 0
				});
				case "circle": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: primitive.cx,
					cy: primitive.cy,
					r: primitive.radius,
					fill: primitive.filled === true ? "currentColor" : "none"
				});
				case "ellipse": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ellipse", {
					cx: primitive.cx,
					cy: primitive.cy,
					rx: primitive.rx,
					ry: primitive.ry,
					...primitive.rotate === void 0 ? {} : { transform: `rotate(${primitive.rotate} 8 8)` }
				});
				case "path": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: primitive.d });
			}
		}
		/**
		* Render one research icon in the Host glyph's visual language: 16x16,
		* `currentColor` stroke, 1.3px, round joins, decorative for screen readers (the
		* row/picker button already carries the bilingual name).
		* @param props.icon - research icon id.
		* @param props.size - rendered square size in CSS pixels (default 16, like Host glyphs).
		*/
		function ScienceGlyph({ icon, size = 16 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: SCIENCE_ICON_ART[icon].map((primitive, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Primitive, { primitive }, index))
			});
		}
		/** Research icon id → rendered node, merged into the row icon registry. */
		function scienceIconNodes() {
			const nodes = {};
			for (const id of SCIENCE_ICON_IDS) nodes[id] = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ScienceGlyph, { icon: id });
			return nodes;
		}
		// src/client/rows.tsx
		/**
		* Row components for the workspace-groups tree. Kept dependency-light: they
		* consume only React, primitives (StateDot/Menu/icons), and the shared CSS
		* string. Each row owns its hover actions menu; dialogs live in the browser
		* root so they survive row unmounts during collapse.
		*
		* Drag & drop: workspace rows are draggable sources; category rows (and
		* workspace rows, standing for their containing category) are drop targets.
		* The payload is a custom dataTransfer type so only in-plugin drags land.
		*/
		/** dataTransfer type carrying the dragged workspace id (in-plugin drags only). */
		const DND_WORKSPACE_TYPE = "application/x-dsh-workspace-groups";
		/** dataTransfer type carrying the dragged category key (group reorder). */
		const DND_CATEGORY_TYPE = "application/x-dsh-workspace-groups-category";
		/** Whether a drag carries any of the plugin's payloads (drop targets accept both). */
		function hasPluginDragType(types) {
			const list = Array.from(types);
			return list.includes("application/x-dsh-workspace-groups") || list.includes("application/x-dsh-workspace-groups-category");
		}
		/** Pending interaction status → primitives StateDot state. */
		function pendingState(status) {
			switch (status) {
				case "approval":
				case "plan-review":
				case "question": return "warning";
				default: return;
			}
		}
		/** Primary status dot state for a session row. */
		function sessionDotState(node) {
			if (pendingState(node.pendingInteraction) !== void 0) return "warning";
			if (node.running || node.runningSubagentCount > 0) return "ongoing";
			return node.completed ? "done" : "done";
		}
		/** Compact relative time ("now"/"5min"/"3h"/"2d"/"4mo"/"1y"). */
		function relativeTimeLabel(updatedAt, now) {
			const diff = Math.max(0, now - updatedAt);
			const MIN = 6e4;
			const HOUR = 36e5;
			const DAY = 864e5;
			if (diff < MIN) return "now";
			if (diff < HOUR) return `${Math.floor(diff / MIN)}min`;
			if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
			if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d`;
			if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))}mo`;
			return `${Math.floor(diff / (365 * DAY))}y`;
		}
		/**
		* Registered icon id → rendered artwork. The research family is merged in from
		* its own module: those glyphs are drawn locally (the Host primitive package
		* ships no lab/material icons) but must render through the very same path.
		*/
		const CATEGORY_ICONS = {
			folder: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseMedium, {}),
			workspace: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWorkspaceTreeOutlineMedium, {}),
			code: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineMedium, {}),
			plugin: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCordisPluginOutlineMedium, {}),
			skill: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSkillOutlineMedium, {}),
			data: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutlineMedium, {}),
			database: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDatabaseOutlineMedium, {}),
			api: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconApiOutlineMedium, {}),
			plan: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlanOutlineMedium, {}),
			goal: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGoalOutlineMedium, {}),
			light: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLightOutlineMedium, {}),
			globe: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineMedium, {}),
			archive: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineMedium, {}),
			branch: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineMedium, {}),
			users: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUsersOutlineMedium, {}),
			clock: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineMedium, {}),
			shield: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconShieldOutlineMedium, {}),
			checklist: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutlineMedium, {}),
			sparkle: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkleMedium, {}),
			tree: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTreeCornerMedium, {}),
			chat: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutlineMedium, {}),
			search: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineMedium, {}),
			settings: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineMedium, {}),
			document: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDeliverDocMedium, {}),
			edit: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineMedium, {}),
			think: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconThinkOutlineMedium, {}),
			agent: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutlineMedium, {}),
			browse: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutlineMedium, {}),
			context: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconContextInjectionOutlineMedium, {}),
			link: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLinkOutlineMedium, {}),
			share: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconShareOutlineMedium, {}),
			user: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutlineMedium, {}),
			send: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPaperPlaneOutlineMedium, {}),
			attachment: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPaperclipOutlineMedium, {}),
			download: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutlineMedium, {}),
			play: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlayOutlineMedium, {}),
			design: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPersonalizationOutlineMedium, {}),
			moon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDarkOutlineMedium, {}),
			monitor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFollowsystemOutlineMedium, {}),
			gauge: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGaugeOutlineMedium, {}),
			queue: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQueueOutlineMedium, {}),
			notes: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutlineMedium, {}),
			inspect: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInspectOutlineMedium, {}),
			help: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQuestionOutlineMedium, {}),
			info: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInfoOutlineMedium, {}),
			alarm: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconAlarmClockOutlineMedium, {}),
			compare: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCompareSplitOutlineMedium, {}),
			done: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckCircleOutlineMedium, {}),
			pin: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinOutlineMedium, {}),
			microphone: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconMicrophoneOutlineMedium, {}),
			...scienceIconNodes()
		};
		/**
		* Resolve a stored `appearance.icon` value: a preset id renders the artwork,
		* a 1–4 character glyph renders as text, and anything else returns null so the
		* caller keeps the default folder icon.
		*/
		function resolveCategoryIcon(icon) {
			if (icon === void 0 || icon === "") return null;
			const preset = Object.prototype.hasOwnProperty.call(CATEGORY_ICONS, icon) ? CATEGORY_ICONS[icon] : void 0;
			if (preset !== void 0) return preset;
			return Array.from(icon).length <= 4 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "wgCategoryGlyph",
				children: icon
			}) : null;
		}
		/**
		* Render one stored icon value (preset artwork or a short glyph). Shared by the
		* category row's icon slot and the appearance picker grid, so both show exactly
		* the same artwork. `fallback` renders when the value is empty or unknown.
		*/
		function CategoryGlyph({ icon, fallback = null }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: resolveCategoryIcon(icon) ?? fallback });
		}
		/**
		* One category folder row: toggle, rename/delete menu (every group — rule
		* groups via overlay renames/hides), draggable source for group reorder and
		* drop target for both workspace moves and group reorders.
		*/
		function CategoryRow({ node, t, onToggle, onAddWorkspace, addingWorkspace = false, onRename, onDelete, onTogglePin, onEditAppearance, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartCategory }) {
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const count = node.workspaces.length;
			const manageable = onRename !== void 0 && onDelete !== void 0;
			const pinned = node.appearance?.pinned === true;
			const menuItems = [
				...onTogglePin === void 0 ? [] : [{
					id: "pin",
					label: pinned ? t("group.unpin") : t("group.pin"),
					icon: pinned ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillMedium, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinOutlineRegular, {})
				}],
				...onEditAppearance === void 0 ? [] : [{
					id: "appearance",
					label: t("group.appearance"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSlidersTwoOutlineRegular, {})
				}],
				{
					type: "separator",
					id: "group-menu-separator"
				},
				{
					id: "rename",
					label: t("group.rename"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, {})
				},
				{
					id: "delete",
					label: t("group.delete"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, {}),
					danger: true
				}
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgCategoryRow${dropActive ? " wgDropTarget" : ""}${insertLine === "before" ? " wgInsertBefore" : insertLine === "after" ? " wgInsertAfter" : ""}`,
				role: "treeitem",
				"aria-expanded": node.expanded,
				"aria-label": pinned ? `${t("section.workspaces")} · ${t("group.pinned")}` : t("section.workspaces"),
				"data-wg-category": node.key,
				"data-wg-color": node.appearance?.color,
				"data-wg-branch-row": "",
				"data-wg-branch-group": "",
				draggable: onDragStartCategory !== void 0,
				onClick: onToggle,
				onDragStart: onDragStartCategory,
				onDragOver: onRowDragOver,
				onDragLeave: onRowDragLeave,
				onDrop: onRowDrop,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `wgChevron${node.expanded ? " wgChevronOpen" : ""}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFillMedium, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryIcon",
						"data-wg-row-icon": "group",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategoryGlyph, {
							icon: node.appearance?.icon,
							fallback: node.expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenMedium, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseMedium, {})
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryLabel",
						children: node.label
					}),
					pinned && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryPin",
						"aria-hidden": true,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillMedium, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgRowTrail",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wgCategoryCount",
							children: count
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "wgRowActions",
							children: [onAddWorkspace !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								draggable: false,
								disabled: addingWorkspace,
								title: t("workspace.add"),
								"aria-label": `${t("workspace.add")} · ${node.label}`,
								onClick: (event) => {
									event.stopPropagation();
									onAddWorkspace();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, {})
							}), manageable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: menuOpen,
								onClose: () => {
									setMenuOpen(false);
								},
								items: menuItems,
								onSelect: (id) => {
									setMenuOpen(false);
									if (id === "pin") onTogglePin?.();
									if (id === "appearance") onEditAppearance?.();
									if (id === "rename") onRename();
									if (id === "delete") onDelete();
								},
								portal: true,
								closeOnPointerLeave: true,
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgIconButton",
									draggable: false,
									"aria-label": `${t("group.rename")} ${node.label}`,
									onClick: (e) => {
										e.stopPropagation();
										setMenuOpen((v) => !v);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
								})
							})]
						})]
					})
				]
			});
		}
		/** One workspace folder row inside a category: draggable source + drop target. */
		function WorkspaceRow({ node, t, onToggle, onNewSession, onRename, onDelete, canMoveOut = false, onMoveOut, onManageFolders, onOpenInFolder, flat = false, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartExtra }) {
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const menuItems = [
				...onOpenInFolder !== void 0 ? [{
					id: "openInFolder",
					label: t("workspace.openInFolder"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 16 })
				}] : [],
				...canMoveOut && onMoveOut !== void 0 ? [{
					id: "moveOut",
					label: t("workspace.moveOutOfGroup"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 16 })
				}] : [],
				...onManageFolders !== void 0 ? [{
					id: "folders",
					label: t("folder.manage"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 16 })
				}] : [],
				{
					id: "rename",
					label: t("workspace.rename"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, {})
				},
				{
					id: "delete",
					label: t("workspace.delete"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, {}),
					danger: true
				}
			];
			const onDragStart = (event) => {
				event.dataTransfer.setData(DND_WORKSPACE_TYPE, node.workspaceId);
				event.dataTransfer.effectAllowed = "move";
				onDragStartExtra?.();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgProjectRow${node.containsCurrent ? " wgProjectActive" : ""}${flat ? " wgProjectFlat" : ""}${dropActive ? " wgDropTarget" : ""}${insertLine === "before" ? " wgInsertBefore" : insertLine === "after" ? " wgInsertAfter" : ""}`,
				role: "treeitem",
				"aria-expanded": node.expanded,
				"data-wsid": node.workspaceId,
				"data-wg-branch-row": "",
				"data-wg-branch-group": "",
				draggable: true,
				onClick: onToggle,
				onDragStart,
				onDragOver: onRowDragOver,
				onDragLeave: onRowDragLeave,
				onDrop: onRowDrop,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `wgChevron${node.expanded ? " wgChevronOpen" : ""}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFillMedium, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryIcon",
						"data-wg-row-icon": "project",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconProjectAddOutlineRegular, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgProjectLabel",
						title: node.path,
						children: node.label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgRowTrail",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wgProjectCount",
							children: node.sessionCount
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "wgRowActions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								draggable: false,
								"aria-label": `${t("session.new")} ${node.label}`,
								onClick: (e) => {
									e.stopPropagation();
									onNewSession();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, {})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: menuOpen,
								onClose: () => {
									setMenuOpen(false);
								},
								items: menuItems,
								onSelect: (id) => {
									setMenuOpen(false);
									if (id === "openInFolder") onOpenInFolder?.();
									if (id === "moveOut") onMoveOut?.();
									if (id === "folders") onManageFolders?.();
									if (id === "rename") onRename();
									if (id === "delete") onDelete();
								},
								portal: true,
								closeOnPointerLeave: true,
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgIconButton",
									draggable: false,
									"aria-label": `${t("workspace.rename")} ${node.label}`,
									onClick: (e) => {
										e.stopPropagation();
										setMenuOpen((v) => !v);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
								})
							})]
						})]
					})
				]
			});
		}
		/**
		* One folder row under a project: the base directory (folder #0) plus every
		* extra folder of that workspace. Sits at the session indent level so the
		* 42/58/74 ladder is preserved, and its own session rows indent one step
		* deeper (see `.wgSessionNested`).
		*
		* Deliberately NOT a drag source or drop target: folders are a fixed,
		* host-ordered list; reordering them would need a write path this feature does
		* not have.
		*/
		function FolderRow({ node, t, onToggle, onNewSession, onSetRoot, onRemove, onOpenInFolder, creating = false }) {
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const menuItems = [
				{
					id: "newSession",
					label: t("session.new"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, {})
				},
				...onOpenInFolder !== void 0 ? [{
					id: "openInFolder",
					label: t("workspace.openInFolder"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 16 })
				}] : [],
				...node.isRoot ? [] : [{
					id: "setRoot",
					label: t("folder.setRoot"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinOutlineRegular, {})
				}],
				...node.isBase ? [] : [{
					type: "separator",
					id: "folder-menu-separator"
				}, {
					id: "remove",
					label: t("folder.remove"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, {}),
					danger: true
				}]
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgFolderRow${node.isRoot ? " wgFolderRooted" : ""}${node.isBase ? " wgFolderBase" : ""}`,
				role: "treeitem",
				"aria-expanded": node.expanded,
				"aria-label": node.label,
				"data-wg-row-folder": "",
				"data-wg-folder": node.path,
				...node.isRoot ? { "data-wg-folder-root": "" } : {},
				"data-wg-branch-row": "",
				onClick: onToggle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `wgChevron${node.expanded ? " wgChevronOpen" : ""}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFillMedium, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgCategoryIcon",
						"data-wg-row-icon": "folder",
						children: node.expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenMedium, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseMedium, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgFolderLabel",
						title: node.path,
						children: node.label
					}),
					node.isRoot && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgFolderRoot",
						title: t("folder.rootBadge"),
						"aria-label": t("folder.rootBadge"),
						children: "★"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgRowTrail",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wgFolderCount",
							children: node.sessions.length
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "wgRowActions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								draggable: false,
								disabled: creating,
								"aria-label": `${t("session.new")} ${node.label}`,
								onClick: (e) => {
									e.stopPropagation();
									onNewSession();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, {})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: menuOpen,
								onClose: () => {
									setMenuOpen(false);
								},
								items: menuItems,
								onSelect: (id) => {
									setMenuOpen(false);
									if (id === "newSession") onNewSession();
									if (id === "openInFolder") onOpenInFolder?.();
									if (id === "setRoot") onSetRoot();
									if (id === "remove") onRemove();
								},
								portal: true,
								closeOnPointerLeave: true,
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgIconButton",
									draggable: false,
									"aria-label": `${t("folder.title")} ${node.label}`,
									onClick: (e) => {
										e.stopPropagation();
										setMenuOpen((v) => !v);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
								})
							})]
						})]
					})
				]
			});
		}
		/** Keyframe names the disclosure animation relies on (styles.css). */
		const ROW_GROUP_OPEN_ANIMATION = "wg-rows-in";
		const ROW_GROUP_CLOSE_ANIMATION = "wg-rows-out";
		/** Upper bound for one disclosure animation (180ms open / 160ms close). */
		const ROW_GROUP_ANIMATION_FALLBACK_MS = 400;
		/** Whether the user asked the OS to reduce motion (no sync unmount without it). */
		function prefersReducedMotion() {
			return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		}
		/**
		* Animated disclosure body shared by the category and project levels.
		*
		* Collapsed state renders nothing at all (same DOM as the old
		* `{expanded && …}`), so hidden subtrees cost no layout. Expanding plays a
		* 0fr→1fr grid animation; collapsing keeps the rows mounted for one closing
		* animation and unmounts on its `animationend`. `prefers-reduced-motion`
		* unmounts synchronously instead — waiting for an `animationend` that CSS
		* disabled would leave the group stuck half-closed.
		*
		* The flower-branch overlay cannot follow a moving row box, so the animation
		* phase exposes `data-wg-animating` (styles.css fades the vine while it is
		* present).
		*/
		function RowGroup({ expanded, className, animate = true, children }) {
			const [phase, setPhase] = (0, react.useState)(expanded ? "open" : "closed");
			const previousExpanded = (0, react.useRef)(expanded);
			if (previousExpanded.current !== expanded) {
				previousExpanded.current = expanded;
				if (expanded) setPhase(animate && !prefersReducedMotion() ? "opening" : "open");
				else setPhase(animate && !prefersReducedMotion() ? "closing" : "closed");
			}
			(0, react.useEffect)(() => {
				if (phase !== "opening" && phase !== "closing") return void 0;
				const timer = window.setTimeout(() => {
					setPhase(phase === "opening" ? "open" : "closed");
				}, ROW_GROUP_ANIMATION_FALLBACK_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [phase]);
			if (phase === "closed") return null;
			const animating = phase === "opening" || phase === "closing";
			const classes = `wgRows${className === void 0 ? "" : ` ${className}`}${phase === "opening" ? " wgRowsOpening" : ""}${phase === "closing" ? " wgRowsClosing" : ""}`;
			const onAnimationEnd = (event) => {
				if (event.target !== event.currentTarget) return;
				if (phase === "opening" && event.animationName === ROW_GROUP_OPEN_ANIMATION) setPhase("open");
				if (phase === "closing" && event.animationName === ROW_GROUP_CLOSE_ANIMATION) setPhase("closed");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				role: "group",
				className: classes,
				"aria-hidden": !expanded,
				...animating ? { "data-wg-animating": "" } : {},
				style: animating ? { pointerEvents: "none" } : void 0,
				onAnimationEnd,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "wgRowsInner",
					children
				})
			});
		}
		/** One session leaf row. */
		function SessionRow({ node, currentId, now, t, onOpen, onRename, onFork, onArchive, nested = false }) {
			const selected = node.id === currentId;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const menuItems = [
				{
					id: "rename",
					label: t("session.rename"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, {})
				},
				{
					id: "fork",
					label: t("session.fork"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, {})
				},
				{
					id: "archive",
					label: t("session.archive"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 16 })
				}
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgSessionRow${nested ? " wgSessionNested" : ""}${selected ? " wgSelected" : ""}${node.matched === true ? " wgMatched" : ""}`,
				role: "treeitem",
				"aria-selected": selected,
				"data-wg-branch-row": "",
				...selected ? { "data-wg-branch-active": "" } : {},
				onClick: () => {
					onOpen(node.id);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgStatusSlot",
						children: selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionFlower, { spinning: node.running || node.runningSubagentCount > 0 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: sessionDotState(node) })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgSessionTitle",
						children: node.title
					}),
					node.snippet !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wgSessionSnippet",
						title: node.snippet,
						children: node.snippet
					}),
					!node.blank && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "wgRowTrail",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wgSessionTime",
							children: relativeTimeLabel(node.updatedAt, now)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wgRowActions",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: menuOpen,
								onClose: () => {
									setMenuOpen(false);
								},
								items: menuItems,
								onSelect: (id) => {
									setMenuOpen(false);
									if (id === "rename") onRename(node.id, node.title);
									if (id === "fork") onFork(node.id);
									if (id === "archive") onArchive(node.id);
								},
								portal: true,
								closeOnPointerLeave: true,
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgIconButton",
									"aria-label": `${t("session.rename")} ${node.title}`,
									onClick: (e) => {
										e.stopPropagation();
										setMenuOpen((v) => !v);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
								})
							})
						})]
					})
				]
			});
		}
		// src/client/group-icon-labels.ts
		/** Bilingual accessible names also make native browser tooltips recognizable in either locale. */
		const GROUP_ICON_LABELS = {
			folder: "文件夹 / Folder",
			workspace: "工作区 / Workspace",
			code: "代码 / Code",
			plugin: "插件 / Plugin",
			skill: "技能 / Skill",
			data: "数据 / Data",
			database: "数据库 / Database",
			api: "接口 / API",
			plan: "计划 / Plan",
			goal: "目标 / Goal",
			light: "日光 / Sun",
			globe: "全球 / Globe",
			archive: "归档 / Archive",
			branch: "分支 / Branch",
			users: "团队 / Team",
			clock: "时间 / Clock",
			shield: "安全 / Security",
			checklist: "清单 / Checklist",
			sparkle: "灵感 / Sparkle",
			tree: "层级 / Tree",
			chat: "对话 / Chat",
			search: "搜索 / Search",
			settings: "设置 / Settings",
			document: "文档 / Document",
			edit: "编辑 / Edit",
			think: "思考 / Think",
			agent: "智能体 / Agent",
			browse: "浏览 / Browse",
			context: "上下文 / Context",
			link: "链接 / Link",
			share: "分享 / Share",
			user: "个人 / Personal",
			send: "发送 / Send",
			attachment: "附件 / Attachment",
			download: "下载 / Download",
			play: "运行 / Run",
			design: "设计 / Design",
			moon: "夜间 / Moon",
			monitor: "桌面 / Desktop",
			gauge: "性能 / Performance",
			queue: "队列 / Queue",
			notes: "笔记 / Notes",
			inspect: "检查 / Inspect",
			help: "帮助 / Help",
			info: "信息 / Information",
			alarm: "提醒 / Reminder",
			compare: "对比 / Compare",
			done: "完成 / Done",
			pin: "重点 / Pin",
			microphone: "语音 / Voice",
			"test-tube": "试管 / Test tube",
			flask: "烧瓶 / Flask",
			pipette: "移液枪 / Pipette",
			dropper: "滴液 / Dropper",
			stirrer: "磁力搅拌 / Magnetic stirrer",
			hotplate: "加热台 / Hot plate",
			centrifuge: "离心机 / Centrifuge",
			balance: "电子天平 / Balance",
			atom: "原子 / Atom",
			molecule: "分子 / Molecule",
			lattice: "晶格 / Crystal lattice",
			layered: "层状材料 / Layered material",
			framework: "多孔框架 / Porous framework",
			"thin-film": "薄膜 / Thin film",
			fiber: "纤维 / Fiber",
			hydrogel: "水凝胶 / Hydrogel",
			microscope: "显微镜 / Microscope",
			xrd: "XRD 衍射峰 / XRD pattern",
			spectrum: "光谱 / Spectrum",
			tensile: "拉伸测试 / Tensile test",
			electrode: "电极 / Electrode",
			"iv-curve": "电学曲线 / I–V curve",
			illumination: "光照 / Illumination",
			temperature: "温度 / Temperature",
			humidity: "湿度 / Humidity",
			actuator: "弯曲驱动器 / Bending actuator",
			"flex-sensor": "柔性传感器 / Flexible sensor",
			battery: "电池 / Battery"
		};
		/** All presets satisfy the existing host's 1–4 Unicode-code-point custom-glyph rule. */
		const GROUP_EMOJI_ICONS = [
			{
				icon: "🚀",
				label: "启动 / Launch"
			},
			{
				icon: "📚",
				label: "学习 / Learning"
			},
			{
				icon: "🔬",
				label: "科研 / Research"
			},
			{
				icon: "🧪",
				label: "实验 / Experiment"
			},
			{
				icon: "🎨",
				label: "创作 / Art"
			},
			{
				icon: "🎯",
				label: "目标 / Target"
			},
			{
				icon: "💡",
				label: "想法 / Idea"
			},
			{
				icon: "🛠️",
				label: "工具 / Tools"
			},
			{
				icon: "🌱",
				label: "成长 / Growth"
			},
			{
				icon: "🏠",
				label: "生活 / Home"
			},
			{
				icon: "💼",
				label: "工作 / Work"
			},
			{
				icon: "🎮",
				label: "游戏 / Games"
			},
			{
				icon: "🎵",
				label: "音乐 / Music"
			},
			{
				icon: "❤️",
				label: "收藏 / Favorites"
			},
			{
				icon: "⭐",
				label: "星标 / Star"
			},
			{
				icon: "🔥",
				label: "热门 / Hot"
			}
		];
		// src/client/folders-persist.ts
		/**
		* Client side of the per-workspace folder list, talking to
		* `GET|PUT /workspace-groups/folders` on the host.
		*
		* The document is the host's JSON sidecar verbatim (`version` + `workspaces`),
		* so the client and the host agree on one shape: `folders` holds EXTRA folders
		* only — the workspace's canonical directory is implicit folder #0 — and
		* `root` names one of those extras (absent means "the workspace itself").
		*
		* Reads are best-effort, like the manual overlay and the tab strip: a failed
		* read means "no extra folders". A failed write, however, rejects so the caller
		* can say so — a folder row that silently forgot its edit would be worse than
		* the toast.
		*/
		/** Host route holding the folder overlay. */
		const FOLDERS_ROUTE = "/workspace-groups/folders";
		/** One non-empty string field, or undefined when it is absent or blank. */
		function wireText(value) {
			if (typeof value !== "string") return void 0;
			const trimmed = value.trim();
			return trimmed === "" ? void 0 : trimmed;
		}
		/**
		* Read one member (a folder backed by its own workspace) off the wire.
		* @param value - one value of the stored `members` list.
		* @returns the member, or null for a malformed one.
		*/
		function parseWireMember(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
			const row = value;
			const path = wireText(row.path);
			const workspaceId = wireText(row.workspaceId);
			if (path === void 0 || workspaceId === void 0) return null;
			const remotePath = wireText(row.remotePath);
			const profileId = wireText(row.profileId);
			const recordId = wireText(row.recordId);
			const title = wireText(row.title);
			return {
				path,
				workspaceId,
				kind: row.kind === "remote" ? "remote" : "local",
				...remotePath === void 0 ? {} : { remotePath },
				...profileId === void 0 ? {} : { profileId },
				...recordId === void 0 ? {} : { recordId },
				...title === void 0 ? {} : { title }
			};
		}
		/**
		* Read one workspace entry off the wire, dropping the entry when it is
		* unusable.
		*
		* `members` must survive this round trip: the client owns the whole document
		* (the PUT sends it back verbatim), so an entry parsed without its members is
		* not merely a display gap — the next folder edit would rewrite the sidecar and
		* erase every member-backed folder for good.
		* @param value - one value of the stored `workspaces` mapping.
		* @returns the entry, or null for a malformed one.
		*/
		function parseWireEntry(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
			const row = value;
			const folders = [];
			if (Array.isArray(row.folders)) for (const candidate of row.folders) {
				const path = wireText(candidate);
				if (path !== void 0) folders.push(path);
			}
			const members = [];
			if (Array.isArray(row.members)) for (const candidate of row.members) {
				const member = parseWireMember(candidate);
				if (member !== null) members.push(member);
			}
			if (folders.length === 0 && members.length === 0) return null;
			const root = wireText(row.root);
			return {
				folders,
				...members.length === 0 ? {} : { members },
				...root === void 0 ? {} : { root }
			};
		}
		/**
		* Fetch the stored folder overlay.
		* @param fetchImpl - fetch implementation (injectable for tests).
		* @returns the overlay plus the reported mirror base; the empty document on any
		* failure.
		*/
		async function loadFolders(fetchImpl = fetch) {
			try {
				const response = await fetchImpl(FOLDERS_ROUTE, {
					method: "GET",
					cache: "no-store"
				});
				if (!response.ok) return { document: EMPTY_FOLDERS_DOCUMENT };
				const body = await response.json();
				if (typeof body !== "object" || body === null) return { document: EMPTY_FOLDERS_DOCUMENT };
				const source = body;
				const remoteBase = typeof source.remoteBase === "string" && source.remoteBase.trim() !== "" ? source.remoteBase.trim() : void 0;
				const base = remoteBase === void 0 ? {} : { remoteBase };
				return {
					document: parseWireDocument(source) ?? EMPTY_FOLDERS_DOCUMENT,
					...base
				};
			} catch {
				return { document: EMPTY_FOLDERS_DOCUMENT };
			}
		}
		/**
		* Read a whole folder document off the wire (GET response, PUT echo or the
		* 409 conflict body), or null when it is not a version-1 document.
		* @param source - parsed JSON body.
		*/
		function parseWireDocument(source) {
			if (source.version !== 1) return null;
			const revision = typeof source.revision === "number" && Number.isSafeInteger(source.revision) && source.revision >= 0 ? source.revision : 0;
			if (typeof source.workspaces !== "object" || source.workspaces === null || Array.isArray(source.workspaces)) return {
				version: 1,
				revision,
				workspaces: {}
			};
			const workspaces = {};
			for (const [workspaceId, value] of Object.entries(source.workspaces)) {
				if (workspaceId === "__proto__") continue;
				const entry = parseWireEntry(value);
				if (entry !== null) workspaces[workspaceId] = entry;
			}
			return {
				version: 1,
				revision,
				workspaces
			};
		}
		/**
		* A save rejected because another window wrote first (HTTP 409). Carries the
		* host's current document so the caller can adopt it and resync its state
		* instead of leaving the user looking at a phantom edit.
		*/
		var FoldersConflictError = class extends Error {
			current;
			constructor(current) {
				super("folder overlay changed in another window");
				this.name = "FoldersConflictError";
				this.current = current;
			}
		};
		/**
		* Store the whole folder overlay.
		*
		* Unlike the tab strip this does NOT swallow failures: folder edits are explicit
		* row/dialog actions, so the caller turns a rejection into a toast instead of
		* leaving the user with a row that silently forgot its folder.
		* @param document - the client's current document.
		* @param fetchImpl - fetch implementation (injectable for tests).
		*/
		async function saveFolders(document, fetchImpl = fetch) {
			const response = await fetchImpl(FOLDERS_ROUTE, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(document),
				cache: "no-store",
				keepalive: true
			});
			if (response.status === 409) {
				const body = await response.json().catch(() => null);
				throw new FoldersConflictError((typeof body === "object" && body !== null ? parseWireDocument(body) : null) ?? EMPTY_FOLDERS_DOCUMENT);
			}
			if (!response.ok) throw new Error(`PUT ${FOLDERS_ROUTE}: ${response.status}`);
			const body = await response.json().catch(() => null);
			return (typeof body === "object" && body !== null ? parseWireDocument(body) : null) ?? document;
		}
		// src/client/folder-directory.ts
		/** One directory operation for local DSH and optional remote-ssh workspaces.
		* Never send remote writes through the sidebar route: without its SSH interceptor
		* that route can create a LOCAL directory instead. Use the SSH-owned API instead.
		*/
		function object(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		function message(value) {
			const error = value?.error;
			return typeof error === "string" ? error : typeof object(error)?.message === "string" ? String(object(error)?.message) : typeof value?.stderr === "string" && value.stderr !== "" ? value.stderr : "Remote SSH request failed";
		}
		async function rpc(method, body, fetchImpl) {
			const response = await fetchImpl(`/remote-ssh/api/${method}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Requested-With": "XMLHttpRequest"
				},
				body: JSON.stringify(body),
				cache: "no-store",
				signal: AbortSignal.timeout(3e4)
			});
			if (response.status === 404 && method === "listWorkspaces") return null;
			if (!response.ok) throw new Error(`Remote SSH ${method}: HTTP ${response.status}`);
			const envelope = object(await response.json());
			const value = object(envelope?.value);
			if (envelope?.ok !== true || value?.ok !== true) throw new Error(message(value ?? envelope));
			return value;
		}
		/** A marker is only a refusal hint, never authority to execute remote commands. */
		async function refuseMarkedLocalPath(path, fetchImpl) {
			const response = await fetchImpl(`/workspace-groups/remote-hint?path=${encodeURIComponent(path)}`, {
				cache: "no-store",
				signal: AbortSignal.timeout(1e4)
			});
			if (!response.ok) throw new Error(`Cannot verify local directory: HTTP ${response.status}`);
			const body = object(await response.json());
			if (typeof body?.remoteHint !== "boolean") throw new Error("Invalid directory safety response");
			if (body.remoteHint) throw new Error("SSH marker detected but no active registered remote workspace; refusing local operation");
		}
		/** Single-quote one POSIX shell word; `~` expands only when it stays unquoted. */
		function shellWord(path) {
			return `'${path.replace(/'/gu, `'\\''`)}'`;
		}
		/** Quote a remote path for `sh`, keeping a leading `~` expandable. */
		function shellPath(path) {
			if (path === "~") return "~";
			if (path.startsWith("~/")) return `~/${shellWord(path.slice(2))}`;
			return shellWord(path);
		}
		/** Parent of a directory path, or null where going up stops (`~`, `/`, root). */
		function remoteDirParent(path) {
			const trimmed = path.trim().replace(/\/+$/u, "");
			if (trimmed === "" || trimmed === "~" || trimmed === ".") return null;
			const cut = trimmed.lastIndexOf("/");
			if (cut < 0) return null;
			if (cut === 0) return "/";
			return trimmed.slice(0, cut);
		}
		/** Join a child directory name onto a remote directory path. */
		function remoteDirJoin(base, name) {
			if (base === "") return name;
			return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
		}
		/**
		* List one remote directory through the SSH plugin's own pooled session, so
		* password auth, ProxyJump and host-key handling stay where they already work.
		* @param profileId - SSH connection to browse.
		* @param path - directory to list; empty means the connection's remote root.
		* @param fetchImpl - fetch implementation (tests inject one).
		*/
		async function listRemoteDirectory(profileId, path, fetchImpl = fetch) {
			const requested = path.trim() === "" ? "~" : path.trim();
			const value = await rpc("listDir", {
				profileId,
				path: requested
			}, fetchImpl);
			if (value === null) throw new Error("The SSH plugin is unavailable; cannot browse that connection");
			const rows = Array.isArray(value.entries) ? value.entries : [];
			const entries = [];
			for (const raw of rows) {
				const row = object(raw);
				if (row === void 0 || typeof row.name !== "string" || row.name === "") continue;
				entries.push({
					name: row.name,
					type: row.type === "directory" ? "directory" : "file",
					size: typeof row.size === "number" && Number.isFinite(row.size) ? row.size : 0
				});
			}
			return {
				requested,
				resolved: await resolveRemoteDirectory(profileId, requested, fetchImpl) ?? requested,
				entries
			};
		}
		/** Absolute form of a remote path, or null when the remote shell cannot resolve it. */
		async function resolveRemoteDirectory(profileId, path, fetchImpl) {
			try {
				const value = await rpc("remoteExec", {
					profileId,
					command: `cd ${shellPath(path)} && pwd -P`
				}, fetchImpl);
				const line = (typeof value?.stdout === "string" ? value.stdout.trim() : "").split("\n").filter((text) => text.trim() !== "").pop();
				return line === void 0 ? null : line.trim();
			} catch {
				return null;
			}
		}
		/**
		* The SSH connections available for a cloud folder, or null when the
		* `@zhangfengshun/dsh-remote-ssh` plugin does not answer at all.
		* @param fetchImpl - fetch implementation (tests inject one).
		*/
		async function listRemoteProfiles(fetchImpl = fetch) {
			let value;
			try {
				value = await rpc("listProfiles", {}, fetchImpl);
			} catch (reason) {
				if (reason instanceof Error && reason.message.includes("HTTP 404")) return null;
				throw reason;
			}
			if (value === null) return null;
			const rows = Array.isArray(value.profiles) ? value.profiles : [];
			const profiles = [];
			for (const raw of rows) {
				const row = object(raw);
				if (row === void 0 || typeof row.id !== "string" || row.id === "") continue;
				profiles.push({
					id: row.id,
					name: typeof row.name === "string" && row.name !== "" ? row.name : row.id,
					host: typeof row.host === "string" ? row.host : "",
					user: typeof row.user === "string" ? row.user : "",
					remoteRoot: typeof row.remoteRoot === "string" && row.remoteRoot !== "" ? row.remoteRoot : "~"
				});
			}
			return profiles;
		}
		/**
		* Register one cloud folder: the SSH plugin creates the local mirror, writes the
		* connection marker and registers a real DSH workspace for it — exactly what its
		* own "new remote workspace" flow does. The returned native workspace id backs
		* the folder row, and the workspace's own sidebar row is hidden once the entry
		* lists it (see `absorbedWorkspaceIds`).
		* @param profileId - SSH connection to use.
		* @param remotePath - remote directory (`~`, `~/proj`, `/srv/proj`).
		* @param title - optional display title; the plugin derives one from the path.
		* @param fetchImpl - fetch implementation (tests inject one).
		*/
		async function createRemoteFolder(profileId, remotePath, title, fetchImpl = fetch) {
			const trimmedPath = remotePath.trim();
			if (profileId.trim() === "" || trimmedPath === "") throw new Error("Pick a connection and enter a remote path");
			const value = await rpc("createRemoteWorkspace", {
				profileId,
				remotePath: trimmedPath,
				...title === void 0 || title.trim() === "" ? {} : { title: title.trim() }
			}, fetchImpl);
			if (value === null) throw new Error("The SSH plugin is unavailable; cannot add a cloud folder");
			const record = object(value.workspace) ?? {};
			const workspaceId = typeof value.workspaceId === "string" ? value.workspaceId : "";
			const mirrorPath = typeof value.mirrorPath === "string" ? value.mirrorPath : "";
			const recordId = typeof record.id === "string" ? record.id : "";
			if (workspaceId === "" || mirrorPath === "") throw new Error("The SSH plugin did not register a workspace for this folder");
			return {
				path: mirrorPath,
				workspaceId,
				recordId,
				remotePath: typeof record.remotePath === "string" ? record.remotePath : trimmedPath,
				profileId: typeof record.profileId === "string" ? record.profileId : profileId,
				title: typeof record.title === "string" && record.title !== "" ? record.title : trimmedPath,
				reused: value.reused === true
			};
		}
		/**
		* Delete one remote workspace record through the SSH plugin: it removes the
		* record, unregisters the native workspace behind it (that workspace's
		* sessions go with it) and cleans up the mirror — the counterpart of
		* {@link createRemoteFolder}, for when a member folder is removed for good.
		* @param recordId - remote-ssh record id stored on the member.
		* @param fetchImpl - fetch implementation (tests inject one).
		*/
		async function deleteRemoteWorkspaceRecord(recordId, fetchImpl = fetch) {
			if (recordId.trim() === "") throw new Error("No remote workspace record to delete");
			if (await rpc("deleteWorkspace", { id: recordId }, fetchImpl) === null) throw new Error("The SSH plugin is unavailable; cannot delete the remote workspace");
		}
		/** Resolve against the SSH plugin's registered mirrors, not copied marker files. */
		async function remoteFolderWorkspace(path, remoteBase, fetchImpl = fetch) {
			const value = await rpc("listWorkspaces", {}, fetchImpl);
			const knownMirror = remoteBase !== null && isUnderBase(path, remoteBase);
			if (value === null) {
				if (knownMirror) throw new Error("SSH plugin is unavailable; refusing a local operation in a remote mirror");
				await refuseMarkedLocalPath(path, fetchImpl);
				return null;
			}
			if (!Array.isArray(value.workspaces)) throw new Error("Invalid SSH workspace catalog");
			const matches = [];
			for (const raw of value.workspaces) {
				const row = object(raw);
				if (!row || typeof row.mirrorPath !== "string" || typeof row.remotePath !== "string" || typeof row.profileId !== "string" || !row.mirrorPath || !row.remotePath || !row.profileId) throw new Error("Invalid SSH workspace entry");
				if (samePath(path, row.mirrorPath) || isUnderBase(path, row.mirrorPath)) matches.push({
					mirrorPath: row.mirrorPath,
					remotePath: row.remotePath,
					profileId: row.profileId,
					workspaceId: typeof row.shellWorkspaceId === "string" ? row.shellWorkspaceId : "",
					recordId: typeof row.id === "string" ? row.id : ""
				});
			}
			if (matches.length > 1) throw new Error("Overlapping SSH workspaces are not supported safely");
			if (matches.length === 1) return matches[0];
			if (knownMirror) throw new Error("Remote mirror is not registered with the SSH plugin");
			await refuseMarkedLocalPath(path, fetchImpl);
			return null;
		}
		/** Single-segment names match DSH createDirectory(path, name). */
		function validateFolderName(raw) {
			const name = raw.trim();
			if (!name || name === "." || name === ".." || /[\\/\u0000-\u001f]/u.test(name)) throw new Error("Enter a single folder name, not an absolute path or nested path");
			return name;
		}
		async function createWorkspaceDirectory(parent, rawName, remoteBase, createLocal, fetchImpl = fetch) {
			const name = validateFolderName(rawName);
			const path = joinSubpath(parent, name);
			if (path === null) throw new Error("Invalid folder name");
			const remote = await remoteFolderWorkspace(parent, remoteBase, fetchImpl);
			if (!remote) return {
				path: await createLocal(parent, name),
				remote: false
			};
			if (/[\u0000-\u001f`$"\\]/u.test(name)) throw new Error("Unsupported remote folder name");
			const normalizedParent = parent.trim().replace(/\\/gu, "/").replace(/\/+$/u, "");
			const normalizedRoot = remote.mirrorPath.trim().replace(/\\/gu, "/").replace(/\/+$/u, "");
			const suffix = normalizedParent.slice(normalizedRoot.length).replace(/^\/+/, "");
			if (suffix.split("/").some((part) => part === ".." || part === ".")) throw new Error("Invalid mirror path");
			const remotePath = `${remote.remotePath.replace(/\/+$/u, "")}/${suffix ? `${suffix}/` : ""}${name}`;
			await rpc("mkdir", {
				profileId: remote.profileId,
				path: remotePath
			}, fetchImpl);
			return {
				path,
				remote: true
			};
		}
		// src/client/open-folder.ts
		/**
		* Transport for the official open-in-app host routes served by
		* `@deepseek-ai/dsh-host-open-in-app`. The project row offers "open this
		* project's folder" by asking that host half for the applications it verified
		* as installed, then POSTing the launcher it already resolved — this plugin
		* never probes or spawns a launcher itself, and a host without the capability
		* (no resolved application, e.g. an SSH launch) simply yields no menu entry.
		*/
		/** GET route serving the probed application ids (host-owned constant). */
		const OPEN_IN_APP_APPS_ROUTE = "/open-in-app/apps";
		/** POST route launching one resolved application on one absolute directory. */
		const OPEN_IN_APP_OPEN_ROUTE = "/open-in-app/open";
		/**
		* Catalog ids that open a directory in the platform file manager, most
		* specific first (the official catalog names one per platform: `explorer` on
		* Windows, `finder` on macOS, `filemanager` on Linux).
		*/
		const FOLDER_APP_IDS = [
			"explorer",
			"finder",
			"filemanager"
		];
		/**
		* The installed file-manager id for this host, or undefined when the host
		* resolved none (the row then offers no "open in folder" entry).
		* @param apps - installed catalog ids from the apps route.
		* @returns the preferred available id.
		*/
		function folderAppId(apps) {
			for (const id of FOLDER_APP_IDS) if (apps.includes(id)) return id;
		}
		/**
		* Resolve the browser's Host base with the connection carrier's null-origin
		* fallback (same rule the official button uses): a sandboxed document reports
		* the literal origin "null", which cannot address the host.
		* @returns the absolute base URL of the current Host.
		*/
		function hostBase() {
			const origin = globalThis.location?.origin;
			return origin !== void 0 && origin !== "null" ? origin : "http://dsh.internal";
		}
		/**
		* Read the host's installed-application ids. A host without the capability
		* (or one that refuses) reads as an empty list rather than an error, so the
		* caller can treat "no apps" and "no route" identically.
		* @param signal - aborts the read when the browser half unmounts.
		* @returns installed catalog ids, in host menu order.
		*/
		async function fetchOpenInApps(signal) {
			const response = await fetch(new URL(OPEN_IN_APP_APPS_ROUTE, hostBase()), {
				headers: { accept: "application/json" },
				cache: "no-store",
				...signal === void 0 ? {} : { signal }
			});
			if (!response.ok) throw new Error(`open-in-app apps request failed: ${response.status}`);
			const apps = (await response.json()).apps;
			return Array.isArray(apps) ? apps.filter((id) => typeof id === "string") : [];
		}
		/**
		* Launch one installed application on one absolute directory.
		* @param appId - catalog id from the apps route.
		* @param path - the project's absolute directory.
		* @returns after the host acknowledged the launch; rejects on any refusal.
		*/
		async function openPathInApp(appId, path) {
			const response = await fetch(new URL(OPEN_IN_APP_OPEN_ROUTE, hostBase()), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					app: appId,
					path
				})
			});
			if (!response.ok) throw new Error(`open-in-app launch failed: ${response.status}`);
		}
		// src/client/FoldersDialog.tsx
		/**
		* The folder dialog of one workspace row: the base folder first, then every
		* extra folder in stored order. A row is chosen as the root (the folder new
		* sessions default to); open/remove act per row, and the base folder is never
		* removable because the workspace's canonical directory cannot be dropped.
		*
		* Folders come in two kinds, and the add area switches between them:
		* · local — a directory picked on this machine (`pickDirectory`);
		* · cloud — a directory on an SSH host, browsed through the SSH plugin's own
		*   pooled session, then registered as a mirror-backed workspace.
		*
		* Cloud browsing lives here rather than behind a second modal: the dialog body
		* swaps to the remote tree, so no stacked overlays are needed and the current
		* location stays readable at the top.
		*/
		/** Relative path of `picked` inside `root`: '' for the root itself, null outside. */
		function subfolderOf(root, picked) {
			if (root === null) return null;
			const base = root.trim().replace(/\/+$/u, "");
			if (base === "") return null;
			if (picked === base) return "";
			return picked.startsWith(`${base}/`) ? picked.slice(base.length + 1) : null;
		}
		function FoldersDialog({ workspace, entry, t, busy, canOpen, remote, ownerRemotePath, profiles, profilesError, knownWorkspaceIds, onClose, onAddFolder, onAddRemote, onAddSubpath, onSetRoot, onRemove, onOpenFolder }) {
			const folders = effectiveFolders(workspace.path, entry);
			const root = rootOf(workspace.path, entry);
			const [addMode, setAddMode] = (0, react.useState)("local");
			const [confirmRemovePath, setConfirmRemovePath] = (0, react.useState)(null);
			const [profileId, setProfileId] = (0, react.useState)("");
			const [remotePath, setRemotePath] = (0, react.useState)("");
			const [browsing, setBrowsing] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(null);
			const profileChoices = profiles ?? [];
			const knownIds = new Set(knownWorkspaceIds);
			const selectedProfile = profileChoices.some((profile) => profile.id === profileId) ? profileId : profileChoices[0]?.id ?? "";
			const currentProfile = profileChoices.find((profile) => profile.id === selectedProfile);
			/** One field, two shapes: a bare name creates a subdirectory inside THIS
			*  project's remote root, anything with a separator registers a new cloud
			*  workspace. Keeping them in one field removed a whole extra row from a
			*  ~330px wide dialog. */
			const typed = remotePath.trim();
			const asSubfolder = remote && typed !== "" && !/[/\\~]/u.test(typed);
			const submitAdd = () => {
				if (typed === "" || busy) return;
				if (asSubfolder) {
					onAddSubpath(typed).then((success) => {
						if (success) setRemotePath("");
					});
					return;
				}
				if (selectedProfile === "") return;
				onAddRemote(selectedProfile, typed).then((success) => {
					if (!success) return;
					setRemotePath("");
					setBrowsing(false);
				});
			};
			if (browsing && currentProfile !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RemoteFolderPicker, {
				profile: currentProfile,
				startPath: remotePath.trim() === "" ? ownerRemotePath ?? currentProfile.remoteRoot : remotePath.trim(),
				t,
				busy,
				onPick: (picked) => {
					const relative = subfolderOf(ownerRemotePath, picked);
					if (relative === "" && ownerRemotePath !== null) {
						setNotice(t("folder.alreadyRoot"));
						setBrowsing(false);
						return;
					}
					if (relative !== null) {
						onAddSubpath(relative).then((success) => {
							if (success) {
								setNotice(null);
								setBrowsing(false);
							}
						});
						return;
					}
					setRemotePath(picked);
					setBrowsing(false);
				},
				onCancel: () => {
					setBrowsing(false);
				}
			});
			const cloudAvailable = profiles !== null;
			const extraFolders = folders.length > 1;
			const ownerPath = remote ? ownerRemotePath ?? workspace.path : workspace.path;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose,
				closeLabel: t("close"),
				title: t("folder.title"),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					onClick: onClose,
					children: t("folder.done")
				}),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wgFolderBody",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: "wgFolderHead",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wgFolderHeadName",
								title: workspace.title,
								children: workspace.title
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
								className: "wgFolderHeadPath",
								title: ownerPath,
								children: ownerPath
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "wgFolderSection",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wgFolderSectionTitle",
									children: t("folder.sectionList")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wgFolderList",
									role: "list",
									"aria-label": t("folder.listAria"),
									children: folders.map((path, index) => {
										const isBase = index === 0;
										const isRoot = samePath(path, root);
										const member = memberOf(entry, path);
										const label = isBase ? workspace.title : member?.kind === "remote" ? member.title ?? folderLabel(member.remotePath ?? path) : folderLabel(path);
										const displayPath = member === void 0 ? isBase ? ownerPath : path : member.remotePath ?? member.path;
										const memberGone = member !== void 0 && !knownIds.has(member.workspaceId);
										const canDeleteRecord = member?.kind === "remote" && member.recordId !== void 0 && member.recordId !== "";
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wgFolderListRow",
											role: "listitem",
											"data-active": isRoot,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													className: "wgFolderRootPick",
													title: t("folder.rootBadge"),
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "radio",
														className: "wgFolderRadio",
														name: "wg-folder-root",
														checked: isRoot,
														"aria-label": `${t("folder.rootBadge")} ${label}`,
														onChange: () => {
															onSetRoot(path);
														}
													})
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "wgFolderEntry",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "wgFolderListLabel",
														title: path,
														children: label
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
														className: "wgFolderListPath",
														title: displayPath,
														children: displayPath
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "wgFolderListTags",
													children: [
														isBase && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "wgFolderListTag",
															"data-tone": "base",
															children: t("folder.base")
														}),
														isRoot && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "wgFolderListTag",
															"data-tone": "root",
															children: t("folder.rootBadge")
														}),
														member !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "wgFolderListTag",
															"data-tone": member.kind === "remote" ? "cloud" : "local",
															children: member.kind === "remote" ? t("folder.cloudTag") : t("folder.localTag")
														}),
														memberGone && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "wgFolderListTag",
															"data-tone": "danger",
															role: "alert",
															children: t("folder.memberMissing")
														})
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "wgFolderListActions",
													children: [canOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "wgIconButton",
														"aria-label": `${t("workspace.openInFolder")} ${label}`,
														onClick: () => {
															onOpenFolder(path);
														},
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 16 })
													}), !isBase && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "wgIconButton",
														"aria-label": `${t("folder.remove")} ${label}`,
														onClick: () => {
															if (canDeleteRecord) setConfirmRemovePath(path);
															else onRemove(path, false);
														},
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, {})
													})]
												})
											]
										}), confirmRemovePath === path && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wgFolderConfirm",
											role: "alert",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wgFolderConfirmText",
												children: t("folder.removeRemotePrompt")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "wgFolderConfirmActions",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "wgFolderConfirmButton",
														"data-tone": "danger",
														onClick: () => {
															setConfirmRemovePath(null);
															onRemove(path, true);
														},
														children: t("folder.removeRemoteDelete")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "wgFolderConfirmButton",
														onClick: () => {
															setConfirmRemovePath(null);
															onRemove(path, false);
														},
														children: t("folder.removeRemoteOnly")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "wgFolderConfirmButton",
														onClick: () => {
															setConfirmRemovePath(null);
														},
														children: t("cancel")
													})
												]
											})]
										})] }, path);
									})
								}),
								!extraFolders && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "wgFolderEmpty",
									children: t("folder.emptyHint")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "wgFolderAdd",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wgFolderSectionTitle",
									children: t("folder.sectionAdd")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wgFolderSegmented",
									role: "tablist",
									"aria-label": t("folder.addAria"),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										role: "tab",
										className: "wgFolderTab",
										"aria-selected": addMode === "local",
										onClick: () => {
											setAddMode("local");
											setNotice(null);
										},
										children: t("folder.tabLocal")
									}), cloudAvailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										role: "tab",
										className: "wgFolderTab",
										"aria-selected": addMode === "cloud",
										onClick: () => {
											setAddMode("cloud");
											setNotice(null);
										},
										children: t("folder.tabCloud")
									})]
								}),
								notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "wgFolderNote",
									role: "status",
									children: notice
								}),
								addMode === "local" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wgFolderLocalPane",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "wgFolderPick",
										disabled: busy,
										onClick: onAddFolder,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wgFolderPickPlus",
											"aria-hidden": true,
											children: "＋"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("folder.pickLocal") })]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "wgFolderHint",
										children: remote ? t("folder.localIntoRemote") : t("folder.localNote")
									})]
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wgFolderStack",
									children: [
										profileChoices.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "wgFolderNote",
											children: t("folder.noProfiles")
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
											className: "wgFolderSubpathInput wgFolderSelect",
											value: selectedProfile,
											"aria-label": t("folder.profileLabel"),
											disabled: busy,
											onChange: (event) => setProfileId(event.target.value),
											children: profileChoices.map((profile) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: profile.id,
												children: profile.host === "" ? profile.name : `${profile.name} (${profile.user}@${profile.host})`
											}, profile.id))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wgFolderField",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "text",
												className: "wgFolderSubpathInput wgFolderFieldInput",
												value: remotePath,
												placeholder: t(remote ? "folder.remotePathOrName" : "folder.remotePathPlaceholder"),
												"aria-label": t(remote ? "folder.remotePathOrName" : "folder.remotePathLabel"),
												disabled: busy,
												onChange: (event) => setRemotePath(event.target.value),
												onKeyDown: (event) => {
													if (event.key !== "Enter") return;
													event.preventDefault();
													submitAdd();
												}
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "wgFolderFieldAction",
												title: t("folder.browse"),
												"aria-label": t("folder.browse"),
												disabled: busy || currentProfile === void 0,
												onClick: () => {
													setBrowsing(true);
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 15 })
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "wgFolderActions",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												variant: "primary",
												disabled: busy || typed === "" || !asSubfolder && selectedProfile === "",
												onClick: submitAdd,
												children: t(asSubfolder ? "folder.createAndAdd" : "folder.addRemote")
											})
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "wgFolderHint",
									children: t(remote ? "folder.cloudNoteBoth" : "folder.cloudNote")
								})] }),
								profilesError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: "wgFolderNote",
									role: "alert",
									children: [
										t("folder.profilesError"),
										": ",
										profilesError
									]
								})
							]
						})
					]
				})
			});
		}
		/**
		* Browse one SSH host and pick a directory. Entries come from the SSH plugin's
		* `listDir`, so the local machine never runs a copy of the remote tree and the
		* connection's own auth (key, password, ProxyJump) is reused unchanged.
		*/
		function RemoteFolderPicker({ profile, startPath, t, busy, onPick, onCancel }) {
			const [path, setPath] = (0, react.useState)(startPath);
			const [resolved, setResolved] = (0, react.useState)(startPath);
			const [entries, setEntries] = (0, react.useState)([]);
			const [error, setError] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [reloadKey, setReloadKey] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				let live = true;
				setLoading(true);
				setError(null);
				listRemoteDirectory(profile.id, path).then((listing) => {
					if (!live) return;
					setEntries(listing.entries);
					setResolved(listing.resolved);
					setLoading(false);
					if (listing.resolved !== path) setPath(listing.resolved);
				}, (reason) => {
					if (!live) return;
					setError(reason instanceof Error ? reason.message : String(reason));
					setLoading(false);
				});
				return () => {
					live = false;
				};
			}, [
				profile.id,
				path,
				reloadKey
			]);
			const parent = remoteDirParent(resolved);
			const directories = entries.filter((entry) => entry.type === "directory");
			const choose = () => {
				onPick(resolved);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose: onCancel,
				closeLabel: t("close"),
				title: `${t("folder.browseTitle")} · ${profile.name}`,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					onClick: onCancel,
					children: t("cancel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					disabled: busy || loading || error !== null,
					onClick: choose,
					children: t("folder.chooseHere")
				})] }),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgRemoteBar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							className: "wgRemotePath",
							title: resolved,
							children: resolved
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "wgRemoteActions",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: parent === null || loading,
									onClick: () => {
										if (parent !== null) setPath(parent);
									},
									children: t("folder.up")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: loading,
									onClick: () => {
										setPath(profile.remoteRoot);
									},
									children: t("folder.home")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: loading,
									onClick: () => {
										setReloadKey((key) => key + 1);
									},
									children: t("folder.refresh")
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgRemoteList",
						role: "list",
						"aria-label": t("folder.browseListAria"),
						children: [
							loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "wgFolderNote",
								children: t("folder.loading")
							}),
							!loading && error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: "wgFolderNote",
								role: "alert",
								children: [
									t("folder.browseFailed"),
									": ",
									error
								]
							}),
							!loading && error === null && directories.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "wgFolderNote",
								children: t("folder.emptyDir")
							}),
							!loading && error === null && directories.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "listitem",
								className: "wgRemoteRow",
								onClick: () => {
									setPath(remoteDirJoin(resolved, entry.name));
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 16 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wgRemoteName",
									children: entry.name
								})]
							}, entry.name))
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "wgFolderNote",
						children: t("folder.browseNote")
					})
				]
			});
		}
		// src/client/quick.ts
		/** A session row eligible for quick switching: running, top-level, real. */
		function quickEligible(summary) {
			return summary.running === true && summary.origin !== "subagent" && !summary.blank;
		}
		/**
		* Running quick-switchable sessions across the whole list, newest first.
		* @param list - sessions list snapshot.
		* @param archived - registry-global archive set (archived rows never surface).
		* @returns running summaries in recency order (id as deterministic tiebreak).
		*/
		function runningSessions(list, archived) {
			const out = [];
			for (const id of list.ids) {
				if (archived.has(id)) continue;
				const summary = list.byId[id];
				if (summary !== void 0 && quickEligible(summary)) out.push(summary);
			}
			out.sort((a, b) => b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : a.id < b.id ? -1 : 1);
			return out;
		}
		/**
		* Every quick-switchable session across the whole list — the sessions tab's
		* data: running rows pinned on top, everything else under them, both groups
		* newest first. Visibility mirrors the tree (subagent rows never; archived
		* never; a blank row only while it is the open session).
		* @param list - sessions list snapshot.
		* @param archived - registry-global archive set (archived rows never surface).
		* @param current - the selected session (`mainView` retention; keeps its blank row visible).
		* @returns summaries with running first, then recency (id as deterministic tiebreak).
		*/
		function allSessions(list, archived, current) {
			const out = [];
			for (const id of list.ids) {
				if (archived.has(id)) continue;
				const summary = list.byId[id];
				if (summary === void 0) continue;
				if (summary.origin === "subagent") continue;
				if (summary.blank && summary.id !== current) continue;
				out.push(summary);
			}
			out.sort((a, b) => {
				if (a.running !== b.running) return a.running ? -1 : 1;
				return b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : a.id < b.id ? -1 : 1;
			});
			return out;
		}
		/**
		* Session search for the quick panel: display-title or owning-workspace-title
		* substring match (trimmed, case-insensitive). Filters only — the incoming
		* running-first/recency order is preserved verbatim, so "running on top"
		* survives any query.
		* @param sessions - allSessions() output (running pinned on top, then recency).
		* @param query - raw query.
		* @param workspaceTitleOf - owning workspace title resolver (sub-line source).
		* @param limit - hard render cap.
		* @returns matching sessions in the given order.
		*/
		function filterSessions(sessions, query, workspaceTitleOf, limit = 200) {
			const q = query.trim().toLowerCase();
			if (q === "") return sessions.slice(0, limit);
			const out = [];
			for (const session of sessions) {
				const workspace = workspaceTitleOf(session)?.toLowerCase() ?? "";
				if (session.displayTitle.toLowerCase().includes(q) || workspace.includes(q)) out.push(session);
			}
			return out.slice(0, limit);
		}
		/**
		* Most recently updated running session inside one workspace.
		* @param list - sessions list snapshot.
		* @param workspace - target workspace (its session account order is irrelevant;
		* recency picks the row).
		* @returns the session id, or undefined when nothing in the workspace runs.
		*/
		function latestRunningInWorkspace(list, workspace) {
			let best;
			let bestTime = Number.NEGATIVE_INFINITY;
			for (const id of workspace.sessionIds) {
				const summary = list.byId[id];
				if (summary === void 0 || !quickEligible(summary)) continue;
				if (summary.updatedAt > bestTime) {
					best = summary.id;
					bestTime = summary.updatedAt;
				}
			}
			return best;
		}
		/**
		* Running-session count per workspace id (badge on the workspace tab rows).
		* @param running - runningSessions() output.
		* @param workspaces - real workspaces in stable Host order.
		* @returns counts keyed by workspace id; absent key = none running.
		*/
		function runningCountByWorkspace(running, workspaces) {
			const counts = /* @__PURE__ */ new Map();
			if (running.length === 0) return counts;
			const runningIds = new Set(running.map((s) => s.id));
			for (const workspace of workspaces) {
				let count = 0;
				for (const sessionId of workspace.sessionIds) if (runningIds.has(sessionId)) count += 1;
				if (count > 0) counts.set(workspace.workspaceId, count);
			}
			return counts;
		}
		/**
		* The workspace that owns the currently open session.
		* @param workspaces - real workspaces in stable Host order.
		* @param currentSessionId - the selected session (`mainView` retention); may be undefined
		*   (no session open, cleared selection) or an id no listed workspace holds
		*   (e.g. an addressed subagent session).
		* @returns the workspace id, or undefined when there is no active workspace.
		*/
		function activeWorkspaceId(workspaces, currentSessionId) {
			if (currentSessionId === void 0) return void 0;
			return workspaces.find((w) => w.sessionIds.includes(currentSessionId))?.workspaceId;
		}
		/**
		* Workspace search for the quick panel: title prefix → title substring →
		* category label substring → path substring; ties keep host order via a
		* stable title compare inside one rank.
		* @param workspaces - real workspaces in stable Host order.
		* @param query - raw query (trimmed, case-insensitive).
		* @param categoryLabelOf - category label resolver (grouped workspaces only).
		* @param limit - hard render cap.
		* @returns ranked matches; an empty query returns host order.
		*/
		function filterWorkspaces(workspaces, query, categoryLabelOf, limit = 50) {
			const q = query.trim().toLowerCase();
			if (q === "") return workspaces.slice(0, limit);
			const scored = [];
			for (const workspace of workspaces) {
				const title = workspace.title.toLowerCase();
				const path = workspace.path.toLowerCase();
				const category = (categoryLabelOf?.(workspace) ?? "").toLowerCase();
				let score;
				if (title.startsWith(q)) score = 0;
				else if (title.includes(q)) score = 1;
				else if (category !== "" && category.includes(q)) score = 2;
				else if (path.includes(q)) score = 3;
				if (score !== void 0) scored.push({
					workspace,
					score
				});
			}
			scored.sort((a, b) => a.score !== b.score ? a.score - b.score : a.workspace.title.localeCompare(b.workspace.title));
			return scored.slice(0, limit).map((entry) => entry.workspace);
		}
		// src/client/QuickPanel.tsx
		/**
		* Ctrl+R quick switch panel: two tabs over the framework's global hooks.
		*
		* - Workspaces tab: search real Workspaces, select one, then either start a
		*   New Session in it or jump straight to its most recently updated running
		*   session (the button reads the none-running state and disables).
		* - Sessions tab: every top-level session across workspaces — running ones
		*   pinned on top, everything else under them, both groups newest first; one
		*   click (or Enter) opens it. The shared search input filters by session or
		*   workspace title and never re-sorts, so the running-first order survives.
		*
		* Current-row marker: the open workspace (workspaces tab) and the open
		* session (sessions tab) render `.wgQuickRowCurrent`; with no current
		* session — or one no listed workspace holds — nothing is marked.
		*
		* Mount discipline: the parent conditionally mounts this component, so every
		* open starts from a fresh query/selection (quick-switcher semantics). The
		* overlay portals to document.body (sidebar ancestors clip `fixed`), sizes
		* itself like a launcher (top-anchored, 640px) instead of the host Modal's
		* 380px dialog, and handles Escape / mask click by itself. Pure data shaping
		* lives in quick.ts; this file only binds hooks + actions.
		*/
		/** Basename of a host path (both separators; shortens the workspace row sub-line). */
		function pathBasename(path) {
			const trimmed = path.replace(/[/\\]+$/, "");
			const base = trimmed.split(/[/\\]/).pop();
			return base !== void 0 && base !== "" ? base : trimmed;
		}
		/**
		* Render the quick switch panel (portaled overlay).
		* @param props - hooks snapshots + injected verbs.
		* @returns the panel element tree.
		*/
		function QuickPanel({ onClose, list, workspaces, archivedSessionIds, categoryByWorkspace, current: currentSessionId, startSession, openSession, now, t }) {
			const [tab, setTab] = (0, react.useState)("workspaces");
			const [query, setQuery] = (0, react.useState)("");
			const [selectedId, setSelectedId] = (0, react.useState)(null);
			const [activeIndex, setActiveIndex] = (0, react.useState)(0);
			const inputRef = (0, react.useRef)(null);
			const activeRowRef = (0, react.useRef)(null);
			const archived = (0, react.useMemo)(() => new Set(archivedSessionIds), [archivedSessionIds]);
			const running = (0, react.useMemo)(() => runningSessions(list, archived), [list, archived]);
			const runCounts = (0, react.useMemo)(() => runningCountByWorkspace(running, workspaces), [running, workspaces]);
			const filtered = (0, react.useMemo)(() => filterWorkspaces(workspaces, query, (ws) => categoryByWorkspace.get(ws.workspaceId)), [
				workspaces,
				query,
				categoryByWorkspace
			]);
			const currentWorkspaceId = (0, react.useMemo)(() => activeWorkspaceId(workspaces, currentSessionId), [workspaces, currentSessionId]);
			const sessions = (0, react.useMemo)(() => allSessions(list, archived, currentSessionId), [
				list,
				archived,
				currentSessionId
			]);
			const workspaceTitleBySession = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const workspace of workspaces) for (const sessionId of workspace.sessionIds) if (!map.has(sessionId)) map.set(sessionId, workspace.title);
				return map;
			}, [workspaces]);
			const filteredSessions = (0, react.useMemo)(() => filterSessions(sessions, query, (s) => workspaceTitleBySession.get(s.id)), [
				sessions,
				query,
				workspaceTitleBySession
			]);
			const selected = selectedId === null ? void 0 : workspaces.find((w) => w.workspaceId === selectedId);
			const selectedRunningId = selected === void 0 ? void 0 : latestRunningInWorkspace(list, selected);
			(0, react.useEffect)(() => {
				inputRef.current?.focus();
			}, [tab]);
			(0, react.useEffect)(() => {
				activeRowRef.current?.scrollIntoView({ block: "nearest" });
			}, [activeIndex]);
			/** Select the workspace and close (New Session verb). */
			const launchNewSession = (workspace) => {
				startSession(workspace.workspaceId);
				onClose();
			};
			/** Open a session row and close (sessions tab click or Enter). */
			const launchSession = (sessionId) => {
				openSession(sessionId);
				onClose();
			};
			/** Switch tabs; the query carries over, the per-tab selection resets. */
			const switchTab = (next) => {
				setTab(next);
				setSelectedId(null);
				setActiveIndex(0);
			};
			/** Search-input keyboard: arrows move the active row; Enter confirms it. */
			const onSearchKeyDown = (e) => {
				if (e.key === "ArrowDown") {
					e.preventDefault();
					const max = (tab === "workspaces" ? filtered.length : filteredSessions.length) - 1;
					setActiveIndex((i) => Math.min(i + 1, Math.max(max, 0)));
				} else if (e.key === "ArrowUp") {
					e.preventDefault();
					setActiveIndex((i) => Math.max(i - 1, 0));
				} else if (e.key === "Enter") {
					e.preventDefault();
					if (tab === "workspaces") {
						if (selected === void 0) {
							const target = filtered[activeIndex];
							if (target !== void 0) setSelectedId(target.workspaceId);
						} else launchNewSession(selected);
					} else {
						const target = filteredSessions[activeIndex];
						if (target !== void 0) launchSession(target.id);
					}
				}
			};
			/** Escape closes (capture so row buttons and the input can't swallow it). */
			const onCardKeyDown = (e) => {
				if (e.key === "Escape") {
					e.preventDefault();
					e.stopPropagation();
					onClose();
				}
			};
			/** Mask click closes; clicks inside the card never reach the mask. */
			const onOverlayMouseDown = (e) => {
				if (e.target === e.currentTarget) onClose();
			};
			const selectWorkspace = (id) => {
				setSelectedId(id);
				inputRef.current?.focus();
			};
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wgQuickOverlay",
				onMouseDown: onOverlayMouseDown,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wgQuickCard",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("quick.title"),
					onKeyDown: onCardKeyDown,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgQuickHeader",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wgQuickTitle",
								children: t("quick.title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wgQuickTabs",
								role: "tablist",
								"aria-label": t("quick.title"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									"aria-selected": tab === "workspaces",
									className: `wgQuickTab${tab === "workspaces" ? " wgQuickTabActive" : ""}`,
									onClick: () => {
										switchTab("workspaces");
									},
									children: t("quick.tab.workspaces")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "tab",
									"aria-selected": tab === "sessions",
									className: `wgQuickTab${tab === "sessions" ? " wgQuickTabActive" : ""}`,
									onClick: () => {
										switchTab("sessions");
									},
									children: [t("quick.tab.sessions"), running.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wgQuickTabCount",
										children: running.length
									})]
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgQuickSearchWrap",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								ref: inputRef,
								className: "wgQuickSearch",
								value: query,
								placeholder: tab === "workspaces" ? t("quick.search.placeholder") : t("quick.search.sessions"),
								"aria-label": tab === "workspaces" ? t("quick.search.placeholder") : t("quick.search.sessions"),
								onChange: (e) => {
									setQuery(e.target.value);
									setSelectedId(null);
									setActiveIndex(0);
								},
								onKeyDown: onSearchKeyDown
							})
						}),
						tab === "workspaces" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgQuickList",
							role: "listbox",
							"aria-label": t("quick.tab.workspaces"),
							children: [filtered.map((workspace, i) => {
								const id = workspace.workspaceId;
								const count = runCounts.get(id) ?? 0;
								const category = categoryByWorkspace.get(id);
								const isCurrent = id === currentWorkspaceId;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									ref: i === activeIndex ? activeRowRef : void 0,
									type: "button",
									role: "option",
									"aria-selected": selectedId === id,
									"aria-current": isCurrent || void 0,
									className: `wgQuickRow${i === activeIndex ? " wgQuickRowActive" : ""}${selectedId === id ? " wgQuickRowSelected" : ""}${isCurrent ? " wgQuickRowCurrent" : ""}`,
									onMouseEnter: () => {
										setActiveIndex(i);
									},
									onClick: () => {
										selectWorkspace(id);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "wgQuickRowMain",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wgQuickRowTitle",
											children: workspace.title
										}), count > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "wgQuickRunBadge",
											children: ["● ", count]
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wgQuickRowSub",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wgQuickRowPath",
											children: category !== void 0 ? `${category} · ${pathBasename(workspace.path)}` : pathBasename(workspace.path)
										})
									})]
								}, id);
							}), filtered.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgQuickEmpty",
								children: t("quick.empty.workspaces")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgQuickFooter",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wgQuickSelected",
									children: selected === void 0 ? t("quick.select.hint") : selected.title
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: selected === void 0 || selectedRunningId === void 0,
									onClick: () => {
										if (selectedRunningId !== void 0) launchSession(selectedRunningId);
									},
									children: selectedRunningId !== void 0 ? t("quick.action.running") : t("quick.action.noneRunning")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									disabled: selected === void 0,
									onClick: () => {
										if (selected !== void 0) launchNewSession(selected);
									},
									children: t("quick.action.newSession")
								})
							]
						})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgQuickList",
							role: "listbox",
							"aria-label": t("quick.tab.sessions"),
							children: [filteredSessions.map((session, i) => {
								const workspaceTitle = workspaceTitleBySession.get(session.id) ?? "";
								const isCurrent = session.id === currentSessionId;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									ref: i === activeIndex ? activeRowRef : void 0,
									type: "button",
									role: "option",
									"aria-selected": i === activeIndex,
									"aria-current": isCurrent || void 0,
									className: `wgQuickRow${i === activeIndex ? " wgQuickRowActive" : ""}${isCurrent ? " wgQuickRowCurrent" : ""}`,
									onMouseEnter: () => {
										setActiveIndex(i);
									},
									onClick: () => {
										launchSession(session.id);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "wgQuickRowMain",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: session.running ? "ongoing" : "done" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wgQuickRowTitle",
												children: session.blank ? t("newSession") : session.displayTitle
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wgQuickTime",
												children: relativeTimeLabel(session.updatedAt, now)
											})
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wgQuickRowSub",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wgQuickRowPath",
											children: workspaceTitle
										})
									})]
								}, session.id);
							}), filteredSessions.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgQuickEmpty",
								children: t("quick.empty.sessions")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgQuickHint",
							children: t("quick.hint")
						})
					]
				})
			}), document.body);
		}
		// src/client/tab-seat.ts
		/**
		* DOM seat for the session tab strip.
		*
		* Why this exists instead of a slot: the strip belongs at the very top of the
		* conversation column — `pI_x6G_centerCol` (ui-layout's AppFrame `.centerCol`,
		* a hashed CSS-Modules class). That column declares NO child slots: its only
		* child is the `main` slot's occupant (`renderSlot('main', …)`, the
		* Conversation or a global panel), so there is nowhere to register. The
		* shipped slot in that neighbourhood — `conversation.composer.dock` — is the
		* band UNDER the composer card, a different place entirely.
		*
		* So the strip gets a real DOM seat: this module finds the column, prepends a
		* `<div>` to it, and hands that element to a React portal. The element is
		* OURS, never React's: it is inserted outside the column's child list that
		* React reconciles, and it is re-inserted if React (or a theme/titlebar
		* re-render) ever drops it.
		*
		* Two hazards this module is built around:
		*
		* 1. `centerCol` is a hashed class name (`pI_x6G_centerCol`) that changes when
		*    the package is rebuilt. Matching is therefore done on the *structural*
		*    contract — a grid-item column that holds the `main` panel — plus a
		*    `[class*="_centerCol"]` probe, never on the exact hash.
		* 2. The column mounts after the client plugin's `apply()` runs. Discovery is
		*    therefore a MutationObserver on `document.body` plus a `requestAnimationFrame`
		*    retry, and both are torn down when the owning effect disposes.
		*/
		/** Persistent marker for the injected container (survives React re-renders). */
		const SEAT_ATTRIBUTE = "data-wg-tab-seat";
		/** Sentinel attribute on the container so discovery can skip our own node. */
		const SEAT_SELECTOR = `[${SEAT_ATTRIBUTE}]`;
		/**
		* Match the conversation column by its hashed CSS-Modules class.
		*
		* The hash prefix (`pI_x6G_`) is build-dependent, so the probe matches the
		* `_centerCol` suffix that the Modules transform always preserves. A plain
		* `class*="centerCol"` scan would risk matching unrelated utility classes, so
		* the leading underscore is required.
		* @param root - subtree to scan (normally `document`).
		* @returns the column element, or null while it has not mounted.
		*/
		function findCenterColumn(root) {
			const existing = root.querySelector(SEAT_SELECTOR);
			if (existing?.isConnected === true) return existing.parentElement;
			const column = root.querySelector("[class*=\"_centerCol\"]");
			if (column !== null) return column;
			return null;
		}
		/**
		* Ensure a seat exists as the FIRST child of the conversation column, creating
		* it if needed, and keep it there for as long as the returned handle is live.
		*
		* The seat element is created once and reused: a portal that re-mounts into a
		* fresh node on every shell re-render would drop the tab strip's React state
		* and visible focus. If React removes the node (it owns the column's child
		* list, and our node is not part of it), the observer re-inserts the SAME
		* element, so the portal's subtree moves with it.
		*
		* @param onReady - called with the host element each time it becomes attached
		*   (once immediately when the column already exists). Used to seed React
		*   state; may fire more than once if the column is remounted.
		* @returns the seat handle. `host` is null until the column appears, so the
		*   caller renders nothing meanwhile and starts rendering when `onReady`
		*   fires. Never null: a missing column must degrade to "no strip", not to a
		*   thrown error that would take the whole client plugin down.
		*/
		function mountTabSeat(onReady) {
			let host = null;
			let column = null;
			let observer = null;
			let raf = 0;
			let attempts = 0;
			let disposed = false;
			const MAX_ATTEMPTS = 300;
			/**
			* Put the seat at the head of the column, creating it on first success.
			* Idempotent: a seat already first is left untouched, so repeated calls from
			* the observer cause no DOM churn (and therefore no observer feedback loop —
			* our insertion schedules one more callback, which then takes this early
			* return instead of re-inserting).
			*/
			const place = (target) => {
				if (disposed) return;
				if (host === null) {
					host = document.createElement("div");
					host.setAttribute(SEAT_ATTRIBUTE, "");
				}
				if (target.firstChild === host) return;
				target.insertBefore(host, target.firstChild);
			};
			/** Locate the column and, on success, seat the host and notify the caller. */
			const tryMount = () => {
				if (disposed) return true;
				if (column !== null && column.isConnected) {
					place(column);
					return true;
				}
				const found = findCenterColumn(document);
				if (found === null) return false;
				const changed = found !== column;
				column = found;
				place(found);
				if (changed) onReady(host);
				return true;
			};
			const tick = () => {
				if (disposed) return;
				raf = 0;
				if (tryMount()) return;
				attempts += 1;
				if (attempts >= MAX_ATTEMPTS) return;
				raf = requestAnimationFrame(tick);
			};
			observer = new MutationObserver(() => {
				if (disposed) return;
				if (tryMount()) return;
				if (raf === 0 && attempts < MAX_ATTEMPTS) raf = requestAnimationFrame(tick);
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			if (!tryMount() && raf === 0) raf = requestAnimationFrame(tick);
			return {
				get host() {
					return host;
				},
				dispose: () => {
					disposed = true;
					if (raf !== 0) cancelAnimationFrame(raf);
					raf = 0;
					observer?.disconnect();
					observer = null;
					host?.remove();
					host = null;
					column = null;
				}
			};
		}
		// src/client/SessionTabs.tsx
		/**
		* The session tab strip: one chip per opened conversation, rendered into the
		* DOM seat at the head of the conversation column (see `tab-seat.ts` for why
		* this is a DOM injection rather than a slot).
		*
		* A tab is a *view* of the open session, not a second navigation model:
		* clicking a chip navigates through `ctx.uiWorkspace.openSession`, which is the
		* one path that retains a target session; the owning component derives the
		* strip from the open session plus the tab store.
		*
		* The active chip is derived, never stored: it is the chip whose session is the
		* open one, so clicking a background chip immediately shows that chip active.
		*
		* Every affordance beyond "click to switch" is an explicit USER gesture, and
		* each one maps to exactly one store action: middle-click closes, the context
		* menu pins / renames / closes a range, a drag reorders, and a double-click
		* edits the tab's own label. None of them can run on their own — the strip stays
		* a record of what the user opened.
		*/
		/** Dot state for one tab (the sidebar's session rows share this vocabulary). */
		function dotState(indicator) {
			if (indicator.attention) return "warning";
			if (indicator.running) return "ongoing";
			return "done";
		}
		/** One row of the tab context menu. */
		function MenuRow({ label, onSelect, disabled = false, danger = false }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				role: "menuitem",
				className: `wgTabMenuItem${danger ? " wgTabMenuDanger" : ""}`,
				disabled,
				onClick: onSelect,
				children: label
			});
		}
		/**
		* Render the session tab strip into the conversation column's head seat.
		* @param props - tab store, catalog/status hooks, navigation, locale.
		* @returns the portal (or null until the column has mounted).
		*/
		function SessionTabs({ useTabs, actions, useSessions, useSessionStatus, useWorkspaces, activate, rename, t }) {
			const tabs = useTabs((s) => s.tabs);
			const list = useSessions((s) => s);
			const statuses = useSessionStatus((s) => s);
			const currentId = useSessions((s) => currentSessionId(s));
			const workspaces = useWorkspaces((s) => s.items);
			const projects = (0, react.useMemo)(() => projectIndex(workspaces), [workspaces]);
			const [seat, setSeat] = (0, react.useState)(null);
			const scrollRef = (0, react.useRef)(null);
			const [menu, setMenu] = (0, react.useState)(null);
			const [editing, setEditing] = (0, react.useState)(null);
			const [dragging, setDragging] = (0, react.useState)(null);
			const [dropTarget, setDropTarget] = (0, react.useState)(null);
			const dragEndedAt = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				const mounted = mountTabSeat(setSeat);
				if (mounted.host !== null) setSeat(mounted.host);
				return () => {
					mounted.dispose();
					setSeat(null);
				};
			}, []);
			const display = (0, react.useMemo)(() => orderedTabs(tabs, currentId), [tabs, currentId]);
			const index = (0, react.useMemo)(() => new Map(display.map((tab, at) => [tab.sessionId, at])), [display]);
			(0, react.useEffect)(() => {
				const el = scrollRef.current;
				if (el === null || currentId === void 0) return;
				el.querySelector(`[data-tab-session="${CSS.escape(currentId)}"]`)?.scrollIntoView({
					block: "nearest",
					inline: "nearest"
				});
			}, [currentId, display.length]);
			(0, react.useEffect)(() => {
				if (menu === null) return;
				const dismiss = () => {
					setMenu(null);
				};
				const onPointerDown = (event) => {
					const target = event.target;
					if (target instanceof Element && target.closest(".wgTabMenu") !== null) return;
					dismiss();
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") dismiss();
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				document.addEventListener("keydown", onKeyDown);
				window.addEventListener("resize", dismiss);
				window.addEventListener("scroll", dismiss, true);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
					document.removeEventListener("keydown", onKeyDown);
					window.removeEventListener("resize", dismiss);
					window.removeEventListener("scroll", dismiss, true);
				};
			}, [menu]);
			if (seat === null || display.length === 0) return null;
			/** Commit the in-flight label edit (blank clears the override). */
			const commitEdit = () => {
				if (editing === null) return;
				actions.rename(editing.sessionId, editing.draft);
				setEditing(null);
			};
			/** Start editing a tab's own label, pre-filled with what the chip shows. */
			const startEdit = (sessionId, current) => {
				setMenu(null);
				setEditing({
					sessionId,
					draft: current
				});
			};
			/** Translate a drop onto `target` into an index in the resulting strip. */
			const dropIndexFor = (draggedSessionId, target) => {
				const from = index.get(draggedSessionId);
				const at = index.get(target.sessionId);
				if (from === void 0 || at === void 0 || from === at) return null;
				const insertion = at + (target.side === "after" ? 1 : 0);
				return from < insertion ? insertion - 1 : insertion;
			};
			const chips = display.map((tab, at) => {
				const summary = list.byId[tab.sessionId];
				const sessionLabel = summary === void 0 ? tab.sessionId : summary.blank ? t("newSession") : summary.displayTitle;
				const label = tab.title ?? sessionLabel;
				const active = tab.sessionId === currentId;
				const pinned = tab.pinned === true;
				const indicator = tabIndicator(summary, statuses.get(tab.sessionId));
				const project = projects.get(tab.sessionId);
				const tip = project === void 0 ? label : `${project.label} · ${label}\n${project.path}`;
				const drop = dropTarget !== null && dropTarget.sessionId === tab.sessionId ? dropTarget.side : null;
				const isEditing = editing !== null && editing.sessionId === tab.sessionId;
				const draft = isEditing && editing !== null ? editing.draft : "";
				const className = [
					"wgTab",
					active ? "wgTabActive" : "",
					pinned ? "wgTabPinned" : "",
					dragging === tab.sessionId ? "wgTabDragging" : "",
					drop === "before" ? "wgTabDropBefore" : "",
					drop === "after" ? "wgTabDropAfter" : ""
				].filter((part) => part !== "").join(" ");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className,
					"data-tab-session": tab.sessionId,
					...project !== void 0 ? { "data-tab-project": project.workspaceId } : {},
					draggable: !isEditing,
					onAuxClick: (event) => {
						if (event.button !== 1) return;
						event.preventDefault();
						actions.close(tab.sessionId);
					},
					onContextMenu: (event) => {
						event.preventDefault();
						setEditing(null);
						setMenu({
							sessionId: tab.sessionId,
							x: Math.min(event.clientX, window.innerWidth - 208),
							y: Math.min(event.clientY, window.innerHeight - 240)
						});
					},
					onDragStart: (event) => {
						event.dataTransfer.effectAllowed = "move";
						event.dataTransfer.setData("text/plain", tab.sessionId);
						setDragging(tab.sessionId);
						setMenu(null);
					},
					onDragOver: (event) => {
						if (dragging === null || dragging === tab.sessionId) return;
						event.preventDefault();
						event.dataTransfer.dropEffect = "move";
						const rect = event.currentTarget.getBoundingClientRect();
						const side = event.clientX < rect.left + rect.width / 2 ? "before" : "after";
						setDropTarget({
							sessionId: tab.sessionId,
							side
						});
					},
					onDrop: (event) => {
						event.preventDefault();
						if (dragging !== null && dropTarget !== null) {
							const target = dropIndexFor(dragging, dropTarget);
							if (target !== null) actions.move(dragging, target);
						}
						setDragging(null);
						setDropTarget(null);
						dragEndedAt.current = Date.now();
					},
					onDragEnd: () => {
						setDragging(null);
						setDropTarget(null);
						dragEndedAt.current = Date.now();
					},
					children: isEditing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: "wgTabRename",
						value: draft,
						placeholder: t("tabs.renamePlaceholder"),
						"aria-label": t("tabs.rename"),
						autoFocus: true,
						onFocus: (event) => {
							event.currentTarget.select();
						},
						onChange: (event) => {
							setEditing({
								sessionId: tab.sessionId,
								draft: event.target.value
							});
						},
						onClick: (event) => {
							event.stopPropagation();
						},
						onKeyDown: (event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								commitEdit();
							} else if (event.key === "Escape") {
								event.preventDefault();
								setEditing(null);
							}
						},
						onBlur: () => {
							commitEdit();
						}
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "tab",
							"aria-selected": active,
							className: "wgTabMain",
							title: pinned ? `${t("tabs.pinned")} · ${tip}` : tip,
							onClick: () => {
								if (Date.now() - dragEndedAt.current < 250) return;
								activate(tab.sessionId);
							},
							onDoubleClick: () => {
								startEdit(tab.sessionId, label);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wgTabStatus",
								"data-tab-state": indicator.attention ? "attention" : indicator.running ? "running" : indicator.unread ? "unread" : indicator.settled ? "settled" : "idle",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: dotState(indicator) })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "wgTabText",
								children: [project !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wgTabProject",
									title: project.path,
									children: project.label
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wgTabLabel",
									children: label
								})]
							})]
						}),
						pinned && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wgTabPin",
							title: t("tabs.pinned"),
							"aria-hidden": true,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillMedium, {})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("tabs.close"),
							side: "top",
							delayMs: 600,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgTabClose",
								"aria-label": `${t("tabs.close")} ${label}`,
								onClick: (event) => {
									event.stopPropagation();
									actions.close(tab.sessionId);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFillMedium, {})
							})
						})
					] })
				}, tab.order);
			});
			const menuTab = menu === null ? void 0 : display.find((tab) => tab.sessionId === menu.sessionId);
			const menuIndex = menuTab === void 0 ? -1 : at(display, menuTab);
			const menuLabel = menuTab === void 0 ? "" : menuTab.title ?? list.byId[menuTab.sessionId]?.displayTitle ?? menuTab.sessionId;
			const menuPinned = menuTab?.pinned === true;
			const canCloseRight = menuIndex >= 0 && menuIndex < display.length - 1;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wgTabs",
				role: "tablist",
				"aria-label": t("tabs.aria"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "wgTabsScroll",
					ref: scrollRef,
					onWheel: (event) => {
						const el = event.currentTarget;
						if (el.scrollWidth <= el.clientWidth) return;
						const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
						if (delta === 0) return;
						const atStart = el.scrollLeft <= 0 && delta < 0;
						const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && delta > 0;
						if (atStart || atEnd) return;
						el.scrollLeft += delta;
						event.preventDefault();
					},
					children: chips
				})
			}), menu !== null && menuTab !== void 0 && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wgTabMenu",
				role: "menu",
				"aria-label": menuLabel,
				style: {
					left: menu.x,
					top: menu.y
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuRow, {
						label: menuPinned ? t("tabs.unpin") : t("tabs.pin"),
						onSelect: () => {
							actions.pin(menu.sessionId);
							setMenu(null);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuRow, {
						label: t("tabs.rename"),
						onSelect: () => {
							startEdit(menu.sessionId, menuLabel);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuRow, {
						label: t("tabs.renameSession"),
						onSelect: () => {
							setMenu(null);
							rename(menu.sessionId, menuLabel);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgTabMenuSeparator",
						role: "separator"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuRow, {
						label: t("tabs.close"),
						onSelect: () => {
							setMenu(null);
							actions.close(menu.sessionId);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuRow, {
						label: t("tabs.closeOthers"),
						onSelect: () => {
							setMenu(null);
							actions.closeOthers(menu.sessionId);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuRow, {
						label: t("tabs.closeRight"),
						disabled: !canCloseRight,
						onSelect: () => {
							setMenu(null);
							actions.closeAfter(menu.sessionId);
						}
					})
				]
			}), document.body)] }), seat);
		}
		/** Index of one tab in the strip, used by the menu's range actions. */
		function at(tabs, target) {
			return tabs.findIndex((tab) => tab.sessionId === target.sessionId);
		}
		// \0dsh-workspace-groups-inline-css:/home/hatch/workspace/dsh-workspace-groups-remote/src/client/styles.css.mjs
		var styles_css_default = ".wgRoot{box-sizing:border-box;flex-direction:column;flex:1;width:100%;min-width:0;min-height:0;display:flex;overflow:hidden}.wgSectionHeader{flex:none;align-items:center;gap:4px;height:36px;padding:0 12px;display:flex}.wgSectionLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:45%;color:var(--dsw-fg-1,inherit);flex:none;font-size:12px;font-weight:600;overflow:hidden}.wgIconButton{width:26px;height:26px;color:var(--dsw-fg-2,inherit);cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex}.wgIconButton:hover{background:var(--dsw-bg-hover,#7f7f7f1f);color:var(--dsw-fg-1,inherit)}.wgIconButton:disabled{opacity:.5;cursor:default}.wgSearch{flex:1;align-items:center;min-width:0;max-width:28px;margin-left:auto;transition:max-width .18s;display:flex}.wgSearchExpanded{max-width:100%}.wgSearchInput{min-width:0;color:var(--dsw-fg-1,inherit);background:0 0;border:none;outline:none;flex:1;padding:0;font-size:12px}.wgTreeBody{flex:1;min-width:0;min-height:0;padding:0 8px 8px;overflow:hidden auto}.wgDock{border-top:1px solid var(--dsw-alias-border-l2,#7f7f7f47);flex-direction:column;flex:0 auto;min-width:0;min-height:84px;max-height:min(62vh,560px);display:flex;overflow:hidden}.wgDockBucket{flex:none;min-width:0;min-height:0;max-height:min(26vh,200px);padding:4px 8px 0;overflow:hidden auto}.wgDockBucket+.wgDefaultWorkspaceBar{border-top:1px solid var(--dsw-alias-border-l2,#7f7f7f47)}.wgRail .wgDock{display:none}.wgDefaultWorkspaceBar{flex-direction:column;flex:auto;min-width:0;min-height:0;padding:6px 8px 8px;display:flex;overflow:hidden}.wgDockSessions{flex:auto;min-width:0;min-height:0;max-height:min(26vh,400px);overflow:hidden auto}.wgDefaultWorkspaceBar .wgProjectRow{flex:none;margin-bottom:2px}.wgTreeWrap,.wgList,.wgRows,.wgRowsInner,.wgTreeChildren{min-width:0;max-width:100%}.wgCategoryRow,.wgProjectRow,.wgFolderRow,.wgSessionRow{box-sizing:border-box;width:100%;min-width:0;max-width:100%}.wgRowActions:last-child{margin-left:auto}.wgList{flex-direction:column;gap:1px;display:flex}.wgEmpty{text-align:center;color:var(--dsw-fg-3,#7f7f7fcc);padding:16px 8px;font-size:12px}.wgCategoryRow{cursor:pointer;user-select:none;border-radius:6px;align-items:center;gap:4px;height:28px;padding:0 4px;display:flex;position:relative}[data-wg-color=red]{--wg-group-tint:#d9534f}[data-wg-color=orange]{--wg-group-tint:#e08a3c}[data-wg-color=amber]{--wg-group-tint:#d9a521}[data-wg-color=green]{--wg-group-tint:#3fa45b}[data-wg-color=teal]{--wg-group-tint:#2f9e93}[data-wg-color=blue]{--wg-group-tint:#4a90d9}[data-wg-color=indigo]{--wg-group-tint:#5b6fd6}[data-wg-color=purple]{--wg-group-tint:#9a63c9}[data-wg-color=pink]{--wg-group-tint:#d4659c}[data-wg-color=gray]{--wg-group-tint:#8a8a8a}.wgCategoryRow[data-wg-color]{box-shadow:inset 2px 0 0 var(--wg-group-tint)}.wgCategoryRow[data-wg-color] .wgCategoryIcon{color:var(--wg-group-tint)}.wgCategoryRow:hover{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgCategoryRow:hover .wgRowActions,.wgCategoryRow:focus-within .wgRowActions{opacity:1}.wgDropTarget{background:var(--dsw-bg-selected,#4a90d92e);outline:1px dashed var(--dsw-accent,#4a90d9);outline-offset:-1px}.wgInsertBefore:before,.wgInsertAfter:after{content:\"\";background:var(--dsw-accent,#4a90d9);height:2px;box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-accent,#4a90d9) 25%, transparent);pointer-events:none;z-index:6;border-radius:1px;position:absolute;left:2px;right:2px}.wgInsertBefore:before{top:-1px}.wgInsertAfter:after{bottom:-1px}.wgChevron{width:14px;height:14px;color:var(--dsw-fg-3,#7f7f7fcc);flex:none;justify-content:center;align-items:center;transition:transform .12s;display:inline-flex}.wgChevronOpen{transform:rotate(90deg)}.wgCategoryIcon{color:var(--dsw-fg-2,inherit);flex:none;justify-content:center;align-items:center;display:inline-flex}.wgCategoryLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-fg-1,inherit);flex:1;font-size:12px;font-weight:600;overflow:hidden}.wgCategoryCount,.wgProjectCount{color:var(--dsw-fg-3,#7f7f7fcc);flex:none;font-size:11px}.wgCategoryGlyph{font-size:12px;line-height:1}.wgCategoryPin{color:var(--dsw-fg-3,#7f7f7fcc);flex:none;display:inline-flex}.wgProjectRow{cursor:pointer;user-select:none;border-radius:6px;align-items:center;gap:4px;height:28px;padding:0 4px 0 20px;display:flex;position:relative}.wgProjectFlat{padding-left:4px}.wgTopLevelArea{margin-top:2px;padding-bottom:10px}.wgTopLevelEmpty{border-radius:4px;height:14px;position:relative}.wgTopLevelEmptyLine{background:var(--dsw-accent,#4a90d9);height:2px;box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-accent,#4a90d9) 25%, transparent);pointer-events:none;border-radius:1px;position:absolute;top:50%;left:2px;right:2px}.wgTopLevelEmptyActive{background:var(--dsw-bg-selected,#4a90d92e)}.wgProjectRow:hover{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgProjectActive .wgProjectLabel{font-weight:700}.wgProjectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));flex:1;font-size:12px;font-weight:500;overflow:hidden}.wgRowActions{opacity:0;flex:none;align-items:center;gap:2px;display:inline-flex}.wgRowTrail{flex:none;place-items:center end;margin-left:auto;display:grid}.wgRowTrail>*{grid-area:1/1}.wgProjectRow:hover .wgRowActions,.wgProjectRow:focus-within .wgRowActions{opacity:1}.wgFolderRow{cursor:pointer;user-select:none;border-radius:6px;align-items:center;gap:4px;height:28px;padding:0 4px 0 38px;display:flex;position:relative}.wgFolderRow:hover{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgFolderRow:hover .wgRowActions,.wgFolderRow:focus-within .wgRowActions{opacity:1}.wgFolderLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));flex:1;font-size:12px;font-weight:500;overflow:hidden}.wgFolderBase .wgFolderLabel{font-weight:600}.wgFolderRoot{color:var(--dsw-accent,#4a90d9);flex:none;font-size:11px;line-height:1}.wgFolderCount{color:var(--dsw-fg-3,#7f7f7fcc);flex:none;font-size:11px}.wgCategoryCount,.wgFolderCount,.wgProjectCount,.wgSessionTime{transition:opacity .12s}.wgCategoryRow:hover .wgCategoryCount,.wgCategoryRow:focus-within .wgCategoryCount,.wgFolderRow:hover .wgFolderCount,.wgFolderRow:focus-within .wgFolderCount,.wgProjectRow:hover .wgProjectCount,.wgProjectRow:focus-within .wgProjectCount,.wgSessionRow:hover .wgSessionTime,.wgSessionRow:focus-within .wgSessionTime{opacity:0;visibility:hidden}.wgSessionNested{padding-left:70px}.wgTreeWrap{position:relative}.wgBranch{z-index:2;pointer-events:none;transition:opacity .12s;position:absolute;top:0;left:0;overflow:visible}.wgTreeWrap:has([data-wg-animating]) .wgBranch{opacity:0}.wgTreeWrap>.wgList{z-index:1;position:relative}.wgFlowerArt{transform-box:fill-box;transform-origin:50%;animation:4s linear infinite paused wg-flower-spin}.wgFlowerSpinning .wgFlowerArt{animation-play-state:running}@keyframes wg-flower-spin{0%{transform:rotate(0)}to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.wgFlowerArt,.wgRowsOpening,.wgRowsClosing{animation:none}.wgBranch{transition:none}}.wgRows{grid-template-rows:1fr;grid-template-columns:minmax(0,1fr);display:grid}.wgRowsInner{min-height:0}.wgRowsOpening{animation:.18s cubic-bezier(.2,.8,.2,1) wg-rows-in}.wgRowsClosing{pointer-events:none;animation:.16s cubic-bezier(.4,0,1,1) forwards wg-rows-out}.wgRowsOpening .wgRowsInner,.wgRowsClosing .wgRowsInner{overflow:hidden}@keyframes wg-rows-in{0%{opacity:.35;grid-template-rows:0fr}to{opacity:1;grid-template-rows:1fr}}@keyframes wg-rows-out{0%{opacity:1;grid-template-rows:1fr}to{opacity:0;grid-template-rows:0fr}}.wgTreeChildren{position:relative}.wgSessionRow{cursor:pointer;user-select:none;border-radius:6px;align-items:center;gap:6px;height:28px;padding:0 4px 0 54px;display:flex}.wgSessionRow:hover{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgSessionRow:hover .wgRowActions,.wgSessionRow:focus-within .wgRowActions{opacity:1}.wgSelected{background:var(--dsw-bg-selected,#4a90d92e)}.wgStatusSlot{flex:none;justify-content:center;align-items:center;width:14px;height:14px;display:inline-flex}.wgSessionTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary,var(--dsw-fg-2,inherit));flex:1;font-size:12px;overflow:hidden}.wgSelected .wgSessionTitle{color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));font-weight:500}.wgSessionTime{color:var(--dsw-fg-3,#7f7f7fcc);flex:none;font-size:11px}.wgVisuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.wgMatched{background:var(--dsw-bg-selected,#4a90d92e)}.wgSessionSnippet{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-fg-3,#7f7f7fcc);flex:1;font-size:11px;overflow:hidden}.wgSearchStatus{color:var(--dsw-fg-3,#7f7f7fcc);text-align:center;padding:8px;font-size:11px}.wgManualError{color:var(--dsw-fg-1,inherit);text-align:left;word-break:break-word}.wgRail{flex-direction:column;align-items:center;gap:12px;padding:8px 0 0;display:flex;overflow:hidden}.wgRail .wgSectionHeader{flex-direction:column;align-self:center;align-items:center;gap:12px;width:36px;height:auto;padding:0}.wgRail .wgIconButton{border-radius:50%;width:36px;height:36px}.wgRail .wgTreeBody{display:none}.wgAddError{color:var(--dsw-fg-1,inherit);white-space:pre-wrap;word-break:break-word;max-height:200px;font-size:12px;overflow-y:auto}.wgRenameInput{border:1px solid var(--dsw-border,#7f7f7f4d);background:var(--dsw-bg-1,transparent);width:100%;color:var(--dsw-fg-1,inherit);border-radius:6px;outline:none;padding:6px 8px;font-size:13px}.wgRenameInput:focus{border-color:var(--dsw-accent,#4a90d9)}.wgFolderBody{flex-direction:column;gap:14px;display:flex}.wgFolderHead{flex-direction:column;gap:2px;min-width:0;display:flex}.wgFolderHeadName{color:var(--dsw-fg-1,inherit);text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;overflow:hidden}.wgFolderHeadPath{color:var(--dsw-alias-label-secondary,inherit);font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,monospace);opacity:.65;text-overflow:ellipsis;white-space:nowrap;font-size:11px;overflow:hidden}.wgFolderSection{flex-direction:column;gap:6px;min-width:0;display:flex}.wgFolderSectionTitle{color:var(--dsw-alias-label-secondary,inherit);letter-spacing:.03em;opacity:.7;font-size:11px;font-weight:600}.wgFolderList{flex-direction:column;gap:4px;max-height:280px;margin:0 -2px;padding:2px;display:flex;overflow:auto}.wgFolderListRow{background:#7f7f7f1a;border:1px solid #0000;border-radius:8px;align-items:center;gap:8px;padding:7px 8px;transition:background .12s,border-color .12s;display:flex}.wgFolderListRow:hover{background:var(--dsw-bg-hover,#7f7f7f2e)}.wgFolderListRow[data-active=true]{border-color:var(--dsw-alias-border-l2,#7f7f7f40);background:var(--dsw-bg-hover,#7f7f7f1f)}.wgFolderRootPick{cursor:pointer;flex:none;align-items:center;display:inline-flex}.wgFolderRadio{appearance:none;border:1.5px solid var(--dsw-alias-border-l2,#7f7f7f80);cursor:pointer;background:0 0;border-radius:50%;place-content:center;width:14px;height:14px;margin:0;transition:border-color .12s;display:grid}.wgFolderRadio:hover,.wgFolderRadio:checked{border-color:var(--dsw-accent,#4a90d9)}.wgFolderRadio:checked:after{content:\"\";background:var(--dsw-accent,#4a90d9);border-radius:50%;width:7px;height:7px}.wgFolderRadio:focus-visible{outline:2px solid var(--dsw-accent,#4a90d9);outline-offset:2px}.wgFolderEntry{flex-direction:column;flex:auto;gap:1px;min-width:0;display:flex}.wgFolderListLabel{color:var(--dsw-fg-1,inherit);text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;font-weight:500;line-height:1.35;overflow:hidden}.wgFolderListPath{color:var(--dsw-alias-label-secondary,inherit);font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,monospace);opacity:.6;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:1.35;overflow:hidden}.wgFolderListTags{flex:none;align-items:center;gap:4px;display:inline-flex}.wgFolderListTag{border:1px solid var(--dsw-alias-border-l2,#7f7f7f40);color:var(--dsw-alias-label-secondary,inherit);white-space:nowrap;border-radius:999px;padding:2px 6px;font-size:10px;line-height:1.4}.wgFolderListTag[data-tone=base]{border-style:dashed}.wgFolderListTag[data-tone=root]{color:var(--dsw-fg-1,inherit);background:#4a90d92e;border-color:#0000}.wgFolderListTag[data-tone=cloud],.wgFolderListTag[data-tone=local]{opacity:.85}.wgFolderListTag[data-tone=danger]{color:#e08a8a;border-color:#d464644d}.wgFolderListActions{opacity:.5;flex:none;align-items:center;gap:2px;transition:opacity .12s;display:inline-flex}.wgFolderListRow:hover .wgFolderListActions,.wgFolderListRow:focus-within .wgFolderListActions{opacity:1}.wgFolderEmpty{border:1px dashed var(--dsw-alias-border-l2,#7f7f7f40);color:var(--dsw-alias-label-secondary,inherit);opacity:.75;border-radius:8px;margin:0;padding:10px 12px;font-size:11.5px;line-height:1.5}.wgFolderConfirm{border:1px solid var(--dsw-alias-border-l2,#7f7f7f40);border-radius:8px;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:4px 0 6px;padding:8px 10px;font-size:11.5px;line-height:1.5;display:flex}.wgFolderConfirmText{flex:220px}.wgFolderConfirmActions{gap:6px;display:flex}.wgFolderConfirmButton{border:1px solid var(--dsw-alias-border-l2,#7f7f7f40);color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:3px 9px}.wgFolderConfirmButton[data-tone=danger]{color:var(--dsw-alias-status-danger,#d13438);border-color:var(--dsw-alias-status-danger,#d13438)}.wgFolderAdd{border-top:1px solid var(--dsw-alias-border-l2,#7f7f7f33);flex-direction:column;gap:8px;padding-top:12px;display:flex}.wgFolderSegmented{background:#7f7f7f29;border-radius:999px;align-self:flex-start;gap:2px;padding:2px;display:inline-flex}.wgFolderTab{color:var(--dsw-alias-label-secondary,inherit);font:inherit;cursor:pointer;white-space:nowrap;background:0 0;border:0;border-radius:999px;padding:4px 12px;font-size:12px;transition:background .12s,color .12s}.wgFolderTab:hover{color:var(--dsw-fg-1,inherit)}.wgFolderTab[aria-selected=true]{color:var(--dsw-fg-1,inherit);background:#ffffff2b;font-weight:600;box-shadow:inset 0 0 0 1px #ffffff1f}.wgFolderLocalPane{flex-direction:column;gap:6px;display:flex}.wgFolderPick{border:1px dashed var(--dsw-alias-border-l2,#7f7f7f59);width:100%;color:var(--dsw-fg-1,inherit);font:inherit;text-align:left;cursor:pointer;white-space:nowrap;background:0 0;border-radius:8px;align-items:center;gap:8px;padding:9px 12px;font-size:12.5px;font-weight:500;transition:border-color .12s,background .12s;display:flex}.wgFolderPick:hover:not(:disabled){border-color:var(--dsw-accent,#4a90d9);background:#4a90d91a}.wgFolderPick:disabled{opacity:.5;cursor:default}.wgFolderPickPlus{color:var(--dsw-accent,#4a90d9);flex:none;font-size:13px;line-height:1}.wgFolderHint{color:var(--dsw-alias-label-secondary,inherit);opacity:.7;margin:0;font-size:11px;line-height:1.55}.wgFolderActions{gap:6px;display:flex}.wgFolderActions>button{justify-content:center;width:100%}.wgFolderStack{flex-direction:column;gap:6px;display:flex}.wgFolderField{align-items:center;display:flex;position:relative}.wgFolderField .wgFolderFieldInput{width:100%;padding-right:30px}.wgFolderFieldAction{width:22px;height:22px;color:var(--dsw-fg-3,#a6abc4);cursor:pointer;background:0 0;border:0;border-radius:5px;justify-content:center;align-items:center;padding:0;display:inline-flex;position:absolute;top:50%;right:4px;transform:translateY(-50%)}.wgFolderFieldAction:hover:not(:disabled){background:var(--dsw-bg-hover,#ffffff1f);color:var(--dsw-fg-1,inherit)}.wgFolderFieldAction:disabled{opacity:.4;cursor:default}.wgFolderAddRow{align-items:center;gap:6px;margin-top:6px;display:flex}.wgFolderAddRow>button{white-space:nowrap;flex:none}.wgFolderNote{color:var(--dsw-alias-label-secondary,inherit);opacity:.8;margin:0;font-size:11px;line-height:1.5}.wgRemoteBar{align-items:center;gap:6px;margin-bottom:8px;display:flex}.wgRemotePath{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-family:var(--dsw-font-mono,ui-monospace,monospace);color:var(--dsw-fg-1,inherit);flex:auto;font-size:12px;overflow:hidden}.wgRemoteActions{flex:none;gap:4px;display:inline-flex}.wgRemoteList{border:1px solid var(--dsw-alias-border-l2,#7f7f7f33);border-radius:8px;max-height:260px;margin:0 0 8px;padding:4px;overflow:auto}.wgRemoteRow{width:100%;color:var(--dsw-fg-1,inherit);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:6px;align-items:center;gap:6px;padding:5px 6px;font-size:12px;display:flex}.wgRemoteRow:hover{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgRemoteName{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.wgFolderSelect{flex:auto;width:100%;min-width:0}.wgFolderSubpathInput{border:1px solid var(--dsw-alias-border-l2,#7f7f7f40);background:var(--dsw-alias-bg-base,transparent);min-width:0;color:inherit;font:inherit;border-radius:6px;flex:auto;padding:4px 8px;font-size:13px}.wgFolderSubpathInput:focus{border-color:var(--dsw-alias-label-primary,currentColor);outline:none}.wgAppearanceBody{flex-direction:column;gap:16px;display:flex}.wgAppearanceDialog{max-height:100%}.wgAppearanceContent{min-height:0;overflow:hidden auto}.wgAppearanceContent>:first-child{z-index:1;background:var(--dsw-alias-bg-layer-2,transparent);position:sticky;top:0}.wgAppearanceSection{flex-direction:column;gap:6px;display:flex}.wgAppearanceLabel{color:var(--dsw-fg-3,#7f7f7fcc);font-size:11px;font-weight:600}.wgSwatchRow{flex-wrap:wrap;gap:6px;display:flex}.wgSwatch{cursor:pointer;border:1px solid var(--dsw-alias-border-l2,#7f7f7f47);border-radius:5px;width:20px;height:20px;padding:0}.wgSwatch[data-wg-color]{background:var(--wg-group-tint)}.wgSwatch:disabled{cursor:default;opacity:.5}.wgSwatchActive{outline:2px solid var(--dsw-accent,#4a90d9);outline-offset:1px}.wgSwatchDefault{background:var(--dsw-bg-hover,#7f7f7f1f)}.wgIconSections{scrollbar-gutter:stable;flex-direction:column;gap:10px;max-height:216px;padding:4px;display:flex;overflow-y:auto}.wgIconSection{flex-direction:column;gap:4px;display:flex}.wgIconSectionLabel{color:var(--dsw-fg-3,#7f7f7fcc);font-size:11px;font-weight:600;line-height:14px}.wgIconGrid{grid-template-columns:repeat(auto-fill,minmax(28px,1fr));gap:4px;padding:1px;display:grid}.wgEmojiGrid .wgIconCell{font-size:18px}.wgIconCustom{align-items:center;gap:8px;margin-top:2px;display:flex}.wgIconCustom .wgRenameInput{flex:1;min-width:0}.wgIconCell.wgIconDefault{width:auto;padding:0 8px}.wgIconCell{cursor:pointer;color:var(--dsw-fg-2,inherit);background:0 0;border:0;border-radius:5px;justify-content:center;align-items:center;width:28px;height:28px;padding:0;display:inline-flex}.wgIconCell:hover:not(:disabled){background:var(--dsw-bg-hover,#7f7f7f1f)}.wgIconCell[aria-pressed=true]{background:var(--dsw-bg-selected,#4a90d92e);box-shadow:inset 0 0 0 1px var(--dsw-accent,#4a90d9)}.wgIconCell:focus-visible{outline:2px solid var(--dsw-accent,#4a90d9);outline-offset:1px}.wgIconCell:disabled{cursor:default;opacity:.5}.wgQuickOverlay{z-index:1100;background:var(--dsw-alias-bg-mask-1,#00000052);backdrop-filter:var(--dsw-mask-blur,blur(2px));justify-content:center;align-items:flex-start;padding:10vh 24px 24px;display:flex;position:fixed;inset:0}.wgQuickCard{border:1px solid var(--dsw-border,#7f7f7f33);background:var(--dsw-alias-bg-layer-2,var(--dsw-bg-1,#fff));width:min(640px,100%);max-height:min(560px,90vh - 48px);box-shadow:var(--dsw-elevation-prominent,0 16px 48px #00000040);box-sizing:border-box;border-radius:12px;flex-direction:column;gap:10px;padding:14px;display:flex;overflow:hidden}.wgQuickHeader{flex:none;justify-content:space-between;align-items:center;gap:12px;display:flex}.wgQuickTitle{color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));font-size:13px;font-weight:600}.wgQuickTabs{gap:2px;display:flex}.wgQuickTab{color:var(--dsw-alias-label-secondary,var(--dsw-fg-2,inherit));cursor:pointer;background:0 0;border:none;border-radius:6px;align-items:center;gap:6px;padding:4px 12px;font-family:inherit;font-size:12px;display:inline-flex}.wgQuickTab:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgQuickTabActive{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-selected,#4a90d92e));color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));font-weight:600}.wgQuickTabCount{background:var(--dsw-accent,#4a90d9);color:#fff;text-align:center;border-radius:8px;min-width:16px;height:16px;padding:0 4px;font-size:10px;font-weight:600;line-height:16px}.wgQuickSearchWrap{flex:none}.wgQuickSearch{border:1px solid var(--dsw-border,#7f7f7f4d);background:var(--dsw-bg-1,transparent);width:100%;height:34px;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));box-sizing:border-box;border-radius:8px;outline:none;padding:0 10px;font-family:inherit;font-size:13px}.wgQuickSearch:focus{border-color:var(--dsw-accent,#4a90d9)}.wgQuickList{flex-direction:column;flex:auto;gap:2px;min-height:64px;padding-right:2px;display:flex;overflow-y:auto}.wgQuickRow{cursor:pointer;text-align:left;box-sizing:border-box;background:0 0;border:none;border-radius:8px;flex-direction:column;flex:none;gap:2px;width:100%;padding:7px 10px;font-family:inherit;display:flex}.wgQuickRow:hover,.wgQuickRowActive{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgQuickRowSelected,.wgQuickRowCurrent{background:var(--dsw-bg-selected,#4a90d92e)}.wgQuickRowMain{align-items:center;gap:8px;width:100%;min-width:0;display:flex}.wgQuickRowTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));flex:1;font-size:13px;font-weight:500;overflow:hidden}.wgQuickRunBadge{color:var(--dsw-accent,#4a90d9);flex:none;font-size:11px}.wgQuickTime{color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,#7f7f7fcc));flex:none;font-size:11px}.wgQuickRowSub{min-width:0;display:flex}.wgQuickRowPath{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,#7f7f7fcc));flex:1;font-size:11px;overflow:hidden}.wgQuickEmpty{text-align:center;color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,#7f7f7fcc));padding:24px 8px;font-size:12px}.wgQuickFooter{flex:none;align-items:center;gap:8px;padding-top:2px;display:flex}.wgQuickSelected{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,#7f7f7fcc));flex:1;font-size:12px;overflow:hidden}.wgQuickHint{text-align:center;color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,#7f7f7fcc));flex:none;font-size:11px}.wgTabs{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2,#7f7f7f33);background:0 0;flex:none;align-items:stretch;gap:4px;min-width:0;height:56px;padding:8px 10px;display:flex}.wgTabsScroll{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;box-sizing:border-box;flex:auto;align-items:stretch;gap:6px;min-width:0;padding:1px 0;display:flex;overflow:auto hidden}.wgTabsScroll::-webkit-scrollbar{width:0;height:0;display:none}.wgTab{min-width:0;max-width:240px;box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2,#7f7f7f2e);color:var(--dsw-alias-label-secondary,var(--dsw-fg-2,inherit));border-radius:8px;flex:none;align-items:center;padding:0 6px 0 10px;transition:background .12s,box-shadow .12s;display:inline-flex}.wgTabText{flex-direction:column;flex:auto;justify-content:center;align-items:flex-start;gap:3px;min-width:0;height:100%;display:flex}.wgTabProject{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:100%;font-family:var(--dsw-font-mono,ui-monospace, SFMono-Regular, Menlo, monospace);letter-spacing:.02em;color:var(--dsw-alias-label-secondary,var(--dsw-fg-3,inherit));opacity:.85;flex:none;font-size:10px;line-height:13px;overflow:hidden}.wgTab:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgTabActive{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f));box-shadow:inset 0 0 0 1px var(--dsw-alias-label-secondary,#7f7f7f73);color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit))}.wgTabActive .wgTabProject{opacity:1}.wgTabMain{box-sizing:border-box;min-width:0;height:100%;color:inherit;cursor:pointer;background:0 0;border:none;flex:auto;align-items:center;gap:8px;padding:6px 0;font-family:inherit;font-size:12px;display:inline-flex}.wgTabStatus{flex:none;justify-content:center;align-items:center;width:12px;height:12px;display:inline-flex}.wgTabStatus[data-tab-state=idle]{opacity:.45}.wgTabLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:100%;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));flex:none;font-size:12px;line-height:16px;overflow:hidden}.wgTabText>.wgTabLabel:only-child{align-self:center}.wgTabClose{width:20px;height:20px;color:inherit;cursor:pointer;opacity:0;background:0 0;border:none;border-radius:5px;flex:none;justify-content:center;align-items:center;margin-left:2px;padding:0;transition:opacity .12s,background .12s;display:inline-flex}.wgTab:hover .wgTabClose,.wgTab:focus-within .wgTabClose,.wgTabActive .wgTabClose{opacity:1}.wgTabClose:hover{background:var(--dsw-alias-interactive-bg-hover-solid,#7f7f7f33)}.wgTab{position:relative}.wgTabPinned{box-shadow:inset 0 0 0 1px var(--dsw-alias-label-secondary,#7f7f7f73)}.wgTabPin{opacity:.55;width:12px;height:12px;color:inherit;flex:none;justify-content:center;align-items:center;margin-left:4px;display:inline-flex}.wgTabDragging{opacity:.42}.wgTabDropBefore:before,.wgTabDropAfter:before{content:\"\";background:var(--dsw-alias-label-primary,var(--dsw-fg-1,#4a90d9));border-radius:2px;width:2px;position:absolute;top:2px;bottom:2px}.wgTabDropBefore:before{left:-4px}.wgTabDropAfter:before{right:-4px}.wgTabRename{box-sizing:border-box;min-width:88px;height:100%;color:inherit;background:var(--dsw-alias-bg-elevated,var(--dsw-bg-1,transparent));border:1px solid var(--dsw-alias-label-secondary,#7f7f7f73);border-radius:6px;outline:none;flex:auto;margin:2px 0;padding:0 6px;font-family:inherit;font-size:12px}.wgTabMenu{z-index:2147483000;box-sizing:border-box;background:var(--dsw-alias-bg-popup,var(--dsw-bg-2,#1e1e1e));border:1px solid var(--dsw-alias-border-l2,#7f7f7f33);border-radius:8px;flex-direction:column;min-width:196px;padding:4px;display:flex;position:fixed;box-shadow:0 8px 24px #0003,0 1px 2px #0000001f}.wgTabMenuItem{width:100%;color:var(--dsw-alias-label-primary,var(--dsw-fg-1,inherit));text-align:left;cursor:pointer;background:0 0;border:none;border-radius:5px;padding:6px 10px;font-family:inherit;font-size:12px;line-height:16px}.wgTabMenuItem:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-bg-hover,#7f7f7f1f))}.wgTabMenuItem:disabled{cursor:default;opacity:.4}.wgTabMenuDanger{color:var(--dsw-alias-label-error,var(--dsw-fg-error,#d9534f))}.wgTabMenuSeparator{background:var(--dsw-alias-border-l2,#7f7f7f33);height:1px;margin:4px 6px}";
		// src/client/GroupsBrowser.tsx
		/**
		* The workspace-groups browsing region filling the sidebar shell's
		* `sidebar.workspaces` hole: section header (title + right-aligned search +
		* new-group + add workspace), the three-level tree (category —workspace — * session), group management dialogs, and the workspace/session dialogs. Wide
		* state renders the full browser; rail state renders the two region icons
		* (search / add workspace) as 36px controls on the shell's shared rail entry
		* path, each requesting expansion through the owner share.
		*
		* Data: workspaces/sessions via the framework global hooks; grouping config
		* via the host half's `/workspace-groups/config` route (refetched on mount).
		* Runtime group management (create/rename/delete any group, drag workspaces
		* between groups and into position, drag groups into position) persists
		* through `PUT /workspace-groups/manual`; the sidecar YAML is never rewritten
		* (rule-group rename/delete ride the overlay `renamed`/`hidden` maps).
		*/
		const SEARCH_DEBOUNCE_MS = 250;
		const SEARCH_QUERY_MAX_CODE_UNITS = 500;
		const EMPTY_MANUAL = {
			revision: 0,
			categories: [],
			assignments: {},
			categoryOrder: [],
			workspaceOrder: {},
			renamed: {},
			hidden: [],
			appearance: {}
		};
		/** Materialize optional overlay fields so every update is a plain object edit. */
		function normalizeManual(manual) {
			return {
				revision: manual.revision ?? 0,
				categories: manual.categories,
				assignments: manual.assignments,
				categoryOrder: manual.categoryOrder ?? [],
				workspaceOrder: manual.workspaceOrder ?? {},
				renamed: manual.renamed ?? {},
				hidden: manual.hidden ?? [],
				appearance: manual.appearance ?? {}
			};
		}
		/**
		* Largest subtree (rows including the level header) that still animates: a
		* 100-session project expanding with a grid animation janks the sidebar, so
		* wide subtrees snap open instead.
		*/
		const ANIMATION_ROW_CAP = 40;
		/**
		* Mirrors the host icon validator (`parseAppearance`) so invalid custom glyphs
		* fail locally instead of turning the whole overlay PUT into a 400.
		*/
		const ICON_VALUE_PATTERN = /^(?:[a-z][a-z0-9-]{0,23}|[^\s\u0000-\u001f\u007f]{1,4})$/u;
		/** Rows a group reveals when expanded (projects + their visible sessions). */
		function categoryRowCount(category) {
			return category.workspaces.reduce((total, workspace) => total + 1 + (workspace.expanded ? workspace.sessions.length : 0), 0);
		}
		/** Palette id —i18n key for the colour picker (keeps literal key types intact). */
		const COLOR_LABEL_KEYS = {
			red: "color.red",
			orange: "color.orange",
			amber: "color.amber",
			green: "color.green",
			teal: "color.teal",
			blue: "color.blue",
			indigo: "color.indigo",
			purple: "color.purple",
			pink: "color.pink",
			gray: "color.gray"
		};
		/** Research icon ids, matched against the shared registry for the picker split. */
		const SCIENCE_ICON_ID_SET = new Set(SCIENCE_ICON_IDS);
		/** Picker section key —i18n key (keeps literal key types intact). */
		const SCIENCE_SECTION_LABEL_KEYS = {
			lab: "group.icon.section.lab",
			materials: "group.icon.section.materials",
			characterization: "group.icon.section.characterization",
			devices: "group.icon.section.devices"
		};
		/** The pre-existing glyphs, shown as the picker's "common" section. */
		const COMMON_ICON_IDS = GROUP_ICON_IDS.filter((id) => !SCIENCE_ICON_ID_SET.has(id));
		/**
		* The same workspace node without its extra folders and session rows: used
		* while searching, so the pinned default-workspace bar never paints unrelated
		* sessions next to pruned search results.
		*/
		function withoutSessions(node) {
			return {
				workspaceId: node.workspaceId,
				path: node.path,
				label: node.label,
				createdAt: node.createdAt,
				sessionCount: node.sessionCount,
				expanded: node.expanded,
				containsCurrent: node.containsCurrent,
				sessions: []
			};
		}
		/**
		* Split the derived categories into the tree and the docked "not classified
		* yet" bucket (see isDockedCategoryKey). The bucket keeps its own row and
		* children, only its position moves to the bottom dock.
		*/
		function splitDockedCategory(categories) {
			const docked = categories.find((category) => isDockedCategoryKey(category.key));
			return {
				treeGroups: docked === void 0 ? categories : categories.filter((category) => category !== docked),
				dockedCategory: docked
			};
		}
		/** Whether a workspace node (or one of its folder rows) holds a matched session. */
		function workspaceHasMatchedSession(workspace, matched) {
			if (workspace.sessions.some((session) => matched.has(session.id))) return true;
			return workspace.folders?.some((folder) => folder.sessions.some((session) => matched.has(session.id))) ?? false;
		}
		function sanitizeSearchQuery(value) {
			const withoutNul = value.replaceAll("\0", "");
			if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul;
			return withoutNul.slice(0, SEARCH_QUERY_MAX_CODE_UNITS);
		}
		/** Light runtime guard for the manual overlay attached to the config fetch. */
		function isManualGroups(value) {
			if (typeof value !== "object" || value === null) return false;
			const candidate = value;
			return Array.isArray(candidate.categories) && typeof candidate.assignments === "object" && candidate.assignments !== null;
		}
		/** Minimal fetch of the grouping config + runtime overlay (no-cache revalidation). */
		async function fetchGroupsConfig() {
			const response = await fetch("/workspace-groups/config", { cache: "no-cache" });
			if (!response.ok) throw new Error(`config request failed: ${response.status}`);
			const body = await response.json();
			return {
				config: Array.isArray(body.categories) ? body : { categories: [] },
				manual: isManualGroups(body.manual) ? normalizeManual(body.manual) : EMPTY_MANUAL
			};
		}
		/** A manual-overlay save rejected because another window wrote first (HTTP 409). */
		var ManualConflictError = class extends Error {
			current;
			constructor(current, message = "group changes changed in another window") {
				super(message);
				this.name = "ManualConflictError";
				this.current = current;
			}
		};
		/**
		* Persist the whole runtime overlay (idempotent; the host validates + writes).
		* Resolves with the overlay as stored (host echo, revision bumped) so callers
		* adopt it instead of their own pre-save copy; a stale write rejects with
		* {@link ManualConflictError} carrying the host's current overlay.
		*/
		async function saveManualOverlay(manual) {
			const response = await fetch("/workspace-groups/manual", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(manual)
			});
			if (response.status === 409) {
				const body = await response.json().catch(() => null);
				throw new ManualConflictError(typeof body === "object" && body !== null && isManualGroups(body.manual) ? body.manual : {
					categories: [],
					assignments: {}
				});
			}
			if (!response.ok) {
				let message = `manual save failed: ${response.status}`;
				try {
					const text = await response.text();
					if (text !== "") message = text;
				} catch {}
				throw new Error(message);
			}
			const body = await response.json().catch(() => null);
			return (typeof body === "object" && body !== null && isManualGroups(body.manual) ? body.manual : null) ?? manual;
		}
		/**
		* Render the browsing region.
		* @param props - composed slot props (shell owner share + store + injected actions).
		* @returns the region element tree.
		*/
		function GroupsBrowser({ wide, expandSidebar, useSessions, useWorkspaces, useSessionStatus, useStore, actions, startSession, createSessionIn, open, renameSession, forkSession, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, archiveSession, insertSessionBefore, createWorkspace, pickDirectory, getDirectoryFlow, createDirectory, searchSessions, searchResultLimit, openTab, useTabs, tabActions, t }) {
			(0, react.useEffect)(() => {
				const style = document.createElement("style");
				style.setAttribute("data-plugin", "dsh-workspace-groups");
				style.textContent = styles_css_default;
				document.head.append(style);
				return () => {
					style.remove();
				};
			}, []);
			const [quickOpen, setQuickOpen] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				const onKeyDown = (e) => {
					if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && (e.key === "r" || e.key === "R")) {
						e.preventDefault();
						e.stopPropagation();
						setQuickOpen((v) => !v);
					}
				};
				window.addEventListener("keydown", onKeyDown, true);
				return () => window.removeEventListener("keydown", onKeyDown, true);
			}, []);
			const [config, setConfig] = (0, react.useState)({ categories: [] });
			const [manual, setManual] = (0, react.useState)(EMPTY_MANUAL);
			const [configError, setConfigError] = (0, react.useState)(null);
			const reloadConfig = () => {
				setConfigError(null);
				fetchGroupsConfig().then(({ config: nextConfig, manual: nextManual }) => {
					setConfig(nextConfig);
					setManual(nextManual);
				}).catch((reason) => {
					setConfigError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			(0, react.useEffect)(() => {
				reloadConfig();
			}, []);
			const [manualError, setManualError] = (0, react.useState)(null);
			const [manualSaving, setManualSaving] = (0, react.useState)(false);
			const [foldersDoc, setFoldersDoc] = (0, react.useState)(EMPTY_FOLDERS_DOCUMENT);
			const [collapsedFolderKeys, setCollapsedFolderKeys] = (0, react.useState)([]);
			const [foldersTarget, setFoldersTarget] = (0, react.useState)(null);
			const [foldersBusy, setFoldersBusy] = (0, react.useState)(false);
			const createdFolderPendingSave = (0, react.useRef)(null);
			const [creatingSessionIn, setCreatingSessionIn] = (0, react.useState)(null);
			const [foldersRemoteBase, setFoldersRemoteBase] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let cancelled = false;
				loadFolders().then((snapshot) => {
					if (cancelled) return;
					setFoldersDoc(snapshot.document);
					setFoldersRemoteBase(snapshot.remoteBase ?? null);
				});
				return () => {
					cancelled = true;
				};
			}, []);
			const workspaces = useWorkspaces((state) => state.items);
			const workspacePhase = useWorkspaces((state) => state.phase);
			const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
			const categoryExpansion = useStore((s) => s.categoryExpansion);
			const workspaceExpansion = useStore((s) => s.workspaceExpansion);
			const list = useSessions((s) => s);
			const statuses = useSessionStatus((s) => s);
			const current = currentSessionId(list);
			const members = (0, react.useMemo)(() => memberWorkspaces(workspaces, foldersDoc), [workspaces, foldersDoc]);
			const visibleWorkspaces = (0, react.useMemo)(() => workspaces.filter((w) => !members.absorbed.has(w.workspaceId)), [workspaces, members]);
			const currentWorkspaceKey = (0, react.useMemo)(() => {
				if (current === void 0) return void 0;
				const owner = workspaces.find((w) => w.sessionIds.includes(current))?.workspaceId;
				if (owner === void 0) return void 0;
				return members.absorbed.get(owner) ?? owner;
			}, [
				current,
				workspaces,
				members
			]);
			(0, react.useEffect)(() => {
				if (current === void 0 || currentWorkspaceKey === void 0) return;
				const category = categoriesForCurrent(config, workspaces, current, manual);
				if (category !== void 0 && !Object.hasOwn(categoryExpansion, category)) actions.setCategoryExpanded(category, true);
				if (!Object.hasOwn(workspaceExpansion, currentWorkspaceKey)) actions.setWorkspaceExpanded(currentWorkspaceKey, true);
			}, [
				current,
				currentWorkspaceKey,
				config,
				workspaces,
				manual,
				categoryExpansion,
				workspaceExpansion,
				actions
			]);
			(0, react.useEffect)(() => {
				if (workspacePhase !== "ready") return;
				actions.retainKeys(displayCategoryKeys(config, manual), workspaces.map((w) => w.workspaceId));
			}, [
				actions,
				config,
				manual,
				workspacePhase,
				workspaces
			]);
			(0, react.useEffect)(() => {
				if (current === void 0) return;
				openTab(current, statuses.get(current));
			}, [
				current,
				list,
				statuses,
				openTab
			]);
			const [query, setQuery] = (0, react.useState)("");
			const [searchExpanded, setSearchExpanded] = (0, react.useState)(false);
			const normalizedQuery = sanitizeSearchQuery(query).trim();
			const [remoteSearch, setRemoteSearch] = (0, react.useState)({
				query: "",
				status: "idle",
				items: [],
				hasMore: false
			});
			const searchInput = (0, react.useRef)(null);
			const searchRoot = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (normalizedQuery === "") {
					setRemoteSearch({
						query: "",
						status: "idle",
						items: [],
						hasMore: false
					});
					return;
				}
				const controller = new AbortController();
				setRemoteSearch({
					query: normalizedQuery,
					status: "loading",
					items: [],
					hasMore: false
				});
				const timer = window.setTimeout(() => {
					searchSessions(normalizedQuery, controller.signal).then((result) => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "ready",
							items: result.items,
							hasMore: result.hasMore
						});
					}).catch(() => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "error",
							items: [],
							hasMore: false
						});
					});
				}, SEARCH_DEBOUNCE_MS);
				return () => {
					window.clearTimeout(timer);
					controller.abort();
				};
			}, [normalizedQuery, searchSessions]);
			(0, react.useEffect)(() => {
				if (!wide || !searchExpanded) return;
				const onClick = (event) => {
					if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return;
					searchInput.current?.blur();
					if (normalizedQuery !== "") return;
					setSearchExpanded(false);
				};
				document.addEventListener("click", onClick);
				return () => {
					document.removeEventListener("click", onClick);
				};
			}, [
				normalizedQuery,
				wide,
				searchExpanded
			]);
			const expandedCategories = (0, react.useMemo)(() => Object.entries(categoryExpansion).filter(([, v]) => v).map(([k]) => k), [categoryExpansion]);
			const expandedWorkspaces = (0, react.useMemo)(() => Object.entries(workspaceExpansion).filter(([, v]) => v).map(([k]) => k), [workspaceExpansion]);
			const [dragging, setDragging] = (0, react.useState)(null);
			const groups = (0, react.useMemo)(() => deriveGroups(list, workspaces, archivedSessionIds, config, {
				expandedCategories,
				expandedWorkspaces,
				collapsedFolders: collapsedFolderKeys
			}, manual, statuses, foldersDoc), [
				list,
				workspaces,
				archivedSessionIds,
				config,
				manual,
				statuses,
				expandedCategories,
				expandedWorkspaces,
				collapsedFolderKeys,
				foldersDoc
			]);
			const topLevel = (0, react.useMemo)(() => deriveTopLevel(list, workspaces, archivedSessionIds, config, {
				expandedCategories,
				expandedWorkspaces,
				collapsedFolders: collapsedFolderKeys
			}, manual, statuses, foldersDoc), [
				list,
				workspaces,
				archivedSessionIds,
				config,
				manual,
				statuses,
				expandedCategories,
				expandedWorkspaces,
				collapsedFolderKeys,
				foldersDoc
			]);
			const defaultWorkspace = (0, react.useMemo)(() => deriveDefaultWorkspace(list, workspaces, archivedSessionIds, {
				expandedCategories,
				expandedWorkspaces,
				collapsedFolders: collapsedFolderKeys
			}, statuses, foldersDoc), [
				list,
				workspaces,
				archivedSessionIds,
				statuses,
				foldersDoc,
				expandedCategories,
				expandedWorkspaces,
				collapsedFolderKeys
			]);
			const activeRemoteSearch = (0, react.useMemo)(() => remoteSearch.query === normalizedQuery ? remoteSearch : {
				query: normalizedQuery,
				status: "loading",
				items: [],
				hasMore: false
			}, [remoteSearch, normalizedQuery]);
			const searchMatches = (0, react.useMemo)(() => normalizedQuery === "" ? void 0 : deriveSearchMatches(list, workspaces, config, normalizedQuery, archivedSessionIds, activeRemoteSearch, searchResultLimit, foldersDoc), [
				list,
				workspaces,
				config,
				normalizedQuery,
				archivedSessionIds,
				activeRemoteSearch,
				searchResultLimit,
				foldersDoc
			]);
			const searchTree = (0, react.useMemo)(() => searchMatches === void 0 ? void 0 : deriveSearchGroups(list, workspaces, config, searchMatches.matchedIds, archivedSessionIds, manual, searchMatches.snippetsBySession, statuses, foldersDoc), [
				list,
				workspaces,
				config,
				searchMatches,
				archivedSessionIds,
				manual,
				statuses,
				foldersDoc
			]);
			const { treeGroups, dockedCategory } = (0, react.useMemo)(() => splitDockedCategory(groups), [groups]);
			const searchDockCategory = (0, react.useMemo)(() => {
				if (searchTree === void 0 || searchMatches === void 0) return void 0;
				const docked = searchTree.categories.find((category) => isDockedCategoryKey(category.key));
				if (docked === void 0) return void 0;
				const workspaces = docked.workspaces.filter((workspace) => workspaceHasMatchedSession(workspace, searchMatches.matchedIds));
				return workspaces.length === 0 ? void 0 : {
					...docked,
					workspaces
				};
			}, [searchTree, searchMatches]);
			const searchTreeForBody = (0, react.useMemo)(() => searchTree === void 0 ? void 0 : {
				...searchTree,
				categories: searchTree.categories.filter((category) => !isDockedCategoryKey(category.key))
			}, [searchTree]);
			const categoryByWorkspace = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const category of groups) for (const workspace of category.workspaces) map.set(workspace.workspaceId, category.label);
				return map;
			}, [groups]);
			const topLevelDropActive = dragging === "workspace" && topLevel.length === 0;
			const topLevelRef = {
				kind: "topLevel",
				key: UNCATEGORIZED_KEY
			};
			const [directoryFlowOpen, setDirectoryFlowOpen] = (0, react.useState)(false);
			const [directoryFlow, setDirectoryFlow] = (0, react.useState)(null);
			const DirectoryFlow = directoryFlow?.component;
			const directoryRequest = (0, react.useRef)(null);
			const finishDirectoryFlow = (path, error) => {
				const pending = directoryRequest.current;
				directoryRequest.current = null;
				setDirectoryFlowOpen(false);
				if (error !== void 0) pending?.reject(new Error(error));
				else pending?.resolve(path);
			};
			(0, react.useEffect)(() => () => {
				directoryRequest.current?.resolve(null);
				directoryRequest.current = null;
			}, []);
			const pickWorkspaceDirectory = () => {
				const flow = getDirectoryFlow();
				if (!flow) return pickDirectory();
				if (directoryRequest.current) return Promise.resolve(null);
				setDirectoryFlow(flow);
				return new Promise((resolve, reject) => {
					directoryRequest.current = {
						resolve,
						reject
					};
					setDirectoryFlowOpen(true);
				});
			};
			const [adding, setAdding] = (0, react.useState)(false);
			const [addError, setAddError] = (0, react.useState)(null);
			const [addErrorOpen, setAddErrorOpen] = (0, react.useState)(false);
			const addCategoryRef = (0, react.useRef)(void 0);
			const currentGrouping = (0, react.useRef)({
				manual,
				groups,
				manualSaving
			});
			currentGrouping.current = {
				manual,
				groups,
				manualSaving
			};
			const addWorkspace = async (categoryKey) => {
				if (adding || manualSaving) return;
				addCategoryRef.current = categoryKey;
				setAdding(true);
				setAddError(null);
				setAddErrorOpen(false);
				try {
					const path = await pickWorkspaceDirectory();
					if (path === null) return;
					const workspace = await createWorkspace({ path });
					if (categoryKey !== void 0) {
						const latest = currentGrouping.current;
						if (latest.manualSaving || !latest.groups.some((group) => group.key === categoryKey)) throw new Error("The group changed while adding the workspace. Please retry from the target group.");
						const workspaceId = workspace.workspaceId;
						const workspaceOrder = Object.fromEntries(Object.entries(latest.manual.workspaceOrder).map(([key, ids]) => [key, ids.filter((id) => id !== workspaceId)]));
						workspaceOrder[categoryKey] = [...workspaceOrder[categoryKey] ?? [], workspaceId];
						const next = {
							...latest.manual,
							assignments: {
								...latest.manual.assignments,
								[workspaceId]: categoryKey
							},
							workspaceOrder
						};
						setManualSaving(true);
						try {
							await persistManual(next);
							actions.setCategoryExpanded(categoryKey, true);
						} finally {
							setManualSaving(false);
						}
					}
					startSession(workspace.workspaceId);
				} catch (reason) {
					const message = reason instanceof Error ? reason.message : String(reason);
					setAddError(message);
					setAddErrorOpen(true);
				} finally {
					setAdding(false);
				}
			};
			const [renameTarget, setRenameTarget] = (0, react.useState)(null);
			const [renameDraft, setRenameDraft] = (0, react.useState)("");
			const [renaming, setRenaming] = (0, react.useState)(false);
			const [renameError, setRenameError] = (0, react.useState)(null);
			const renameTrimmed = renameDraft.trim();
			const renameDuplicate = renameTarget !== null && renameTrimmed !== "" && renameTrimmed !== renameTarget.currentTitle && workspaces.some((w) => w.title === renameTrimmed);
			const renameBlocked = renaming || renameTrimmed === "" || renameTarget === null || renameTrimmed === renameTarget.currentTitle || renameDuplicate;
			const confirmRename = () => {
				if (renameBlocked || renameTarget === null) return;
				setRenaming(true);
				setRenameError(null);
				renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
					setRenaming(false);
					setRenameTarget(null);
				}).catch((reason) => {
					setRenaming(false);
					setRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [deleteTarget, setDeleteTarget] = (0, react.useState)(null);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const [deleteError, setDeleteError] = (0, react.useState)(null);
			const confirmDelete = () => {
				if (deleting || deleteTarget === null) return;
				setDeleting(true);
				setDeleteError(null);
				deleteWorkspace(deleteTarget.workspaceId).then(() => {
					setDeleting(false);
					setDeleteTarget(null);
				}).catch((reason) => {
					setDeleting(false);
					setDeleteError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [sessionRenameTarget, setSessionRenameTarget] = (0, react.useState)(null);
			const [sessionRenameDraft, setSessionRenameDraft] = (0, react.useState)("");
			const [sessionRenaming, setSessionRenaming] = (0, react.useState)(false);
			const [sessionRenameError, setSessionRenameError] = (0, react.useState)(null);
			const sessionRenameTrimmed = sessionRenameDraft.trim();
			const sessionRenameBlocked = sessionRenaming || sessionRenameTrimmed === "" || sessionRenameTarget === null;
			const confirmSessionRename = () => {
				if (sessionRenameBlocked || sessionRenameTarget === null) return;
				setSessionRenaming(true);
				setSessionRenameError(null);
				renameSession(sessionRenameTarget.sessionId, sessionRenameTrimmed).then(() => {
					setSessionRenaming(false);
					setSessionRenameTarget(null);
				}).catch((reason) => {
					setSessionRenaming(false);
					setSessionRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const onSessionRename = (sessionId, currentTitle) => {
				setSessionRenameTarget({
					sessionId,
					currentTitle
				});
				setSessionRenameDraft(currentTitle);
				setSessionRenameError(null);
			};
			const activateTab = (sessionId) => {
				open(sessionId);
			};
			const onSessionArchive = (sessionId) => {
				archiveSession(sessionId).catch((reason) => {
					console.warn("session archive rejected:", reason);
				});
			};
			const [folderApp, setFolderApp] = (0, react.useState)(void 0);
			const [folderError, setFolderError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				fetchOpenInApps(controller.signal).then((apps) => {
					if (controller.signal.aborted) return;
					setFolderApp(folderAppId(apps));
				}).catch(() => {});
				return () => {
					controller.abort();
				};
			}, []);
			const openInFolder = folderApp === void 0 ? void 0 : (workspaceId) => {
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) return;
				openPathInApp(folderApp, workspace.path).catch((reason) => {
					const detail = reason instanceof Error ? reason.message : String(reason);
					setFolderError({
						id: Date.now(),
						text: `${t("workspace.openInFolderError")}: ${detail}`
					});
				});
			};
			const notifyFolder = (text) => {
				setFolderError({
					id: Date.now(),
					text
				});
			};
			const persistFolders = (next) => {
				setFoldersDoc(next);
				saveFolders(next).then((stored) => {
					setFoldersDoc(stored);
				}).catch((reason) => {
					if (reason instanceof FoldersConflictError) {
						setFoldersDoc(reason.current);
						notifyFolder(t("folder.conflict"));
						return;
					}
					const detail = reason instanceof Error ? reason.message : String(reason);
					notifyFolder(`${t("folder.saveError")}: ${detail}`);
				});
			};
			/**
			* Save the manual overlay and adopt the host's stored version (revision
			* bumped). On a conflict the host's current overlay is adopted instead, so
			* the tree resyncs to what is actually stored, and the caller still sees a
			* (localized) rejection it can surface in its own error area.
			*/
			const persistManual = async (next) => {
				try {
					const stored = await saveManualOverlay(next);
					setManual(normalizeManual(stored));
					return stored;
				} catch (reason) {
					if (reason instanceof ManualConflictError) {
						setManual(normalizeManual(reason.current));
						throw new ManualConflictError(reason.current, t("manual.conflict"));
					}
					throw reason;
				}
			};
			/** Write one workspace's entry; an entry with nothing attached removes the key. */
			const writeFolderEntry = (workspaceId, entry) => {
				const next = { ...foldersDoc.workspaces };
				const key = workspaceId;
				if (isEmptyEntry(entry)) delete next[key];
				else next[key] = entry;
				persistFolders({
					version: 1,
					revision: foldersDoc.revision ?? 0,
					workspaces: next
				});
			};
			const toggleFolder = (workspaceId, path) => {
				const key = folderKey(workspaceId, path);
				setCollapsedFolderKeys((keys) => keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);
			};
			const isRemoteWorkspace = (workspace) => foldersRemoteBase !== null && isUnderBase(workspace.path, foldersRemoteBase);
			const [foldersOwnerRemote, setFoldersOwnerRemote] = (0, react.useState)(null);
			const foldersOwnerRequest = (0, react.useRef)("");
			/** Open the folder dialog and learn the owner's remote root (cloud owners only). */
			const openFoldersFor = (workspaceId) => {
				foldersOwnerRequest.current = workspaceId;
				setFoldersTarget(workspaceId);
				setFoldersOwnerRemote(null);
				const workspace = workspaces.find((row) => row.workspaceId === workspaceId);
				if (workspace === void 0 || !isRemoteWorkspace(workspace) || foldersRemoteBase === null) return;
				remoteFolderWorkspace(workspace.path, foldersRemoteBase).then((record) => {
					if (foldersOwnerRequest.current !== workspaceId) return;
					setFoldersOwnerRemote(record === null ? null : record.remotePath);
				}, () => {
					if (foldersOwnerRequest.current === workspaceId) setFoldersOwnerRemote(null);
				});
			};
			/** The overlay record for a picked path that the SSH plugin already mirrors. */
			const remoteMember = (target) => ({
				path: target.mirrorPath,
				workspaceId: target.workspaceId,
				kind: "remote",
				remotePath: target.remotePath,
				profileId: target.profileId,
				...target.recordId === "" ? {} : { recordId: target.recordId }
			});
			const [remoteProfiles, setRemoteProfiles] = (0, react.useState)(null);
			const [remoteProfilesError, setRemoteProfilesError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (foldersTarget === null) return;
				let cancelled = false;
				setRemoteProfilesError(null);
				listRemoteProfiles().then((profiles) => {
					if (!cancelled) setRemoteProfiles(profiles);
				}).catch((reason) => {
					if (cancelled) return;
					setRemoteProfiles(null);
					setRemoteProfilesError(reason instanceof Error ? reason.message : String(reason));
				});
				return () => {
					cancelled = true;
				};
			}, [foldersTarget]);
			/**
			* Resolve the member workspace that owns one folder living OUTSIDE this
			* project's own tree. DSH roots every session's file tools at its workspace,
			* so an outside folder is only readable by the agent once it is a workspace of
			* its own. A registered workspace already sitting on that exact path is reused
			* instead of forked; one that owns folders of its own is refused, because
			* nesting a folder tree inside another would hide the inner folders' sessions.
			*/
			const memberWorkspaceFor = async (workspaceId, path) => {
				const existing = workspaces.find((w) => samePath(w.path, path) && w.workspaceId !== workspaceId);
				if (existing !== void 0) {
					if (!isEmptyEntry(entryFor(foldersDoc, existing.workspaceId))) throw new Error(t("folder.memberNested"));
					return {
						path,
						workspaceId: existing.workspaceId,
						kind: "local"
					};
				}
				return {
					path,
					workspaceId: (await createWorkspace({ path })).workspaceId,
					kind: "local"
				};
			};
			/**
			* Whether an entry already holds a member backed by this workspace, or a
			* remote member naming the same connection + remote directory. Both add
			* flows (pick a local directory, create a cloud folder) run this check —
			* the remote-ssh side now reuses same-directory records, so the member
			* layer must refuse the second row itself.
			*/
			const hasMemberClash = (entry, candidate) => memberByWorkspaceId(entry, candidate.workspaceId) !== void 0 || candidate.profileId !== void 0 && candidate.remotePath !== void 0 && findRemoteMember(entry, candidate.profileId, candidate.remotePath) !== void 0;
			const addFolderTo = async (workspaceId) => {
				if (foldersBusy) return;
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) return;
				setFoldersBusy(true);
				try {
					if (foldersRemoteBase === null) throw new Error(t("folder.notReady"));
					const path = await pickDirectory();
					if (path === null) return;
					const entry = entryFor(foldersDoc, workspaceId);
					if (effectiveFolders(workspace.path, entry).some((folder) => samePath(folder, path))) {
						notifyFolder(t("folder.duplicate"));
						return;
					}
					const target = await remoteFolderWorkspace(path, foldersRemoteBase);
					if (target !== null) {
						if (samePath(target.mirrorPath, path) && target.workspaceId !== "" && target.workspaceId !== workspaceId) {
							if (hasMemberClash(entry, target)) {
								notifyFolder(t("folder.duplicate"));
								return;
							}
							writeFolderEntry(workspaceId, addMember(entry, remoteMember(target)));
							return;
						}
						notifyFolder(t("folder.remoteNeedsSubpath"));
						return;
					}
					if (!isUnderBase(path, workspace.path)) {
						writeFolderEntry(workspaceId, addMember(entry, await memberWorkspaceFor(workspaceId, path)));
						return;
					}
					writeFolderEntry(workspaceId, addFolder(entry, path));
				} catch (reason) {
					const detail = reason instanceof Error ? reason.message : String(reason);
					notifyFolder(`${t("folder.addError")}: ${detail}`);
				} finally {
					setFoldersBusy(false);
				}
			};
			/**
			* "New cloud folder" in the folder dialog: the SSH plugin creates the mirror,
			* registers a real workspace for it and returns both ids, so the folder joins
			* this project as a member and its own sidebar row stays hidden.
			*/
			const addRemoteFolderTo = async (workspaceId, profileId, remotePath) => {
				if (foldersBusy) return false;
				const owner = workspaces.find((w) => w.workspaceId === workspaceId);
				if (owner === void 0) return false;
				setFoldersBusy(true);
				try {
					const created = await createRemoteFolder(profileId, remotePath);
					const entry = entryFor(foldersDoc, workspaceId);
					if (created.workspaceId === workspaceId) throw new Error(t("folder.duplicate"));
					if (hasMemberClash(entry, created)) throw new Error(t("folder.duplicate"));
					if (effectiveFolders(owner.path, entry).some((folder) => samePath(folder, created.path))) throw new Error(t("folder.duplicate"));
					const member = {
						path: created.path,
						workspaceId: created.workspaceId,
						kind: "remote",
						remotePath: created.remotePath,
						profileId: created.profileId,
						title: created.title,
						...created.recordId === "" ? {} : { recordId: created.recordId }
					};
					const next = {
						version: 1,
						revision: foldersDoc.revision ?? 0,
						workspaces: {
							...foldersDoc.workspaces,
							[workspaceId]: addMember(entry, member)
						}
					};
					setFoldersDoc(await saveFolders(next));
					return true;
				} catch (reason) {
					if (reason instanceof FoldersConflictError) setFoldersDoc(reason.current);
					notifyFolder(`${t("folder.addError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
					return false;
				} finally {
					setFoldersBusy(false);
				}
			};
			/** The same gesture routes through native local or SSH-owned mkdir APIs. */
			const addSubpathTo = async (workspaceId, name) => {
				if (foldersBusy) return false;
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) return false;
				setFoldersBusy(true);
				try {
					if (foldersRemoteBase === null) throw new Error(t("folder.notReady"));
					const pending = createdFolderPendingSave.current;
					const created = pending !== null && pending.workspaceId === workspaceId && pending.name === name ? pending : await createWorkspaceDirectory(workspace.path, name, foldersRemoteBase, createDirectory);
					createdFolderPendingSave.current = {
						workspaceId,
						name,
						path: created.path
					};
					const entry = addFolder(entryFor(foldersDoc, workspaceId), created.path);
					const next = {
						version: 1,
						revision: foldersDoc.revision ?? 0,
						workspaces: {
							...foldersDoc.workspaces,
							[workspaceId]: entry
						}
					};
					setFoldersDoc(await saveFolders(next));
					createdFolderPendingSave.current = null;
					return true;
				} catch (reason) {
					if (reason instanceof FoldersConflictError) setFoldersDoc(reason.current);
					notifyFolder(`${t("folder.addError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
					return false;
				} finally {
					setFoldersBusy(false);
				}
			};
			const setFolderRoot = (workspaceId, path) => {
				writeFolderEntry(workspaceId, setRoot(entryFor(foldersDoc, workspaceId), path));
			};
			/**
			* Remove one folder from a project. With `deleteRecord` set — only the
			* folder dialog offers it, behind an explicit confirm — a remote member's
			* backing record is deleted through the SSH plugin as well (record, native
			* workspace and mirror go away, sessions included); without it the removal
			* is overlay-only and the workspace survives as its own project. If the
			* record deletion fails, the member stays so the user can retry.
			*/
			const removeFolderFrom = (workspaceId, path, deleteRecord = false) => {
				const entry = entryFor(foldersDoc, workspaceId);
				const member = memberOf(entry, path);
				if (deleteRecord && member?.kind === "remote" && member.recordId !== void 0 && member.recordId !== "") {
					const recordId = member.recordId;
					(async () => {
						try {
							await deleteRemoteWorkspaceRecord(recordId);
						} catch (reason) {
							const detail = reason instanceof Error ? reason.message : String(reason);
							notifyFolder(`${t("folder.removeError")}: ${detail}`);
							return;
						}
						writeFolderEntry(workspaceId, removeFolder(entry, path));
					})();
					return;
				}
				writeFolderEntry(workspaceId, removeFolder(entry, path));
			};
			/**
			* "New session here": a member folder has its OWN workspace, so the session is
			* created there with no cwd override at all —that is what makes a cloud
			* folder and a local folder behave identically under one project row. A plain
			* extra folder keeps the cwd gesture. The base folder keeps the platform's own
			* gesture instead, because that one reuses the blank session it already opened;
			* creating a fresh Session on every click would pile up empty sessions. One
			* creation in flight at a time; a rejection surfaces the failure and creates
			* nothing else.
			*/
			const startSessionInFolder = (workspaceId, path, isBase) => {
				if (isBase) {
					startSession(workspaceId);
					return;
				}
				if (creatingSessionIn !== null) return;
				setCreatingSessionIn(folderKey(workspaceId, path));
				(async () => {
					const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
					if (!workspace) throw new Error("Workspace not found");
					const member = memberOf(entryFor(foldersDoc, workspaceId), path);
					if (member !== void 0) {
						if (!workspaces.some((w) => w.workspaceId === member.workspaceId)) throw new Error(t("folder.memberMissing"));
						await createSessionIn(member.workspaceId);
						return;
					}
					if (foldersRemoteBase === null) throw new Error(t("folder.notReady"));
					if (!isUnderBase(path, workspace.path)) {
						const entry = entryFor(foldersDoc, workspaceId);
						const attached = await memberWorkspaceFor(workspaceId, path);
						writeFolderEntry(workspaceId, addMember(entry, attached));
						await createSessionIn(attached.workspaceId);
						return;
					}
					const remote = await remoteFolderWorkspace(workspace.path, foldersRemoteBase);
					const targetRemote = await remoteFolderWorkspace(path, foldersRemoteBase);
					if (remote || targetRemote) throw new Error(t("folder.remoteSessionUnsupported"));
					await createSessionIn(workspaceId, path);
				})().catch((reason) => {
					const detail = reason instanceof Error ? reason.message : String(reason);
					notifyFolder(`${t("folder.sessionError")}: ${detail}`);
				}).finally(() => {
					setCreatingSessionIn(null);
				});
			};
			/** A project row's plus button —starts in that workspace's root folder. */
			const startSessionAtRoot = (workspaceId) => {
				const workspace = workspaceId === void 0 ? void 0 : workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) {
					startSession(workspaceId);
					return;
				}
				const root = rootOf(workspace.path, entryFor(foldersDoc, workspaceId));
				startSessionInFolder(workspaceId, root, samePath(root, workspace.path));
			};
			const openFolderPath = folderApp === void 0 ? void 0 : (path) => {
				openPathInApp(folderApp, path).catch((reason) => {
					const detail = reason instanceof Error ? reason.message : String(reason);
					notifyFolder(`${t("workspace.openInFolderError")}: ${detail}`);
				});
			};
			const [groupDialog, setGroupDialog] = (0, react.useState)(null);
			const [groupDraft, setGroupDraft] = (0, react.useState)("");
			const [groupError, setGroupError] = (0, react.useState)(null);
			const [groupBusy, setGroupBusy] = (0, react.useState)(false);
			const [groupDeleteTarget, setGroupDeleteTarget] = (0, react.useState)(null);
			const [groupDeleting, setGroupDeleting] = (0, react.useState)(false);
			const [groupDeleteError, setGroupDeleteError] = (0, react.useState)(null);
			const [appearanceTarget, setAppearanceTarget] = (0, react.useState)(null);
			const [appearanceDraft, setAppearanceDraft] = (0, react.useState)({});
			const [appearanceError, setAppearanceError] = (0, react.useState)(null);
			const takenNames = (0, react.useMemo)(() => takenCategoryNames(config, manual), [config, manual]);
			const groupTrimmed = groupDraft.trim();
			const groupNameIssue = groupDialog !== null && groupTrimmed !== "" ? groupTrimmed === "未分类" ? t("group.nameReserved") : groupDialog.mode === "rename" && groupTrimmed === groupDialog.from ? null : takenNames.has(groupTrimmed) ? t("group.nameDuplicate") : null : null;
			const groupBlocked = groupBusy || groupTrimmed === "" || groupNameIssue !== null || groupDialog !== null && groupDialog.mode === "rename" && groupTrimmed === groupDialog.from;
			const confirmGroupDialog = () => {
				if (groupBlocked || groupDialog === null) return;
				const name = groupTrimmed;
				const from = groupDialog.mode === "rename" ? groupDialog.from : void 0;
				const renaming = groupDialog.mode === "rename" && from !== name;
				let next;
				if (groupDialog.mode === "create") next = {
					...manual,
					categories: [...manual.categories, name]
				};
				else {
					const originalRule = from !== void 0 ? originalRuleNameForDisplay(config.categories, manual, from) : void 0;
					next = {
						...manual,
						...originalRule !== void 0 ? { renamed: {
							...manual.renamed,
							[originalRule]: name
						} } : { categories: manual.categories.map((c) => c === from ? name : c) },
						assignments: Object.fromEntries(Object.entries(manual.assignments).map(([id, category]) => [id, category === from ? name : category])),
						workspaceOrder: Object.fromEntries(Object.entries(manual.workspaceOrder).map(([key, ids]) => [key === from ? name : key, ids])),
						categoryOrder: manual.categoryOrder.map((key) => key === from ? name : key),
						appearance: from === void 0 || from === name ? manual.appearance : Object.fromEntries(Object.entries(manual.appearance).map(([key, value]) => [key === from ? name : key, value]))
					};
				}
				setGroupBusy(true);
				setGroupError(null);
				persistManual(next).then(() => {
					setManualError(null);
					setGroupBusy(false);
					setGroupDialog(null);
					setGroupDraft("");
					if (renaming) actions.setCategoryExpanded(name, true);
				}).catch((reason) => {
					setGroupBusy(false);
					setGroupError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const confirmGroupDelete = () => {
				if (groupDeleting || groupDeleteTarget === null) return;
				const name = groupDeleteTarget;
				const originalRule = originalRuleNameForDisplay(config.categories, manual, name);
				const assignments = { ...manual.assignments };
				for (const workspace of workspaces) if (resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title) === name) assignments[workspace.workspaceId] = null;
				const workspaceOrder = Object.fromEntries(Object.entries(manual.workspaceOrder).filter(([key]) => key !== name));
				const next = {
					...manual,
					assignments,
					workspaceOrder,
					categoryOrder: manual.categoryOrder.filter((key) => key !== name),
					appearance: Object.fromEntries(Object.entries(manual.appearance).filter(([key]) => key !== name)),
					...originalRule !== void 0 ? {
						renamed: Object.fromEntries(Object.entries(manual.renamed).filter(([key]) => key !== originalRule)),
						hidden: [...manual.hidden, originalRule]
					} : { categories: manual.categories.filter((c) => c !== name) }
				};
				setGroupDeleting(true);
				setGroupDeleteError(null);
				persistManual(next).then(() => {
					setManualError(null);
					setGroupDeleting(false);
					setGroupDeleteTarget(null);
				}).catch((reason) => {
					setGroupDeleting(false);
					setGroupDeleteError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [dragIndicator, setDragIndicator] = (0, react.useState)(null);
			const expansionSnapshot = (0, react.useRef)(null);
			const liveExpansionRef = (0, react.useRef)({
				categoryExpansion,
				workspaceExpansion,
				actions
			});
			liveExpansionRef.current = {
				categoryExpansion,
				workspaceExpansion,
				actions
			};
			(0, react.useEffect)(() => {
				const clear = () => {
					setDragIndicator(null);
					setDragging(null);
					const snapshot = expansionSnapshot.current;
					if (snapshot === null) return;
					expansionSnapshot.current = null;
					const { categoryExpansion: currentCategories, workspaceExpansion: currentWorkspaces, actions: currentActions } = liveExpansionRef.current;
					for (const [key, value] of Object.entries(snapshot.categories)) if (currentCategories[key] !== value) currentActions.setCategoryExpanded(key, value);
					for (const [key, value] of Object.entries(snapshot.workspaces)) if (currentWorkspaces[key] !== value) currentActions.setWorkspaceExpanded(key, value);
				};
				document.addEventListener("dragend", clear);
				return () => {
					document.removeEventListener("dragend", clear);
				};
			}, []);
			/** Move a workspace into a category (or reorder inside it when `beforeWorkspaceId`/`afterWorkspaceId`). */
			const moveWorkspaceTo = async (workspaceId, categoryKey, beforeWorkspaceId, afterWorkspaceId) => {
				if (manualSaving) return;
				const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
				if (workspace === void 0) return;
				setManualSaving(true);
				try {
					let next;
					if (categoryKey === UNCATEGORIZED_KEY) {
						const assignments = {
							...manual.assignments,
							[workspaceId]: null
						};
						const workspaceOrder = {};
						for (const [key, ids] of Object.entries(manual.workspaceOrder)) {
							if (key === "__topLevel__") continue;
							workspaceOrder[key] = ids.filter((id) => id !== workspaceId);
						}
						const topLevelIds = workspaces.filter((w) => w.workspaceId !== workspaceId && resolveCategory(config, manual, w.workspaceId, w.path, w.title) === void 0).map((w) => w.workspaceId);
						workspaceOrder[TOP_LEVEL_ORDER_KEY] = afterWorkspaceId !== void 0 ? moveAfter(topLevelIds, workspaceId, afterWorkspaceId) : moveBefore(topLevelIds, workspaceId, beforeWorkspaceId);
						next = {
							...manual,
							assignments,
							workspaceOrder
						};
					} else {
						const currentKey = resolveCategory(config, manual, workspaceId, workspace.path, workspace.title);
						const movingAcross = currentKey !== categoryKey;
						const assignments = movingAcross ? {
							...manual.assignments,
							[workspaceId]: categoryKey
						} : manual.assignments;
						const targetOrder = afterWorkspaceId !== void 0 ? moveAfter(manual.workspaceOrder[categoryKey] ?? [], workspaceId, afterWorkspaceId) : moveBefore(manual.workspaceOrder[categoryKey] ?? [], workspaceId, beforeWorkspaceId);
						const workspaceOrder = {
							...manual.workspaceOrder,
							[categoryKey]: targetOrder
						};
						if (movingAcross && currentKey !== void 0 && workspaceOrder[currentKey] !== void 0) workspaceOrder[currentKey] = workspaceOrder[currentKey].filter((id) => id !== workspaceId);
						next = {
							...manual,
							assignments,
							workspaceOrder
						};
					}
					await persistManual(next);
					setManualError(null);
					if (categoryKey !== UNCATEGORIZED_KEY) actions.setCategoryExpanded(categoryKey, true);
				} catch (reason) {
					setManualError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setManualSaving(false);
				}
			};
			/** Reorder groups: move `draggedKey` before `beforeKey` or after `afterKey` (no target = append). */
			const moveCategory = async (draggedKey, beforeKey, afterKey) => {
				if (manualSaving || draggedKey === beforeKey || draggedKey === afterKey) return;
				setManualSaving(true);
				try {
					const order = displayCategoryKeys(config, manual);
					const categoryOrder = afterKey !== void 0 ? moveAfter(order, draggedKey, afterKey) : moveBefore(order, draggedKey, beforeKey);
					const neighbourKey = afterKey ?? beforeKey;
					let appearance = manual.appearance;
					if (neighbourKey !== void 0 && isCategoryPinned(manual, neighbourKey) !== isCategoryPinned(manual, draggedKey)) {
						const cleaned = pruneAppearance({
							...manual.appearance[draggedKey] ?? {},
							pinned: isCategoryPinned(manual, neighbourKey)
						});
						appearance = { ...manual.appearance };
						if (cleaned === void 0) delete appearance[draggedKey];
						else appearance[draggedKey] = cleaned;
					}
					const next = {
						...manual,
						categoryOrder,
						appearance
					};
					await persistManual(next);
					setManualError(null);
				} catch (reason) {
					setManualError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setManualSaving(false);
				}
			};
			/**
			* Merge a presentation patch for one group and persist the overlay.
			* Optimistic: the tree reflects the change immediately and rolls back if the
			* host refuses the write (the dialog has no confirm step).
			*/
			const updateCategoryAppearance = async (key, patch) => {
				if (manualSaving) return;
				setManualSaving(true);
				const previous = manual;
				try {
					const merged = {
						...manual.appearance[key] ?? {},
						...patch
					};
					const appearance = { ...manual.appearance };
					const cleaned = pruneAppearance(merged);
					if (cleaned === void 0) delete appearance[key];
					else appearance[key] = cleaned;
					const next = {
						...manual,
						appearance
					};
					setManual(next);
					await persistManual(next);
					setManualError(null);
				} catch (reason) {
					if (!(reason instanceof ManualConflictError)) setManual(previous);
					setManualError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setManualSaving(false);
				}
			};
			/** Pin/unpin a group (pinned groups render above the normal order). */
			const toggleCategoryPinned = async (key) => {
				await updateCategoryAppearance(key, { pinned: !isCategoryPinned(manual, key) });
			};
			/** Appearance currently shown in the dialog (empty while it is closed). */
			const appearanceCurrent = appearanceTarget === null ? {} : manual.appearance[appearanceTarget] ?? {};
			/**
			* Commit the custom-icon text field. Invalid input is blocked locally (the
			* host would 400 the whole overlay save); an empty field clears the icon.
			*/
			const commitAppearanceIcon = () => {
				if (appearanceTarget === null) return;
				const icon = (appearanceDraft.icon ?? "").trim();
				if (icon !== "" && !ICON_VALUE_PATTERN.test(icon)) {
					setAppearanceError(t("group.iconInvalid"));
					return;
				}
				setAppearanceError(null);
				if (icon === (appearanceCurrent.icon ?? "")) return;
				updateCategoryAppearance(appearanceTarget, { icon: icon === "" ? void 0 : icon });
			};
			/**
			* Drop on a row. The insertion point is re-derived from the drop event's
			* position (top half = before, bottom half = after), so it always matches
			* the indicator the user last saw —even when dragover and drop arrive in
			* the same tick.
			*/
			const onDropRow = (categoryKey, row) => (event) => {
				event.preventDefault();
				event.stopPropagation();
				setDragIndicator(null);
				setDragging(null);
				const draggedCategory = event.dataTransfer.getData(DND_CATEGORY_TYPE);
				if (draggedCategory !== "") {
					const rect = event.currentTarget.getBoundingClientRect();
					const before = event.clientY < rect.top + rect.height / 2;
					const beforeKey = row.kind === "category" && before ? row.key : void 0;
					const afterKey = row.kind === "category" && !before ? row.key : void 0;
					moveCategory(draggedCategory, beforeKey, afterKey);
					return;
				}
				const workspaceId = event.dataTransfer.getData("application/x-dsh-workspace-groups") || event.dataTransfer.getData("text/plain");
				if (workspaceId === "") return;
				if (row.kind === "topLevel") {
					const rect = event.currentTarget.getBoundingClientRect();
					const before = event.clientY < rect.top + rect.height / 2;
					const specificKey = row.key === UNCATEGORIZED_KEY ? void 0 : row.key;
					moveWorkspaceTo(workspaceId, UNCATEGORIZED_KEY, before ? specificKey : void 0, !before ? specificKey : void 0);
					return;
				}
				const rect = event.currentTarget.getBoundingClientRect();
				const before = event.clientY < rect.top + rect.height / 2;
				const beforeWsid = row.kind === "workspace" && before ? row.key : void 0;
				const afterWsid = row.kind === "workspace" && !before ? row.key : void 0;
				moveWorkspaceTo(workspaceId, categoryKey, beforeWsid, afterWsid);
			};
			const onDragOverRow = (row) => (event) => {
				if (!hasPluginDragType(event.dataTransfer.types)) return;
				const draggingCategory = Array.from(event.dataTransfer.types).includes(DND_CATEGORY_TYPE);
				if (draggingCategory && row.kind !== "category") return;
				event.preventDefault();
				event.stopPropagation();
				event.dataTransfer.dropEffect = "move";
				const rect = event.currentTarget.getBoundingClientRect();
				const before = event.clientY < rect.top + rect.height / 2;
				if (draggingCategory || row.kind === "workspace" || row.kind === "topLevel") setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === row.kind && prev.row.key === row.key && prev.before === before ? prev : {
					mode: "line",
					row,
					before
				});
				else setDragIndicator((prev) => prev?.mode === "into" && prev.categoryKey === row.key ? prev : {
					mode: "into",
					categoryKey: row.key
				});
			};
			const onDragLeaveRow = (event) => {
				if (event.currentTarget.contains(event.relatedTarget)) return;
				setDragIndicator(null);
			};
			/**
			* Drag over the TOP-LEVEL AREA's blank space (not on a row ???rows stop
			* propagation). An insertion line shows the landing spot: empty top level —   * a standalone line under the last group; non-empty —a line below the last
			* top-level row (end of the list).
			*/
			const onDragOverTopLevelArea = (event) => {
				if (!hasPluginDragType(event.dataTransfer.types)) return;
				if (Array.from(event.dataTransfer.types).includes("application/x-dsh-workspace-groups-category")) return;
				event.preventDefault();
				event.dataTransfer.dropEffect = "move";
				const last = topLevel.length > 0 ? topLevel[topLevel.length - 1] : void 0;
				if (last !== void 0) setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === "topLevel" && prev.row.key === last.workspaceId && prev.before === false ? prev : {
					mode: "line",
					row: {
						kind: "topLevel",
						key: last.workspaceId
					},
					before: false
				});
				else setDragIndicator((prev) => prev?.mode === "line" && prev.row.kind === "topLevel" && prev.row.key === topLevelRef.key && prev.before === false ? prev : {
					mode: "line",
					row: topLevelRef,
					before: false
				});
			};
			const onDragStartWorkspace = (_workspaceId) => () => {
				setDragging("workspace");
				expansionSnapshot.current = {
					categories: { ...categoryExpansion },
					workspaces: { ...workspaceExpansion }
				};
				for (const key of Object.keys(workspaceExpansion)) if (workspaceExpansion[key]) actions.setWorkspaceExpanded(key, false);
			};
			const onDragStartCategory = (categoryKey) => (event) => {
				event.dataTransfer.setData(DND_CATEGORY_TYPE, categoryKey);
				event.dataTransfer.effectAllowed = "move";
				setDragging("category");
				expansionSnapshot.current = {
					categories: { ...categoryExpansion },
					workspaces: { ...workspaceExpansion }
				};
				for (const key of Object.keys(categoryExpansion)) if (categoryExpansion[key]) actions.setCategoryExpanded(key, false);
			};
			const renderIconCell = (id, label) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "wgIconCell",
				"aria-pressed": appearanceCurrent.icon === id,
				"aria-label": label,
				title: label,
				disabled: manualSaving,
				onClick: () => {
					setAppearanceDraft({
						...appearanceDraft,
						icon: id
					});
					setAppearanceError(null);
					if (appearanceTarget !== null) updateCategoryAppearance(appearanceTarget, { icon: id });
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategoryGlyph, { icon: id })
			}, id);
			const now = Date.now();
			const defaultBarNode = defaultWorkspace === void 0 ? void 0 : normalizedQuery === "" ? defaultWorkspace : searchTree?.defaultWorkspace ?? withoutSessions(defaultWorkspace);
			const dockCategory = normalizedQuery === "" ? dockedCategory : searchDockCategory;
			/**
			* One category section with every tree callback bound. Extracted so the docked
			* bucket is literally the same row/children component as a tree category —   * drag, menu, rename, appearance, folder management all behave identically.
			*/
			const categorySectionNode = (category) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategorySection, {
				category,
				current,
				now,
				t,
				dragIndicator,
				onDragOverRow,
				onDragLeaveRow,
				onDropRow,
				onDragStartCategory: onDragStartCategory(category.key),
				onDragStartWorkspace,
				onToggleCategory: () => {
					actions.setCategoryExpanded(category.key, !category.expanded);
				},
				onToggleWorkspace: (key) => {
					actions.setWorkspaceExpanded(key, !workspaceExpansion[key]);
				},
				onNewSession: startSessionAtRoot,
				onOpen: open,
				onToggleFolder: toggleFolder,
				onFolderNewSession: startSessionInFolder,
				onFolderSetRoot: setFolderRoot,
				onFolderRemove: removeFolderFrom,
				onOpenFolderPath: openFolderPath,
				onManageFolders: openFoldersFor,
				creatingFolderKey: creatingSessionIn,
				onRenameRequest: (workspaceId, title) => {
					setRenameTarget({
						workspaceId,
						currentTitle: title
					});
					setRenameDraft(title);
					setRenameError(null);
				},
				onDeleteRequest: (workspaceId, title) => {
					setDeleteTarget({
						workspaceId,
						title
					});
					setDeleteError(null);
				},
				onSessionRename,
				onSessionArchive,
				onFork: forkSession,
				onAddWorkspace: () => {
					addWorkspace(category.key);
				},
				addingWorkspace: adding || manualSaving,
				onGroupRename: () => {
					setGroupDraft(category.key);
					setGroupError(null);
					setGroupDialog({
						mode: "rename",
						from: category.key
					});
				},
				onGroupDelete: () => {
					setGroupDeleteTarget(category.key);
					setGroupDeleteError(null);
				},
				onGroupTogglePin: () => {
					toggleCategoryPinned(category.key);
				},
				onGroupAppearance: () => {
					setAppearanceDraft(manual.appearance[category.key] ?? {});
					setAppearanceError(null);
					setAppearanceTarget(category.key);
				},
				animate: dragging === null,
				onMoveOut: (workspaceId) => {
					moveWorkspaceTo(workspaceId, UNCATEGORIZED_KEY);
				},
				onOpenInFolder: openInFolder,
				canMoveOut: (workspaceId) => {
					const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
					return workspace !== void 0 && resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title) !== void 0;
				}
			}, category.key);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `wgRoot${wide ? "" : " wgRail"}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionTabs, {
						useSessions,
						useSessionStatus,
						useWorkspaces,
						useTabs,
						actions: tabActions,
						activate: activateTab,
						rename: onSessionRename,
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgSectionHeader",
						children: [
							wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wgSectionLabel",
								children: t("section.workspaces")
							}),
							wide && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `wgSearch${searchExpanded ? " wgSearchExpanded" : ""}`,
								ref: searchRoot,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wgIconButton",
										"aria-label": t("search"),
										onClick: () => {
											setSearchExpanded(true);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: searchExpanded ? 11 : 14 })
									}),
									searchExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										ref: searchInput,
										className: "wgSearchInput",
										type: "text",
										placeholder: t("search.placeholder"),
										maxLength: SEARCH_QUERY_MAX_CODE_UNITS,
										value: query,
										autoFocus: true,
										onChange: (e) => {
											setQuery(sanitizeSearchQuery(e.target.value));
										},
										onKeyDown: (e) => {
											if (e.key !== "Escape") return;
											setQuery("");
											setSearchExpanded(false);
										}
									}),
									searchExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wgIconButton",
										"aria-label": t("search.clear"),
										onClick: (e) => {
											e.stopPropagation();
											setQuery("");
											setSearchExpanded(false);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFillMedium, {})
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("group.create"),
								side: "bottom",
								delayMs: 500,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgIconButton",
									"aria-label": t("group.create"),
									onClick: () => {
										setGroupDraft("");
										setGroupError(null);
										setGroupDialog({ mode: "create" });
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: wide ? 16 : 18 })
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("workspace.add"),
								side: "bottom",
								delayMs: 500,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wgIconButton",
									"aria-label": t("workspace.add"),
									disabled: adding,
									onClick: () => {
										addWorkspace();
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconProjectAddOutlineRegular, { size: wide ? 16 : 18 })
								})
							})
						]
					}),
					!wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSectionHeader",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("search"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wgIconButton",
								"aria-label": t("search"),
								onClick: () => {
									setSearchExpanded(true);
									expandSidebar();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 18 })
							})
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgTreeBody",
						children: [
							configError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgSearchStatus",
								role: "status",
								children: t("configUnavailable")
							}),
							manualError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wgSearchStatus wgManualError",
								role: "alert",
								children: [
									t("manual.saveError"),
									": ",
									manualError
								]
							}),
							wide && normalizedQuery !== "" && searchTreeForBody !== void 0 && searchMatches !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchBody, {
								tree: searchTreeForBody,
								matches: searchMatches,
								status: activeRemoteSearch.status,
								current,
								now,
								open,
								t
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgTreeWrap",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wgList",
									role: "tree",
									"aria-label": t("section.workspaces"),
									children: [
										treeGroups.length === 0 && topLevel.length === 0 && !topLevelDropActive && defaultBarNode === void 0 && dockCategory === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "wgEmpty",
											children: workspacePhase === "ready" ? t("empty.noWorkspaces") : t("empty.none")
										}),
										treeGroups.map(categorySectionNode),
										(topLevel.length > 0 || topLevelDropActive) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TopLevelSection, {
											topLevel,
											current,
											now,
											t,
											dragging: dragging === "workspace",
											dragIndicator,
											topLevelRef,
											onDragOverRow,
											onDragOverTopLevelArea,
											onDragLeaveRow,
											onDropRow,
											onDragStartWorkspace,
											onToggleWorkspace: (key) => {
												actions.setWorkspaceExpanded(key, !workspaceExpansion[key]);
											},
											onNewSession: startSessionAtRoot,
											onOpen: open,
											onToggleFolder: toggleFolder,
											onFolderNewSession: startSessionInFolder,
											onFolderSetRoot: setFolderRoot,
											onFolderRemove: removeFolderFrom,
											onOpenFolderPath: openFolderPath,
											onManageFolders: openFoldersFor,
											creatingFolderKey: creatingSessionIn,
											onRenameRequest: (workspaceId, title) => {
												setRenameTarget({
													workspaceId,
													currentTitle: title
												});
												setRenameDraft(title);
												setRenameError(null);
											},
											onDeleteRequest: (workspaceId, title) => {
												setDeleteTarget({
													workspaceId,
													title
												});
												setDeleteError(null);
											},
											onSessionRename,
											onSessionArchive,
											onFork: forkSession,
											onOpenInFolder: openInFolder
										})
									]
								})
							})
						]
					}),
					wide && (dockCategory !== void 0 || defaultBarNode !== void 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wgDock",
						children: [dockCategory !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgDockBucket",
							role: "group",
							"aria-label": dockCategory.label,
							children: categorySectionNode(dockCategory)
						}), defaultBarNode !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgDefaultWorkspaceBar",
							role: "group",
							"aria-label": t("section.defaultWorkspace"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
								node: defaultBarNode,
								t,
								flat: true,
								onToggle: () => {
									actions.setWorkspaceExpanded(defaultBarNode.workspaceId, !workspaceExpansion[defaultBarNode.workspaceId]);
								},
								onNewSession: () => {
									startSessionAtRoot(defaultBarNode.workspaceId);
								},
								onRename: () => {
									setRenameTarget({
										workspaceId: defaultBarNode.workspaceId,
										currentTitle: defaultBarNode.label
									});
									setRenameDraft(defaultBarNode.label);
									setRenameError(null);
								},
								onDelete: () => {
									setDeleteTarget({
										workspaceId: defaultBarNode.workspaceId,
										title: defaultBarNode.label
									});
									setDeleteError(null);
								},
								...openInFolder !== void 0 ? { onOpenInFolder: () => {
									openInFolder(defaultBarNode.workspaceId);
								} } : {},
								onManageFolders: () => {
									openFoldersFor(defaultBarNode.workspaceId);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgDockSessions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceSubtree, {
									workspace: defaultBarNode,
									current,
									now,
									t,
									animate: dragging === null,
									onOpen: open,
									onSessionRename,
									onSessionArchive,
									onFork: forkSession,
									onToggleFolder: toggleFolder,
									onFolderNewSession: startSessionInFolder,
									onFolderSetRoot: setFolderRoot,
									onFolderRemove: removeFolderFrom,
									onOpenFolderPath: openFolderPath,
									creatingFolderKey: creatingSessionIn
								})
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: groupDialog !== null,
						onClose: () => {
							setGroupDialog(null);
						},
						closeLabel: t("close"),
						title: groupDialog?.mode === "rename" ? t("group.renameTitle") : t("group.createTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setGroupDialog(null);
							},
							children: t("group.createCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: groupBlocked,
							onClick: confirmGroupDialog,
							children: groupDialog?.mode === "rename" ? t("group.renameConfirm") : t("group.createConfirm")
						})] }),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "wgRenameInput",
								value: groupDraft,
								"aria-label": t("group.createPlaceholder"),
								placeholder: t("group.createPlaceholder"),
								autoFocus: true,
								onChange: (e) => {
									setGroupDraft(e.target.value);
									setGroupError(null);
								},
								onKeyDown: (e) => {
									if (e.key === "Enter") confirmGroupDialog();
								}
							}),
							groupNameIssue !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgAddError",
								role: "alert",
								children: groupNameIssue
							}),
							groupError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wgAddError",
								role: "alert",
								children: groupError
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: groupDeleteTarget !== null,
						onClose: () => {
							setGroupDeleteTarget(null);
						},
						closeLabel: t("close"),
						title: t("group.deleteTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setGroupDeleteTarget(null);
							},
							children: t("group.deleteCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: groupDeleting,
							onClick: confirmGroupDelete,
							children: t("group.delete")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							children: t("group.deleteConfirm")
						}), groupDeleteError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: groupDeleteError
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: appearanceTarget !== null,
						onClose: () => {
							setAppearanceTarget(null);
						},
						closeLabel: t("group.appearanceDone"),
						title: t("group.appearanceTitle"),
						className: "wgAppearanceDialog",
						contentClassName: "wgAppearanceContent",
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							onClick: () => {
								setAppearanceTarget(null);
							},
							children: t("group.appearanceDone")
						}),
						children: appearanceTarget !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wgAppearanceBody",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wgAppearanceSection",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "wgAppearanceLabel",
										children: t("group.color")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wgSwatchRow",
										role: "group",
										"aria-label": t("group.color"),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: `wgSwatch wgSwatchDefault${appearanceCurrent.color === void 0 ? " wgSwatchActive" : ""}`,
											"aria-pressed": appearanceCurrent.color === void 0,
											"aria-label": t("group.colorDefault"),
											title: t("group.colorDefault"),
											disabled: manualSaving,
											onClick: () => {
												updateCategoryAppearance(appearanceTarget, { color: void 0 });
											}
										}), GROUP_COLORS.map((color) => {
											const active = appearanceCurrent.color === color;
											return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: `wgSwatch${active ? " wgSwatchActive" : ""}`,
												"data-wg-color": color,
												"aria-pressed": active,
												"aria-label": t(COLOR_LABEL_KEYS[color]),
												title: t(COLOR_LABEL_KEYS[color]),
												disabled: manualSaving,
												onClick: () => {
													updateCategoryAppearance(appearanceTarget, { color });
												}
											}, color);
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wgAppearanceSection",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "wgAppearanceLabel",
											children: t("group.icon")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wgIconSections",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "wgIconSection",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "wgIconSectionLabel",
														children: t("group.icon.section.common")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "wgIconGrid",
														role: "group",
														"aria-label": t("group.icon.section.common"),
														children: COMMON_ICON_IDS.map((id) => renderIconCell(id, GROUP_ICON_LABELS[id]))
													})]
												}),
												SCIENCE_ICON_SECTIONS.map((section) => {
													const label = t(SCIENCE_SECTION_LABEL_KEYS[section.key]);
													return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "wgIconSection",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: "wgIconSectionLabel",
															children: label
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: "wgIconGrid",
															role: "group",
															"aria-label": label,
															children: section.ids.map((id) => renderIconCell(id, GROUP_ICON_LABELS[id]))
														})]
													}, section.key);
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "wgIconSection",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "wgIconSectionLabel",
														children: t("group.icon.section.emoji")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "wgIconGrid wgEmojiGrid",
														role: "group",
														"aria-label": t("group.icon.section.emoji"),
														children: GROUP_EMOJI_ICONS.map(({ icon, label }) => renderIconCell(icon, label))
													})]
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wgIconCustom",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "wgIconCell wgIconDefault",
												"aria-pressed": appearanceCurrent.icon === void 0,
												disabled: manualSaving,
												onClick: () => {
													setAppearanceDraft({
														...appearanceDraft,
														icon: ""
													});
													setAppearanceError(null);
													updateCategoryAppearance(appearanceTarget, { icon: void 0 });
												},
												children: t("group.iconDefault")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "wgRenameInput",
												value: appearanceDraft.icon ?? "",
												"aria-label": t("group.iconCustom"),
												placeholder: t("group.iconDefault"),
												disabled: manualSaving,
												onChange: (e) => {
													setAppearanceDraft({
														...appearanceDraft,
														icon: e.target.value
													});
													setAppearanceError(null);
												},
												onKeyDown: (e) => {
													if (e.key === "Enter") commitAppearanceIcon();
												},
												onBlur: (event) => {
													const next = event.relatedTarget;
													if (next instanceof Element && next.closest(".wgSwatch, .wgIconCell") !== null) return;
													commitAppearanceIcon();
												}
											})]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wgAppearanceSection",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: appearanceCurrent.pinned === true ? "primary" : "outline",
										disabled: manualSaving,
										onClick: () => {
											updateCategoryAppearance(appearanceTarget, { pinned: appearanceCurrent.pinned !== true });
										},
										children: appearanceCurrent.pinned === true ? t("group.unpin") : t("group.pin")
									})
								}),
								appearanceError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wgAddError",
									role: "alert",
									children: appearanceError
								})
							]
						})
					}),
					foldersTarget !== null && (() => {
						const workspace = workspaces.find((w) => w.workspaceId === foldersTarget);
						if (workspace === void 0) return null;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FoldersDialog, {
							workspace,
							entry: entryFor(foldersDoc, foldersTarget),
							t,
							busy: foldersBusy,
							canOpen: openFolderPath !== void 0,
							remote: isRemoteWorkspace(workspace),
							ownerRemotePath: foldersOwnerRemote,
							profiles: remoteProfiles,
							profilesError: remoteProfilesError,
							knownWorkspaceIds: workspaces.map((w) => w.workspaceId),
							onAddFolder: () => {
								addFolderTo(foldersTarget);
							},
							onAddRemote: (profileId, remotePath) => addRemoteFolderTo(foldersTarget, profileId, remotePath),
							onAddSubpath: (relative) => addSubpathTo(foldersTarget, relative),
							onSetRoot: (path) => {
								setFolderRoot(foldersTarget, path);
							},
							onRemove: (path, deleteRecord) => {
								removeFolderFrom(foldersTarget, path, deleteRecord);
							},
							onOpenFolder: (path) => {
								openFolderPath?.(path);
							},
							onClose: () => {
								foldersOwnerRequest.current = "";
								setFoldersTarget(null);
							}
						});
					})(),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: renameTarget !== null,
						onClose: () => {
							setRenameTarget(null);
						},
						closeLabel: t("close"),
						title: t("workspace.renameTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setRenameTarget(null);
							},
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: renameBlocked,
							onClick: confirmRename,
							children: t("workspace.renameConfirm")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "wgRenameInput",
							value: renameDraft,
							"aria-label": t("workspace.renamePlaceholder"),
							autoFocus: true,
							onChange: (e) => {
								setRenameDraft(e.target.value);
							},
							onKeyDown: (e) => {
								if (e.key === "Enter") confirmRename();
							}
						}), renameError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: renameError
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleteTarget !== null,
						onClose: () => {
							setDeleteTarget(null);
						},
						closeLabel: t("close"),
						title: t("workspace.deleteTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setDeleteTarget(null);
							},
							children: t("workspace.deleteCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: deleting,
							onClick: confirmDelete,
							children: t("workspace.delete")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							children: t("workspace.deleteConfirm")
						}), deleteError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: deleteError
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: sessionRenameTarget !== null,
						onClose: () => {
							setSessionRenameTarget(null);
						},
						closeLabel: t("close"),
						title: t("session.renameTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setSessionRenameTarget(null);
							},
							children: t("session.renameCancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: sessionRenameBlocked,
							onClick: confirmSessionRename,
							children: t("session.renameConfirm")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "wgRenameInput",
							value: sessionRenameDraft,
							"aria-label": t("session.renamePlaceholder"),
							autoFocus: true,
							onChange: (e) => {
								setSessionRenameDraft(e.target.value);
							},
							onKeyDown: (e) => {
								if (e.key === "Enter") confirmSessionRename();
							}
						}), sessionRenameError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: sessionRenameError
						})]
					}),
					directoryFlowOpen && DirectoryFlow && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DirectoryFlow, {
						...directoryFlow?.injected,
						open: true,
						busy: false,
						onPicked: (path) => {
							finishDirectoryFlow(path);
						},
						onCancel: () => {
							finishDirectoryFlow(null);
						},
						onError: (message) => {
							finishDirectoryFlow(null, message);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: addErrorOpen,
						onClose: () => {
							setAddErrorOpen(false);
						},
						closeLabel: t("close"),
						title: t("workspace.addErrorTitle"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setAddErrorOpen(false);
							},
							children: t("close")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							onClick: () => {
								addWorkspace(addCategoryRef.current);
							},
							children: t("retry")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wgAddError",
							role: "alert",
							children: addError
						})
					}),
					folderError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
						text: folderError.text,
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 16 }),
						onDone: () => {
							setFolderError(null);
						}
					}, folderError.id),
					quickOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuickPanel, {
						onClose: () => {
							setQuickOpen(false);
						},
						list,
						workspaces: visibleWorkspaces,
						archivedSessionIds,
						categoryByWorkspace,
						current,
						startSession,
						openSession: open,
						now,
						t
					})
				]
			});
		}
		/** Resolve the category label containing the current session (auto-expand helper). */
		function categoriesForCurrent(config, workspaces, current, manual) {
			const workspace = workspaces.find((w) => w.sessionIds.includes(current));
			if (workspace === void 0) return void 0;
			return resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title);
		}
		/**
		* The expanded session rows of one project. Workspaces with extra folders get
		* one folder row per folder (root first) and hang their sessions off that
		* folder; a workspace without extra folders renders today's flat list, so the
		* common case is unchanged row-for-row.
		*/
		function WorkspaceSubtree({ workspace, current, now, t, animate, onOpen, onSessionRename, onSessionArchive, onFork, onToggleFolder, onFolderNewSession, onFolderSetRoot, onFolderRemove, onOpenFolderPath, creatingFolderKey }) {
			const folders = workspace.folders;
			if (folders === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RowGroup, {
				expanded: workspace.expanded,
				className: "wgTreeChildren",
				animate: animate && workspace.sessions.length <= ANIMATION_ROW_CAP,
				children: workspace.sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
					node: session,
					currentId: current,
					now,
					t,
					onOpen,
					onRename: onSessionRename,
					onFork,
					onArchive: onSessionArchive
				}, session.id))
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RowGroup, {
				expanded: workspace.expanded,
				className: "wgTreeChildren",
				animate: animate && folders.length + workspace.sessions.length <= ANIMATION_ROW_CAP,
				children: folders.map((folder) => {
					const key = folderKey(workspace.workspaceId, folder.path);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FolderRow, {
							node: folder,
							t,
							creating: creatingFolderKey === key,
							onToggle: () => {
								onToggleFolder(workspace.workspaceId, folder.path);
							},
							onNewSession: () => {
								onFolderNewSession(workspace.workspaceId, folder.path, folder.isBase);
							},
							onSetRoot: () => {
								onFolderSetRoot(workspace.workspaceId, folder.path);
							},
							onRemove: () => {
								onFolderRemove(workspace.workspaceId, folder.path);
							},
							...onOpenFolderPath !== void 0 ? { onOpenInFolder: () => {
								onOpenFolderPath(folder.path);
							} } : {}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RowGroup, {
							expanded: folder.expanded,
							className: "wgTreeChildren",
							animate: animate && folder.sessions.length <= ANIMATION_ROW_CAP,
							children: folder.sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
								node: session,
								nested: true,
								currentId: current,
								now,
								t,
								onOpen,
								onRename: onSessionRename,
								onFork,
								onArchive: onSessionArchive
							}, session.id))
						})]
					}, key);
				})
			});
		}
		/** One category section: header row + expanded workspace folders. */
		function CategorySection({ category, current, now, t, dragIndicator, onDragOverRow, onDragLeaveRow, onDropRow, onDragStartCategory, onDragStartWorkspace, onToggleCategory, onToggleWorkspace, onNewSession, onOpen, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onFork, onAddWorkspace, addingWorkspace, onGroupRename, onGroupDelete, onGroupTogglePin, onGroupAppearance, animate, onMoveOut, canMoveOut, onOpenInFolder, onToggleFolder, onFolderNewSession, onFolderSetRoot, onFolderRemove, onOpenFolderPath, onManageFolders, creatingFolderKey }) {
			const categoryLine = dragIndicator?.mode === "line" && dragIndicator.row.kind === "category" && dragIndicator.row.key === category.key ? dragIndicator.before ? "before" : "after" : void 0;
			const categoryInto = dragIndicator?.mode === "into" && dragIndicator.categoryKey === category.key;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "group",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategoryRow, {
					node: category,
					t,
					onToggle: onToggleCategory,
					onAddWorkspace,
					addingWorkspace,
					onRename: onGroupRename,
					onDelete: onGroupDelete,
					onTogglePin: onGroupTogglePin,
					onEditAppearance: onGroupAppearance,
					onDragStartCategory,
					dropActive: categoryInto,
					...categoryLine !== void 0 ? { insertLine: categoryLine } : {},
					onRowDragOver: onDragOverRow({
						kind: "category",
						key: category.key
					}),
					onRowDragLeave: onDragLeaveRow,
					onRowDrop: onDropRow(category.key, {
						kind: "category",
						key: category.key
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RowGroup, {
					expanded: category.expanded,
					className: "wgCategoryChildren",
					animate: animate && categoryRowCount(category) <= ANIMATION_ROW_CAP,
					children: category.workspaces.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
							node: workspace,
							t,
							onToggle: () => {
								onToggleWorkspace(workspace.workspaceId);
							},
							onNewSession: () => {
								onNewSession(workspace.workspaceId);
							},
							onRename: () => {
								onRenameRequest(workspace.workspaceId, workspace.label);
							},
							onDelete: () => {
								onDeleteRequest(workspace.workspaceId, workspace.label);
							},
							canMoveOut: canMoveOut(workspace.workspaceId),
							onMoveOut: () => {
								onMoveOut(workspace.workspaceId);
							},
							...onOpenInFolder !== void 0 ? { onOpenInFolder: () => {
								onOpenInFolder(workspace.workspaceId);
							} } : {},
							dropActive: false,
							...dragIndicator?.mode === "line" && dragIndicator.row.kind === "workspace" && dragIndicator.row.key === workspace.workspaceId ? { insertLine: dragIndicator.before ? "before" : "after" } : {},
							onRowDragOver: onDragOverRow({
								kind: "workspace",
								key: workspace.workspaceId
							}),
							onRowDragLeave: onDragLeaveRow,
							onRowDrop: onDropRow(category.key, {
								kind: "workspace",
								key: workspace.workspaceId
							}),
							onDragStartExtra: onDragStartWorkspace(workspace.workspaceId),
							onManageFolders: () => {
								onManageFolders(workspace.workspaceId);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceSubtree, {
							workspace,
							current,
							now,
							t,
							animate,
							onOpen,
							onSessionRename,
							onSessionArchive,
							onFork,
							onToggleFolder,
							onFolderNewSession,
							onFolderSetRoot,
							onFolderRemove,
							onOpenFolderPath,
							creatingFolderKey
						})]
					}, workspace.workspaceId))
				})]
			});
		}
		/**
		* Top-level (ungrouped) workspace rows rendered after the group folders. While
		* a project drag is in progress the WHOLE top-level area is the move-out
		* landing spot, shown with an insertion LINE (not a highlight box):
		* - a top-level row reorders before/after it (line above/below, like a group);
		* - the blank space below the last row appends to the end (line below the
		*   last row);
		* - an empty top level shows a standalone line under the last group folder.
		*/
		function TopLevelSection({ topLevel, current, now, t, dragging, dragIndicator, topLevelRef, onDragOverRow, onDragOverTopLevelArea, onDragLeaveRow, onDropRow, onDragStartWorkspace, onToggleWorkspace, onNewSession, onOpen, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onFork, onOpenInFolder, onToggleFolder, onFolderNewSession, onFolderSetRoot, onFolderRemove, onOpenFolderPath, onManageFolders, creatingFolderKey }) {
			const emptyLineActive = dragIndicator?.mode === "line" && dragIndicator.row.kind === "topLevel" && dragIndicator.row.key === topLevelRef.key;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "group",
				"aria-label": t("section.topLevel"),
				className: "wgTopLevelArea",
				onDragOver: onDragOverTopLevelArea,
				onDragLeave: onDragLeaveRow,
				onDrop: onDropRow(UNCATEGORIZED_KEY, topLevelRef),
				children: [topLevel.length === 0 && dragging && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `wgTopLevelEmpty${emptyLineActive ? " wgTopLevelEmptyActive" : ""}`,
					role: "treeitem",
					onDragOver: onDragOverRow(topLevelRef),
					onDragLeave: onDragLeaveRow,
					onDrop: onDropRow(UNCATEGORIZED_KEY, topLevelRef),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "wgTopLevelEmptyLine" })
				}), topLevel.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "group",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
						node: workspace,
						t,
						flat: true,
						onToggle: () => {
							onToggleWorkspace(workspace.workspaceId);
						},
						onNewSession: () => {
							onNewSession(workspace.workspaceId);
						},
						onRename: () => {
							onRenameRequest(workspace.workspaceId, workspace.label);
						},
						onDelete: () => {
							onDeleteRequest(workspace.workspaceId, workspace.label);
						},
						...onOpenInFolder !== void 0 ? { onOpenInFolder: () => {
							onOpenInFolder(workspace.workspaceId);
						} } : {},
						...dragIndicator?.mode === "line" && dragIndicator.row.kind === "topLevel" && dragIndicator.row.key === workspace.workspaceId ? { insertLine: dragIndicator.before ? "before" : "after" } : {},
						onRowDragOver: onDragOverRow({
							kind: "topLevel",
							key: workspace.workspaceId
						}),
						onRowDragLeave: onDragLeaveRow,
						onRowDrop: onDropRow(UNCATEGORIZED_KEY, {
							kind: "topLevel",
							key: workspace.workspaceId
						}),
						onDragStartExtra: onDragStartWorkspace(workspace.workspaceId),
						onManageFolders: () => {
							onManageFolders(workspace.workspaceId);
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceSubtree, {
						workspace,
						current,
						now,
						t,
						animate: !dragging,
						onOpen,
						onSessionRename,
						onSessionArchive,
						onFork,
						onToggleFolder,
						onFolderNewSession,
						onFolderSetRoot,
						onFolderRemove,
						onOpenFolderPath,
						creatingFolderKey
					})]
				}, workspace.workspaceId))]
			});
		}
		/**
		* Search hits inside one project. When the project owns extra folders the hits
		* keep their folder row (all expanded, since search prunes to matches) so a
		* match never loses the folder it came from.
		*/
		function SearchSubtree({ workspace, current, now, open, t }) {
			const folders = workspace.folders;
			if (folders === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				role: "group",
				children: workspace.sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
					node: session,
					currentId: current,
					now,
					t,
					onOpen: open,
					onRename: () => {},
					onFork: () => {},
					onArchive: () => {}
				}, session.id))
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				role: "group",
				children: folders.map((folder) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "group",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FolderRow, {
						node: folder,
						t,
						onToggle: () => {},
						onNewSession: () => {},
						onSetRoot: () => {},
						onRemove: () => {}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "group",
						children: folder.sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionRow, {
							node: session,
							nested: true,
							currentId: current,
							now,
							t,
							onOpen: open,
							onRename: () => {},
							onFork: () => {},
							onArchive: () => {}
						}, session.id))
					})]
				}, folderKey(workspace.workspaceId, folder.path)))
			});
		}
		/**
		* Search body rendered as a three-level tree pruned to matched branches:
		* Only branches that contain a hit are rendered, which keeps a long list short. Reuses the same row components as
		* the idle tree, so search keeps the same folder hierarchy the user is used to.
		*/
		/**
		* Search results, presentational only: the owner derives the tree and the
		* match set (so the pinned default-workspace bar can share that derivation).
		* This view never repeats the default workspace —tree.ts leaves it out of the
		* categories / top-level projections and hands it back as `tree.defaultWorkspace`.
		*/
		function SearchBody({ tree, matches, status, current, now, open, t }) {
			const groups = tree.categories;
			const searchTopLevel = tree.topLevel;
			const pending = status === "loading";
			const failed = status === "error";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wgList",
				role: "tree",
				"aria-label": t("search.results.aria"),
				children: [
					groups.map((category) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CategoryRow, {
							node: category,
							t,
							onToggle: () => {}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "group",
							children: category.workspaces.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								role: "group",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
									node: workspace,
									t,
									onToggle: () => {},
									onNewSession: () => {},
									onRename: () => {},
									onDelete: () => {}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchSubtree, {
									workspace,
									current,
									now,
									open,
									t
								})]
							}, workspace.workspaceId))
						})]
					}, category.key)),
					searchTopLevel.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "group",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceRow, {
							node: workspace,
							t,
							flat: true,
							onToggle: () => {},
							onNewSession: () => {},
							onRename: () => {},
							onDelete: () => {}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchSubtree, {
							workspace,
							current,
							now,
							open,
							t
						})]
					}, workspace.workspaceId)),
					pending && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSearchStatus",
						role: "status",
						children: t("search.pending")
					}),
					failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSearchStatus",
						role: "status",
						children: t("search.unavailable")
					}),
					!pending && groups.length === 0 && searchTopLevel.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgEmpty",
						children: t("search.noMatches")
					}),
					matches.hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wgSearchStatus",
						children: t("search.hasMore")
					})
				]
			});
		}
		// src/client/directory-flow.ts
		/** Adapt the elected self-contained picker, without stealing its original slot. */
		function directoryFlowFromEntry(entry) {
			if (!entry) return null;
			if (entry.store || entry.locale || entry.children || typeof entry.component !== "function") throw new Error("This directory picker requires an unsupported renderer context.");
			return {
				component: entry.component,
				injected: entry.inject?.() ?? {}
			};
		}
		// src/client/locales.ts
		/** Simplified Chinese dictionary. */
		const zh = {
			"section.workspaces": "工作区",
			"section.sessions": "会话",
			"search": "搜索",
			"search.placeholder": "搜索会话…",
			"search.clear": "清除",
			"search.noMatches": "没有匹配的会话",
			"search.unavailable": "搜索不可用",
			"search.pending": "搜索中…",
			"search.hasMore": "结果过多，请细化关键词",
			"search.results.aria": "搜索结果",
			"workspace.add": "添加工作区",
			"workspace.addBusy": "正在添加…",
			"workspace.addError": "添加失败",
			"workspace.addErrorTitle": "无法添加工作区",
			"workspace.rename": "重命名",
			"workspace.delete": "删除",
			"workspace.deleteTitle": "删除工作区",
			"workspace.deleteConfirm": "仅删除注册信息，目录与会话日志保留。确定删除？",
			"workspace.deleteCancel": "取消删除",
			"workspace.renaming": "重命名中…",
			"workspace.deleting": "删除中…",
			"workspace.renameTitle": "重命名工作区",
			"workspace.renamePlaceholder": "工作区名称",
			"workspace.renameConfirm": "重命名",
			"workspace.renameCancel": "取消",
			"workspace.moveOutOfGroup": "移出分组",
			"workspace.openInFolder": "在文件夹中打开",
			"workspace.openInFolderError": "打开文件夹失败",
			"folder.title": "文件夹",
			"folder.manage": "文件夹…",
			"folder.listAria": "工作区文件夹",
			"folder.sectionList": "项目文件夹",
			"folder.sectionAdd": "添加文件夹",
			"folder.emptyHint": "还没有额外文件夹。下面挂一个目录，它的会话会独立运行，模型也能直接读到里面的文件。",
			"folder.base": "基础文件夹",
			"folder.setRoot": "设为根目录",
			"folder.rootBadge": "根目录",
			"folder.remove": "从工作区移除",
			"folder.add": "添加文件夹",
			"folder.done": "完成",
			"folder.duplicate": "该文件夹已在此工作区中",
			"folder.conflict": "文件夹已被另一个窗口修改，已同步为最新状态，本次修改未保存，请重试",
			"folder.removeError": "远程工作区删除失败",
			"folder.removeRemotePrompt": "这个云端文件夹背后有一个工作区，移除时要连它一起删掉吗？删掉后它里面的会话也会消失。",
			"folder.removeRemoteDelete": "连工作区一起删",
			"folder.removeRemoteOnly": "只移除文件夹",
			"folder.addError": "添加文件夹失败",
			"folder.sessionError": "新建会话失败",
			"folder.saveError": "文件夹保存失败",
			"folder.notReady": "目录安全信息尚未加载，请重启 DSH 并刷新页面后重试",
			"folder.remoteSessionUnsupported": "当前 SSH 插件不完整支持子目录会话，请从远程工作区根目录打开会话。不会退回本地终端。",
			"folder.remoteHint": "输入一个文件夹名：本地使用 DSH 目录接口；远程使用 SSH 创建目录接口（远端同名目录已存在时复用）。SSH 不可用时不会在镜像里创建本地目录。",
			"folder.remoteNeedsSubpath": "远程工作区请用子目录方式添加文件夹",
			"folder.subpathLabel": "文件夹名称",
			"folder.subpathPlaceholder": "例如 data",
			"folder.addSubpath": "创建文件夹",
			"folder.subpathInvalid": "路径无效：请填工作区内的相对路径，不能用绝对路径或 ..",
			"folder.cloudSection": "云端文件夹",
			"folder.profileLabel": "SSH 连接",
			"folder.remotePathLabel": "远端目录",
			"folder.remotePathPlaceholder": "例如 ~/projects/app",
			"folder.remotePathOrName": "例如 ~/projects/app，或新目录名",
			"folder.createAndAdd": "新建并添加",
			"folder.cloudNoteBoth": "填绝对路径：新建一个云端工作区（带本地镜像）；只填名字：在项目云端根目录下新建该目录并挂进来",
			"folder.addRemote": "添加云端文件夹",
			"folder.noProfiles": "没有可用的 SSH 连接：请先在 remote-ssh 插件中配置连接",
			"folder.profilesError": "读取 SSH 连接失败",
			"folder.cloudTag": "云端",
			"folder.localTag": "本地",
			"folder.memberMissing": "该文件夹对应的独立工作区已不存在，请移除后重新添加",
			"folder.memberNested": "该目录本身已是一个含文件夹的项目，不能作为文件夹加入",
			"folder.alreadyRoot": "这就是项目的根目录，不能再作为一个文件夹加入",
			"folder.addAria": "添加文件夹的方式",
			"folder.tabLocal": "本地目录",
			"folder.tabCloud": "云端目录",
			"folder.pickLocal": "选择本地目录…",
			"folder.localNote": "在本机选一个目录，作为这个项目的文件夹",
			"folder.localIntoRemote": "这个项目在云端；本地目录会作为本地文件夹挂到这个项目里",
			"folder.cloudNote": "会为该远端目录建立本地镜像，并注册成一个工作区供会话使用",
			"folder.browse": "浏览…",
			"folder.browseTitle": "选择云端文件夹",
			"folder.browseListAria": "远端目录列表",
			"folder.browseNote": "只列出目录：点目录进入，用底部按钮选择当前目录。",
			"folder.browseFailed": "读取远端目录失败",
			"folder.chooseHere": "选择此目录",
			"folder.up": "上一级",
			"folder.home": "主目录",
			"folder.refresh": "刷新",
			"folder.loading": "正在读取远端目录…",
			"folder.emptyDir": "这个目录下没有子目录",
			"group.create": "新建分组",
			"group.createTitle": "新建分组",
			"group.createPlaceholder": "分组名称",
			"group.createConfirm": "创建",
			"group.createCancel": "取消",
			"group.rename": "重命名分组",
			"group.renameTitle": "重命名分组",
			"group.renameConfirm": "重命名",
			"group.delete": "删除分组",
			"group.deleteTitle": "删除分组",
			"group.deleteConfirm": "删除后，该分组内的所有项目将移到顶层（不归组）。确定删除？",
			"group.deleteCancel": "取消删除",
			"group.nameDuplicate": "已存在同名分组",
			"group.nameReserved": "该名称不可用",
			"group.pin": "置顶分组",
			"group.unpin": "取消置顶",
			"group.pinned": "已置顶",
			"group.appearance": "颜色与图标…",
			"group.appearanceTitle": "分组外观",
			"group.appearanceDone": "完成",
			"group.color": "颜色",
			"group.colorDefault": "默认",
			"group.icon": "图标",
			"group.iconDefault": "默认图标",
			"group.iconCustom": "自定义字符",
			"group.iconInvalid": "图标需为预设图标或 1–4 个字符",
			"group.icon.section.common": "常用图标",
			"group.icon.section.lab": "实验操作",
			"group.icon.section.materials": "材料结构",
			"group.icon.section.characterization": "表征测试",
			"group.icon.section.devices": "功能器件",
			"group.icon.section.emoji": "常用表情",
			"color.red": "红色",
			"color.orange": "橙色",
			"color.amber": "琥珀",
			"color.green": "绿色",
			"color.teal": "青色",
			"color.blue": "蓝色",
			"color.indigo": "靛蓝",
			"color.purple": "紫色",
			"color.pink": "粉色",
			"color.gray": "灰色",
			"section.topLevel": "顶层项目",
			"section.defaultWorkspace": "默认工作区",
			"manual.saveError": "分组变更保存失败",
			"manual.conflict": "分组已被另一个窗口修改，已同步为最新状态，本次修改未保存，请重试",
			"session.new": "新建会话",
			"session.rename": "重命名会话",
			"session.archive": "归档",
			"session.fork": "派生",
			"session.renameTitle": "重命名会话",
			"session.renamePlaceholder": "会话名称",
			"session.renameConfirm": "重命名",
			"session.renameCancel": "取消",
			"session.renaming": "重命名中…",
			"uncategorized": "未分类",
			"empty.none": "暂无内容",
			"empty.noWorkspaces": "还没有工作区",
			"close": "关闭",
			"cancel": "取消",
			"confirm": "确定",
			"retry": "重试",
			"configUnavailable": "分组配置不可用",
			"collapse": "折叠",
			"expandMore": "展开全部",
			"newSession": "新建会话",
			"quick.title": "快速切换",
			"quick.tab.workspaces": "工作区",
			"quick.tab.sessions": "全部会话",
			"quick.search.placeholder": "搜索工作区…",
			"quick.search.sessions": "搜索会话…",
			"quick.empty.workspaces": "没有匹配的工作区",
			"quick.action.newSession": "新建会话",
			"quick.action.running": "切到运行中的会话",
			"quick.action.noneRunning": "没有正在运行的会话",
			"quick.empty.sessions": "还没有会话",
			"quick.select.hint": "在上方选择一个工作区",
			"quick.hint": "Ctrl+R 开关 · Enter 打开/新建 · Esc 关闭",
			"tabs.aria": "已打开的会话",
			"tabs.close": "关闭标签",
			"tabs.archive": "归档",
			"tabs.pin": "固定标签",
			"tabs.unpin": "取消固定",
			"tabs.pinned": "已固定（关闭其他时保留）",
			"tabs.rename": "重命名标签",
			"tabs.renameSession": "重命名会话…",
			"tabs.renamePlaceholder": "标签名，留空恢复会话标题",
			"tabs.closeOthers": "关闭其他标签",
			"tabs.closeRight": "关闭右侧标签",
			"tabs.dragHint": "拖动可排序"
		};
		/** English dictionary. */
		const en = {
			"section.workspaces": "Workspaces",
			"section.sessions": "Sessions",
			"search": "Search",
			"search.placeholder": "Search sessions…",
			"search.clear": "Clear",
			"search.noMatches": "No matching sessions",
			"search.unavailable": "Search unavailable",
			"search.pending": "Searching…",
			"search.hasMore": "Too many results — refine the query",
			"search.results.aria": "Search results",
			"workspace.add": "Add workspace",
			"workspace.addBusy": "Adding…",
			"workspace.addError": "Add failed",
			"workspace.addErrorTitle": "Could not add workspace",
			"workspace.rename": "Rename",
			"workspace.delete": "Delete",
			"workspace.deleteTitle": "Delete workspace",
			"workspace.deleteConfirm": "Only the registration is removed; the directory and session logs stay. Delete?",
			"workspace.deleteCancel": "Cancel delete",
			"workspace.renaming": "Renaming…",
			"workspace.deleting": "Deleting…",
			"workspace.renameTitle": "Rename workspace",
			"workspace.renamePlaceholder": "Workspace name",
			"workspace.renameConfirm": "Rename",
			"workspace.renameCancel": "Cancel",
			"workspace.moveOutOfGroup": "Move out of group",
			"workspace.openInFolder": "Open in folder",
			"workspace.openInFolderError": "Could not open the folder",
			"folder.title": "Folders",
			"folder.manage": "Folders…",
			"folder.listAria": "Workspace folders",
			"folder.sectionList": "Project folders",
			"folder.sectionAdd": "Add a folder",
			"folder.emptyHint": "No extra folders yet. A folder added below runs its sessions on its own, so the agent can read the files inside it directly.",
			"folder.base": "Base folder",
			"folder.setRoot": "Set as root",
			"folder.rootBadge": "Root",
			"folder.remove": "Remove from workspace",
			"folder.add": "Add folder",
			"folder.done": "Done",
			"folder.duplicate": "That folder is already in this workspace",
			"folder.conflict": "Folders changed in another window; synced to the latest state, this edit was not saved — please retry",
			"folder.removeError": "Could not delete the remote workspace",
			"folder.removeRemotePrompt": "This cloud folder is backed by its own workspace. Remove the workspace along with it? Its sessions will be deleted too.",
			"folder.removeRemoteDelete": "Delete workspace too",
			"folder.removeRemoteOnly": "Remove folder only",
			"folder.addError": "Could not add the folder",
			"folder.sessionError": "Could not start a session",
			"folder.saveError": "Could not save folders",
			"folder.notReady": "Directory safety information is not loaded. Restart DSH and refresh the page before retrying.",
			"folder.remoteSessionUnsupported": "This SSH plugin does not fully support subdirectory sessions. Start from the remote workspace root instead; no local terminal fallback is allowed.",
			"folder.remoteHint": "Enter one folder name. Local workspaces use DSH; remote workspaces use SSH mkdir (existing remote directories are reused). Missing SSH never falls back to a local mirror write.",
			"folder.remoteNeedsSubpath": "Remote workspaces take a subdirectory, not a picked folder",
			"folder.subpathLabel": "Folder name",
			"folder.subpathPlaceholder": "e.g. data",
			"folder.addSubpath": "Create folder",
			"folder.subpathInvalid": "Invalid path: use a relative path inside the workspace (no absolute paths, no ..)",
			"folder.cloudSection": "Cloud folders",
			"folder.profileLabel": "SSH connection",
			"folder.remotePathLabel": "Remote directory",
			"folder.remotePathPlaceholder": "e.g. ~/projects/app",
			"folder.remotePathOrName": "e.g. ~/projects/app, or a new folder name",
			"folder.createAndAdd": "Create and add",
			"folder.cloudNoteBoth": "A path creates a new cloud workspace with its local mirror; a bare name creates that directory under this project’s remote root and attaches it",
			"folder.addRemote": "Add cloud folder",
			"folder.noProfiles": "No SSH connection available: configure one in the remote-ssh plugin first",
			"folder.profilesError": "Could not read SSH connections",
			"folder.cloudTag": "Cloud",
			"folder.localTag": "Local",
			"folder.memberMissing": "The standalone workspace behind this folder no longer exists. Remove the folder and add it again.",
			"folder.memberNested": "That directory is a project with folders of its own, so it cannot join as a folder.",
			"folder.alreadyRoot": "That is the root of this project, so it cannot join as a folder.",
			"folder.addAria": "Ways to add a folder",
			"folder.tabLocal": "Local directory",
			"folder.tabCloud": "Cloud directory",
			"folder.pickLocal": "Choose a local directory…",
			"folder.localNote": "Pick a directory on this machine to use as a folder of this project",
			"folder.localIntoRemote": "This project lives on the SSH host; a local directory joins it as a local folder",
			"folder.cloudNote": "Mirrors that remote directory locally and registers a workspace for its sessions",
			"folder.browse": "Browse…",
			"folder.browseTitle": "Choose a cloud folder",
			"folder.browseListAria": "Remote directory list",
			"folder.browseNote": "Only directories are listed: enter one, then choose the current directory with the button below.",
			"folder.browseFailed": "Could not read the remote directory",
			"folder.chooseHere": "Choose this directory",
			"folder.up": "Up",
			"folder.home": "Home",
			"folder.refresh": "Refresh",
			"folder.loading": "Reading the remote directory…",
			"folder.emptyDir": "No subdirectories here",
			"group.create": "New group",
			"group.createTitle": "New group",
			"group.createPlaceholder": "Group name",
			"group.createConfirm": "Create",
			"group.createCancel": "Cancel",
			"group.rename": "Rename group",
			"group.renameTitle": "Rename group",
			"group.renameConfirm": "Rename",
			"group.delete": "Delete group",
			"group.deleteTitle": "Delete group",
			"group.deleteConfirm": "Deleting removes this group; every project inside it moves to the top level (ungrouped). Delete?",
			"group.deleteCancel": "Cancel delete",
			"group.nameDuplicate": "A group with this name already exists",
			"group.nameReserved": "This name is not available",
			"group.pin": "Pin group",
			"group.unpin": "Unpin group",
			"group.pinned": "Pinned",
			"group.appearance": "Color & icon…",
			"group.appearanceTitle": "Group appearance",
			"group.appearanceDone": "Done",
			"group.color": "Color",
			"group.colorDefault": "Default",
			"group.icon": "Icon",
			"group.iconDefault": "Default icon",
			"group.iconCustom": "Custom character",
			"group.iconInvalid": "Use a preset icon or 1–4 characters",
			"group.icon.section.common": "Common icons",
			"group.icon.section.lab": "Lab operations",
			"group.icon.section.materials": "Material structures",
			"group.icon.section.characterization": "Characterization",
			"group.icon.section.devices": "Functional devices",
			"group.icon.section.emoji": "Emoji",
			"color.red": "Red",
			"color.orange": "Orange",
			"color.amber": "Amber",
			"color.green": "Green",
			"color.teal": "Teal",
			"color.blue": "Blue",
			"color.indigo": "Indigo",
			"color.purple": "Purple",
			"color.pink": "Pink",
			"color.gray": "Gray",
			"section.topLevel": "Top-level projects",
			"section.defaultWorkspace": "Default workspace",
			"manual.saveError": "Could not save group changes",
			"manual.conflict": "Groups changed in another window; synced to the latest state, this edit was not saved — please retry",
			"session.new": "New Session",
			"session.rename": "Rename session",
			"session.archive": "Archive",
			"session.fork": "Fork",
			"session.renameTitle": "Rename session",
			"session.renamePlaceholder": "Session name",
			"session.renameConfirm": "Rename",
			"session.renameCancel": "Cancel",
			"session.renaming": "Renaming…",
			"uncategorized": "Uncategorized",
			"empty.none": "Nothing here",
			"empty.noWorkspaces": "No workspaces yet",
			"close": "Close",
			"cancel": "Cancel",
			"confirm": "Confirm",
			"retry": "Retry",
			"configUnavailable": "Grouping config unavailable",
			"collapse": "Collapse",
			"expandMore": "Show all",
			"newSession": "New Session",
			"quick.title": "Quick switch",
			"quick.tab.workspaces": "Workspaces",
			"quick.tab.sessions": "All sessions",
			"quick.search.placeholder": "Search workspaces…",
			"quick.search.sessions": "Search sessions…",
			"quick.empty.workspaces": "No matching workspaces",
			"quick.action.newSession": "New Session",
			"quick.action.running": "Switch to running session",
			"quick.action.noneRunning": "No running session",
			"quick.empty.sessions": "No sessions yet",
			"quick.select.hint": "Pick a workspace above",
			"quick.hint": "Ctrl+R toggle · Enter open/new · Esc close",
			"tabs.aria": "Open sessions",
			"tabs.close": "Close tab",
			"tabs.archive": "Archive",
			"tabs.pin": "Pin tab",
			"tabs.unpin": "Unpin tab",
			"tabs.pinned": "Pinned (kept by Close others)",
			"tabs.rename": "Rename tab",
			"tabs.renameSession": "Rename session…",
			"tabs.renamePlaceholder": "Tab name — blank restores the session title",
			"tabs.closeOthers": "Close other tabs",
			"tabs.closeRight": "Close tabs to the right",
			"tabs.dragHint": "Drag to reorder"
		};
		// src/client/groups-client.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "workspaceGroups";
		/**
		* Tab visibility policy. `auto` is the behaviour the feature was asked for —
		* opening a session that has no tab yet adds one at the front of the strip;
		* `manual` leaves the strip to callers that drive `openTab` themselves.
		*/
		const TAB_OPEN_MODE = "auto";
		/**
		* Register the grouped browser once the sidebar slot declaration is on the
		* ledger. Inject factory returns plain callbacks; data reads use the
		* framework's global hooks.
		* @param ctx - client root context.
		*/
		function apply$1(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "@dsh-xhl/workspace-groups: dictionaries");
			const tabInstance = createSessionTabsStore().create();
			const tabWrites = tabInstance.actions;
			let hydrated = false;
			ctx.effect(() => {
				const stop = tabInstance.subscribe(() => {
					if (!hydrated) return;
					saveTabs({
						order: tabInstance.getSnapshot().order,
						tabs: tabInstance.getSnapshot().tabs
					});
				});
				return () => {
					stop();
				};
			}, "@dsh-xhl/workspace-groups: tab persistence");
			ctx.effect(() => {
				let cancelled = false;
				loadTabs().then((tabs) => {
					if (cancelled) return;
					if (tabs.length > 0) tabWrites.restore(tabs.map((tab) => ({
						sessionId: tab.sessionId,
						order: tab.order,
						...tab.pinned === true ? { pinned: true } : {},
						...tab.title !== void 0 ? { title: tab.title } : {}
					})));
					hydrated = true;
				}).catch(() => {
					if (!cancelled) hydrated = true;
				});
				return () => {
					cancelled = true;
				};
			}, "@dsh-xhl/workspace-groups: tab restore");
			const searchSessions = async (query, signal) => {
				const result = await ctx.sessions.search(query, signal);
				if (!result.ok) throw new Error(result.error.message);
				return result.value;
			};
			const browserInjected = () => ({
				startSession: (workspaceId) => {
					ctx.uiWorkspace.startSession(workspaceId);
				},
				createSessionIn: async (workspaceId, cwd) => {
					const sessionId = await ctx.sessions.create({
						workspaceId,
						...cwd === void 0 ? {} : { cwd }
					});
					ctx.uiWorkspace.openSession(sessionId);
					return sessionId;
				},
				open: (sessionId) => {
					ctx.uiWorkspace.openSession(sessionId);
				},
				forkSession: (sessionId) => {
					ctx.uiWorkspace.forkSession(sessionId).catch((reason) => {
						console.warn("fork session failed:", reason);
					});
				},
				archiveSession: async (sessionId) => {
					await ctx.uiWorkspace.archiveSession(sessionId);
				},
				pickDirectory: () => ctx.uiWorkspace.pickDirectory(),
				getDirectoryFlow: () => directoryFlowFromEntry(ctx.slots.entriesOfSlot("sidebar.workspaces.directoryFlow")[0]),
				createDirectory: (path, name) => ctx.uiWorkspace.createDirectory(path, name),
				searchSessions,
				searchResultLimit: ctx.sessions.searchResultLimit,
				hooks: { directoryFlow: {
					getSnapshot: () => true,
					subscribe: () => () => {}
				} },
				renameSession: async (sessionId, title) => {
					const session = ctx.sessions.binding(sessionId)?.session;
					if (session === void 0) throw new Error(`unknown session "${sessionId}"`);
					const result = await session.rename(title);
					if (!result.ok) throw new Error(result.error.message);
				},
				renameWorkspace: async (workspaceId, title) => {
					await ctx.workspaces.rename(workspaceId, title);
				},
				deleteWorkspace: async (workspaceId) => {
					await ctx.workspaces.delete(workspaceId);
				},
				insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
					await ctx.workspaces.insertBefore(workspaceId, beforeWorkspaceId);
				},
				insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
					await ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId);
				},
				createWorkspace: (input) => ctx.workspaces.create(input),
				openTab: (sessionId, status) => {
					const summary = ctx.sessions.list.getSnapshot().byId[sessionId];
					if (shouldOpenTab(TAB_OPEN_MODE, summary, status)) tabWrites.touch(sessionId);
				},
				useTabs: createStoreHook(tabInstance),
				tabActions: tabWrites
			});
			ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
				name: "sidebar.workspaces",
				priority: -1,
				store: createGroupsViewStore(),
				inject: browserInjected,
				locale: NS,
				registrant: "workspace-groups-local"
			}, GroupsBrowser));
		}
		// src/client/remote-ssh-factory.generated.mjs
		/**
		* @zhangfengshun/dsh-remote-ssh — Client 半边（静态 DSH Web 插件，浏览器 bundle）
		*
		* 远程文件与远程终端已合并到内置「文件」和「终端」页签：
		*   - 远程文件：内置「文件」页签通过 fs.* 拦截直接 SSH 读写远程文件，无需同步。
		*     远程终端由内置「终端」页签提供（shell wrapper 自动 SSH）。
		*   - 远程终端：shell wrapper 自动检测工作区 .remote-ssh.json，在远程工作区中打开 SSH 终端。
		*     需在 better-sidebar 设置中将 shell 指向 wrapper 脚本（见 README）。
		* 仍保留隐藏的 remssh:editor 页签用于远程文件编辑器。
		* 在 DSH 设置页注册「远程连接」小节管理连接配置和远程工作区；
		* 同时接管原生「添加工作区」流程提供「本地目录 / 远程目录」两选。
		*/
		var remote_ssh_factory_generated_default = (require$1) => {
			var module = { exports: {} };
			var exports = module.exports;
			var React = require$1("react");
			var Modal = require$1("@deepseek-ai/dsh-client-ui-primitives").Modal;
			function h(tag, props) {
				var args = [tag, props];
				for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
				return React.createElement.apply(React, args);
			}
			var CSS = ".rssh-row{margin:6px 0}.rssh-label{color:var(--dsw-alias-label-caption);font-size:11px;display:block;margin-bottom:2px}.rssh-input{width:100%;box-sizing:border-box;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:5px 7px;margin:3px 0;font-size:12px}.rssh-select{width:100%;box-sizing:border-box;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:5px 7px;margin:3px 0;font-size:12px}.rssh-btn{background:var(--dsw-alias-button-ghost-active-fill);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:4px 9px;cursor:pointer;font-size:12px}.rssh-btn:hover{background:var(--dsw-alias-button-ghost-active-hover)}.rssh-btn:disabled{opacity:.5;cursor:default}.rssh-card{padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;margin:8px 0;background:var(--dsw-alias-bg-layer-2)}.rssh-title{font-weight:600;font-size:13px}.rssh-sub{color:var(--dsw-alias-label-tertiary);font-size:11px}.rssh-actions{margin-top:6px;display:flex;gap:5px;flex-wrap:wrap}.rssh-tree-item{display:flex;align-items:center;gap:5px;padding:3px 5px;cursor:pointer;border-radius:3px}.rssh-tree-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.rssh-tree-dir{color:var(--dsw-alias-state-business-primary)}.rssh-tree-file{color:var(--dsw-alias-label-primary)}.rssh-tree-size{color:var(--dsw-alias-label-caption);font-size:11px;margin-left:auto}.rssh-pathbar{display:flex;gap:4px;align-items:center;margin:4px 0}.rssh-pathbar .rssh-input{flex:1;margin:0}.rssh-content{white-space:pre-wrap;font-family:Consolas,monospace;font-size:12px;background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-primary);padding:8px;border-radius:4px;margin-top:6px;max-height:400px;overflow:auto}.rssh-terminal{background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-primary);border-radius:4px;padding:6px;margin-top:8px;font-family:Consolas,monospace;font-size:12px}.rssh-terminal-out{white-space:pre-wrap;max-height:320px;overflow:auto;min-height:120px;line-height:1.4}.rssh-terminal-bar{display:flex;gap:5px;align-items:center;margin-bottom:4px}.rssh-terminal-input-row{display:flex;gap:4px;margin-top:5px}.rssh-terminal-input-row .rssh-input{flex:1}.rssh-ok{color:var(--dsw-alias-state-success-primary)}.rssh-err{color:var(--dsw-alias-state-error-primary)}.rssh-muted{color:var(--dsw-alias-label-tertiary);font-size:12px;padding:6px 0}.rssh-empty{padding:12px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px}.rssh-flow-dialog{width:690px!important;max-width:94vw!important;min-width:460px;resize:horizontal;overflow:auto!important}.rssh-seg{display:flex;gap:0;margin-bottom:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;overflow:hidden}.rssh-seg-btn{flex:1;padding:7px 12px;text-align:center;cursor:pointer;font-size:12px;font-weight:500;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border:none;transition:background .15s}.rssh-seg-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}.rssh-seg-btn.active{background:var(--dsw-alias-state-business-primary);color:#fff}.rssh-pick-tree{border:1px solid var(--dsw-alias-border-l1);border-radius:4px;max-height:240px;overflow-y:auto;margin-top:4px;background:var(--dsw-alias-bg-layer-2)}.rssh-pick-empty{padding:12px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:11px}";
			var NS = "dsh-remote-ssh";
			var zh = {
				"tabs.files": "远程文件",
				"tabs.term": "远程终端",
				"settings.nav": "远程连接",
				"settings.desc": "管理 Remote-SSH 的远程连接配置（SSH 密钥或密码认证）。",
				"settings.empty": "还没有连接配置。请在下方添加。",
				"settings.add": "添加连接",
				"settings.workspaces": "远程工作区",
				"settings.name": "名称",
				"settings.namePlaceholder": "如：我的超算",
				"settings.host": "主机 host",
				"settings.hostPlaceholder": "login.example.com",
				"settings.port": "端口 port",
				"settings.user": "用户名 user",
				"settings.userPlaceholder": "your-username",
				"settings.auth": "认证方式",
				"settings.key": "密钥 (推荐)",
				"settings.password": "密码",
				"settings.keyPath": "私钥路径 keyPath",
				"settings.keyPathPlaceholder": "~/.ssh/id_rsa",
				"settings.passwordField": "密码 password",
				"settings.remoteRoot": "远程根目录 remoteRoot",
				"settings.proxyJump": "跳板机 ProxyJump",
				"settings.test": "测试连接",
				"settings.saved": "已保存",
				"settings.connOk": "连接成功",
				"settings.connFail": "连接失败: ",
				"settings.errSave": "保存失败",
				"settings.guards": "写回与终端（进阶）",
				"settings.guardsHint": "终端起不来时，把 node 可执行文件的绝对路径填在这里（issue #23）；写回失败与远端新鲜度检查控制 agent 的 write/edit 要不要推到远端（issue #24）。",
				"settings.nodePath": "node 绝对路径 nodePath（留空 = 自动解析）",
				"settings.writeBackFailure": "写回推送失败时",
				"settings.wbError": "让模型看见（工具报错，推荐）",
				"settings.wbLog": "只写日志（不打扰模型）",
				"settings.writeBackFreshness": "推之前检查远端是否被改过（发现被改过就不推、并报告；推荐开着）",
				"settings.wsWriteBack": "该工作区启用写回（agent 的 write/edit 同步到远端）",
				"settings.wsWriteBackExclude": "写回排除（逗号或换行分隔，如 _patch/, *.log, wbdeep/**）",
				"settings.saveGuards": "保存这一项",
				"settings.wsSyncPaths": "同步范围（逗号或换行分隔，如 .dsh；留空 = 整树）",
				"settings.wsSyncExclude": "同步排除（逗号或换行分隔，如 data/, *.log）",
				"settings.wsSyncMaxBytes": "同步体积上限（GiB，留空 = 默认 2 GiB）",
				"settings.syncScope": "同步范围（进阶）",
				"settings.syncScopeHint": "只同步需要的子路径，避免整树 tar。对远程路径是 ~ 的工作区尤其重要：整树会先被体积上限拒绝（issue #28）。留空 = 整树。",
				"settings.defaultSyncPaths": "新工作区的默认同步范围（逗号或换行分隔）",
				"settings.defaultSyncExclude": "新工作区的默认同步排除",
				"settings.defaultSyncMaxBytes": "默认同步体积上限（GiB，留空 = 内置 2 GiB）",
				"sync.upDone": "推送完成",
				"sync.upFail": "推送失败: ",
				"common.selectProfile": "— 选择连接 —",
				"common.profile": "连接配置",
				"common.save": "保存",
				"common.open": "打开",
				"common.close": "关闭",
				"common.noEntries": "（无子目录）",
				"common.delete": "删除",
				"common.up": "⬆ 上级",
				"common.loading": "加载中…",
				"common.processing": "处理中…",
				"common.errList": "读取目录失败",
				"files.workspace": "远程工作区",
				"files.selectWorkspace": "— 选择工作区 —",
				"files.orProfile": "或直接选连接配置",
				"files.defaultDir": "默认目录（打开该工作区时进入的远程目录）",
				"files.reading": "读取中…",
				"files.errRead": "读取失败",
				"files.errSave": "保存失败",
				"files.errSaveDefaultDir": "保存默认目录失败",
				"files.binary": "二进制文件，无法预览",
				"term.title": "终端 {id}",
				"term.exited": " (已退出)",
				"term.connecting": "正在连接…",
				"term.noOutput": "(无输出)",
				"term.inputPlaceholder": "输入命令后回车…",
				"term.send": "发送",
				"term.needProfile": "请先选择连接配置",
				"term.newTerminal": "+ 新建终端",
				"term.emptyHint": "从上面的连接配置新建一个终端，直接操作远程环境。",
				"term.errSpawn": "启动终端失败",
				"picker.dir": "目录",
				"picker.choose": "选择此目录",
				"picker.errNameEmpty": "目录名不能为空",
				"picker.errNameBad": "目录名不能包含 / 或 \\，也不能是 . 或 ..",
				"flow.localTitle": "选择本地目录",
				"flow.remoteTitle": "选择远程目录",
				"flow.localDir": "本地目录",
				"flow.remoteDir": "远程目录",
				"flow.addWsTitle": "添加工作区",
				"flow.localSeg": "📁 本地目录",
				"flow.remoteSeg": "🌐 远程目录",
				"flow.syncPaths": "同步范围（可选，留空 = 全局默认/整树）",
				"flow.browse": "浏览",
				"flow.chooseRemote": "选择远程目录…",
				"flow.backLocal": "← 选择本地目录",
				"flow.errCreate": "创建远程工作区失败",
				"flow.errMkdir": "新建目录失败",
				"settings.importSshConfig": "从 ~/.ssh/config 导入…",
				"settings.importTitle": "导入 ~/.ssh/config 主机",
				"settings.noneFound": "未在 ~/.ssh/config 中发现可用主机",
				"settings.imported": "已导入 {n} 个连接",
				"sync.down": "⬇ 同步",
				"sync.up": "⬆ 推送",
				"sync.syncing": "同步中…",
				"sync.pushing": "推送中…",
				"sync.done": "同步完成",
				"sync.fail": "同步失败",
				"ops.search": "🔍 搜索",
				"ops.find": "按名查找",
				"ops.searchPh": "正则或关键词…",
				"ops.globPh": "*.py",
				"ops.newDir": "📁 新建目录",
				"ops.newDirPh": "目录名",
				"ops.rename": "✏ 重命名/移动",
				"ops.renamePh": "目标路径",
				"ops.delete": "🗑 删除",
				"ops.confirmDel": "确认删除远程文件/目录？（不可恢复）",
				"ops.grepTitle": "远程内容搜索 (grep)",
				"ops.globTitle": "按文件名查找 (glob)",
				"ops.mkdirTitle": "新建远程目录",
				"ops.moveTitle": "移动/重命名",
				"ops.deleteTitle": "删除远程文件/目录",
				"ops.noMatch": "无匹配",
				"ops.done": "操作完成",
				"ops.fail": "操作失败"
			};
			var en = {
				"tabs.files": "Remote Files",
				"tabs.term": "Remote Terminal",
				"settings.nav": "Remote Connections",
				"settings.desc": "Manage Remote-SSH connection profiles (SSH key or password authentication).",
				"settings.empty": "No connection profiles yet. Add one below.",
				"settings.add": "Add Profile",
				"settings.workspaces": "Remote Workspaces",
				"settings.name": "Name",
				"settings.namePlaceholder": "e.g. My HPC",
				"settings.host": "Host",
				"settings.hostPlaceholder": "login.example.com",
				"settings.port": "Port",
				"settings.user": "User",
				"settings.userPlaceholder": "your-username",
				"settings.auth": "Authentication",
				"settings.key": "Key (recommended)",
				"settings.password": "Password",
				"settings.keyPath": "Private key path (keyPath)",
				"settings.keyPathPlaceholder": "~/.ssh/id_rsa",
				"settings.passwordField": "Password",
				"settings.remoteRoot": "Remote root (remoteRoot)",
				"settings.proxyJump": "ProxyJump (jump host)",
				"settings.test": "Test Connection",
				"settings.saved": "Saved",
				"settings.connOk": "Connected",
				"settings.connFail": "Connection failed: ",
				"settings.errSave": "Save failed",
				"settings.guards": "Write-back & terminal (advanced)",
				"settings.guardsHint": "If the integrated terminal cannot start, put the absolute path of node here (issue #23). The other two control whether the agent's write/edit is pushed to the remote (issue #24).",
				"settings.nodePath": "Absolute path of node (nodePath; empty = auto-resolve)",
				"settings.writeBackFailure": "When a write-back push fails",
				"settings.wbError": "Make it visible to the model (tool error, recommended)",
				"settings.wbLog": "Log only (do not disturb the model)",
				"settings.writeBackFreshness": "Check the remote before pushing (skip + report if it changed remotely; recommended on)",
				"settings.wsWriteBack": "Enable write-back for this workspace (agent write/edit syncs to the remote)",
				"settings.wsWriteBackExclude": "Write-back excludes (comma or newline separated, e.g. _patch/, *.log, wbdeep/**)",
				"settings.saveGuards": "Save this item",
				"settings.wsSyncPaths": "Sync scope (comma or newline separated, e.g. .dsh; empty = whole tree)",
				"settings.wsSyncExclude": "Sync excludes (comma or newline separated, e.g. data/, *.log)",
				"settings.wsSyncMaxBytes": "Sync size limit (GiB, empty = default 2 GiB)",
				"settings.syncScope": "Sync scope (advanced)",
				"settings.syncScopeHint": "Sync only the sub-paths you need instead of a whole-tree tar. This matters for workspaces whose remote path is ~ — a whole-tree sync is refused by the size sentinel first (issue #28). Empty = whole tree.",
				"settings.defaultSyncPaths": "Default sync scope for new workspaces (comma or newline separated)",
				"settings.defaultSyncExclude": "Default sync excludes for new workspaces",
				"settings.defaultSyncMaxBytes": "Default sync size limit (GiB, empty = built-in 2 GiB)",
				"sync.upDone": "Push complete",
				"sync.upFail": "Push failed: ",
				"common.selectProfile": "— Select profile —",
				"common.profile": "Profile",
				"common.save": "Save",
				"common.open": "Open",
				"common.close": "Close",
				"common.noEntries": "(no subdirectories)",
				"common.delete": "Delete",
				"common.up": "⬆ Up",
				"common.loading": "Loading…",
				"common.processing": "Processing…",
				"common.errList": "Failed to list directory",
				"files.workspace": "Remote Workspace",
				"files.selectWorkspace": "— Select workspace —",
				"files.orProfile": "or pick a profile directly",
				"files.defaultDir": "Default directory (entered when opening this workspace)",
				"files.reading": "Reading…",
				"files.errRead": "Failed to read",
				"files.errSave": "Failed to save",
				"files.errSaveDefaultDir": "Failed to save default directory",
				"files.binary": "Binary file — preview not available",
				"term.title": "Terminal {id}",
				"term.exited": " (exited)",
				"term.connecting": "Connecting…",
				"term.noOutput": "(no output)",
				"term.inputPlaceholder": "Type a command and press Enter…",
				"term.send": "Send",
				"term.needProfile": "Select a profile first",
				"term.newTerminal": "+ New terminal",
				"term.emptyHint": "Create a terminal from the profile above to operate the remote environment.",
				"term.errSpawn": "Failed to start terminal",
				"picker.dir": "Directory",
				"picker.choose": "Choose this directory",
				"picker.errNameEmpty": "Folder name cannot be empty",
				"picker.errNameBad": "Folder name cannot contain / or \\, nor be . or ..",
				"flow.localTitle": "Select Local Directory",
				"flow.remoteTitle": "Select Remote Directory",
				"flow.localDir": "Local directory",
				"flow.remoteDir": "Remote directory",
				"flow.addWsTitle": "Add Workspace",
				"flow.localSeg": "📁 Local",
				"flow.remoteSeg": "🌐 Remote",
				"flow.syncPaths": "Sync scope (optional, empty = global default / whole tree)",
				"flow.browse": "Browse",
				"flow.chooseRemote": "Choose remote directory…",
				"flow.backLocal": "← Choose local directory",
				"flow.errCreate": "Failed to create remote workspace",
				"flow.errMkdir": "Failed to create the folder",
				"settings.importSshConfig": "Import from ~/.ssh/config…",
				"settings.importTitle": "Import ~/.ssh/config hosts",
				"settings.noneFound": "No usable hosts found in ~/.ssh/config",
				"settings.imported": "Imported {n} connection(s)",
				"sync.down": "⬇ Sync",
				"sync.up": "⬆ Push",
				"sync.syncing": "Syncing…",
				"sync.pushing": "Pushing…",
				"sync.done": "Sync complete",
				"sync.fail": "Sync failed",
				"ops.search": "🔍 Search",
				"ops.find": "Find by name",
				"ops.searchPh": "regex or keyword…",
				"ops.globPh": "*.py",
				"ops.newDir": "📁 New dir",
				"ops.newDirPh": "dir name",
				"ops.rename": "✏ Rename/Move",
				"ops.renamePh": "target path",
				"ops.delete": "🗑 Delete",
				"ops.confirmDel": "Confirm delete remote file/dir? (irreversible)",
				"ops.grepTitle": "Remote content search (grep)",
				"ops.globTitle": "Find by name (glob)",
				"ops.mkdirTitle": "Create remote directory",
				"ops.moveTitle": "Move/Rename",
				"ops.deleteTitle": "Delete remote file/dir",
				"ops.noMatch": "No match",
				"ops.done": "Done",
				"ops.fail": "Operation failed"
			};
			var i18n = {
				t: function(key) {
					return key;
				},
				subscribe: function() {
					return function() {};
				},
				getSnapshot: function() {
					return 0;
				}
			};
			function useT() {
				var force = React.useState(0)[1];
				React.useEffect(function() {
					return i18n.subscribe(function() {
						force(function(n) {
							return n + 1;
						});
					});
				}, []);
				return i18n.t;
			}
			async function api(method, args) {
				try {
					var r = await fetch("/remote-ssh/api/" + method, {
						method: "POST",
						headers: {
							"content-type": "application/json",
							"x-requested-with": "XMLHttpRequest"
						},
						body: JSON.stringify(args || {})
					});
					var j = await r.json();
					if (j && j.ok) return j.value;
					return {
						ok: false,
						error: j && j.error && j.error.message || "HTTP " + r.status
					};
				} catch (e) {
					return {
						ok: false,
						error: String(e && e.message ? e.message : e)
					};
				}
			}
			function useProfiles(refreshKey) {
				var state = React.useState([]);
				var profiles = state[0], setProfiles = state[1];
				React.useEffect(function() {
					api("listProfiles").then(function(r) {
						if (r && r.ok) setProfiles(r.profiles || []);
					});
				}, [refreshKey]);
				return profiles;
			}
			function Field(props) {
				return h("div", { className: "rssh-row" }, h("span", { className: "rssh-label" }, props.label), h("input", {
					className: "rssh-input",
					type: props.type || "text",
					value: props.value,
					placeholder: props.placeholder,
					onChange: function(e) {
						props.onChange(e.target.value);
					}
				}));
			}
			/** 「逗号或换行分隔」的列表文本 → 数组。 */
			function splitList(value) {
				return String(value == null ? "" : value).split(/[\n,;]/).map(function(s) {
					return s.trim();
				}).filter(Boolean);
			}
			/** 字节数 → GiB 文本（空 = 用宿主内置默认上限）。 */
			function bytesToGibText(bytes) {
				var n = Number(bytes) || 0;
				if (!n) return "";
				return String(Math.round(n / 1073741824 * 100) / 100);
			}
			/** GiB 文本 → 字节；空/非法 → 0（= 用宿主内置默认上限）。 */
			function gibTextToBytes(text) {
				var n = parseFloat(String(text == null ? "" : text).replace(/[^0-9.]/g, ""));
				if (!isFinite(n) || n <= 0) return 0;
				return Math.round(n * 1073741824);
			}
			/** 宿主返回的偏好 → 界面状态（数组转文本，字节转 GiB）。 */
			function prefsForUi(p) {
				var v = p || {};
				return {
					nodePath: String(v.nodePath || ""),
					writeBackFailure: String(v.writeBackFailure || "error"),
					writeBackFreshness: v.writeBackFreshness !== false,
					defaultSyncPaths: (v.defaultSyncPaths || []).join(", "),
					defaultSyncExclude: (v.defaultSyncExclude || []).join(", "),
					defaultSyncMaxBytes: bytesToGibText(v.defaultSyncMaxBytes)
				};
			}
			function RemoteEditor(props) {
				var t = useT();
				var tab = props.tab || {};
				var ctx = props.ctx;
				var meta = tab.meta || {};
				var profileId = meta.profileId || "";
				var remotePath = tab.path || meta.remotePath || "";
				var [data, setData] = React.useState({
					loading: true,
					content: "",
					binary: false,
					dirty: false,
					error: null
				});
				React.useEffect(function() {
					var alive = true;
					setData({
						loading: true,
						content: "",
						binary: false,
						dirty: false,
						error: null
					});
					api("readFile", {
						profileId,
						path: remotePath
					}).then(function(r) {
						if (!alive) return;
						if (r && r.ok) setData({
							loading: false,
							content: r.content || "",
							binary: !!r.binary,
							dirty: false,
							error: null
						});
						else setData({
							loading: false,
							content: "",
							binary: false,
							dirty: false,
							error: r && r.error || t("files.errRead")
						});
					});
					return function() {
						alive = false;
					};
				}, [profileId, remotePath]);
				function save() {
					api("writeFile", {
						profileId,
						path: remotePath,
						content: data.content
					}).then(function(r) {
						if (r && r.ok) setData(Object.assign({}, data, {
							dirty: false,
							error: null
						}));
						else setData(Object.assign({}, data, { error: r && r.error || t("files.errSave") }));
					});
				}
				function close() {
					if (ctx && ctx.betterSidebar && tab.id) ctx.betterSidebar.closeTab(tab.id);
				}
				if (data.loading) return h("div", {
					className: "rssh-muted",
					style: { padding: 8 }
				}, t("files.reading"));
				if (data.error) return h("div", {
					className: "rssh-err",
					style: {
						padding: 8,
						whiteSpace: "pre-wrap"
					}
				}, data.error);
				if (data.binary) return h("div", {
					className: "rssh-muted",
					style: { padding: 8 }
				}, t("files.binary"));
				return h("div", { style: {
					display: "flex",
					flexDirection: "column",
					flex: 1,
					minHeight: 0,
					padding: 8,
					overflow: "hidden"
				} }, h("div", {
					className: "rssh-pathbar",
					style: { flex: "none" }
				}, h("span", {
					className: "rssh-title",
					style: {
						flex: 1,
						wordBreak: "break-all"
					}
				}, remotePath), h("button", {
					className: "rssh-btn",
					onClick: save
				}, t("common.save")), h("button", {
					className: "rssh-btn",
					onClick: close
				}, t("common.close"))), h("textarea", {
					className: "rssh-content",
					style: {
						flex: 1,
						minHeight: 0,
						maxHeight: "none",
						width: "100%",
						boxSizing: "border-box",
						background: "var(--dsw-alias-markdown-code-block)",
						color: "var(--dsw-alias-label-primary)",
						border: "1px solid var(--dsw-alias-border-l2)"
					},
					value: data.content,
					onChange: function(e) {
						setData(Object.assign({}, data, {
							content: e.target.value,
							dirty: true
						}));
					}
				}));
			}
			function localListFn(workspaces, p) {
				return fetch("/sidebar/api/fs.tree", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						sessionId: "",
						path: p || ""
					})
				}).then(function(r) {
					return r.json();
				}).then(function(j) {
					if (!j || !j.ok) return {
						ok: false,
						error: j && j.error && j.error.message || "list failed"
					};
					var v = j.value || {};
					return {
						ok: true,
						path: v.path || p || "",
						entries: (v.entries || []).filter(function(e) {
							return e.isDir;
						}).map(function(e) {
							return {
								name: e.name,
								type: "directory",
								path: e.path
							};
						})
					};
				}).catch(function(e) {
					return {
						ok: false,
						error: String(e && e.message ? e.message : e)
					};
				});
			}
			function remoteListFn(profileId, p) {
				return api("listDir", {
					profileId,
					path: p
				}).then(function(r) {
					if (!(r && r.ok)) return r;
					var parent = r.path || "";
					var entries = (r.entries || []).map(function(e) {
						return {
							name: e.name,
							type: e.type,
							path: (parent ? parent.replace(/\/+$/, "") + "/" : "") + e.name
						};
					});
					return {
						ok: true,
						path: r.path,
						entries
					};
				});
			}
			function parentOf(path) {
				if (!path) return null;
				var str = String(path).replace(/[\/\\]+$/, "");
				if (str === "") return null;
				var idx = Math.max(str.lastIndexOf("/"), str.lastIndexOf("\\"));
				if (idx < 0) return null;
				var parent = str.slice(0, idx);
				if (/^[A-Za-z]:$/.test(parent)) return parent + "\\";
				if (parent === "") return "/";
				return parent;
			}
			function newDirNameError(name) {
				var s = String(name == null ? "" : name).trim();
				if (!s) return "picker.errNameEmpty";
				if (s === "." || s === "..") return "picker.errNameBad";
				if (s.indexOf("/") >= 0 || s.indexOf("\\") >= 0) return "picker.errNameBad";
				return null;
			}
			function joinChild(base, name) {
				var raw = String(base == null ? "" : base);
				var b = raw.replace(/[\/\\]+$/, "");
				if (!b) return (raw.charAt(0) === "/" ? "/" : "") + String(name);
				return b + (b.indexOf("\\") >= 0 && b.indexOf("/") < 0 || /^[A-Za-z]:$/.test(b) ? "\\" : "/") + String(name);
			}
			function DirPicker(props) {
				var t = useT();
				var [path, setPath] = React.useState("");
				var [entries, setEntries] = React.useState([]);
				var [err, setErr] = React.useState(null);
				var [loading, setLoading] = React.useState(false);
				var [newDir, setNewDir] = React.useState(null);
				var listFnRef = React.useRef(props.listFn);
				listFnRef.current = props.listFn;
				function load(p) {
					setLoading(true);
					setErr(null);
					listFnRef.current(p).then(function(r) {
						setLoading(false);
						if (r && r.ok) {
							setEntries(r.entries || []);
							setPath(r.path || p || "");
						} else setErr(r && r.error || t("common.errList"));
					});
				}
				React.useEffect(function() {
					load(void 0);
				}, [props.resetKey]);
				function enterDir(e) {
					load(e.path);
				}
				function goUp() {
					var up = parentOf(path);
					if (up !== null) load(up);
				}
				function open() {
					load(path || void 0);
				}
				function submitNewDir() {
					if (!newDir || !props.createFn) return;
					var name = String(newDir.name || "").trim();
					var invalid = newDirNameError(name);
					if (invalid) {
						setNewDir({
							name,
							busy: false,
							error: t(invalid)
						});
						return;
					}
					setNewDir({
						name,
						busy: true,
						error: null
					});
					Promise.resolve(props.createFn(path, name)).then(function(r) {
						if (r && r.ok) {
							setNewDir(null);
							load(r && r.path || joinChild(path, name));
						} else setNewDir({
							name,
							busy: false,
							error: r && r.error || t("common.errList")
						});
					}).catch(function(e) {
						setNewDir({
							name,
							busy: false,
							error: String(e && e.message ? e.message : e)
						});
					});
				}
				return h("div", null, h("div", { className: "rssh-pathbar" }, h("input", {
					className: "rssh-input",
					value: path,
					onChange: function(e) {
						setPath(e.target.value);
					},
					onKeyDown: function(e) {
						if (e.key === "Enter") {
							e.preventDefault();
							open();
						}
					},
					placeholder: props.placeholder || t("picker.dir")
				}), h("button", {
					className: "rssh-btn",
					onClick: open,
					disabled: loading
				}, t("common.open")), h("button", {
					className: "rssh-btn",
					onClick: goUp
				}, t("common.up"))), newDir ? h("div", {
					className: "rssh-pathbar",
					style: { marginTop: 6 }
				}, h("input", {
					className: "rssh-input",
					value: newDir.name,
					autoFocus: true,
					placeholder: t("ops.newDirPh"),
					onChange: function(e) {
						setNewDir({
							name: e.target.value,
							busy: false,
							error: null
						});
					},
					onKeyDown: function(e) {
						if (e.key === "Enter") {
							e.preventDefault();
							submitNewDir();
						}
					}
				}), h("button", {
					className: "rssh-btn",
					onClick: submitNewDir,
					disabled: newDir.busy
				}, newDir.busy ? t("common.processing") : t("common.save")), h("button", {
					className: "rssh-btn",
					onClick: function() {
						setNewDir(null);
					},
					disabled: newDir.busy
				}, t("common.close"))) : null, newDir && newDir.error ? h("div", { className: "rssh-err" }, newDir.error) : null, loading ? h("div", { className: "rssh-muted" }, t("common.loading")) : null, err ? h("div", { className: "rssh-err" }, err) : null, h("div", { className: "rssh-pick-tree" }, entries.filter(function(e) {
					return e.type === "directory";
				}).length === 0 && !loading ? h("div", { className: "rssh-pick-empty" }, t("common.noEntries")) : entries.filter(function(e) {
					return e.type === "directory";
				}).map(function(e) {
					return h("div", {
						key: e.path || e.name,
						className: "rssh-tree-item",
						onClick: function() {
							enterDir(e);
						}
					}, h("span", { className: "rssh-tree-dir" }, "📁 " + e.name));
				})), h("div", {
					className: "rssh-actions",
					style: { marginTop: 8 }
				}, h("button", {
					className: "rssh-btn",
					disabled: !path || props.disabled,
					onClick: function() {
						props.onChoose(path);
					}
				}, t("picker.choose")), props.createFn ? h("button", {
					className: "rssh-btn",
					disabled: !path || loading || props.disabled || !!(newDir && newDir.busy),
					onClick: function() {
						setNewDir({
							name: "",
							busy: false,
							error: null
						});
					}
				}, t("ops.newDir")) : null));
			}
			function RemoteWorkspaceFlow(props) {
				var t = useT();
				var [mode, setMode] = React.useState("local");
				var profiles = useProfiles(props.open);
				var [profileId, setProfileId] = React.useState("");
				var [creating, setCreating] = React.useState(false);
				var [syncPaths, setSyncPaths] = React.useState("");
				React.useEffect(function() {
					if (props.open) {
						setMode("local");
						setProfileId("");
						setSyncPaths("");
					}
				}, [props.open]);
				if (!props.open) return null;
				function chooseLocal(p) {
					props.onPicked(p);
				}
				function chooseRemote(remotePath) {
					setCreating(true);
					var payload = {
						profileId,
						remotePath
					};
					var scope = splitList(syncPaths);
					if (scope.length) payload.syncPaths = scope;
					api("createRemoteWorkspace", payload).then(function(r) {
						setCreating(false);
						if (r && r.ok && r.mirrorPath) props.onPicked(r.mirrorPath);
						else props.onError(r && r.error || t("flow.errCreate"));
					});
				}
				var canClose = !creating && !props.busy;
				var isRemote = mode === "remote";
				return h(Modal, {
					open: true,
					onClose: function() {
						if (canClose) props.onCancel();
					},
					title: t("flow.addWsTitle"),
					closeLabel: t("common.close"),
					className: "rssh-flow-dialog"
				}, h("div", { style: { padding: 8 } }, creating || props.busy ? h("div", { className: "rssh-muted" }, t("common.processing")) : null, h("div", { className: "rssh-seg" }, h("button", {
					className: "rssh-seg-btn" + (isRemote ? "" : " active"),
					onClick: function() {
						setMode("local");
					},
					disabled: !!props.busy || creating
				}, t("flow.localSeg")), h("button", {
					className: "rssh-seg-btn" + (isRemote ? " active" : ""),
					onClick: function() {
						setMode("remote");
					},
					disabled: !!props.busy || creating
				}, t("flow.remoteSeg"))), isRemote ? h("div", { className: "rssh-row" }, h("span", { className: "rssh-label" }, t("common.profile")), h("select", {
					className: "rssh-select",
					value: profileId,
					onChange: function(e) {
						setProfileId(e.target.value);
					},
					disabled: creating
				}, h("option", { value: "" }, t("common.selectProfile")), profiles.map(function(p) {
					return h("option", {
						key: p.id,
						value: p.id
					}, p.name);
				}))) : null, isRemote ? Field({
					label: t("flow.syncPaths"),
					value: syncPaths,
					onChange: setSyncPaths,
					placeholder: ".dsh"
				}) : null, isRemote ? profileId ? h(DirPicker, {
					resetKey: profileId,
					placeholder: t("flow.remoteDir"),
					listFn: function(p) {
						return remoteListFn(profileId, p);
					},
					createFn: function(p, name) {
						var target = joinChild(p, name);
						return api("mkdir", {
							profileId,
							path: target
						}).then(function(r) {
							return r && r.ok ? {
								ok: true,
								path: target
							} : {
								ok: false,
								error: r && r.error || t("flow.errMkdir")
							};
						});
					},
					onChoose: chooseRemote,
					disabled: creating
				}) : h("div", { className: "rssh-pick-empty" }, t("common.selectProfile")) : h(DirPicker, {
					resetKey: "local",
					placeholder: t("flow.localDir"),
					listFn: function(p) {
						return localListFn(props.workspaces, p);
					},
					createFn: function(p, name) {
						var target = joinChild(p, name);
						return api("mkdirLocal", { path: target }).then(function(r) {
							return r && r.ok ? {
								ok: true,
								path: target
							} : {
								ok: false,
								error: r && r.error || t("flow.errMkdir")
							};
						});
					},
					onChoose: chooseLocal
				})));
			}
			function SettingsSection(props) {
				var t = useT();
				var [profiles, setProfiles] = React.useState([]);
				var [workspaces, setWorkspaces] = React.useState([]);
				var [form, setForm] = React.useState({
					name: "",
					host: "",
					port: "22",
					user: "",
					authMethod: "key",
					keyPath: "",
					password: "",
					remoteRoot: "~",
					proxyJump: ""
				});
				var [result, setResult] = React.useState(null);
				var [busy, setBusy] = React.useState(false);
				var [importDlg, setImportDlg] = React.useState(null);
				var [prefs, setPrefs] = React.useState(prefsForUi(null));
				var [guards, setGuards] = React.useState({});
				var [prefsMsg, setPrefsMsg] = React.useState(null);
				var [syncId, setSyncId] = React.useState("");
				var set = function(k, v) {
					setForm(function(f) {
						var n = {};
						for (var key in f) n[key] = f[key];
						n[k] = v;
						return n;
					});
				};
				var setPref = function(k, v) {
					setPrefs(function(p) {
						var n = {};
						for (var key in p) n[key] = p[key];
						n[k] = v;
						return n;
					});
				};
				var setGuard = function(id, k, v) {
					setGuards(function(g) {
						var n = {};
						for (var key in g) n[key] = g[key];
						n[id] = Object.assign({}, n[id] || {}, { [k]: v });
						return n;
					});
				};
				function reload() {
					api("listProfiles").then(function(r) {
						if (r && r.ok) setProfiles(r.profiles || []);
					});
					api("listWorkspaces").then(function(r) {
						if (!r || !r.ok) return;
						var list = r.workspaces || [];
						setWorkspaces(list);
						var g = {};
						list.forEach(function(w) {
							g[w.id] = {
								writeBack: w.writeBack !== false,
								exclude: (w.writeBackExclude || []).join(", "),
								syncPaths: (w.syncPaths || []).join(", "),
								syncExclude: (w.syncExclude || []).join(", "),
								syncMaxBytes: bytesToGibText(w.syncMaxBytes)
							};
						});
						setGuards(g);
					});
					api("getPrefs").then(function(r) {
						if (r && r.ok && r.prefs) setPrefs(prefsForUi(r.prefs));
					});
				}
				React.useEffect(reload, []);
				/** 保存全局偏好（nodePath 是 #23 的逃生舱，writeBack* 是 #24 的开关，defaultSync* 是 #28 的默认范围）。 */
				function savePrefs() {
					setPrefsMsg(null);
					api("savePrefs", {
						nodePath: String(prefs.nodePath || ""),
						writeBackFailure: String(prefs.writeBackFailure || "error"),
						writeBackFreshness: prefs.writeBackFreshness !== false,
						defaultSyncPaths: splitList(prefs.defaultSyncPaths),
						defaultSyncExclude: splitList(prefs.defaultSyncExclude),
						defaultSyncMaxBytes: gibTextToBytes(prefs.defaultSyncMaxBytes)
					}).then(function(r) {
						if (r && r.ok) {
							if (r.prefs) setPrefs(prefsForUi(r.prefs));
							setPrefsMsg({
								ok: true,
								msg: t("settings.saved")
							});
						} else setPrefsMsg({
							ok: false,
							msg: r && r.error || t("settings.errSave")
						});
					});
				}
				/** 保存单个工作区的写回护栏 + 同步范围（issue #24 护栏 A / issue #28）。 */
				function saveGuard(ws) {
					var g = guards[ws.id] || {
						writeBack: true,
						exclude: "",
						syncPaths: "",
						syncExclude: "",
						syncMaxBytes: ""
					};
					setPrefsMsg(null);
					api("updateWorkspaceGuards", {
						id: ws.id,
						writeBack: g.writeBack !== false,
						writeBackExclude: splitList(g.exclude),
						syncPaths: splitList(g.syncPaths),
						syncExclude: splitList(g.syncExclude),
						syncMaxBytes: gibTextToBytes(g.syncMaxBytes)
					}).then(function(r) {
						if (r && r.ok) {
							setWorkspaces(r.workspaces || []);
							reload();
							setPrefsMsg({
								ok: true,
								msg: t("settings.saved")
							});
						} else setPrefsMsg({
							ok: false,
							msg: r && r.error || t("settings.errSave")
						});
					});
				}
				/** 手动同步（issue #28 第 4 条）：复用已有的 syncDown / syncUp 端点，走该工作区的持久化范围。 */
				function runSync(ws, action) {
					if (syncId) return;
					var down = action === "syncDown";
					setSyncId(ws.id);
					setPrefsMsg({
						ok: true,
						msg: t(down ? "sync.syncing" : "sync.pushing")
					});
					api(action, { id: ws.id }).then(function(r) {
						setSyncId("");
						if (r && r.ok) setPrefsMsg({
							ok: true,
							msg: t(down ? "sync.done" : "sync.upDone")
						});
						else setPrefsMsg({
							ok: false,
							msg: t(down ? "sync.fail" : "sync.upFail") + (r && r.error || "")
						});
					});
				}
				function profileName(id) {
					var p = profiles.find(function(x) {
						return x.id === id;
					});
					return p ? p.name : id;
				}
				function delWs(wsId) {
					api("deleteWorkspace", { id: wsId }).then(function(r) {
						if (r && r.ok) setWorkspaces(r.workspaces || []);
					});
				}
				function save() {
					setBusy(true);
					setResult(null);
					api("saveProfile", Object.assign({}, form, { port: parseInt(form.port, 10) || 22 })).then(function(r) {
						setBusy(false);
						if (r && r.ok) {
							setProfiles(r.profiles || []);
							setForm({
								name: "",
								host: "",
								port: "22",
								user: "",
								authMethod: "key",
								keyPath: "",
								password: "",
								remoteRoot: "~",
								proxyJump: ""
							});
							setResult({
								ok: true,
								msg: t("settings.saved")
							});
						} else setResult({
							ok: false,
							msg: r && r.error || t("settings.errSave")
						});
					});
				}
				function test(p) {
					setBusy(true);
					setResult(null);
					api("testConnection", { id: p.id }).then(function(r) {
						setBusy(false);
						if (r && r.ok) setResult({
							ok: true,
							msg: t("settings.connOk") + "\n" + (r.warning ? r.warning + "\n" : "") + (r.stdout || "")
						});
						else setResult({
							ok: false,
							msg: t("settings.connFail") + (r && r.error || r && r.stderr || "")
						});
					});
				}
				function del(p) {
					api("deleteProfile", { id: p.id }).then(function(r) {
						if (r && r.ok) setProfiles(r.profiles || []);
					});
				}
				function openImport() {
					setImportDlg({
						loading: true,
						hosts: [],
						selected: {}
					});
					api("listSshConfigHosts").then(function(r) {
						if (r && r.ok) {
							var hosts = r.hosts || [];
							var sel = {};
							hosts.forEach(function(h) {
								sel[h.name + "|" + h.hostName] = true;
							});
							setImportDlg({
								loading: false,
								hosts,
								selected: sel
							});
						} else setImportDlg({
							loading: false,
							hosts: [],
							selected: {},
							error: r && r.error || t("settings.noneFound")
						});
					});
				}
				function toggleImport(key) {
					setImportDlg(function(d) {
						var sel = {};
						for (var k in d.selected) sel[k] = d.selected[k];
						sel[key] = !sel[key];
						return Object.assign({}, d, { selected: sel });
					});
				}
				function doImport() {
					if (!importDlg) return;
					var picked = importDlg.hosts.filter(function(h) {
						return importDlg.selected[h.name + "|" + h.hostName];
					});
					setBusy(true);
					var i = 0;
					function next() {
						if (i >= picked.length) {
							setBusy(false);
							setImportDlg(null);
							setResult({
								ok: true,
								msg: t("settings.imported").replace("{n}", String(picked.length))
							});
							reload();
							return;
						}
						var h = picked[i++];
						api("saveProfile", {
							name: h.name,
							host: h.hostName,
							port: h.port || 22,
							user: h.user || "",
							authMethod: "key",
							keyPath: h.identityFile || "",
							password: "",
							remoteRoot: "~",
							proxyJump: h.proxyJump || ""
						}).then(next);
					}
					next();
				}
				return h("div", null, h("p", { className: "rssh-muted" }, t("settings.desc")), profiles.map(function(p) {
					return h("div", {
						key: p.id,
						className: "rssh-card"
					}, h("div", { className: "rssh-title" }, p.name), h("div", { className: "rssh-sub" }, (p.user || "") + "@" + (p.host || "") + ":" + (p.port || 22) + "  [" + (p.authMethod || "key") + "]"), h("div", { className: "rssh-actions" }, h("button", {
						className: "rssh-btn",
						onClick: function() {
							test(p);
						},
						disabled: busy
					}, t("settings.test")), h("button", {
						className: "rssh-btn",
						onClick: function() {
							del(p);
						}
					}, t("common.delete"))));
				}), profiles.length === 0 ? h("div", { className: "rssh-empty" }, t("settings.empty")) : null, workspaces.length > 0 ? h("div", { className: "rssh-card" }, h("div", { className: "rssh-title" }, t("settings.workspaces")), workspaces.map(function(ws) {
					var g = guards[ws.id] || {
						writeBack: true,
						exclude: "",
						syncPaths: "",
						syncExclude: "",
						syncMaxBytes: ""
					};
					return h("div", {
						key: ws.id,
						className: "rssh-card",
						style: { marginBottom: 6 }
					}, h("div", { className: "rssh-title" }, ws.title || ws.id), h("div", { className: "rssh-sub" }, profileName(ws.profileId) + " → " + (ws.remotePath || "")), h("label", {
						className: "rssh-tree-item",
						style: { cursor: "pointer" }
					}, h("input", {
						type: "checkbox",
						checked: g.writeBack !== false,
						onChange: function(e) {
							setGuard(ws.id, "writeBack", !!e.target.checked);
						}
					}), h("span", null, t("settings.wsWriteBack"))), Field({
						label: t("settings.wsWriteBackExclude"),
						value: g.exclude,
						onChange: function(v) {
							setGuard(ws.id, "exclude", v);
						},
						placeholder: "_patch/, *.log, wbdeep/**"
					}), h("div", {
						className: "rssh-muted",
						style: { marginTop: 6 }
					}, t("settings.syncScopeHint")), Field({
						label: t("settings.wsSyncPaths"),
						value: g.syncPaths,
						onChange: function(v) {
							setGuard(ws.id, "syncPaths", v);
						},
						placeholder: ".dsh"
					}), Field({
						label: t("settings.wsSyncExclude"),
						value: g.syncExclude,
						onChange: function(v) {
							setGuard(ws.id, "syncExclude", v);
						},
						placeholder: "data/, *.log"
					}), Field({
						label: t("settings.wsSyncMaxBytes"),
						value: g.syncMaxBytes,
						onChange: function(v) {
							setGuard(ws.id, "syncMaxBytes", v);
						},
						placeholder: "2"
					}), h("div", { className: "rssh-actions" }, h("button", {
						className: "rssh-btn",
						onClick: function() {
							saveGuard(ws);
						}
					}, t("settings.saveGuards")), h("button", {
						className: "rssh-btn",
						onClick: function() {
							runSync(ws, "syncDown");
						},
						disabled: !!syncId
					}, t("sync.down")), h("button", {
						className: "rssh-btn",
						onClick: function() {
							runSync(ws, "syncUp");
						},
						disabled: !!syncId
					}, t("sync.up")), h("button", {
						className: "rssh-btn",
						onClick: function() {
							delWs(ws.id);
						}
					}, t("common.delete"))));
				})) : null, h("div", { className: "rssh-card" }, h("div", { className: "rssh-title" }, t("settings.guards")), h("div", { className: "rssh-muted" }, t("settings.guardsHint")), Field({
					label: t("settings.nodePath"),
					value: prefs.nodePath,
					onChange: function(v) {
						setPref("nodePath", v);
					},
					placeholder: "C:\\Program Files\\nodejs\\node.exe"
				}), h("div", { className: "rssh-row" }, h("span", { className: "rssh-label" }, t("settings.writeBackFailure")), h("select", {
					className: "rssh-select",
					value: prefs.writeBackFailure || "error",
					onChange: function(e) {
						setPref("writeBackFailure", e.target.value);
					}
				}, h("option", { value: "error" }, t("settings.wbError")), h("option", { value: "log" }, t("settings.wbLog")))), h("label", {
					className: "rssh-tree-item",
					style: { cursor: "pointer" }
				}, h("input", {
					type: "checkbox",
					checked: prefs.writeBackFreshness !== false,
					onChange: function(e) {
						setPref("writeBackFreshness", !!e.target.checked);
					}
				}), h("span", null, t("settings.writeBackFreshness"))), h("div", {
					className: "rssh-title",
					style: { marginTop: 10 }
				}, t("settings.syncScope")), Field({
					label: t("settings.defaultSyncPaths"),
					value: prefs.defaultSyncPaths,
					onChange: function(v) {
						setPref("defaultSyncPaths", v);
					},
					placeholder: ".dsh"
				}), Field({
					label: t("settings.defaultSyncExclude"),
					value: prefs.defaultSyncExclude,
					onChange: function(v) {
						setPref("defaultSyncExclude", v);
					},
					placeholder: "data/, *.log"
				}), Field({
					label: t("settings.defaultSyncMaxBytes"),
					value: prefs.defaultSyncMaxBytes,
					onChange: function(v) {
						setPref("defaultSyncMaxBytes", v);
					},
					placeholder: "2"
				}), h("div", { className: "rssh-actions" }, h("button", {
					className: "rssh-btn",
					onClick: savePrefs
				}, t("common.save")))), prefsMsg ? h("div", {
					className: prefsMsg.ok ? "rssh-ok" : "rssh-err",
					style: {
						whiteSpace: "pre-wrap",
						marginTop: 6
					}
				}, prefsMsg.msg) : null, h("div", { className: "rssh-card" }, h("div", { className: "rssh-title" }, t("settings.add")), Field({
					label: t("settings.name"),
					value: form.name,
					onChange: function(v) {
						set("name", v);
					},
					placeholder: t("settings.namePlaceholder")
				}), Field({
					label: t("settings.host"),
					value: form.host,
					onChange: function(v) {
						set("host", v);
					},
					placeholder: t("settings.hostPlaceholder")
				}), Field({
					label: t("settings.port"),
					value: form.port,
					onChange: function(v) {
						set("port", v);
					}
				}), Field({
					label: t("settings.user"),
					value: form.user,
					onChange: function(v) {
						set("user", v);
					},
					placeholder: t("settings.userPlaceholder")
				}), h("div", { className: "rssh-row" }, h("span", { className: "rssh-label" }, t("settings.auth")), h("select", {
					className: "rssh-select",
					value: form.authMethod,
					onChange: function(e) {
						set("authMethod", e.target.value);
					}
				}, h("option", { value: "key" }, t("settings.key")), h("option", { value: "password" }, t("settings.password")))), form.authMethod === "key" ? Field({
					label: t("settings.keyPath"),
					value: form.keyPath,
					onChange: function(v) {
						set("keyPath", v);
					},
					placeholder: t("settings.keyPathPlaceholder")
				}) : null, form.authMethod === "password" ? Field({
					label: t("settings.passwordField"),
					type: "password",
					value: form.password,
					onChange: function(v) {
						set("password", v);
					}
				}) : null, Field({
					label: t("settings.remoteRoot"),
					value: form.remoteRoot,
					onChange: function(v) {
						set("remoteRoot", v);
					},
					placeholder: "~/project"
				}), Field({
					label: t("settings.proxyJump"),
					value: form.proxyJump,
					onChange: function(v) {
						set("proxyJump", v);
					},
					placeholder: "bastion.example.com"
				}), h("div", { className: "rssh-actions" }, h("button", {
					className: "rssh-btn",
					onClick: save,
					disabled: busy
				}, busy ? t("common.processing") : t("common.save")), h("button", {
					className: "rssh-btn",
					onClick: openImport,
					disabled: busy
				}, t("settings.importSshConfig")))), result ? h("div", {
					className: result.ok ? "rssh-ok" : "rssh-err",
					style: {
						whiteSpace: "pre-wrap",
						marginTop: 6
					}
				}, result.msg) : null, importDlg ? h(Modal, {
					open: true,
					onClose: function() {
						if (!busy) setImportDlg(null);
					},
					title: t("settings.importTitle"),
					closeLabel: t("common.close")
				}, importDlg.loading ? h("div", { className: "rssh-muted" }, t("common.loading")) : importDlg.error ? h("div", { className: "rssh-err" }, importDlg.error) : importDlg.hosts.length === 0 ? h("div", { className: "rssh-muted" }, t("settings.noneFound")) : h("div", null, importDlg.hosts.map(function(hh) {
					var key = hh.name + "|" + hh.hostName;
					return h("label", {
						key,
						className: "rssh-tree-item",
						style: { cursor: "pointer" }
					}, h("input", {
						type: "checkbox",
						checked: !!importDlg.selected[key],
						onChange: function() {
							toggleImport(key);
						}
					}), h("span", { className: "rssh-tree-dir" }, hh.name), h("span", { className: "rssh-sub" }, (hh.user || "?") + "@" + hh.hostName + ":" + (hh.port || 22) + (hh.proxyJump ? "  → " + hh.proxyJump : "")));
				}), h("div", {
					className: "rssh-actions",
					style: { marginTop: 8 }
				}, h("button", {
					className: "rssh-btn",
					onClick: doImport,
					disabled: busy
				}, busy ? t("common.processing") : t("common.save")), h("button", {
					className: "rssh-btn",
					onClick: function() {
						setImportDlg(null);
					},
					disabled: busy
				}, t("common.close"))))) : null);
			}
			function apply(ctx) {
				var slots = ctx.slots;
				var locale = ctx.locale;
				try {
					if (typeof globalThis !== "undefined") {
						var fallbackModules = null;
						try {
							if (ctx.modules && typeof ctx.modules.import === "function") fallbackModules = ctx.modules;
						} catch (e) {}
						if (!fallbackModules && ctx.get && typeof ctx.get === "function") try {
							fallbackModules = ctx.get("modules");
						} catch (e) {
							fallbackModules = null;
						}
						if (globalThis.__DSH_MODULES__ === void 0 && fallbackModules === null) {
							var waitModules = 0;
							var waitTimer = setInterval(function() {
								waitModules += 1;
								try {
									var ms = ctx.get && typeof ctx.get === "function" ? ctx.get("modules") : null;
									if (ms && typeof ms.import === "function") {
										globalThis.__DSH_MODULES__ = ms;
										clearInterval(waitTimer);
									}
								} catch (e) {}
								if (globalThis.__DSH_MODULES__ !== void 0 || waitModules > 40) clearInterval(waitTimer);
							}, 250);
						}
						if (!globalThis.__DSH_MODULES__ && fallbackModules && typeof fallbackModules.import === "function") globalThis.__DSH_MODULES__ = fallbackModules;
					}
				} catch (e) {}
				if (locale) {
					ctx.effect(function() {
						return locale.register(NS, {
							zh,
							en
						});
					}, "dsh-remote-ssh: dictionaries");
					i18n.t = locale.bind(NS);
					i18n.subscribe = function(cb) {
						return locale.subscribe(cb);
					};
					i18n.getSnapshot = function() {
						return locale.getSnapshot();
					};
				}
				ctx.effect(function() {
					var el = document.createElement("style");
					el.textContent = CSS;
					document.head.appendChild(el);
					return function() {
						if (el.parentNode) el.parentNode.removeChild(el);
					};
				});
				if (slots) {
					function monitorIconSvg() {
						var NS = "http://www.w3.org/2000/svg";
						var svg = document.createElementNS(NS, "svg");
						svg.setAttribute("viewBox", "0 0 16 16");
						svg.setAttribute("width", "16");
						svg.setAttribute("height", "16");
						svg.setAttribute("fill", "none");
						svg.setAttribute("data-rssh-monitor", "1");
						function add(name, attrs) {
							var n = document.createElementNS(NS, name);
							for (var k in attrs) n.setAttribute(k, attrs[k]);
							svg.appendChild(n);
						}
						add("rect", {
							x: "1.5",
							y: "2.5",
							width: "13",
							height: "9",
							rx: "1",
							stroke: "currentColor",
							"stroke-width": "1.3"
						});
						add("path", {
							d: "M8 11.5v3",
							stroke: "currentColor",
							"stroke-width": "1.3",
							"stroke-linecap": "round"
						});
						add("path", {
							d: "M5.5 14.5h5",
							stroke: "currentColor",
							"stroke-width": "1.3",
							"stroke-linecap": "round"
						});
						return svg;
					}
					function checkCell(btn) {
						var label = i18n.t("settings.nav");
						var text = (btn.textContent || "").trim();
						if (text !== label.trim() || text === "") return false;
						var icon = btn.querySelector("svg");
						if (!icon) return false;
						if (icon.getAttribute("data-rssh-monitor") === "1") return true;
						try {
							icon.parentNode.replaceChild(monitorIconSvg(), icon);
						} catch (e) {}
						return true;
					}
					function checkCellIn(root) {
						try {
							if (root.tagName && String(root.tagName).toLowerCase() === "button") checkCell(root);
							var cells = root.querySelectorAll("button");
							for (var i = 0; i < cells.length; i++) checkCell(cells[i]);
						} catch (e) {}
					}
					function applyRemoteNavIcon() {
						try {
							var buttons = document.querySelectorAll("button");
							for (var i = 0; i < buttons.length; i++) checkCell(buttons[i]);
						} catch (e) {}
					}
					var remoteTitles = /* @__PURE__ */ new Set();
					var remoteRowKeys = /* @__PURE__ */ new Set();
					var watchedRows = [];
					var remoteWorkspaceCount = 0;
					var decoratedRows = 0;
					/** 归一化标题文本：折叠空白（壳层可能插入换行/多空格），供匹配与诊断共用。 */
					function normTitle(s) {
						return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
					}
					/** 镜像目录 basename → { label: 远程目录 basename, remotePath }（issue #9）。 */
					var rootLabels = {};
					function refreshRemoteTitles() {
						api("listWorkspaces").then(function(r) {
							if (!(r && r.ok && Array.isArray(r.workspaces))) return;
							var next = /* @__PURE__ */ new Set();
							var keys = /* @__PURE__ */ new Set();
							remoteWorkspaceCount = r.workspaces.length;
							for (var i = 0; i < r.workspaces.length; i++) {
								var w = r.workspaces[i] || {};
								var t = normTitle(w.title);
								if (t) {
									next.add(t);
									next.add("🌐 " + t);
								}
								var sid = normTitle(w.shellWorkspaceId);
								if (sid) keys.add("workspace:" + sid);
							}
							remoteTitles = next;
							remoteRowKeys = keys;
							refreshRootLabels(r.workspaces);
							swapWorkspaceIconsIn(document.body);
							applyRootLabelsIn(document.body);
						}).catch(function() {});
					}
					/** 地球经纬线组（右下角、无圆盘底色）：线色**跟随主题**（取文件夹 svg 自身的计算色，
					*  取不到时退回 currentColor）；文件夹本体完全保留壳层默认原语（IconFolderOpen16/Close16
					*  原始路径与几何，零改写），仅向 svg 追加本组 —— appendChild 不触碰 React 管理的子节点。
					*  ⚠️ 此前这里硬编码 `stroke="#ffffff"`：在**浅色主题**下白线落在浅色侧边栏上几乎不可见，
					*  是"换一台电脑就看不到地球角标"的一个真实成因（与本文件里的显示器图标统一用 currentColor）。 */
					function globeGridElement(color) {
						var NS = "http://www.w3.org/2000/svg";
						var g = document.createElementNS(NS, "g");
						g.setAttribute("data-rssh-globe", "1");
						g.setAttribute("fill", "none");
						g.setAttribute("stroke", color || "currentColor");
						g.setAttribute("stroke-width", "0.9");
						function add(name, attrs) {
							var n = document.createElementNS(NS, name);
							for (var k in attrs) n.setAttribute(k, attrs[k]);
							g.appendChild(n);
						}
						add("circle", {
							cx: "11.6",
							cy: "11.9",
							r: "3.4"
						});
						add("ellipse", {
							cx: "11.6",
							cy: "11.9",
							rx: "1.6",
							ry: "3.4"
						});
						add("path", { d: "M8.2 11.9h6.8" });
						add("path", { d: "M8.7 9.6c0.9 0.65 1.85 0.97 2.9 0.97s2-0.32 2.9-0.97" });
						add("path", { d: "M8.7 14.2c0.9-0.65 1.85-0.97 2.9-0.97s2 0.32 2.9 0.97" });
						return g;
					}
					/** 取文件夹 svg 的**计算颜色**作为角标颜色：与图标本体同色 → 浅色/深色主题都可见。
					*  透明/取不到时返回 null（由 globeGridElement 退回 currentColor 继承行文本色）。 */
					function iconInkOf(el) {
						try {
							var win = el && el.ownerDocument && el.ownerDocument.defaultView;
							if (!win || !win.getComputedStyle) return null;
							var c = win.getComputedStyle(el).color;
							if (!c) return null;
							if (/^(transparent|rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\))$/i.test(String(c).trim())) return null;
							return c;
						} catch (e) {
							return null;
						}
					}
					/** 幂等应用：React 还原/重建子节点会清掉本组 —— 以 [data-rssh-globe] 子节点
					*  存在性为状态判据（覆盖属性级还原与节点重建），缺席即追加。 */
					function applyFolderGlobe(slotSvg) {
						if (slotSvg.querySelector("[data-rssh-globe]")) return;
						slotSvg.setAttribute("data-rssh-folder-globe", "1");
						slotSvg.appendChild(globeGridElement(iconInkOf(slotSvg)));
						decoratedRows += 1;
					}
					/** 反向自愈（issue #31）：不是远程工作区的行若还带着角标（升级前按标题误标），摘掉它。
					*  否则用户升级后仍会看到本地项目上的地球，只有等 React 重渲染才会消失。 */
					function removeFolderGlobe(slotSvg) {
						try {
							if (!slotSvg || !slotSvg.querySelector) return;
							var g = slotSvg.querySelector("[data-rssh-globe]");
							if (!g) return;
							if (typeof slotSvg.removeChild === "function") slotSvg.removeChild(g);
							else if (g.parentNode && typeof g.parentNode.removeChild === "function") g.parentNode.removeChild(g);
							if (typeof slotSvg.removeAttribute === "function" && slotSvg.getAttribute("data-rssh-folder-globe") === "1") slotSvg.removeAttribute("data-rssh-folder-globe");
							decoratedRows = Math.max(0, decoratedRows - 1);
						} catch (e) {}
					}
					/** 行首槽位里的文件夹 svg（`row > span.slot.folder > svg`）。 */
					function folderSvgOfRow(row) {
						var first = row && row.children && row.children[0];
						return first && first.querySelector ? first.querySelector("svg") : null;
					}
					/** 行 → 原生工作区键（`workspace:<id>`）；旧壳层没有该属性时返回 null。 */
					function rowKeyOfRow(row) {
						try {
							var k = row && row.getAttribute ? row.getAttribute("data-row-key") : null;
							return k && String(k).indexOf("workspace:") === 0 ? String(k) : null;
						} catch (e) {
							return null;
						}
					}
					/** 工作区行集合（root 自身是行时也算进来 —— MutationObserver 常把行本身当新增节点）。 */
					function workspaceRowsIn(root) {
						var list = [];
						try {
							if (!root || !root.querySelectorAll) return list;
							var found = root.querySelectorAll("[data-row-key^=\"workspace:\"]");
							for (var i = 0; i < found.length; i++) list.push(found[i]);
							if (rowKeyOfRow(root) && list.indexOf(root) < 0) list.unshift(root);
						} catch (e) {}
						return list;
					}
					/** 行首 svg 加/摘角标；返回 true 表示这一行加上了。 */
					function markRow(row, want) {
						var svg = folderSvgOfRow(row);
						if (!svg) return false;
						if (want) {
							applyFolderGlobe(svg);
							return true;
						}
						removeFolderGlobe(svg);
						return false;
					}
					/** 精确路径（issue #31）：按 data-row-key 与 remoteRowKeys 对齐。
					*  同名本地项目行键不同 → 不会被标；曾误标的行会在这里被摘掉（自愈）。 */
					function applyRowGlobes(rows) {
						if (!rows || !rows.length) return 0;
						var applied = 0;
						for (var i = 0; i < rows.length; i++) {
							var key = rowKeyOfRow(rows[i]);
							var want = !!key && remoteRowKeys.has(key);
							if (markRow(rows[i], want)) applied += 1;
							if (want) watchRow(rows[i]);
						}
						return applied;
					}
					/** 向上 ≤4 层找到"行"元素（其首个子元素槽位里有 svg）—— 旧壳层回退用。 */
					function ownerRowOf(el) {
						var holder = el;
						for (var hop = 0; hop < 4 && holder && holder.parentElement; hop++) {
							var row = holder.parentElement;
							var first = row.children && row.children[0];
							if (first && first.querySelector && first.querySelector("svg")) return row;
							holder = row;
						}
						return null;
					}
					/** 旧壳层回退：没有 data-row-key 时只能按标题匹配。
					*  ⚠️ 同名行不止一行时**都不标** —— 无法区分哪一行是远程的，宁可漏标也不误标（issue #31）。 */
					function applyByTitle(root) {
						if (!remoteTitles.size) return;
						try {
							var nodes = root.querySelectorAll("span,div,button,a,p,[title],[aria-label]");
							var rowsSeen = [];
							var titlesSeen = [];
							for (var i = 0; i < nodes.length; i++) {
								var el = nodes[i];
								if (el.childElementCount > 2) continue;
								var text = normTitle(el.textContent);
								var hit = remoteTitles.has(text);
								if (!hit) {
									var attr = el.getAttribute ? el.getAttribute("title") || el.getAttribute("aria-label") : null;
									hit = !!attr && remoteTitles.has(normTitle(attr));
								}
								if (!hit) continue;
								var row = ownerRowOf(el);
								if (!row || rowsSeen.indexOf(row) >= 0) continue;
								rowsSeen.push(row);
								titlesSeen.push(normTitle(row.textContent));
							}
							for (var r = 0; r < rowsSeen.length; r++) {
								var same = 0;
								for (var q = 0; q < titlesSeen.length; q++) if (titlesSeen[q] === titlesSeen[r]) same += 1;
								if (same > 1) continue;
								if (markRow(rowsSeen[r], true)) watchRow(rowsSeen[r]);
							}
						} catch (e) {}
					}
					function watchRow(row) {
						for (var i = 0; i < watchedRows.length; i++) if (watchedRows[i] === row) return;
						watchedRows.push(row);
					}
					function recheckWatched() {
						if (remoteRowKeys.size) {
							var rows = workspaceRowsIn(document.body);
							if (rows.length) {
								applyRowGlobes(rows);
								return;
							}
						}
						for (var i = watchedRows.length - 1; i >= 0; i--) {
							var row = watchedRows[i];
							if (!row || !row.isConnected) {
								watchedRows.splice(i, 1);
								continue;
							}
							var svg = folderSvgOfRow(row);
							if (svg) applyFolderGlobe(svg);
						}
					}
					/** 该壳层是否支持行键（首次见到工作区行即置 true，之后永不再按标题猜）。 */
					var shellHasRowKeys = false;
					function swapWorkspaceIconsIn(root) {
						if (!remoteTitles.size && !remoteRowKeys.size) return;
						var rows = workspaceRowsIn(root);
						if (rows.length) {
							shellHasRowKeys = true;
							applyRowGlobes(rows);
							return;
						}
						if (!shellHasRowKeys) {
							var probe = workspaceRowsIn(document.body);
							if (probe.length) {
								shellHasRowKeys = true;
								applyRowGlobes(probe);
								return;
							}
						}
						if (shellHasRowKeys) return;
						applyByTitle(root);
					}
					var globeHealthWarned = false;
					function globeStats(withTitles) {
						var inDom = 0;
						try {
							inDom = document.querySelectorAll("[data-rssh-globe]").length;
						} catch (e) {}
						var s = {
							loaded: true,
							remoteWorkspaces: remoteWorkspaceCount,
							decoratedRows,
							globesInDom: inDom,
							watchedRows: watchedRows.length,
							titleKeys: remoteTitles.size,
							rowKeyKeys: remoteRowKeys.size,
							matchedBy: remoteRowKeys.size ? "rowKey" : "title"
						};
						if (withTitles) {
							try {
								s.titleSamples = Array.prototype.slice.call(remoteTitles).slice(0, 6);
							} catch (e) {}
							try {
								s.rowKeySamples = Array.prototype.slice.call(remoteRowKeys).slice(0, 6);
							} catch (e) {}
						}
						return s;
					}
					function checkGlobeHealth(verbose) {
						try {
							var s = globeStats(true);
							if (s.remoteWorkspaces === 0) {
								if (verbose) console.info("[dsh-remote-ssh] 宿主未返回远程工作区：地球角标与远程功能都未生效（请检查插件版本与 harness 兼容性，或先创建/迁移远程工作区）", s);
								return s;
							}
							if (s.globesInDom === 0 && !globeHealthWarned) {
								globeHealthWarned = true;
								console.warn("[dsh-remote-ssh] 有 " + s.remoteWorkspaces + " 个远程工作区，但工作区行上没找到可加角标的图标：可能是壳层 DOM 结构变化。执行 window.__dshRemoteSshGlobeStats(true) 查看详情", s);
							}
						} catch (e) {}
						return null;
					}
					try {
						if (typeof window !== "undefined") window.__dshRemoteSshGlobeStats = function(withTitles) {
							var s = globeStats(withTitles === true);
							var health = checkGlobeHealth(true);
							console.info("[dsh-remote-ssh] 地球角标自检", s, health ? health : "");
							return s;
						};
					} catch (e) {}
					var watchedRootLabels = [];
					function refreshRootLabels(workspaces) {
						var next = {};
						for (var i = 0; i < (workspaces || []).length; i++) {
							var w = workspaces[i] || {};
							var mirror = String(w.mirrorPath || "").replace(/[\\/]+$/, "");
							var remote = String(w.remotePath || "").replace(/[\\/]+$/, "");
							if (!mirror || !remote) continue;
							var mb = mirror.split(/[\\/]/).pop();
							var rb = remote.split(/[\\/]/).pop();
							if (mb && rb && mb !== rb) next[mb] = {
								label: rb,
								remotePath: remote
							};
						}
						rootLabels = next;
					}
					/** 根行判据：自身或 ≤3 层祖先带内联 padding-left:6px（better-sidebar 根行样式）。 */
					function isRootRow(el) {
						var node = el;
						for (var hop = 0; hop < 3 && node; hop++) {
							var style = node.getAttribute ? node.getAttribute("style") : null;
							if (style && /padding-left:\s*6px/i.test(String(style))) return true;
							node = node.parentElement;
						}
						return false;
					}
					/** 单个标签替换：纯文本 + 命中镜像 basename + 位于根行 → 换成远程目录名。 */
					function fixRootLabel(el) {
						var text = (el.textContent || "").trim();
						if (!text) return false;
						var hit = rootLabels[text];
						if (hit === void 0) return el.getAttribute && el.getAttribute("data-rssh-root-label") === "1";
						if (el.childElementCount > 0) return false;
						if (!isRootRow(el)) return false;
						el.textContent = hit.label;
						if (el.setAttribute) {
							el.setAttribute("data-rssh-root-label", "1");
							el.setAttribute("title", hit.remotePath);
						}
						watchRootLabel(el);
						return true;
					}
					function watchRootLabel(el) {
						for (var i = 0; i < watchedRootLabels.length; i++) if (watchedRootLabels[i] === el) return;
						watchedRootLabels.push(el);
					}
					function recheckRootLabels() {
						for (var i = watchedRootLabels.length - 1; i >= 0; i--) {
							var el = watchedRootLabels[i];
							if (!el || !el.isConnected) {
								watchedRootLabels.splice(i, 1);
								continue;
							}
							fixRootLabel(el);
						}
					}
					function applyRootLabelsIn(root) {
						if (!root || !root.querySelectorAll) return;
						try {
							var nodes = root.querySelectorAll("span,div");
							for (var i = 0; i < nodes.length; i++) fixRootLabel(nodes[i]);
							if (root.nodeType === 1) fixRootLabel(root);
						} catch (e) {}
					}
					ctx.effect(function() {
						if (typeof document === "undefined") return;
						applyRemoteNavIcon();
						refreshRemoteTitles();
						setTimeout(function() {
							checkGlobeHealth(false);
						}, 8e3);
						setTimeout(function() {
							checkGlobeHealth(false);
						}, 25e3);
						var titleTimer = setInterval(refreshRemoteTitles, 3e4);
						var recheckTimer = setInterval(function() {
							recheckWatched();
							recheckRootLabels();
						}, 1e3);
						var timer = null;
						var pendingRoots = null;
						var schedule = function(root) {
							if (root && root.nodeType === 1) (pendingRoots || (pendingRoots = [])).push(root);
							if (timer) return;
							timer = setTimeout(function() {
								timer = null;
								var roots = pendingRoots;
								pendingRoots = null;
								if (document.hidden) return;
								if (roots && roots.length) {
									for (var i = 0; i < roots.length; i++) if (roots[i].isConnected) swapWorkspaceIconsIn(roots[i]);
								} else {
									applyRemoteNavIcon();
									swapWorkspaceIconsIn(document.body);
									applyRootLabelsIn(document.body);
								}
							}, 500);
						};
						var mo = new MutationObserver(function(muts) {
							for (var i = 0; i < muts.length; i++) {
								var added = muts[i].addedNodes;
								for (var j = 0; j < added.length; j++) {
									var node = added[j];
									if (node && node.nodeType === 1 && node.isConnected) {
										checkCellIn(node);
										applyRootLabelsIn(node);
									}
									schedule(node);
								}
							}
						});
						mo.observe(document.body, {
							childList: true,
							subtree: true
						});
						var off = i18n.subscribe(function() {
							schedule(null);
						});
						return function() {
							mo.disconnect();
							if (off) off();
							if (timer) clearTimeout(timer);
							clearInterval(titleTimer);
							clearInterval(recheckTimer);
						};
					}, "dsh-remote-ssh: settings nav monitor icon + tree root label + remote workspace folder-globe icon");
				}
				ctx.effect(function() {
					if (typeof window === "undefined" || typeof window.fetch !== "function") return;
					var nativeFetch = window.fetch.bind(window);
					var mirrors = [];
					function refreshMirrors() {
						api("listWorkspaces").then(function(r) {
							if (r && r.ok && Array.isArray(r.workspaces)) mirrors = r.workspaces.map(function(w) {
								return String(w && w.mirrorPath || "").replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
							}).filter(Boolean);
						}).catch(function() {});
					}
					refreshMirrors();
					var timer = setInterval(refreshMirrors, 3e4);
					function patchedFetch(input, init) {
						var raw = typeof input === "string" ? input : input && input.url;
						if (typeof raw === "string") try {
							var u = new URL(raw, window.location.origin);
							if (u.pathname === "/sidebar/write") {
								var wpath = (u.searchParams.get("path") || "").replace(/\\/g, "/").toLowerCase();
								var wbody = init && init.body;
								if (typeof wbody === "string") for (var wi = 0; wi < mirrors.length; wi++) {
									var wm = mirrors[wi];
									if (wpath === wm || wpath.indexOf(wm + "/") === 0) {
										var wpayload = {
											sessionId: u.searchParams.get("sessionId") || "",
											cwd: u.searchParams.get("cwd") || "",
											path: u.searchParams.get("path") || "",
											content: wbody
										};
										var emRaw = u.searchParams.get("expectedMtimeMs");
										if (emRaw !== null && emRaw !== "") wpayload.expectedMtimeMs = Number(emRaw);
										return nativeFetch(new URL("/remote-ssh/write", window.location.origin).toString(), {
											method: "POST",
											headers: { "content-type": "application/json" },
											body: JSON.stringify(wpayload)
										});
									}
								}
							}
							if (u.pathname === "/sidebar/upload") {
								var dir = (u.searchParams.get("dir") || "").replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
								var cwd = (u.searchParams.get("cwd") || "").replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
								for (var i = 0; i < mirrors.length; i++) {
									var m = mirrors[i];
									if (dir && (dir === m || dir.indexOf(m + "/") === 0) || cwd && (cwd === m || cwd.indexOf(m + "/") === 0)) return nativeFetch(new URL("/remote-ssh/upload" + u.search, window.location.origin).toString(), init);
								}
							}
						} catch (e) {}
						return nativeFetch(input, init);
					}
					window.fetch = patchedFetch;
					return function() {
						clearInterval(timer);
						if (window.fetch === patchedFetch) window.fetch = nativeFetch;
					};
				}, "dsh-remote-ssh: redirect remote-workspace uploads and editor saves");
				ctx.inject(["betterSidebar"], function(bsCtx) {
					var bs = bsCtx.betterSidebar;
					if (!bs || typeof bs.registerTab !== "function") return;
					bsCtx.effect(function() {
						return bs.registerTab({
							id: "remssh:editor",
							title: function() {
								return i18n.t("tabs.files");
							},
							hidden: true,
							dedupeKey: function(tab) {
								return (tab && tab.meta && tab.meta.profileId || "") + "\0" + (tab && tab.path || "");
							},
							icon: function() {
								return h("span", null, "📄");
							},
							component: function(props) {
								return h(RemoteEditor, {
									tab: props && props.tab,
									ctx: props && props.ctx,
									scope: props && props.scope
								});
							}
						});
					});
				});
				if (slots) {
					slots.inject("settings.section", function() {
						return slots.register({
							name: "settings.section",
							id: "remote-ssh",
							order: 200,
							label: function() {
								return i18n.t("settings.nav");
							},
							locale: NS
						}, SettingsSection);
					});
					var flowInject = function() {
						return { workspaces: ctx.get("workspaces") };
					};
					ctx.effect(function() {
						return slots.inject("conversation.hero.workspace.directoryFlow", function() {
							return slots.register({
								name: "conversation.hero.workspace.directoryFlow",
								priority: -100,
								inject: flowInject
							}, RemoteWorkspaceFlow);
						});
					});
					ctx.effect(function() {
						return slots.inject("sidebar.workspaces.directoryFlow", function() {
							return slots.register({
								name: "sidebar.workspaces.directoryFlow",
								priority: -100,
								inject: flowInject
							}, RemoteWorkspaceFlow);
						});
					});
				}
			}
			exports.apply = apply;
			exports.inject = ["slots", "locale"];
			return module.exports;
		};
		// src/client/index.ts
		/** Services required before mounting (union of both client halves). */
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"uiWorkspace",
			"locale"
		];
		/** Instantiate the vendored remote-ssh client plugin exactly once. */
		const remoteSshClient = remote_ssh_factory_generated_default((id) => require(id));
		/** Plugin body: apply both client halves on this bundle's fiber. */
		function apply(ctx) {
			apply$1(ctx);
			remoteSshClient.apply(ctx);
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map