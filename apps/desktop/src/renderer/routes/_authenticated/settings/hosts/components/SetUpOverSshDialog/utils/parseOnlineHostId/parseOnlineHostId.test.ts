import { expect, test } from "bun:test";
import { parseOnlineHostId } from "./parseOnlineHostId";

test("reads the host id from the success line, through terminal colors", () => {
	expect(
		parseOnlineHostId(
			"\u001b[32m◇\u001b[39m  sshbox is online\r\nsshbox (d1d6de2a6ecbf27dac6d44b433df7ee1) is online\r\n",
		),
	).toBe("d1d6de2a6ecbf27dac6d44b433df7ee1");
	expect(parseOnlineHostId("Error: Could not connect")).toBeNull();
});
