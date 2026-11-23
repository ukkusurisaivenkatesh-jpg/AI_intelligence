import type { Profile, SemanticNetwork } from "./api";

export type DemoProgramme = {
  id: string;
  name: string;
  discipline: string;
  degreeLevel: string;
  duration: string;
  institutionName: "AdmitWise Demo University";
  location: string;
  academicYear: "2026-27 (illustrative)";
  description: string;
  relatedSubjects: string[];
  relatedSkills: string[];
  careerPathways: string[];
  verificationStatus: "DEMO_ONLY";
  dataSource: "Illustrative demonstration data";
};

const demoProgramme = (
  id: string,
  name: string,
  discipline: string,
  degreeLevel: string,
  duration: string,
  description: string,
  relatedSubjects: string[],
  relatedSkills: string[],
  careerPathways: string[],
): DemoProgramme => ({
  id,
  name,
  discipline,
  degreeLevel,
  duration,
  institutionName: "AdmitWise Demo University",
  location: "Pune (illustrative)",
  academicYear: "2026-27 (illustrative)",
  description,
  relatedSubjects,
  relatedSkills,
  careerPathways,
  verificationStatus: "DEMO_ONLY",
  dataSource: "Illustrative demonstration data",
});

export const DEMO_PROGRAMMES: DemoProgramme[] = [
  demoProgramme("demo-cse", "B.E. Computer Science and Engineering", "Computer Science and Engineering", "Undergraduate", "4 years (illustrative)", "Illustrative study of computing systems, software design, and problem solving.", ["Computer Science", "Mathematics", "Physics"], ["Programming", "Problem solving", "Algorithms"], ["Software Developer", "Cybersecurity Analyst"]),
  demoProgramme("demo-it", "B.E. Information Technology", "Information Technology", "Undergraduate", "4 years (illustrative)", "Illustrative study of information systems, networks, and software applications.", ["Information Technology", "Computer Science", "Mathematics"], ["Networking", "Programming", "Systems analysis"], ["Software Developer", "Cybersecurity Analyst"]),
  demoProgramme("demo-aiml", "B.E. Artificial Intelligence and Machine Learning", "Artificial Intelligence and Machine Learning", "Undergraduate", "4 years (illustrative)", "Illustrative study of intelligent systems, data, and computational methods.", ["Artificial Intelligence", "Mathematics", "Computer Science"], ["Programming", "Statistics", "Machine learning concepts"], ["Data Analyst", "Software Developer"]),
  demoProgramme("demo-data-science", "B.Sc. Data Science", "Data Science", "Undergraduate", "3 years (illustrative)", "Illustrative study of data collection, analysis, and communication.", ["Data Science", "Mathematics", "Statistics"], ["Statistics", "Data visualization", "SQL"], ["Data Analyst", "Financial Analyst"]),
  demoProgramme("demo-ece", "B.E. Electronics and Communication Engineering", "Electronics and Communication Engineering", "Undergraduate", "4 years (illustrative)", "Illustrative study of electronic systems, signals, and communication technologies.", ["Electronics", "Physics", "Mathematics"], ["Circuit analysis", "Testing", "Digital systems"], ["Electronics Engineer", "Embedded Systems Developer"]),
  demoProgramme("demo-mechanical", "B.E. Mechanical Engineering", "Mechanical Engineering", "Undergraduate", "4 years (illustrative)", "Illustrative study of mechanical systems, materials, and design methods.", ["Mechanical Engineering", "Physics", "Mathematics"], ["Computer-aided design", "Prototyping", "Mechanics"], ["Design Engineer", "Manufacturing Engineer"]),
  demoProgramme("demo-civil", "B.E. Civil Engineering", "Civil Engineering", "Undergraduate", "4 years (illustrative)", "Illustrative study of structures, materials, and infrastructure planning.", ["Civil Engineering", "Physics", "Mathematics"], ["Structural analysis", "Planning", "Technical drawing"], ["Structural Engineer", "Construction Project Engineer"]),
  demoProgramme("demo-electrical", "B.E. Electrical Engineering", "Electrical Engineering", "Undergraduate", "4 years (illustrative)", "Illustrative study of electrical systems, circuits, and energy concepts.", ["Electrical Engineering", "Physics", "Mathematics"], ["Circuit analysis", "System testing", "Problem solving"], ["Electronics Engineer", "Embedded Systems Developer"]),
  demoProgramme("demo-biotechnology", "B.Sc. Biotechnology", "Biotechnology", "Undergraduate", "3 years (illustrative)", "Illustrative study of biological systems and laboratory research methods.", ["Biotechnology", "Biology", "Chemistry"], ["Laboratory methods", "Research methods", "Data recording"], ["Biotechnology Researcher", "Laboratory Professional"]),
  demoProgramme("demo-bba", "Bachelor of Business Administration", "Business Administration", "Undergraduate", "3 years (illustrative)", "Illustrative study of management, organizations, and business operations.", ["Business", "Economics", "Mathematics"], ["Communication", "Planning", "Data interpretation"], ["Financial Analyst", "Business Analyst"]),
  demoProgramme("demo-bcom", "Bachelor of Commerce", "Commerce", "Undergraduate", "3 years (illustrative)", "Illustrative study of commerce, accounting concepts, and financial records.", ["Commerce", "Accountancy", "Economics"], ["Accounting", "Spreadsheet analysis", "Attention to detail"], ["Accountant", "Financial Analyst"]),
  demoProgramme("demo-bca", "Bachelor of Computer Applications", "Computer Applications", "Undergraduate", "3 years (illustrative)", "Illustrative study of programming, computing applications, and software concepts.", ["Computer Applications", "Computer Science", "Mathematics"], ["Programming", "Software testing", "Problem solving"], ["Software Developer", "Data Analyst"]),
  demoProgramme("demo-bsc-mathematics", "B.Sc. Mathematics", "Mathematics", "Undergraduate", "3 years (illustrative)", "Illustrative study of mathematical reasoning, modelling, and quantitative methods.", ["Mathematics", "Statistics", "Physics"], ["Analytical thinking", "Statistics", "Modelling"], ["Data Analyst", "Financial Analyst"]),
  demoProgramme("demo-bsc-physics", "B.Sc. Physics", "Physics", "Undergraduate", "3 years (illustrative)", "Illustrative study of physical systems, measurement, and experimental methods.", ["Physics", "Mathematics", "Electronics"], ["Measurement", "Data recording", "Analytical thinking"], ["Electronics Engineer", "Laboratory Professional"]),
  demoProgramme("demo-ba-economics", "B.A. Economics", "Economics", "Undergraduate", "3 years (illustrative)", "Illustrative study of economic systems, quantitative reasoning, and policy concepts.", ["Economics", "Mathematics", "Statistics"], ["Data interpretation", "Research", "Communication"], ["Financial Analyst", "Data Analyst"]),
];

