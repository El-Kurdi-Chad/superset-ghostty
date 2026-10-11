import { type RefObject, useLayoutEffect, useState } from "react";
import type { PullRequestActivityLayout } from "../../../../providers/PullRequestActivityLayoutProvider";

/** Below this the rail and its cards give way to folded rows. */
const CARD_MIN_WIDTH_REM = 30;

export function usePullRequestActivityWidthLayout(
	sectionRef: RefObject<HTMLElement | null>,
): PullRequestActivityLayout {
	const [layout, setLayout] = useState<PullRequestActivityLayout>("card");

	useLayoutEffect(() => {
		const section = sectionRef.current;
		if (!section) return;

		const update = () => {
			const rem =
				Number.parseFloat(
					getComputedStyle(document.documentElement).fontSize,
				) || 16;
			setLayout(
				section.clientWidth > 0 &&
					section.clientWidth < CARD_MIN_WIDTH_REM * rem
					? "row"
					: "card",
			);
		};

		update();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(update);
		observer.observe(section);
		return () => observer.disconnect();
	}, [sectionRef]);

	return layout;
}
