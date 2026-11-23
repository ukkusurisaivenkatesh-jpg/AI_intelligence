import { describe, expect, it } from "vitest";
import {
  DEMO_PROGRAMMES,
  demoProgrammesForCareer,
  filterDemoProgrammes,
  rankDemoProgrammes,
  selectDemoProgrammes,
  semanticNetworkWithDemo,
} from "./demoCatalogue";
import type { SemanticNetwork } from "./api";

describe("demonstration programme catalogue", () => {
  it("contains distinct illustrative examples with no admission criteria", () => {
    expect(DEMO_PROGRAMMES).toHaveLength(15);
    expect(new Set(DEMO_PROGRAMMES.map(programme => programme.id)).size).toBe(15);
    expect(DEMO_PROGRAMMES.every(programme =>
      programme.verificationStatus === "DEMO_ONLY"
      && programme.dataSource === "Illustrative demonstration data"
      && programme.institutionName === "AdmitWise Demo University"
      && programme.duration.includes("illustrative")
      && programme.location.includes("illustrative")
      && !("annualFee" in programme)
      && !("minimumPercentage" in programme)
      && !("entranceRequirements" in programme),
    )).toBe(true);
    expect(DEMO_PROGRAMMES.map(programme => programme.discipline)).toEqual(expect.arrayContaining([
      "Computer Science and Engineering",
      "Information Technology",
      "Artificial Intelligence and Machine Learning",
      "Data Science",
      "Electronics and Communication Engineering",
      "Mechanical Engineering",
      "Civil Engineering",
      "Electrical Engineering",
      "Biotechnology",
      "Business Administration",
      "Commerce",
      "Computer Applications",
      "Mathematics",
      "Physics",
      "Economics",
    ]));
  });

  it("filters demonstration records by query, discipline, institution, location, and demo status", () => {
    expect(filterDemoProgrammes(DEMO_PROGRAMMES, { query: "data science" }).map(item => item.id))
      .toContain("demo-data-science");
    expect(filterDemoProgrammes(DEMO_PROGRAMMES, { discipline: "Biotechnology" }).map(item => item.id))
      .toEqual(["demo-biotechnology"]);
    expect(filterDemoProgrammes(DEMO_PROGRAMMES, { institution: "AdmitWise Demo University" })).toHaveLength(15);
    expect(filterDemoProgrammes(DEMO_PROGRAMMES, { location: "Pune" })).toHaveLength(15);
    expect(filterDemoProgrammes(DEMO_PROGRAMMES, { status: "VERIFIED" })).toHaveLength(0);
    expect(filterDemoProgrammes(DEMO_PROGRAMMES, { status: "DEMO_ONLY" })).toHaveLength(15);
  });

  it("ranks suggestions using actual profile interests, subjects, skills, and career goals", () => {
    const ranked = rankDemoProgrammes({
      subject_marks: { "Computer Science": 88 },
      entrance_scores: {},
      interests: ["Data Science"],
      aptitude: {},
      skills: ["SQL"],
      profile: { career_goal: "Data Analyst" },
    });

    expect(ranked[0].programme.id).toBe("demo-data-science");
    expect(ranked[0].reasons).toEqual(expect.arrayContaining([
      expect.stringContaining("Data Science"),
      expect.stringContaining("SQL"),
      expect.stringContaining("Data Analyst"),
    ]));
    expect(JSON.stringify(ranked)).not.toMatch(/suitability|probability|eligible/i);
  });

  it("selects demonstration programmes for local comparison and connects careers", () => {
    const selected = selectDemoProgrammes(["demo-cse", "demo-it"]);
    expect(selected.map(programme => programme.id)).toEqual(["demo-cse", "demo-it"]);
    expect(selected.every(programme => programme.verificationStatus === "DEMO_ONLY")).toBe(true);
    expect(selected.every(programme => !("annualFee" in programme) && !("minimumPercentage" in programme))).toBe(true);
    expect(demoProgrammesForCareer("Software Developer").map(programme => programme.id))
      .toContain("demo-cse");
  });

  it("only adds DEMO_ONLY graph nodes when demonstration view is selected", () => {
    const base: SemanticNetwork = {
      available: true,
      academic_year: "2026-27",
      nodes: [{ id: "official-1", label: "Programme", name: "Official listing", verification_status: "PENDING_VERIFICATION" }],
      edges: [],
    };

    expect(semanticNetworkWithDemo(base, false)).toBe(base);
    const withDemo = semanticNetworkWithDemo(base, true);
    const demoProgrammeNodes = withDemo.nodes.filter(node => node.label === "Demo programme");
    expect(demoProgrammeNodes).toHaveLength(15);
    expect(demoProgrammeNodes.every(node => node.verification_status === "DEMO_ONLY")).toBe(true);
    expect(withDemo.edges.every(edge => !/eligible|admission requirement/i.test(edge.label))).toBe(true);
  });
});