export type DemoCatalogueFilters = {
  query?: string;
  institution?: string;
  location?: string;
  discipline?: string;
  status?: string;
};

export function filterDemoProgrammes(
  programmes: DemoProgramme[],
  filters: DemoCatalogueFilters,
): DemoProgramme[] {
  const query = filters.query?.trim().toLocaleLowerCase() || "";
  const institution = filters.institution?.trim().toLocaleLowerCase() || "";
  const location = filters.location?.trim().toLocaleLowerCase() || "";
  const discipline = filters.discipline?.trim().toLocaleLowerCase() || "";
  const status = filters.status?.trim().toLocaleLowerCase() || "";
  return programmes.filter(programme => {
    const searchable = [
      programme.name,
      programme.discipline,
      programme.degreeLevel,
      programme.institutionName,
      programme.location,
      programme.description,
      ...programme.relatedSubjects,
      ...programme.relatedSkills,
      ...programme.careerPathways,
    ].join(" ").toLocaleLowerCase();
    return (!query || searchable.includes(query))
      && (!institution || programme.institutionName.toLocaleLowerCase().includes(institution))
      && (!location || programme.location.toLocaleLowerCase().includes(location))
      && (!discipline || programme.discipline.toLocaleLowerCase().includes(discipline))
      && (!status || status === "demo_only");
  });
}

function profileGoals(profile: Profile): string[] {
  const value = profile.profile?.career_goals ?? profile.profile?.career_goal;
  return (Array.isArray(value) ? value : typeof value === "string" ? [value] : [])
    .filter((goal): goal is string => typeof goal === "string" && goal.trim().length > 0);
}

function includesTerm(values: string[], term: string): boolean {
  const normalizedTerm = term.trim().toLocaleLowerCase();
  return values.some(value => {
    const normalizedValue = value.toLocaleLowerCase();
    return normalizedValue === normalizedTerm
      || (normalizedTerm.length >= 4 && normalizedValue.includes(normalizedTerm))
      || (normalizedValue.length >= 4 && normalizedTerm.includes(normalizedValue));
  });
}

