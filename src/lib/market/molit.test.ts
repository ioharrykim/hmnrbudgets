import { parseMolitTradeResponse, refreshMarketSnapshotsFromMolit } from "@/lib/market/molit";

const sampleXml = `
<response>
  <body>
    <items>
      <item>
        <dealAmount>85,000</dealAmount>
        <apartment>테스트아파트A</apartment>
        <excluUseAr>59.98</excluUseAr>
        <floor>12</floor>
        <buildYear>2012</buildYear>
      </item>
      <item>
        <dealAmount>91,000</dealAmount>
        <apartment>테스트아파트B</apartment>
        <excluUseAr>74.12</excluUseAr>
        <floor>8</floor>
        <buildYear>2015</buildYear>
      </item>
      <item>
        <dealAmount>95,000</dealAmount>
        <apartment>테스트아파트C</apartment>
        <excluUseAr>84.11</excluUseAr>
        <floor>16</floor>
        <buildYear>2018</buildYear>
      </item>
      <item>
        <dealAmount>102,000</dealAmount>
        <apartment>테스트아파트D</apartment>
        <excluUseAr>84.11</excluUseAr>
        <floor>19</floor>
        <buildYear>2019</buildYear>
      </item>
      <item>
        <dealAmount>110,000</dealAmount>
        <apartment>테스트아파트E</apartment>
        <excluUseAr>84.11</excluUseAr>
        <floor>22</floor>
        <buildYear>2020</buildYear>
      </item>
      <item>
        <dealAmount>116,000</dealAmount>
        <apartment>테스트아파트F</apartment>
        <excluUseAr>84.11</excluUseAr>
        <floor>25</floor>
        <buildYear>2021</buildYear>
      </item>
    </items>
  </body>
</response>
`;

describe("parseMolitTradeResponse", () => {
  it("parses deal amounts into KRW and filters 50m2+ homes", () => {
    const records = parseMolitTradeResponse(sampleXml, "11440", "202602");

    expect(records).toHaveLength(6);
    expect(records[0]?.amountKrw).toBe(850_000_000);
    expect(records[0]?.lawdCode).toBe("11440");
  });
});

describe("refreshMarketSnapshotsFromMolit", () => {
  it("builds reviewed snapshots from MOLIT responses", async () => {
    const originalKey = process.env.OPEN_DATA_API_KEY;
    process.env.OPEN_DATA_API_KEY = "test-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => sampleXml,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await refreshMarketSnapshotsFromMolit("2026-03-10");

    expect(result.markets).toHaveLength(6);
    expect(result.markets.every((market) => market.reviewStatus === "reviewed")).toBe(true);
    expect(result.reviews).toHaveLength(6);
    expect(result.markets[0]?.priceBandMid).toBeGreaterThan(0);

    process.env.OPEN_DATA_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });
});
