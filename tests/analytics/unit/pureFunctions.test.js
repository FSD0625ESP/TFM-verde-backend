const {
    roundTo,
    computeRatePercent,
    buildDateFilterFromQuery,
} = require("../../../services/analyticsService");

describe("analyticsService (unit) - funciones puras", () => {
    test("computeRatePercent: evita NaN/Infinity y retorna 0 si denominator<=0", () => {
        expect(computeRatePercent(1, 0)).toBe(0);
        expect(computeRatePercent(1, -1)).toBe(0);
        expect(computeRatePercent("a", 10)).toBe(0);
    });

    test("computeRatePercent: calcula % y redondea", () => {
        expect(computeRatePercent(1, 2)).toBe(50);
        expect(computeRatePercent(1, 3, 2)).toBe(33.33);
    });

    test("buildDateFilterFromQuery: start/end tienen prioridad sobre period", () => {
        const result = buildDateFilterFromQuery({
            startDate: "2025-01-01T00:00:00.000Z",
            endDate: "2025-01-02T00:00:00.000Z",
            period: "24h",
        });

        expect(result.dateFilter.createdAt.$gte.toISOString()).toBe("2025-01-01T00:00:00.000Z");
        expect(result.dateFilter.createdAt.$lte.toISOString()).toBe("2025-01-02T00:00:00.000Z");
    });

    test("roundTo: no rompe con valores raros", () => {
        expect(roundTo(NaN)).toBe(0);
        expect(roundTo("nope")).toBe(0);
        expect(roundTo(1.005, 2)).toBe(1.01);
    });
});
