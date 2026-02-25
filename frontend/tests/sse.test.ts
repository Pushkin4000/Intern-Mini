import { consumeSseStream } from "@/lib/sse";

describe("consumeSseStream", () => {
  it("parses SSE chunks into events", async () => {
    const response = new Response(
      "event: run_started\ndata: {\"message\":\"start\"}\n\n" +
        "event: run_complete\ndata: {\"message\":\"done\"}\n\n",
      { status: 200 }
    );
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    await consumeSseStream(response, (event) => {
      events.push(event);
    });

    expect(events).toHaveLength(2);
    expect(events[0].event).toBe("run_started");
    expect(events[0].data.message).toBe("start");
    expect(events[1].event).toBe("run_complete");
    expect(events[1].data.message).toBe("done");
  });
});
