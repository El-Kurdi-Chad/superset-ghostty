import type {
	V2WorkspacesLiveViewMode,
	V2WorkspacesViewMode,
} from "../../stores/v2WorkspacesFilterStore";

/**
 * The store's next view mode when the mounted page's URL changes, or null to
 * leave it. A link to a view follows it. A bare URL leaves the Archived view
 * for the last live one (the Archived view is somewhere you go, not a layout
 * you keep) and otherwise keeps the user's List/Board choice.
 */
export function resolveViewModeFromSearch(
	searchView: V2WorkspacesViewMode | undefined,
	state: {
		viewMode: V2WorkspacesViewMode;
		liveViewMode: V2WorkspacesLiveViewMode;
	},
): V2WorkspacesViewMode | null {
	if (searchView === undefined) {
		return state.viewMode === "archived" ? state.liveViewMode : null;
	}
	return searchView === state.viewMode ? null : searchView;
}
