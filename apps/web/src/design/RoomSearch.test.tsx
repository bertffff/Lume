import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { RoomActions } from "../room/live.js";
import { RoomSearch } from "./RoomSearch.js";

afterEach(() => vi.unstubAllGlobals());

it("searches inside the room and sends a result to the queue once", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ results: [{ title: "Дорога", url: "https://cdn.example.com/road.mp4" }] }), { status: 200 })));
  const addQueue = vi.fn();
  const user = userEvent.setup();
  render(<RoomSearch live={{ addQueue } as unknown as RoomActions} />);
  await user.type(screen.getByTestId("room-search-input"), "дорога{Enter}");
  const add = await screen.findByTestId("room-search-add");
  await user.click(add);
  expect(addQueue).toHaveBeenCalledWith("https://cdn.example.com/road.mp4", "Дорога");
  await waitFor(() => expect(screen.getByTestId("room-search-add")).toBeDisabled());
  expect(addQueue).toHaveBeenCalledTimes(1);
});