export function rankDemoProgrammes(
  profile: Profile,
  programmes: DemoProgramme[] = DEMO_PROGRAMMES,
): Array<{ programme: DemoProgramme; reasons: string[] }> {
  const interests = profile.interests || [];
  const subjects = Object.keys(profile.subject_marks || {});
  const skills = profile.skills || [];
  const goals = profileGoals(profile);
  return programmes.map(programme => {
    const subjectsMatched = subjects.filter(subject =>
      includesTerm(programme.relatedSubjects, subject)
      || includesTerm([programme.discipline, programme.name], subject),
    );
    const interestsMatched = interests.filter(interest =>
      includesTerm(
        [programme.discipline, programme.name, ...programme.relatedSubjects, ...programme.careerPathways],
        interest,
      ),
    );
    const skillsMatched = skills.filter(skill =>
      includesTerm(programme.relatedSkills, skill),
    );
    const goalsMatched = goals.filter(goal =>
      includesTerm(programme.careerPathways, goal)
      || includesTerm([programme.discipline, programme.name], goal),
    );
    const reasons = [
      subjectsMatched.length ? `Related to your subjects: ${subjectsMatched.join(", ")}` : "",
      interestsMatched.length ? `Matches your interests: ${interestsMatched.join(", ")}` : "",
      skillsMatched.length ? `Uses skills you listed: ${skillsMatched.join(", ")}` : "",
      goalsMatched.length ? `Connects with career preferences: ${goalsMatched.join(", ")}` : "",
    ].filter(Boolean);
    return { programme, reasons };
  }).sort((left, right) =>
    right.reasons.length - left.reasons.length
    || left.programme.name.localeCompare(right.programme.name),
  );
}

export function selectDemoProgrammes(
  ids: string[],
  programmes: DemoProgramme[] = DEMO_PROGRAMMES,
): DemoProgramme[] {
  const selectedIds = new Set(ids);
  return programmes.filter(programme => selectedIds.has(programme.id));
}

export function demoProgrammesForCareer(
  careerName: string,
  relatedDisciplines: string[] = [],
  programmes: DemoProgramme[] = DEMO_PROGRAMMES,
): DemoProgramme[] {
  const normalizedCareer = careerName.toLocaleLowerCase();
  return programmes.filter(programme =>
    programme.careerPathways.some(pathway => pathway.toLocaleLowerCase() === normalizedCareer)
    || relatedDisciplines.some(discipline =>
      programme.discipline.toLocaleLowerCase().includes(discipline.toLocaleLowerCase()),
    ),
  );
}

export function buildDemoSemanticNetwork(): SemanticNetwork {
  const nodes: SemanticNetwork["nodes"] = [];
  const edges: SemanticNetwork["edges"] = [];
  const addedNodes = new Set<string>();
  const addNode = (id: string, label: string, name: string) => {
    if (addedNodes.has(id)) return;
    addedNodes.add(id);
    nodes.push({
      id,
      label,
      name,
      verification_status: "DEMO_ONLY",
      academic_year: "2026-27 (illustrative)",
      data_source: "Illustrative demonstration data",
    });
  };
  for (const programme of DEMO_PROGRAMMES) {
    const programmeNode = `demo-programme:${programme.id}`;
    addNode(programmeNode, "Demo programme", programme.name);
    for (const subject of programme.relatedSubjects) {
      const subjectNode = `demo-subject:${subject.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      addNode(subjectNode, "Demo subject", subject);
      edges.push({
        id: `${programmeNode}--subject--${subjectNode}`,
        source: programmeNode,
        target: subjectNode,
        label: "demo-related subject",
      });
    }
    for (const skill of programme.relatedSkills) {
      const skillNode = `demo-skill:${skill.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      addNode(skillNode, "Demo skill", skill);
      edges.push({
        id: `${programmeNode}--skill--${skillNode}`,
        source: programmeNode,
        target: skillNode,
        label: "demo-related skill",
      });
    }
    for (const pathway of programme.careerPathways) {
      const careerNode = `demo-career:${pathway.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      addNode(careerNode, "Illustrative career pathway", pathway);
      edges.push({
        id: `${programmeNode}--career--${careerNode}`,
        source: programmeNode,
        target: careerNode,
        label: "illustrative pathway",
      });
    }
  }
  return { available: true, academic_year: "2026-27 (illustrative)", nodes, edges };
}

export function semanticNetworkWithDemo(
  network: SemanticNetwork,
  includeDemo: boolean,
): SemanticNetwork {
  if (!includeDemo) return network;
  const demo = buildDemoSemanticNetwork();
  return {
    ...network,
    nodes: [...network.nodes, ...demo.nodes],
    edges: [...network.edges, ...demo.edges],
  };
}
